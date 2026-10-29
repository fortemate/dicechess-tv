"""Play Vega's lessons on Android using only real D-pad/OK/Back/Home events.

Keeps app data; replaces the current probe game only through confirmation.
Lesson rolls belong to the shared tutorial. No state or moves are injected.
"""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import time
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('remote', Path(__file__).with_name('hotseat-smoke.py'))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
plan = json.loads(subprocess.check_output(['node', str(Path(__file__).with_name('tutorial-route.mjs'))], text=True))
codes = {'up': 19, 'down': 20, 'left': 21, 'right': 22, 'select': 23, 'back': 4}
checks = []


def tutorial_wait(since=0, predicate=lambda state: True):
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        states = [e['detail'] for e in h.events('AndroidTutorial')[since:]
                  if e['event'] == 'state' and predicate(e['detail'])]
        if states:
            return states[-1]
        time.sleep(0.1)
    raise AssertionError(f'No expected tutorial state: {h.events("AndroidTutorial")[-3:]}')


def enter():
    before = len(h.events('AndroidTutorial'))
    h.home_select('learn')
    state = tutorial_wait(before, lambda s: s == plan[0]['expected'])
    time.sleep(0.4)
    return state


def tutorial_key(code, contains):
    before = len(h.events('AndroidTutorial'))
    h.key(code)
    return tutorial_wait(before, lambda s: contains in s)


def home_after(code):
    before = len(h.events('AndroidHome'))
    h.key(code)
    home = h.home_wait(before)
    assert home['selected'] == 'learn', home
    time.sleep(0.4)
    return home


def choose(item):
    before = len(h.events())
    h.home_select(item)
    return h.wait(before)


def unchanged(saved):
    state = choose('resume')
    assert state['game'] == saved, (state['game'], saved)
    h.return_home(state)


def partial(state):
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


def play(capture=False):
    before_game = len(h.events())
    enter()
    previous = plan[0]['expected']
    for action in plan:
        before = len(h.events('AndroidTutorial'))
        if action['key']:
            h.key(codes[action['key']])
        expected = action['expected']
        observed = tutorial_wait(before if expected != previous else 0, lambda s: s == expected)
        assert observed == expected
        if capture and action.get('capture'):
            h.snapshot(f'tutorial-{action["capture"]}.png')
        previous = expected
    assert 'finished true' in previous
    assert not h.events()[before_game:], 'Lessons must not mount a game/worker or change its save'


def closing_game(index):
    if index:
        tutorial_key(20, 'choice Play a friend')
    before = len(h.events())
    h.key(23)
    return h.wait(before)


try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    home = h.open_home()
    assert [i['id'] for i in home['items']][-2:] == ['learn', 'rules']
    assert next(i['label'] for i in home['items'] if i['id'] == 'learn') == 'Learn to play'
    state = choose('hotseat')
    if state['overlay']['kind'] == 'confirm':
        h.press(20)
        state = h.press(23)
    state = partial(state)
    friend = state['game']
    h.return_home(state)
    before = len(h.events())
    enter()
    home_after(4)
    assert not h.events()[before:]
    unchanged(friend)
    checks.append('Learn to play opens without a game/worker; immediate Back restores home focus and exact friend save')

    enter()
    tutorial_key(23, 'dice "PPP"')
    selected = tutorial_key(23, next(a['expected'] for a in plan if a.get('capture') == 'move-selected'))
    h.key(3)
    time.sleep(0.6)
    h.adb('shell', 'am', 'start', '-n', f'{h.package}/.MainActivity')
    time.sleep(0.8)
    assert tutorial_wait() == selected
    tutorial_key(4, 'selected -')
    home_after(4)
    unchanged(friend)
    checks.append('Home/return keeps the lesson and selected piece; Back deselects, then exits without changing the friend save')

    enter()
    tutorial_key(23, 'dice "PPP"')
    h.adb('shell', 'am', 'force-stop', h.package)
    h.open_home()
    unchanged(friend)
    checks.append('process death during a lesson restores the exact real partial turn; reopening lessons starts at lesson one')

    play(capture=True)
    tutorial_key(19, 'choice Main menu')
    tutorial_key(22, 'choice Play Rolly')
    tutorial_key(20, 'choice Play a friend')
    tutorial_key(21, 'choice Play Rolly')
    tutorial_key(19, 'choice Main menu')
    home_after(23)
    unchanged(friend)
    checks.append('all six lessons, selection cancellation, empty-roll pass, missed-capture retry and king capture match the canonical reducer')
    checks.append('closing choices wrap with all four directions; Main menu restores home focus and the unchanged current game')

    play()
    state = closing_game(0)
    assert state['overlay']['kind'] == 'confirm' and state['overlay']['index'] == 0
    assert state['game'] == friend
    h.snapshot('tutorial-replace-confirmation.png')
    home_after(23)
    unchanged(friend)
    checks.append('Play Rolly asks before replacement; default Cancel retains every field of the friend save')

    play()
    state = closing_game(1)
    assert state['overlay']['kind'] == 'confirm' and state['game'] == friend
    h.press(20)
    state = h.press(23, lambda s: s['overlay']['kind'] == 'none')
    assert state['game']['mode'] == 'hotseat' and state['game']['id'] != friend['id']
    friend = state['game']
    h.return_home(state)
    unchanged(friend)
    checks.append('confirmed Play a friend starts and persists a new two-player game without extra selectors')

    play()
    state = closing_game(0)
    assert state['overlay']['kind'] == 'confirm' and state['game'] == friend
    h.press(20)
    state = h.press(23, lambda s: s['overlay']['kind'] == 'none')
    assert state['game']['mode'] == 'random' and state['game']['human'] == 'w'
    assert state['game']['id'] != friend['id']
    h.snapshot('tutorial-first-rolly-game.png')
    state = partial(state)
    bot = state['game']
    h.return_home(state)
    checks.append('confirmed Play Rolly starts the real bot game as White with no opponent/side selectors')

    enter()
    tutorial_key(23, 'dice "PPP"')
    h.adb('shell', 'am', 'force-stop', h.package)
    h.open_home()
    unchanged(bot)
    checks.append('process death during lessons also preserves every field of a current bot partial turn')

    play()
    state = closing_game(1)
    assert state['overlay']['kind'] == 'confirm' and state['game'] == bot
    home_after(4)
    unchanged(bot)
    checks.append('full replay and Back from replacement confirmation preserve the current bot game')
    assert not [e for e in h.events() if e['event'] in ('bot-error', 'load-error', 'save-error')]
    print(json.dumps({'passed': checks}, indent=2))
finally:
    for prefix, name in (('AndroidTutorial', 'tutorial-events.json'), ('AndroidHome', 'home-events.json'), ('AndroidHotseat', 'game-events.json')):
        (h.out / name).write_text(json.dumps(h.events(prefix), indent=2) + '\n')
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2) + '\n')
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
