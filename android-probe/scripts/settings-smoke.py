"""Verify real remote sound preferences, process recovery and unchanged games.

Keeps app data; replaces the current probe game through its normal UI.
"""
import importlib.util
import json
import math
from pathlib import Path
import sys
import time
import xml.etree.ElementTree as ET
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('remote', Path(__file__).with_name('hotseat-smoke.py'))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
checks = []


def settings_wait(since=0):
    """Read the settings report emitted by the requested transition."""
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        events = h.events('AndroidSettings')[since:]
        assert not [e for e in events if e['event'].endswith('error')], events
        states = [e['detail'] for e in events if e['event'] == 'state']
        if states:
            assert not states[-1]['error']
            return states[-1]['sound']
        time.sleep(0.1)
    raise AssertionError('No settings report')


def enter(index=0):
    """Open Settings through the home menu and await a fresh report."""
    before = len(h.events('AndroidSettings'))
    h.home_select('settings')
    result = settings_wait(before)
    for _ in range(index): result = change(20)
    return result


def change(code):
    """Send a remote key and await its resulting settings report."""
    before = len(h.events('AndroidSettings'))
    h.key(code)
    return settings_wait(before)


def visible(name):
    """A fresh UI dump proves the active Settings surface, not an old log."""
    path = '/sdcard/dicechess-settings-smoke.xml'
    h.adb('shell', 'rm', '-f', path)
    h.adb('shell', 'uiautomator', 'dump', path)
    xml = h.adb('shell', 'cat', path)
    (h.out / f'{name}.xml').write_text(xml)
    assert any(n.get('package') == h.package and n.get('content-desc') == 'Settings'
               for n in ET.fromstring(xml).iter('node'))


def level(volume):
    """Set a level through remote keys regardless of previous preferences."""
    if settings_wait()['on']:
        change(23)
    state = change(22)
    for _ in range(volume - 1):
        state = change(22)
    assert state == {'on': True, 'volume': volume}


def leave():
    """Return home with Back and verify restored Settings focus."""
    before = len(h.events('AndroidHome'))
    h.key(4)
    home = h.home_wait(before)
    assert home['selected'] == 'settings'


def choose(item):
    """Open a home item and wait for its game state."""
    before = len(h.events())
    h.home_select(item)
    return h.wait(before)


def restart():
    """Force-stop and relaunch without clearing persistent app data."""
    h.adb('shell', 'am', 'force-stop', h.package)
    h.open_home()


def human_move():
    """Acknowledge empty bot rolls, then wait for a human move without driving the bot cursor."""
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        state = h.wait()
        assert state['game']['phase'] != 'ended', state
        empty_bot_roll = state['view']['bot'] and state['game']['phase'] == 'handoff' and not state['game']['moves']
        if (not state['view']['bot'] or empty_bot_roll) and not state['guarded']:
            if state['game']['phase'] == 'move':
                return state
            h.press(23)
        time.sleep(0.8)
    raise AssertionError('No playable human turn within 60 seconds')


def main():
    """Verify sound controls, lifecycle persistence and preservation of friend and bot games."""
    try:
        h.adb('shell', 'am', 'force-stop', h.package)
        h.adb('logcat', '-c')
        h.open_home()
        enter(1)
        assert not h.events(), 'Settings must not mount a game or worker'
        level(5)
        for code in (19, 20):
            h.key(code)
            visible(f'settings-{code}')
            assert settings_wait() == {'on': True, 'volume': 5}
        assert change(21) == {'on': True, 'volume': 4}
        assert change(22) == {'on': True, 'volume': 5}
        h.snapshot('settings-volume.png')
        assert change(23) == {'on': False, 'volume': 5}
        restart()  # No Back, blur or lifecycle save is needed.
        assert enter(1) == {'on': False, 'volume': 5}
        h.snapshot('settings-muted-restored.png')
        assert change(23) == {'on': True, 'volume': 5}
        restart()
        assert enter(1) == {'on': True, 'volume': 5}
        checks.append('directions, mute and remembered volume survive immediate process death')

        h.key(3)
        h.adb('shell', 'am', 'start', '-n', f'{h.package}/.MainActivity')
        time.sleep(0.8)
        visible('settings-home-return')
        leave()
        checks.append('Home/return keeps Settings visible; Back restores the selected home row')

        h.configure_play_as('ask')
        for mode in ('hotseat', 'bot'):
            state = choose('hotseat' if mode == 'hotseat' else 'computer')
            if mode == 'bot':
                state = h.choose_bot(state, 0, 1)
            elif state['overlay']['kind'] == 'confirm':
                h.press(20)
                state = h.press(23)
            # Obtain a real rolled turn without injecting positions or randomness.
            state = human_move()
            saved = state['game']
            h.return_home(state)
            enter(1)
            level(4)
            change(23)
            restart()
            state = choose('resume')
            assert state['game'] == saved
            before = len(h.events('AndroidEffects'))
            state = h.move(state)
            h.silent_since(before)
            h.return_home(state)
            assert enter(1) == {'on': False, 'volume': 4}
            change(23)
            leave()
            before = len(h.events('AndroidEffects'))
            choose('resume')
            # Make another real human action with sound enabled.
            h.move(human_move())
            requests = [e['detail'] for e in h.events('AndroidEffects')[before:] if e['event'] == 'requested']
            assert all(math.isclose(e['gain'], 10 ** (-18 / 20)) for e in requests), requests
            h.audio_wait('playing', before)
            h.return_home(h.wait())
            checks.append(f'{mode}: settings preserve the exact roll; restored mute suppresses effects and level 4 reaches playback')
        h.snapshot('home-seven-items.png')
        assert not [e for e in h.events('AndroidEffects') if e['event'] in ('error', 'timeout')]
        print(json.dumps({'passed': checks}, indent=2))
    finally:
        for prefix, name in (('AndroidSettings', 'settings'), ('AndroidHotseat', 'game'), ('AndroidEffects', 'effects')):
            (h.out / f'{name}-events.json').write_text(json.dumps(h.events(prefix), indent=2) + '\n')
        (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2) + '\n')
        (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))


if __name__ == '__main__':
    main()
