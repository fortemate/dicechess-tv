"""Exercise gameplay preferences with real remote input and unmodified rolls."""
import importlib.util
import json
import time
import sys
sys.dont_write_bytecode = True
from pathlib import Path
spec = importlib.util.spec_from_file_location('settings_smoke', Path(__file__).with_name('settings-smoke.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
h = s.h
checks = []
change, enter, leave, restart, choose, human_move = s.change, s.enter, s.leave, s.restart, s.choose, s.human_move

def full():
    """Return the latest complete settings report, including selected row."""
    return [e['detail'] for e in h.events('AndroidSettings') if e['event'] == 'state'][-1]

def row(index):
    """Select a row using D-pad events and observed navigation state."""
    while full()['index'] != index:
        change(20)

try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    h.open_home()
    enter()
    row(2)
    change(21)
    row(3)
    change(22)
    change(22)
    assert full()['turnHotseat'] is True
    row(1)
    start = full()['highlights']
    for _ in range(4):
        change(22)
    assert full()['highlights'] == start
    change(23)
    chosen = full()['highlights']
    h.snapshot('settings.png')
    restart()
    enter()
    assert full()['highlights'] == chosen and full()['turnHotseat'] and not full()['autoSelect']
    leave()
    state = choose('hotseat')
    if state['overlay']['kind'] == 'confirm':
        h.press(20)
        state = h.press(23)
    state = human_move()
    saved = state['game']
    h.return_home(state)
    enter()
    row(1)
    change(21)
    chosen = full()['highlights']
    restart()
    state = choose('resume')
    assert state['game'] == saved
    assert state['settings']['highlights'] == chosen
    h.snapshot('board.png')
    checks.append('four highlight choices, switch directions, restart and exact rolled-game preservation')
    # Real moves reach a turn with Black at the bottom.
    for _ in range(40):
        state = h.wait()
        if state['view']['side'] == 'b':
            assert state['flipped']
            break
        if state['game']['phase'] == 'move':
            h.move(state)
        else:
            time.sleep(0.8)
            h.press(23)
    else:
        raise AssertionError('No Black turn')
    h.snapshot('black-bottom.png')
    checks.append('shared turn-board orientation follows the next player')
    # Find an actual sole legal move with auto-play still off.
    for _ in range(100):
        state = human_move()
        if len(state['view']['legal']) == 1:
            break
        h.move(state)
    else:
        raise AssertionError('No sole move reached through normal play')
    saved = state['game']
    h.return_home(state)
    enter()
    row(2)
    change(23)
    assert full()['autoSelect']
    restart()
    enter()
    assert full()['autoSelect']
    leave()
    before = len(h.events())
    choose('resume')
    advanced = h.wait(before, lambda s: s['game']['revision'] > saved['revision'])
    assert advanced['game']['id'] == saved['id']
    h.snapshot('automatic-move.png')
    checks.append('persisted auto-play executes a sole legal move without game-screen keys')
    h.return_home(advanced)
    enter()
    row(2)
    change(21)
    row(3)
    change(21)
    row(1)
    while full()['highlights'] != 'standard':
        change(22)
    leave()
    print(json.dumps({'passed': checks}, indent=2))
finally:
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2))
    (h.out / 'events.json').write_text(json.dumps(h.events(), indent=2))
    (h.out / 'settings.json').write_text(json.dumps(h.events('AndroidSettings'), indent=2))
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
