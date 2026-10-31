"""Verify host preferences, shared commentary and unchanged games with real remote events."""
import importlib.util
import json
import sys
import time
from pathlib import Path
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('settings_smoke', Path(__file__).with_name('settings-smoke.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
h = s.h
checks = []


def setting():
    """Read the complete Settings state after the caller's fresh-state wait."""
    return [e['detail'] for e in h.events('AndroidSettings') if e['event'] == 'state'][-1]


def configure(choice):
    """Reach the Host row and change it using only normal remote keys."""
    s.enter()
    for _ in range(7): s.change(20)
    assert setting()['index'] == 7
    for _ in range(4):
        if setting()['host'] == choice: break
        s.change(22)
    assert setting()['host'] == choice
    s.change(21)
    assert setting()['host'] != choice
    s.change(23)
    assert setting()['host'] == choice
    h.snapshot(f'settings-{choice}.png')
    s.leave()


def host_wait(since, predicate):
    """Await this action's commentary visibility without consuming old reports."""
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        states = [e['detail'] for e in h.events('AndroidHost')[since:] if e['event'] == 'state']
        if states and predicate(states[-1]): return states[-1]
        time.sleep(0.05)
    raise AssertionError(f'No expected host state: {states}')


def new_friend():
    """Create a friend game through its replacement confirmation."""
    state = s.choose('hotseat')
    if state['overlay']['kind'] == 'confirm':
        h.press(20)
        state = h.press(23)
    return state

try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    h.open_home()
    state = new_friend()
    state = s.human_move()
    saved = state['game']
    h.return_home(state)
    for choice in ('rolly', 'thinkle', 'off', 'prowla'):
        configure(choice)
        s.restart()
        s.enter()
        assert setting()['host'] == choice
        s.leave()
        state = s.choose('resume')
        assert state['game'] == saved and state['settings']['host'] == choice
        h.return_home(state)
    checks.append('all four host choices survive force-stop and preserve the exact rolled friend game')
    for choice in ('prowla', 'rolly', 'thinkle', 'off'):
        configure(choice)
        before = len(h.events('AndroidHost'))
        state = new_friend()
        shown = host_wait(before, lambda v: v['host'] == choice and v['visible'] == (choice != 'off'))
        if choice != 'off':
            assert shown['line']['host'] == choice and shown['line']['text']
        h.snapshot(f'host-{choice}.png')
        before = len(h.events('AndroidHost'))
        state = h.press(4)
        host_wait(before, lambda v: not v['visible']) if choice != 'off' else None
        assert state['overlay']['kind'] == 'menu'
        h.return_home(state)
    checks.append('each host shows its own shared portrait/line in a new friend game; Off and game menus show no commentary')
    configure('prowla')
    h.configure_play_as('ask')
    before = len(h.events('AndroidHost'))
    state = h.choose_bot(s.choose('computer'), 0, 1)
    host_wait(before, lambda v: not v['visible'])
    state = s.human_move()
    saved = state['game']
    h.return_home(state)
    configure('off')
    s.restart()
    state = s.choose('resume')
    assert state['game'] == saved and state['settings']['host'] == 'off'
    h.return_home(state)
    checks.append('host preference changes preserve the exact current bot game; bot games show no host commentary')
    configure('prowla')
    print(json.dumps({'passed': checks}, indent=2))
finally:
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2))
    (h.out / 'host-events.json').write_text(json.dumps(h.events('AndroidHost'), indent=2))
    (h.out / 'game-events.json').write_text(json.dumps(h.events(), indent=2))
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
