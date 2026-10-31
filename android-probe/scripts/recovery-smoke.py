"""Exercise actual render failures and recovery with real games and remote input."""
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


def recovery(since=0, index=0):
    """Await a fresh report from Vega's mounted recovery screen."""
    end = time.monotonic() + 20
    while time.monotonic() < end:
        found = [e for e in h.events('AndroidRecovery')[since:] if e['event'] == 'state' and e['detail'] == f'overlay recovery#{index}']
        if found: return found[-1]
        time.sleep(0.1)
    raise AssertionError(f'No Recovery {index}: {h.events("AndroidRecovery")[-6:]}')


def visible(name):
    """Confirm the active native fallback surface instead of trusting old log events."""
    path = '/sdcard/dicechess-recovery.xml'
    h.adb('shell', 'rm', '-f', path)
    h.adb('shell', 'uiautomator', 'dump', path)
    xml = h.adb('shell', 'cat', path)
    assert 'content-desc="Game recovery"' in xml and 'Something went wrong' in xml, xml
    (h.out / f'{name}.xml').write_text(xml)
    h.snapshot(f'{name}.png')


def audio(prefix, since, event):
    """Require a fresh service/player teardown event."""
    end = time.monotonic() + 15
    while time.monotonic() < end:
        observed = h.events(prefix)[since:]
        assert not [e for e in observed if e['event'] in ('error', 'timeout')], observed
        found = [e for e in observed if e['event'] == event]
        if found: return found[-1]
        time.sleep(0.1)
    raise AssertionError(f'Missing {prefix} {event}: {observed[-8:]}')


def fault():
    """Request an explicit diagnostic render throw while keeping the current game untouched."""
    before = len(h.events('AndroidRecovery'))
    effects = len(h.events('AndroidEffects'))
    voices = len(h.events('AndroidVoices'))
    music = len(h.events('AndroidMusic'))
    pid = h.adb('shell', 'pidof', h.package).strip()
    h.adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'dicechess-probe://diagnostics/recovery', '-n', f'{h.package}/.MainActivity')
    recovery(before)
    assert h.adb('shell', 'pidof', h.package).strip() == pid, 'render failure must not restart the process'
    assert [e for e in h.events('AndroidRecovery')[before:] if e['event'] == 'error' and 'Requested diagnostic render failure' in e['detail']]
    audio('AndroidEffects', effects, 'disposed')
    audio('AndroidVoices', voices, 'disposed')
    audio('AndroidMusic', music, 'released')
    return before


def key(code, index):
    """Navigate the real shared fallback and wait for its new selection."""
    before = len(h.events('AndroidRecovery'))
    h.key(code)
    recovery(before, index)


def menu():
    """Accept the default preserving choice and await a fresh home mount."""
    before = len(h.events('AndroidHome'))
    h.key(23)
    result = h.home_wait(before)
    assert result['selected'] == 'resume', result
    return result


def partial():
    """Reach a real human turn with at least one spent die and one remaining move."""
    end = time.monotonic() + 120
    while time.monotonic() < end:
        state = h.move(s.human_move())
        if state['game']['phase'] == 'move': return state
    raise AssertionError('No real partial turn')


def accept(state):
    """Replace the disposable probe game only through Cancel/Yes confirmation."""
    if state['overlay']['kind'] == 'confirm':
        h.press(20)
        state = h.press(23)
    return state


def preferences():
    """Read independent persisted preferences through the normal home panel."""
    before = len(h.events('AndroidSettings'))
    s.enter()
    s.settings_wait(before)
    result = [e['detail'] for e in h.events('AndroidSettings')[before:] if e['event'] == 'state'][-1]
    result = {k: v for k, v in result.items() if k not in ('index', 'from', 'error')}
    s.leave()
    return result

try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    h.open_home()
    # Normalize auto-play and Music using the ordinary Settings controls.
    s.enter()
    detail = [e['detail'] for e in h.events('AndroidSettings') if e['event'] == 'state'][-1]
    if not detail['music']['on']: s.change(23)
    for _ in range(4): s.change(20)
    s.change(21)
    s.leave()
    state = accept(s.choose('hotseat'))
    state = partial()
    saved = state['game']
    fault()
    visible('friend-recovery')
    key(20, 1); key(19, 0)
    menu()
    state = s.choose('resume')
    assert state['game'] == saved
    state = h.move(state)
    assert state['game']['id'] == saved['id'] and state['game']['revision'] > saved['revision']
    h.return_home(state)
    checks.append('a real render throw keeps the process alive, disposes failed-screen audio, releases music and preserves an exact friend partial turn; normal play resumes')

    h.configure_play_as('ask')
    state = h.choose_bot(s.choose('computer'), 0, 1)
    state = partial()
    saved = state['game']
    disposed = len(h.events())
    fault()
    assert [e for e in h.events()[disposed:] if e['event'] == 'bot-disposed']
    menu()
    state = s.choose('resume')
    assert state['game'] == saved
    state = h.move(state)
    h.return_home(state)
    expected_preferences = preferences()
    state = s.choose('resume')
    saved = state['game']
    checks.append('bot worker disposal and exact bot partial-turn recovery; a fresh mounted game accepts subsequent moves without resetting preferences')

    fault()
    key(22, 1)
    visible('fresh-selected')
    before = len(h.events('AndroidHome'))
    h.key(23)
    home = h.home_wait(before)
    assert not home['migrating'] and not any(i['id'] == 'resume' for i in home['items']), home
    assert preferences() == expected_preferences
    state = s.choose('hotseat')
    assert state['overlay']['kind'] == 'none' and state['game']['id'] != saved['id']
    state = partial()
    saved = state['game']
    checks.append('confirmed Start fresh clears only the current slot, keeps every preference, suppresses legacy re-import and permits a new game')

    fault()
    cut = len(h.events('AndroidMusic'))
    h.key(3)
    h.adb('shell', 'am', 'start', '-n', f'{h.package}/.MainActivity')
    time.sleep(0.8)
    visible('recovery-home-return')
    assert not [e for e in h.events('AndroidMusic')[cut:] if e['event'] == 'playing']
    key(20, 1); key(19, 0)
    h.key(4)
    top = h.adb('shell', 'dumpsys', 'activity', 'activities')
    resumed = [line for line in top.splitlines() if 'mResumedActivity:' in line or 'topResumedActivity=' in line]
    assert resumed and all(h.package not in line for line in resumed), resumed
    h.adb('shell', 'am', 'force-stop', h.package)
    h.open_home()
    state = s.choose('resume')
    assert state['game'] == saved
    h.return_home(state)
    checks.append('Home/return retains a responsive silent Recovery; Back leaves the activity; a normal cold launch restores the exact saved game')
    print(json.dumps({'passed': checks}, indent=2))
finally:
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2))
    for prefix in ('AndroidRecovery', 'AndroidHome', 'AndroidHotseat', 'AndroidMusic', 'AndroidEffects', 'AndroidVoices'):
        (h.out / f'{prefix}.json').write_text(json.dumps(h.events(prefix), indent=2))
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
