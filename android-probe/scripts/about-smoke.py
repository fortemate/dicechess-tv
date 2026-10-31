"""Check shared About rendering, remote exits and exact real-game preservation.

Keeps app data; replaces the current probe game only through the normal UI.
No positions, moves or rolls are injected.
"""
import importlib.util
import json
from pathlib import Path
import sys
import time
import xml.etree.ElementTree as ET
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('remote', Path(__file__).with_name('hotseat-smoke.py'))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
checks = []
expected = 'about | credits 4 | portraits not-probed'


def about_wait(since=0):
    """Wait for a new mount/content report, not proof of the current screen."""
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        states = [e['detail'] for e in h.events('AndroidAbout')[since:] if e['event'] == 'state']
        if states:
            assert states[-1] == expected, states
            return states[-1]
        time.sleep(0.1)
    raise AssertionError(f'No About report: {h.events("AndroidAbout")[-3:]}')


def about_visible(name):
    """Read the active UI hierarchy afresh and require the About surface."""
    path = '/sdcard/dicechess-about-smoke.xml'
    h.adb('shell', 'rm', '-f', path)
    h.adb('shell', 'uiautomator', 'dump', path)
    hierarchy = h.adb('shell', 'cat', path)
    (h.out / f'{name}.xml').write_text(hierarchy)
    nodes = ET.fromstring(hierarchy).iter('node')
    assert any(node.get('package') == h.package and
               node.get('content-desc') == 'About Dice Chess'
               for node in nodes), f'About is not visible: {name}'


def enter():
    before = len(h.events('AndroidAbout'))
    h.home_select('about')
    about_wait(before)
    time.sleep(0.4)


def leave(code):
    before = len(h.events('AndroidHome'))
    h.key(code)
    home = h.home_wait(before)
    assert home['selected'] == 'about', home
    time.sleep(0.4)
    return home


def choose(item):
    before = len(h.events())
    h.home_select(item)
    return h.wait(before)


def partial(state):
    """Play real turns until the human has made part of a multi-move turn."""
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        state = h.wait()
        assert state['game']['phase'] != 'ended'
        if state['view']['bot']:
            if state['game']['phase'] == 'handoff' and not state['game']['moves']:
                time.sleep(0.8)
                h.press(23)
            else:
                time.sleep(0.1)
            continue
        if state['game']['phase'] == 'roll':
            state = h.press(23)
        if state['game']['phase'] == 'move':
            state = h.move(state)
            if state['game']['phase'] == 'move':
                return state
        time.sleep(0.8)
        h.press(23)
    raise AssertionError('No human partial turn')


try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    home = h.open_home()
    assert home['items'][-1]['id'] == 'about' and home['items'][-1]['label'] == 'About'
    enter()
    assert not h.events(), 'Opening About must not mount a game or worker'
    h.snapshot('about-credits.png')
    about_visible('about-credits')
    checks.append('home opens the shared screen with four Android credit cards and no Vega portrait probe or game')
    before = len(h.events('AndroidHome'))
    for code, direction in ((19, 'up'), (20, 'down'), (21, 'left'), (22, 'right')):
        h.key(code)
        about_visible(f'about-{direction}')
        h.snapshot(f'about-{direction}.png')
        assert len(h.events('AndroidHome')) == before
    leave(23)
    assert not h.events()
    checks.append('all four directions keep About open; OK returns to the focused About home row')

    enter()
    h.key(3)
    time.sleep(0.6)
    h.adb('shell', 'am', 'start', '-n', f'{h.package}/.MainActivity')
    time.sleep(0.8)
    about_visible('about-home-return')
    leave(4)
    assert not h.events()
    checks.append('system Home/return retains About; Back restores home focus without mounting a game')

    h.configure_play_as('ask')
    for mode in ('hotseat', 'bot'):
        state = choose('hotseat' if mode == 'hotseat' else 'computer')
        if mode == 'bot':
            state = h.choose_bot(state, 0, 1)
        elif state['overlay']['kind'] == 'confirm':
            h.press(20)
            state = h.press(23)
        state = partial(state)
        saved = state['game']
        h.return_home(state)
        before = len(h.events())
        enter()
        h.key(20)
        leave(4)
        assert not h.events()[before:]
        state = choose('resume')
        assert state['game'] == saved
        h.return_home(state)
        enter()
        h.adb('shell', 'am', 'force-stop', h.package)
        h.open_home()
        state = choose('resume')
        assert state['game'] == saved
        h.return_home(state)
        checks.append(f'{mode}: reading, exiting and process death in About preserve every field of a real partial-turn save')
    assert not [e for e in h.events() if e['event'] in ('bot-error', 'load-error', 'save-error')]
    print(json.dumps({'passed': checks}, indent=2))
finally:
    for prefix, name in (('AndroidAbout', 'about-events.json'), ('AndroidHome', 'home-events.json'), ('AndroidHotseat', 'game-events.json')):
        (h.out / name).write_text(json.dumps(h.events(prefix), indent=2) + '\n')
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2) + '\n')
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
