"""Check shared opponent cards, remote navigation and exact saved-game recovery."""
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

try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    h.open_home()
    h.configure_play_as('ask')
    state = s.choose('hotseat')
    if state['overlay']['kind'] == 'confirm':
        h.press(20)
        state = h.press(23)
    state = s.human_move()
    saved = state['game']
    h.return_home(state)
    state = s.choose('computer')
    assert state['overlay']['kind'] == 'opponent' and state['overlay']['index'] == 0
    for index in range(3):
        assert state['overlay']['index'] == index
        h.snapshot(f'card-{index}.png')
        state = h.press(22)
    assert state['overlay']['index'] == 0
    state = h.press(21)
    assert state['overlay']['index'] == 2
    state = h.press(20)
    assert state['overlay']['index'] == 0
    state = h.press(19)
    assert state['overlay']['index'] == 2
    state = h.press(23)
    assert state['overlay']['kind'] == 'colour'
    state = h.press(4)
    assert state['overlay']['kind'] == 'opponent'
    before = len(h.events('AndroidHome'))
    h.key(4)
    h.home_wait(before)
    state = s.choose('resume')
    assert state['game'] == saved
    h.return_home(state)
    s.restart()
    state = s.choose('resume')
    assert state['game'] == saved
    h.return_home(state)
    checks.append('all three shared cards, four directions, OK/Back and exact rolled-game recovery after cancel and force-stop')
    state = s.choose('computer')
    state = h.choose_bot(state, 0, 1)
    assert state['game']['mode'] == 'random' and state['game']['human'] == 'w'
    state = s.human_move()
    saved = state['game']
    h.snapshot('rolly-badge.png')
    h.return_home(state)
    s.restart()
    state = s.choose('resume')
    assert state['game'] == saved
    h.snapshot('rolly-restored.png')
    h.return_home(state)
    checks.append('Rolly card starts the chosen side; badge and exact bot-game recovery after force-stop')
    print(json.dumps({'passed': checks}, indent=2))
finally:
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2))
    (h.out / 'events.json').write_text(json.dumps(h.events(), indent=2))
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
