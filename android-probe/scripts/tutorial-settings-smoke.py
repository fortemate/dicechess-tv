"""Check tutorial Highlights and Settings safe bounds on a disposable TV AVD.

Uses real remote input and screenshots; never injects saves or preferences.
Keeps app data but replaces games through normal confirmation UI.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import struct
import sys
import time
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('settings_smoke', Path(__file__).with_name('settings-smoke.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
h = s.h
checks, captures = [], {}


def state(prefix, since=0, predicate=lambda value: True):
    """Wait for a fresh component report and reject storage errors."""
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        events = h.events(prefix)[since:]
        assert not [e for e in events if e['event'].endswith('error')], events
        found = [e['detail'] for e in events if e['event'] == 'state' and predicate(e['detail'])]
        if found:
            return found[-1]
        time.sleep(0.1)
    raise AssertionError(f'No fresh {prefix} state: {h.events(prefix)[-3:]}')


def settings_key(code):
    """Send one D-pad/OK press and await its Settings state."""
    before = len(h.events('AndroidSettings'))
    h.key(code)
    return state('AndroidSettings', before)


def settings_row(index):
    """Reach a row through bounded, observed remote navigation."""
    current = state('AndroidSettings')
    for _ in range(8):
        if current['index'] == index:
            return current
        current = settings_key(20)
    raise AssertionError(f'Could not reach Settings row {index}')


def require_settings_text(texts, index):
    """Reject missing rows or selected-row descriptions before measuring bounds."""
    visible = {node.get('text', '') for node in texts}
    assert 'Settings' in visible, 'Missing Settings title'
    assert 'Back: return' in visible, 'Missing Back hint'
    for label in (
        'Music', 'Sounds', 'Voices', 'Highlights', 'Auto-play only move',
        'Play as', 'Turn board for friends', 'Host for friends',
    ):
        assert any(text.startswith(f'{label}: ') for text in visible), f'Missing Settings row: {label}'
    description = {
        4: 'Plays the only legal move for you.',
        5: 'Your color in new computer games.',
    }.get(index)
    if description:
        assert description in visible, f'Missing Settings description: {description}'


def safe_settings(index):
    """Measure native text bounds against Vega's five-percent TV safe area."""
    remote = '/sdcard/dicechess-parity-settings.xml'
    h.adb('shell', 'rm', '-f', remote)
    h.adb('shell', 'uiautomator', 'dump', remote)
    xml = h.adb('shell', 'cat', remote)
    (h.out / f'settings-{index}.xml').write_text(xml)
    texts = [n for n in ET.fromstring(xml).iter('node') if n.get('text')]
    require_settings_text(texts, index)
    bounds = {}
    for node in texts:
        left, top, right, bottom = map(int, re.findall(r'\d+', node.get('bounds')))
        assert 96 <= left < right <= 1824, node.attrib
        assert 54 <= top < bottom <= 1026, node.attrib
        bounds[node.get('text')] = [left, top, right, bottom]
    captures[f'settings-{index}'] = bounds
    if index in (0, 4, 7):
        h.snapshot(f'settings-{index}.png')


def partial_turn():
    """Reach an actual partially spent human turn through legal game actions."""
    for _ in range(40):
        current = s.human_move()
        assert current['game']['phase'] != 'ended'
        current = h.move(current)
        if current['game']['phase'] == 'move':
            return current
    raise AssertionError('No partial turn reached')


def tutorial_key(code, contains):
    """Await this tutorial key's completed state transition."""
    before = len(h.events('AndroidTutorial'))
    h.key(code)
    return state('AndroidTutorial', before, lambda value: contains in value)


def board_hash():
    """Hash the visible board pixels, excluding changing captions and audio UI."""
    raw = h.adb('exec-out', 'screencap', binary=True)
    width, height, pixel_format = struct.unpack('<III', raw[:12])
    assert (width, height, pixel_format) == (1920, 1080, 1)
    header = len(raw) - width * height * 4
    assert header in (12, 16), header
    pixels = b''.join(raw[header + (y * width + 96) * 4:header + (y * width + 1008) * 4]
                      for y in range(84, 996))
    return hashlib.sha256(pixels).hexdigest()


def lesson(choice):
    """Select a fixed lesson pawn and capture the real rendered Highlights."""
    before = len(h.events('AndroidTutorial'))
    game_before = len(h.events())
    h.home_select('learn')
    state('AndroidTutorial', before, lambda value: 'dice ""' in value)
    tutorial_key(23, 'dice "PPP"')
    selected = tutorial_key(23, 'selected e2')
    time.sleep(0.5)
    h.snapshot(f'tutorial-{choice}.png')
    result = board_hash()
    tutorial_key(4, 'selected -')
    before = len(h.events('AndroidHome'))
    h.key(4)
    assert h.home_wait(before)['selected'] == 'learn'
    assert not h.events()[game_before:], 'Tutorial mounted or changed the real game'
    return {'state': selected, 'board_sha256': result}


def unchanged(saved):
    """Resume without taking a turn and compare every saved-game field."""
    current = s.choose('resume')
    assert current['game'] == saved, (current['game'], saved)
    h.return_home(current)


try:
    avd = h.adb('emu', 'avd', 'name').splitlines()[0].strip()
    assert avd == 'DiceChessTVParity', f'Use the disposable DiceChessTVParity AVD, not {avd}'
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    h.open_home()  # Answer the fresh-profile offer with Skip before running.
    current = s.choose('hotseat')
    if current['overlay']['kind'] == 'confirm':
        h.press(20)
        current = h.press(23)
    friend = partial_turn()['game']
    h.return_home(h.wait())

    s.enter()
    for index in range(8):
        settings_row(index)
        safe_settings(index)
    s.leave()
    unchanged(friend)
    checks.append('all eight Settings rows, descriptions and Back text stay inside the 5% safe area; navigation preserves the partial turn')

    for choice in ('standard', 'enhanced', 'colour-blind', 'high-contrast'):
        s.enter()
        current = settings_row(3)
        for _ in range(4):
            if current['highlights'] == choice:
                break
            current = settings_key(22)
        assert current['highlights'] == choice
        s.restart()  # No Back/lifecycle save is needed for persistence.
        s.enter()
        assert state('AndroidSettings')['highlights'] == choice
        s.leave()
        captures[choice] = lesson(choice)
        unchanged(friend)
    assert len({captures[c]['state'] for c in ('standard', 'enhanced', 'colour-blind', 'high-contrast')}) == 1
    assert len({captures[c]['board_sha256'] for c in ('standard', 'enhanced', 'colour-blind', 'high-contrast')}) == 4
    checks.append('each persisted Highlights choice produces distinct pixels for the identical selected lesson board, retaining the exact friend game')

    h.configure_play_as('ask')
    h.choose_bot(s.choose('computer'), 0, 1)
    bot = partial_turn()['game']
    h.return_home(h.wait())
    lesson('bot-high-contrast')
    h.home_select('learn')
    tutorial_key(23, 'dice "PPP"')
    s.restart()
    unchanged(bot)
    s.enter()
    assert state('AndroidSettings')['highlights'] == 'high-contrast'
    s.leave()
    checks.append('tutorial Back and process death retain the exact bot partial turn and the saved Highlights choice')
    assert not [e for e in h.events() if e['event'] in ('bot-error', 'load-error', 'save-error')]
    print(json.dumps({'passed': checks, 'captures': captures}, indent=2))
finally:
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks, 'captures': captures}, indent=2) + '\n')
    for prefix in ('AndroidSettings', 'AndroidTutorial', 'AndroidHome', 'AndroidHotseat'):
        (h.out / f'{prefix}.json').write_text(json.dumps(h.events(prefix), indent=2) + '\n')
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
