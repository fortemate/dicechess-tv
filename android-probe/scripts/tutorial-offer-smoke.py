"""Exercise Thinkle onboarding with real remote input and separate upgrade/fresh profiles.

prepare-upgrade runs on the previous APK and records a real existing game.
upgrade runs after install -r and compares that exact game and every preference.
fresh clears only the dedicated DiceChessTVOnboarding emulator's probe data.
No saved games, preferences, rolls or tutorial positions are injected.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import time

parser = argparse.ArgumentParser(add_help=False)
parser.add_argument('--phase', required=True, choices=['prepare-upgrade', 'upgrade', 'fresh'])
mode, remaining = parser.parse_known_args()
sys.argv = [sys.argv[0], *remaining]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('settings_smoke', Path(__file__).with_name('settings-smoke.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
h = s.h
checks = []


def wait(prefix, event, since=0, predicate=lambda value: True, timeout=30):
    """Require a fresh event from the requested screen or service."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        observed = h.events(prefix)[since:]
        assert not [e for e in observed if e['event'].endswith('error') or e['event'] == 'timeout'], observed
        found = [e['detail'] for e in observed if e['event'] == event and predicate(e.get('detail'))]
        if found: return found[-1]
        time.sleep(0.1)
    raise AssertionError(f'Missing {prefix}/{event}: {h.events(prefix)[-6:]}')


def launch():
    """Launch without choosing or answering anything on the player's behalf."""
    h.adb('shell', 'am', 'start', '-n', f'{h.package}/.MainActivity')


def restart_home():
    """A normal process restart must not show an answered offer."""
    h.adb('shell', 'am', 'force-stop', h.package)
    before = len(h.events('AndroidTutorialOffer'))
    home = h.open_home()
    assert not h.events('AndroidTutorialOffer')[before:], h.events('AndroidTutorialOffer')[before:]
    return home


def preferences():
    """Read all independent preferences through the normal Settings route."""
    before = len(h.events('AndroidSettings'))
    s.enter()
    state = wait('AndroidSettings', 'state', before)
    s.leave()
    return {k: v for k, v in state.items() if k not in ('index', 'error', 'from')}


def resume():
    """Resume the actual current game from the ordinary menu."""
    return s.choose('resume')


def visible(name):
    """Prove the fresh native offer, including Thinkle and both options."""
    remote_path = '/sdcard/dicechess-tutorial-offer.xml'
    h.adb('shell', 'rm', '-f', remote_path)
    h.adb('shell', 'uiautomator', 'dump', remote_path)
    xml = h.adb('shell', 'cat', remote_path)
    for value in ('THINKLE', 'Your teacher', 'Learn to play', 'Skip', 'New to Dice Chess'):
        assert value in xml, (value, xml)
    (h.out / f'{name}.xml').write_text(xml)
    h.snapshot(f'{name}.png')


def fresh():
    """Reset only the isolated onboarding profile, never the upgrade/game profile."""
    avd = h.adb('emu', 'avd', 'name').splitlines()[0].strip()
    assert avd == 'DiceChessTVOnboarding', f'Refusing to clear {avd}; use the dedicated onboarding AVD'
    h.adb('shell', 'am', 'force-stop', h.package)
    assert 'Success' in h.adb('shell', 'pm', 'clear', h.package)
    h.adb('logcat', '-c')
    launch()
    assert wait('AndroidTutorialOffer', 'state')['index'] == 0
    assert not h.events('AndroidHome') and not h.events(), 'Offer must precede home/game services'
    time.sleep(0.5)  # Wait for the native TV focus target after the first commit.


def answer(code):
    """Answer through a completed remote press and await its persisted transition."""
    before = len(h.events('AndroidTutorialOffer'))
    h.key(code)
    return wait('AndroidTutorialOffer', 'answered', before)


try:
    if mode.phase == 'prepare-upgrade':
        h.adb('shell', 'am', 'force-stop', h.package)
        h.adb('logcat', '-c')
        h.open_home()
        state = resume()
        assert state['game']['phase'] == 'move' and state['game']['moves'], state['game']
        h.return_home(state)
        (h.out / 'upgrade-baseline.json').write_text(json.dumps({'game': state['game'], 'preferences': preferences()}, indent=2))
        checks.append('previous APK: recorded the real partial turn and all preferences without injecting data')

    elif mode.phase == 'upgrade':
        baseline = json.loads((h.out / 'upgrade-baseline.json').read_text())
        restart_home()
        state = resume()
        assert state['game'] == baseline['game']
        h.return_home(state)
        assert preferences() == baseline['preferences']
        before = len(h.events('AndroidTutorial'))
        h.home_select('learn')
        wait('AndroidTutorial', 'state', before, lambda detail: 'tutorial 1/6' in detail)
        home_before = len(h.events('AndroidHome'))
        h.key(4); h.home_wait(home_before)
        state = resume()
        assert state['game'] == baseline['game']
        h.return_home(state)
        restart_home()
        state = resume()
        assert state['game'] == baseline['game']
        h.return_home(state)
        checks.append('upgrading a returning profile without an offer answer bypasses onboarding, preserves the exact partial turn and every preference, and keeps manual lessons available across restart')

    else:
        fresh()
        visible('first-launch-thinkle')
        wait('AndroidVoices', 'completed', predicate=lambda detail: detail['id'] == 'thinkle_tutor_offer_1')
        wait('AndroidVoices', 'playing', predicate=lambda detail: detail['id'] == 'thinkle_tutor_offer_2')
        wait('AndroidVoices', 'completed', predicate=lambda detail: detail['id'] == 'thinkle_tutor_offer_2')
        before = len(h.events('AndroidTutorialOffer'))
        h.key(20)
        assert wait('AndroidTutorialOffer', 'state', before)['index'] == 1
        h.key(3); launch(); time.sleep(0.8)
        before = len(h.events('AndroidTutorialOffer'))
        h.key(19)
        assert wait('AndroidTutorialOffer', 'state', before)['index'] == 0
        h.adb('shell', 'am', 'force-stop', h.package)
        h.adb('logcat', '-c'); launch()
        assert wait('AndroidTutorialOffer', 'state')['index'] == 0
        time.sleep(0.5)
        checks.append('fresh profile shows Thinkle and both choices before home; both voice clips complete; Home/return preserves remote control and an unanswered restart offers again')

        voices_before = len(h.events('AndroidVoices'))
        assert answer(23) == 'learn'
        wait('AndroidTutorial', 'state', predicate=lambda detail: 'tutorial 1/6' in detail)
        wait('AndroidVoices', 'disposed', voices_before)
        home_before = len(h.events('AndroidHome'))
        h.key(4); home = h.home_wait(home_before)
        assert not any(i['id'] == 'resume' for i in home['items'])
        assert not any(e['event'] == 'playing' and e['detail'].get('id', '').startswith('thinkle_tutor_offer_') for e in h.events('AndroidVoices')[voices_before:])
        home = restart_home()
        assert any(i['id'] == 'learn' for i in home['items'])
        checks.append('Learn to play opens lesson one, Back returns home without creating a save, and the persisted answer suppresses the next launch')

        fresh()
        before = len(h.events('AndroidTutorialOffer'))
        h.key(20)
        assert wait('AndroidTutorialOffer', 'state', before)['index'] == 1
        home_before = len(h.events('AndroidHome'))
        assert answer(23) == 'skip'
        h.home_wait(home_before)
        restart_home()
        checks.append('Skip returns home and remains answered after process restart')

        fresh()
        pid = h.adb('shell', 'pidof', h.package).strip()
        home_before = len(h.events('AndroidHome'))
        assert answer(4) == 'skip'
        home = h.home_wait(home_before)
        assert h.adb('shell', 'pidof', h.package).strip() == pid
        restart_home()
        checks.append('Back answers once and returns home without closing the app; the choice survives restart')

    print(json.dumps({'passed': checks}, indent=2))
finally:
    (h.out / f'{mode.phase}-checks.json').write_text(json.dumps({'passed': checks}, indent=2))
    for prefix in ('AndroidTutorialOffer', 'AndroidTutorial', 'AndroidHome', 'AndroidHotseat', 'AndroidVoices'):
        (h.out / f'{mode.phase}-{prefix}.json').write_text(json.dumps(h.events(prefix), indent=2))
    (h.out / f'{mode.phase}-logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
