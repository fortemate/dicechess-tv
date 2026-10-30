"""Verify Play as persistence and new-game behavior with real remote input."""
import importlib.util
import json
import sys
from pathlib import Path
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('settings_smoke', Path(__file__).with_name('settings-smoke.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
h = s.h
checks = []

def latest():
    """Read the complete Settings report after checking storage errors."""
    s.settings_wait()
    return [e['detail'] for e in h.events('AndroidSettings') if e['event'] == 'state'][-1]

def opponent(choice):
    """Choose Rolly; Ask additionally requires an explicit Black selection."""
    state = s.choose('computer')
    assert state['overlay']['kind'] == 'opponent'
    state = h.press(23)
    if choice == 'ask':
        assert state['overlay']['kind'] == 'colour'
        h.snapshot('ask-side.png')
        h.press(20)
        h.press(20)
        state = h.press(23)
    else:
        assert state['overlay']['kind'] != 'colour'
    return state

def accept(state):
    """Confirm a replacement only through the normal confirmation screen."""
    if state['overlay']['kind'] == 'confirm':
        assert state['overlay']['index'] == 0
        h.press(20)
        state = h.press(23)
    return state

try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    h.open_home()
    h.configure_play_as('w')
    state = accept(opponent('w'))
    assert state['game']['human'] == 'w'
    state = s.human_move()
    saved = state['game']
    h.return_home(state)
    for choice in ('ask', 'random', 'w', 'b'):
        h.configure_play_as(choice)
        s.restart()
        s.enter()
        assert latest()['playAs'] == choice
        s.change(20); s.change(20); s.change(20)
        assert latest()['index'] == 3
        h.snapshot(f'settings-{choice}.png')
        s.leave()
        state = s.choose('resume')
        assert state['game'] == saved and state['settings']['playAs'] == choice
        h.return_home(state)
        state = opponent(choice)
        assert state['overlay']['kind'] == 'confirm' and state['game'] == saved
        before = len(h.events('AndroidHome'))
        h.key(23)  # Cancel remains the default.
        h.home_wait(before)
        state = s.choose('resume')
        assert state['game'] == saved
        h.return_home(state)
    checks.append('all four choices persist after force-stop and preserve the exact current White game, roll and canceled replacements')
    for choice in ('w', 'b', 'random', 'ask'):
        h.configure_play_as(choice)
        state = accept(opponent(choice))
        human = state['game']['human']
        assert human in ('w', 'b')
        if choice != 'random': assert human == ('b' if choice == 'ask' else choice)
        assert state['game']['id'] != saved['id']
        h.snapshot(f'new-{choice}.png')
        h.return_home(h.wait())
    checks.append('White, Black and Random skip the side menu; Ask requires it; confirmed new games use the chosen side')
    h.configure_play_as('ask')
    print(json.dumps({'passed': checks}, indent=2))
finally:
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2))
    (h.out / 'events.json').write_text(json.dumps(h.events(), indent=2))
    (h.out / 'settings.json').write_text(json.dumps(h.events('AndroidSettings'), indent=2))
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
