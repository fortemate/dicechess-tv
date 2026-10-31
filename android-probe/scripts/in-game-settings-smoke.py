"""Verify in-game Settings through real remote input without injecting games or preferences."""
import importlib.util
import json
import math
import sys
import time
from pathlib import Path
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('settings_smoke', Path(__file__).with_name('settings-smoke.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
h = s.h
checks = []


def full():
    """Read the latest fresh complete in-game Settings report."""
    result = [e['detail'] for e in h.events('AndroidSettings') if e['event'] == 'state'][-1]
    assert not result['error'] and result.get('from') == 'game', result
    return result


def change(code):
    """Await both the shared game reducer and the panel's resulting report."""
    before = len(h.events('AndroidSettings'))
    state = h.press(code)
    s.settings_wait(before)
    return state


def row(index):
    """Select a Settings row using observed remote navigation."""
    while full()['index'] != index: change(20)


def enter(state):
    """Open the last shared game-menu item with Up from Resume game."""
    if state['focus']['selected']: state = h.press(4)
    if state['overlay']['kind'] != 'menu': state = h.press(4)
    while state['overlay']['index'] != 0: state = h.press(20)
    state = h.press(19)
    assert state['overlay']['index'] == (6 if state['game']['mode'] == 'hotseat' else 5)
    before = len(h.events('AndroidSettings'))
    state = h.press(23)
    s.settings_wait(before)
    assert state['overlay'] == {'kind': 'settings', 'index': 0, 'from': 'menu'}
    assert full()['index'] == 0
    return state


def leave(saved):
    """Back returns to the Settings menu row, then to the unchanged game."""
    state = h.press(4)
    assert state['overlay'] == {'kind': 'menu', 'index': 6 if saved['mode'] == 'hotseat' else 5}
    assert state['game'] == saved
    state = h.press(4)
    assert state['overlay']['kind'] == 'none' and state['game'] == saved
    return state


def level(name, index, volume, on=True):
    """Set a remembered audio level through its canonical mute and step controls."""
    row(index)
    if full()[name]['on']: change(23)
    change(22)
    for _ in range(volume - 1): change(22)
    if not on: change(23)
    assert full()[name] == {'on': on, 'volume': volume}


def event(prefix, since, predicate, timeout=25):
    """Await fresh decoder/control evidence while rejecting audio errors."""
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        events = h.events(prefix)[since:]
        assert not [e for e in events if e['event'] in ('error', 'timeout')], events
        found = [e for e in events if predicate(e)]
        if found: return found[-1]
        time.sleep(0.1)
    raise AssertionError(f'Missing {prefix} event: {events[-10:]}')


def partial(black=False):
    """Play normal moves until a human has spent a die and can still move."""
    end = time.monotonic() + 120
    while time.monotonic() < end:
        state = s.human_move()
        state = h.move(state)
        if state['game']['phase'] == 'move' and (not black or state['view']['side'] == 'b'):
            return state
    raise AssertionError('No real partial turn reached')


def accept(state):
    """Confirm replacement through the existing Cancel/Yes screen."""
    if state['overlay']['kind'] == 'confirm':
        h.press(20)
        state = h.press(23)
    return state

try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    h.open_home()
    # Normalize automatic play and rotation through the ordinary home panel.
    s.enter(4); s.change(21); s.change(20); s.change(20); s.change(21); s.leave()
    state = accept(s.choose('hotseat'))
    fresh = state['game']
    enter(state)
    level('voices', 2, 4)
    row(7)
    while full()['host'] != 'off': change(22)
    while full()['host'] != 'rolly': change(22)
    voices = len(h.events('AndroidVoices'))
    state = leave(fresh)
    event('AndroidVoices', voices, lambda e: e['event'] == 'requested' and e['detail']['id'].startswith('host_') and math.isclose(e['detail']['gain'], 10 ** (-18 / 20), rel_tol=0.01))
    event('AndroidVoices', voices, lambda e: e['event'] == 'playing' and e['detail']['id'].startswith('host_'))
    state = partial(black=True)
    saved = state['game']
    assert not state['flipped']
    enter(state)
    before = len(h.events('AndroidMusic'))
    level('music', 0, 4)
    gain = 10 ** (-18 / 20)
    event('AndroidMusic', before, lambda e: e['event'] == 'volume' and e['detail']['file'].endswith('clear_space.mp3') and math.isclose(e['detail']['gain'], gain, rel_tol=0.03))
    level('sound', 1, 4, False)
    level('voices', 2, 4, False)
    row(3)
    while full()['highlights'] != 'enhanced': change(22)
    row(4); change(21)
    row(5)
    while full()['playAs'] != 'b': change(22)
    row(6); change(22)
    row(7)
    while full()['host'] != 'rolly': change(22)
    assert h.wait()['flipped'] and h.wait()['game'] == saved
    h.snapshot('in-game-settings.png')
    state = leave(saved)
    assert state['settings']['highlights'] == 'enhanced' and state['flipped']
    before = len(h.events('AndroidEffects'))
    state = h.move(state)
    time.sleep(0.7)
    assert not [e for e in h.events('AndroidEffects')[before:] if e['event'] == 'requested']
    saved = state['game']
    checks.append('all eight rows apply in the mounted friend game; Back restores menu focus; exact spent dice survive; live mute suppresses the next move')

    enter(state)
    level('sound', 1, 4)
    level('voices', 2, 4)
    state = leave(saved)
    effects = len(h.events('AndroidEffects'))
    state = s.human_move()
    state = h.move(state)
    event('AndroidEffects', effects, lambda e: e['event'] == 'requested' and math.isclose(e['detail']['gain'], 10 ** (-18 / 20), rel_tol=0.01))
    saved = state['game']
    enter(state)
    h.key(3)
    h.adb('shell', 'am', 'start', '-n', f'{h.package}/.MainActivity')
    time.sleep(0.8)
    state = leave(saved)
    enter(state)
    s.restart()
    state = s.choose('resume')
    assert state['game'] == saved and state['settings']['highlights'] == 'enhanced'
    enter(state)
    assert full()['music'] == {'on': True, 'volume': 4} and full()['voices'] == {'on': True, 'volume': 4}
    assert full()['sound'] == {'on': True, 'volume': 4} and full()['playAs'] == 'b'
    state = leave(saved)
    h.return_home(state)
    checks.append('live effects and host speech use persisted levels without remounting the game; Home and process death retain the exact friend save')

    state = s.choose('computer')
    state = accept(h.press(23))  # Rolly; persisted Black skips side selection.
    assert state['game']['human'] == 'b'
    state = partial()
    saved = state['game']
    enter(state)
    row(5)
    while full()['playAs'] != 'w': change(22)
    row(3)
    while full()['highlights'] != 'high-contrast': change(22)
    time.sleep(1)
    assert h.wait()['game'] == saved and saved['human'] == 'b'
    state = leave(saved)
    assert state['game']['human'] == 'b' and state['settings']['playAs'] == 'w'
    h.return_home(state)
    state = s.choose('computer')
    assert state['overlay']['kind'] == 'opponent'
    state = accept(h.press(23))
    assert state['game']['human'] == 'w'
    state = s.human_move()
    saved = state['game']
    enter(state)
    s.restart()
    state = s.choose('resume'); assert state['game'] == saved
    h.return_home(state)
    checks.append('bot Settings preserve a partial turn and human side; Play as changes only the next game; bot save survives restart')

    state = accept(s.choose('hotseat'))
    for _ in range(100):
        state = s.human_move()
        if len(state['view']['legal']) == 1: break
        h.move(state)
    else: raise AssertionError('No real sole legal move')
    saved = state['game']
    enter(state)
    row(4); change(22)
    time.sleep(0.6)
    assert h.wait()['game'] == saved, 'auto-play must wait while Settings is open'
    h.press(4)
    before = len(h.events())
    h.key(4)
    state = h.wait(before, lambda s: s['game']['revision'] > saved['revision'])
    assert state['game']['id'] == saved['id']
    h.snapshot('automatic-move.png')
    enter(state)
    row(4); change(21)
    row(6); change(21)
    row(3)
    while full()['highlights'] != 'standard': change(22)
    state = leave(h.wait()['game'])
    h.return_home(state)
    checks.append('Auto-play only move pauses in Settings and applies on return without game-screen OK presses')
    print(json.dumps({'passed': checks}, indent=2))
finally:
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2))
    for prefix in ('AndroidHotseat', 'AndroidSettings', 'AndroidMusic', 'AndroidEffects', 'AndroidVoices'):
        (h.out / f'{prefix}.json').write_text(json.dumps(h.events(prefix), indent=2))
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
