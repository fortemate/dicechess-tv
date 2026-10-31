"""Verify music roles, persistence, ducking, lifecycle and unchanged games by remote input."""
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
MENU = 'warm_anticipation.mp3'
CALM = 'clear_space.mp3'


def full():
    """Read the complete Settings state after a fresh transition."""
    return [e['detail'] for e in h.events('AndroidSettings') if e['event'] == 'state'][-1]


def music_wait(since, predicate, timeout=25):
    """Await music evidence while rejecting service and decoder failures."""
    deadline = time.monotonic() + timeout
    observed = []
    while time.monotonic() < deadline:
        observed = h.events('AndroidMusic')[since:]
        failures = [e for e in observed if e['event'] == 'error' or (e['event'] == 'engine' and any(t in e['detail'] for t in ('failed', 'not released', 'not created')))]
        assert not failures, failures
        matches = [e for e in observed if predicate(e)]
        if matches: return matches[-1]
        time.sleep(0.1)
    raise AssertionError(f'No expected music event: {observed[-12:]}')


def playing(file):
    """Match a native music decoder reaching playback for one track."""
    return lambda e: e['event'] == 'playing' and e['detail']['file'].endswith(file)


def configure(on=True):
    """Set remembered music level 4 through normal Settings controls."""
    s.enter()
    assert full()['index'] == 0
    if full()['music']['on']: s.change(23)
    s.change(22)
    for _ in range(3): s.change(22)
    if not on: s.change(23)
    assert full()['music'] == {'on': on, 'volume': 4}
    h.snapshot('music-settings.png')
    s.leave()


def friend():
    """Start a new friend game through its replacement confirmation."""
    state = s.choose('hotseat')
    if state['overlay']['kind'] == 'confirm':
        h.press(20)
        state = h.press(23)
    return state

try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    h.open_home()
    # First install uses Vega defaults; repeated runs retain their prior settings.
    before = len(h.events('AndroidMusic'))
    configure(True)
    music_wait(0, playing(MENU))
    state = friend()
    music_wait(before, playing(CALM))
    state = s.human_move()
    saved = state['game']
    h.return_home(state)
    configure(False)
    s.restart()
    s.enter()
    assert full()['music'] == {'on': False, 'volume': 4}
    s.leave()
    before = len(h.events('AndroidMusic'))
    state = s.choose('resume')
    assert state['game'] == saved
    time.sleep(0.7)
    assert not [e for e in h.events('AndroidMusic')[before:] if e['event'] == 'playing']
    h.return_home(state)
    checks.append('menu/calm decoder playback; mute and remembered volume survive force-stop and preserve the exact friend roll')

    enabled = len(h.events('AndroidMusic'))
    configure(True)
    base = 10 ** (-18 / 20) * 10 ** (-0.1 / 20)
    music_wait(enabled, lambda e: e['event'] == 'volume' and e['detail']['file'].endswith(MENU) and math.isclose(e['detail']['gain'], base, rel_tol=0.03))
    # Explicitly enable voices through their row without changing the game.
    s.enter(2)
    if not full()['voices']['on']: s.change(23)
    s.leave()
    before = len(h.events('AndroidMusic'))
    tutorial_before = len(h.events('AndroidTutorial'))
    h.home_select('learn')
    deadline = time.monotonic() + 15
    while len(h.events('AndroidTutorial')) == tutorial_before:
        assert time.monotonic() < deadline
        time.sleep(0.1)
    music_wait(before, lambda e: e['event'] == 'ducked' and e['detail'] is True)
    music_wait(before, lambda e: e['event'] == 'volume' and e['detail']['file'].endswith(MENU) and 0 < e['detail']['gain'] < base * 0.45)
    cut = len(h.events('AndroidMusic'))
    home_before = len(h.events('AndroidHome'))
    h.key(4); h.home_wait(home_before)
    music_wait(cut, lambda e: e['event'] == 'ducked' and e['detail'] is False)
    music_wait(cut, lambda e: e['event'] == 'volume' and e['detail']['file'].endswith(MENU) and e['detail']['gain'] > base * 0.9)
    state = s.choose('resume'); assert state['game'] == saved
    h.return_home(state)
    checks.append('native music gain ducks by the shared speech curve and recovers after tutorial exit without changing the friend game')

    h.configure_play_as('ask')
    state = h.choose_bot(s.choose('computer'), 0, 1)
    state = s.human_move()
    saved = state['game']
    before = len(h.events('AndroidMusic'))
    h.key(3)
    music_wait(before, lambda e: e['event'] == 'suspended' and e['detail'] is True)
    music_wait(before, lambda e: e['event'] == 'released')
    restart = len(h.events('AndroidMusic'))
    h.adb('shell', 'am', 'start', '-n', f'{h.package}/.MainActivity')
    music_wait(restart, playing(CALM))
    assert h.wait()['game'] == saved
    h.snapshot('resumed-game.png')
    h.return_home(h.wait())
    configure(False)
    s.restart()
    state = s.choose('resume'); assert state['game'] == saved
    h.return_home(state)
    configure(True)
    checks.append('Home releases music, foreground restores the game theme; persisted changes preserve the exact bot rolled turn')

    state = friend()
    time.sleep(3)  # Let the incoming calm theme settle before ending the game.
    state = h.press(4)
    h.press(20)
    state = h.press(23)
    assert state['overlay']['kind'] == 'confirm'
    h.press(20)
    before = len(h.events('AndroidMusic'))
    state = h.press(23)
    assert state['game']['phase'] == 'ended'
    role = music_wait(before, lambda e: e['event'] == 'role' and e['detail']['role'] == 'menu' and e['detail']['pauseMs'] == 2500)
    h.return_home(state)
    resumed = music_wait(before, playing(MENU))
    assert resumed['at'] - role['at'] >= 2450, (role, resumed)
    checks.append('ending a real game holds menu music for the Vega result-jingle gap, including immediate return home')
    print(json.dumps({'passed': checks}, indent=2))
finally:
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2))
    (h.out / 'music-events.json').write_text(json.dumps(h.events('AndroidMusic'), indent=2))
    (h.out / 'voice-events.json').write_text(json.dumps(h.events('AndroidVoices'), indent=2))
    (h.out / 'game-events.json').write_text(json.dumps(h.events(), indent=2))
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
