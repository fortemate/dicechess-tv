"""Verify native speech, remote settings, cancellation and exact game recovery."""
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
    """Read Settings after its caller has awaited a fresh report."""
    return [e['detail'] for e in h.events('AndroidSettings') if e['event'] == 'state'][-1]


def voice_wait(event, since, prefix=''):
    """Wait for a decoder/service event and reject all playback failures."""
    deadline = time.monotonic() + 35
    observed = []
    while time.monotonic() < deadline:
        observed = h.events('AndroidVoices')[since:]
        assert not [e for e in observed if e['event'] in ('error', 'timeout')], observed
        found = [e for e in observed if e['event'] == event and (not prefix or e['detail'].get('id', '').startswith(prefix))]
        if found: return found[-1]
        time.sleep(0.1)
    raise AssertionError(f'No voice {event}/{prefix}: {observed}')


def level4(on=True):
    """Set remembered voice level 4 through Left/Right/OK on the voice row."""
    s.enter()
    s.change(20)
    if full()['voices']['on']: s.change(23)
    s.change(22)
    for _ in range(3): s.change(22)
    assert full()['voices'] == {'on': True, 'volume': 4}
    if not on: s.change(23)
    assert full()['voices'] == {'on': on, 'volume': 4}
    h.snapshot('voices-settings.png')
    s.leave()


def host_choice(choice):
    """Choose a host through its real Settings row."""
    s.enter()
    for _ in range(6): s.change(20)
    assert full()['index'] == 6
    for _ in range(4):
        if full()['host'] == choice: break
        s.change(22)
    assert full()['host'] == choice
    s.leave()


def friend():
    """Start a friend game through the replacement confirmation."""
    state = s.choose('hotseat')
    if state['overlay']['kind'] == 'confirm':
        h.press(20)
        state = h.press(23)
    return state


def tutorial():
    """Enter the actual shared tutorial through home."""
    before = len(h.events('AndroidTutorial'))
    h.home_select('learn')
    deadline = time.monotonic() + 15
    while len(h.events('AndroidTutorial')) == before:
        assert time.monotonic() < deadline
        time.sleep(0.1)

try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    h.open_home()
    state = friend()
    state = s.human_move()
    saved = state['game']
    h.return_home(state)
    level4(False)
    s.restart()
    s.enter()
    assert full()['voices'] == {'on': False, 'volume': 4}
    s.leave()
    state = s.choose('resume')
    assert state['game'] == saved
    h.return_home(state)
    before = len(h.events('AndroidVoices'))
    tutorial()
    time.sleep(1)
    assert not [e for e in h.events('AndroidVoices')[before:] if e['event'] == 'requested']
    before_home = len(h.events('AndroidHome'))
    h.key(4); h.home_wait(before_home)
    state = s.choose('resume'); assert state['game'] == saved
    h.return_home(state)
    checks.append('voice mute/remembered level survive force-stop; muted tutorial keeps captions and the exact friend game')

    level4()
    s.enter()
    sound_on = full()['sound']['on']
    if sound_on: s.change(23)
    s.leave()
    host_choice('prowla')
    before = len(h.events('AndroidVoices'))
    state = friend()
    playing = voice_wait('playing', before)
    requested = voice_wait('requested', before)
    assert '_host_' in playing['detail']['id']
    assert math.isclose(requested['detail']['gain'], 10 ** (-18 / 20))
    h.snapshot('host-speaking.png')
    cut = len(h.events('AndroidVoices'))
    state = h.press(4)
    voice_wait('released', cut)
    h.return_home(state)
    checks.append('host voice reaches native playback at level 4 with effects muted; game menu stops speech')

    for host in ('rolly', 'thinkle'):
        host_choice(host)
        before = len(h.events('AndroidVoices'))
        state = friend()
        voice_wait('playing', before, 'host_' if host == 'rolly' else host + '_host_')
        h.snapshot(host + '-host-speaking.png')
        cut = len(h.events('AndroidVoices'))
        state = h.press(4)
        voice_wait('released', cut)
        h.return_home(state)
    host_choice('prowla')
    checks.append('Prowla, Rolly and Thinkle host recordings reach native playback and stop in menus')

    h.configure_play_as('ask')
    for index, name in enumerate(('rolly', 'grabby', 'rampage')):
        before = len(h.events('AndroidVoices'))
        state = h.choose_bot(s.choose('computer'), index, 1)
        voice_wait('playing', before, name + '_intro_')
        h.snapshot(name + '-speaking.png')
        cut = len(h.events('AndroidVoices'))
        state = h.press(4)
        voice_wait('released', cut)
        state = h.press(23)  # Resume the current game.
        state = s.human_move()
        saved = state['game']
        h.return_home(state)
    checks.append('all three opponents speak their canonical intros; Back stops speech without changing game control')

    level4(False)
    s.restart()
    state = s.choose('resume'); assert state['game'] == saved
    h.return_home(state)
    level4()
    before = len(h.events('AndroidVoices'))
    tutorial()
    first = voice_wait('playing', before)['detail']['id']
    voice_wait('completed', before, first)
    deadline = time.monotonic() + 35
    while True:
        states = [e for e in h.events('AndroidVoices')[before:] if e['event'] == 'playing' and e['detail']['id'] != first]
        if states: break
        assert time.monotonic() < deadline
        time.sleep(0.1)
    cut = len(h.events('AndroidVoices'))
    h.key(23)  # Change the tutorial point while its next line is speaking.
    voice_wait('released', cut)
    voice_wait('playing', cut)
    h.snapshot('tutorial-speaking.png')
    cut = len(h.events('AndroidVoices'))
    h.key(3)
    voice_wait('released', cut)
    assert voice_wait('suspended', cut)['detail'] is True
    before = len(h.events('AndroidVoices'))
    h.adb('shell', 'am', 'start', '-n', f'{h.package}/.MainActivity')
    voice_wait('playing', before)
    cut = len(h.events('AndroidVoices'))
    before_home = len(h.events('AndroidHome'))
    h.key(4); h.home_wait(before_home)
    voice_wait('disposed', cut)
    state = s.choose('resume'); assert state['game'] == saved
    h.return_home(state)
    checks.append('tutorial advances speech only after decoder completion; step change, Home and exit cancel playback; exact bot game survives')

    s.enter()
    assert full()['voices'] == {'on': True, 'volume': 4}
    if full()['sound']['on'] != sound_on: s.change(23)
    s.leave()
    assert not [e for e in h.events('AndroidVoices') if e['event'] in ('error', 'timeout')]
    print(json.dumps({'passed': checks}, indent=2))
finally:
    for prefix, name in (('AndroidVoices', 'voices'), ('AndroidSettings', 'settings'), ('AndroidHotseat', 'game')):
        (h.out / f'{name}-events.json').write_text(json.dumps(h.events(prefix), indent=2))
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2))
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
