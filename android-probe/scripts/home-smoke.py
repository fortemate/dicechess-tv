"""Main-menu navigation and independent saves using real remote events only.

Run after smoke.py for the fresh-menu checks. Does not inject state or dice;
replaces games through the normal confirmation UI.
"""
import importlib.util
import json
from pathlib import Path
import re
import sys
import time
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('remote', Path(__file__).with_name('hotseat-smoke.py'))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
checks = []


def choose_game(item):
    start = len(h.events())
    h.home_select(item)
    return h.wait(start)


def return_home(state):
    if state['focus']['selected']:
        state = h.press(4)
    if state['overlay']['kind'] != 'menu':
        state = h.press(4, lambda s: s['overlay']['kind'] == 'menu')
    # Last visible row is Main menu in both modes, including after a result.
    target = 4 if state['game']['mode'] == 'hotseat' else 3
    for _ in range(5):
        if state['overlay']['index'] == target:
            break
        state = h.press(20)
    assert state['overlay']['index'] == target, state
    start = len(h.events('AndroidHome'))
    h.key(23)
    home = h.home_wait(start)
    time.sleep(0.5)
    return home


def partial_turn(state):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        state = h.wait()
        game = state['game']
        assert game['phase'] != 'ended'
        if state['view']['bot']:
            if game['phase'] == 'handoff' and not game['moves']:
                time.sleep(0.8)
                state = h.press(23)
            else:
                time.sleep(0.1)
            continue
        if game['phase'] == 'roll':
            state = h.press(23)
        if state['game']['phase'] == 'move':
            state = h.move(state)
            if state['game']['phase'] == 'move':
                return state
        time.sleep(0.8)
        state = h.press(23)
    raise AssertionError('No human partial turn under normal rolls')


def assert_continue(item, saved):
    state = choose_game(item)
    assert state['game'] == saved
    return state


try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    home = h.open_home()
    assert [i['id'] for i in home['items']] == ['new-bot', 'new-hotseat', 'diagnostics']
    h.snapshot('fresh-home.png')
    for code, selected in ((19, 'diagnostics'), (22, 'new-bot'), (20, 'new-hotseat'), (21, 'new-bot')):
        start = len(h.events('AndroidHome'))
        h.key(code)
        assert h.home_wait(start)['selected'] == selected
    checks.append('cold launch opens home; all four D-pad directions and wrap work')

    state = choose_game('new-bot')
    assert state['overlay']['kind'] == 'opponent'
    start = len(h.events('AndroidHome'))
    h.key(4)
    home = h.home_wait(start)
    assert home['selected'] == 'new-bot' and len(home['items']) == 3
    checks.append('Back from first bot selection returns home without a placeholder save')

    state = partial_turn(choose_game('new-hotseat'))
    friend = state['game']
    home = return_home(state)
    assert home['selected'] == 'new-hotseat'
    assert 'continue-hotseat' in [i['id'] for i in home['items']]
    state = assert_continue('continue-hotseat', friend)
    h.key(3)
    time.sleep(1)
    assert h.wait()['game'] == friend
    h.adb('shell', 'am', 'start', '-n', f'{h.package}/.MainActivity')
    time.sleep(0.8)
    h.press(22)  # Native focus still accepts input after Home/return.
    assert h.wait()['game'] == friend
    home = return_home(h.wait())
    checks.append('friend partial turn returns to home and continues exactly; Home/return preserves input')

    state = choose_game('new-hotseat')
    assert state['overlay']['kind'] == 'confirm' and state['game'] == friend
    h.snapshot('replace-friend.png')
    start = len(h.events('AndroidHome'))
    h.key(23)  # Cancel first.
    h.home_wait(start)
    state = assert_continue('continue-hotseat', friend)
    return_home(state)
    state = choose_game('new-hotseat')
    h.key(20)
    state = h.press(23, lambda s: s['overlay']['kind'] == 'none')
    assert state['game']['id'] != friend['id']
    friend = state['game']
    return_home(state)
    checks.append('New friend game cancels without changing the save and replaces only after Yes')

    state = h.choose_bot(choose_game('new-bot'), 1, 2)
    state = partial_turn(state)
    bot = state['game']
    assert bot['mode'] == 'greedy' and bot['human'] == 'b'
    home = return_home(state)
    assert [i['id'] for i in home['items']][:2] == ['continue-bot', 'continue-hotseat']
    h.snapshot('both-saves.png')
    state = assert_continue('continue-bot', bot)
    return_home(state)
    state = assert_continue('continue-hotseat', friend)
    return_home(state)
    checks.append('computer game starts from home; both saves remain independently resumable')

    state = choose_game('new-bot')
    assert state['overlay']['kind'] == 'opponent' and state['overlay']['index'] == 1
    start = len(h.events('AndroidHome'))
    h.key(4)
    h.home_wait(start)
    state = assert_continue('continue-bot', bot)
    return_home(state)
    state = choose_game('new-bot')
    h.press(20)  # Rampage.
    h.press(23, lambda s: s['overlay']['kind'] == 'colour')
    h.press(23, lambda s: s['overlay']['kind'] == 'confirm')
    h.snapshot('replace-bot.png')
    start = len(h.events('AndroidHome'))
    h.key(23)  # Cancel.
    h.home_wait(start)
    state = assert_continue('continue-bot', bot)
    checks.append('Back and final Cancel from New computer game preserve opponent, side and exact turn')

    h.adb('shell', 'am', 'force-stop', h.package)
    start = len(h.events())
    home = h.open_home()
    time.sleep(1.2)
    assert not h.events()[start:], 'Game/worker must not mount while home is open'
    state = assert_continue('continue-bot', bot)
    return_home(state)
    state = assert_continue('continue-hotseat', friend)
    checks.append('process restart stays on home; both exact games resume only when selected')

    # Results remain accessible, without mislabeling an ended game as Continue.
    h.press(4)
    h.key(20)
    h.press(23, lambda s: s['overlay']['kind'] == 'confirm')
    h.key(20)
    state = h.press(23, lambda s: s['game']['phase'] == 'ended')
    ended = state['game']
    home = return_home(state)
    assert next(i['label'] for i in home['items'] if i['id'] == 'continue-hotseat') == 'View result with a friend'
    h.snapshot('result-home.png')
    state = assert_continue('continue-hotseat', ended)
    return_home(state)
    state = choose_game('new-hotseat')
    assert state['overlay']['kind'] == 'none' and state['game']['phase'] == 'roll'
    return_home(state)
    checks.append('ended games expose View result; a new friend game after a result starts directly')

    before = len(h.events('AndroidProbe'))
    h.home_select('diagnostics')
    deadline = time.monotonic() + 15
    while not any(e['event'] == 'ready' for e in h.events('AndroidProbe')[before:]):
        assert time.monotonic() < deadline
        time.sleep(0.1)
    time.sleep(0.5)
    start = len(h.events('AndroidHome'))
    h.key(4)
    home = h.home_wait(start)
    assert home['selected'] == 'diagnostics'
    checks.append('Diagnostics is a separate screen; idle Back restores home focus')

    h.home_select('diagnostics')
    time.sleep(0.8)
    h.key(20); h.key(23)  # Slow diagnostic worker.
    h.key(19, 2)  # Main menu, the last diagnostic.
    start = len(h.events('AndroidHome'))
    h.key(23)
    h.home_wait(start)
    time.sleep(3.5)
    assert h.home_wait()['selected'] == 'diagnostics'
    checks.append('leaving busy diagnostics disposes its work and keeps home responsive')

    h.key(4)
    time.sleep(0.8)
    resumed = [line for line in h.adb('shell','dumpsys','activity','activities').splitlines()
               if re.search(r'(topResumedActivity|mResumedActivity)', line)]
    assert resumed and all(h.package not in line for line in resumed), resumed
    h.adb('shell', 'am', 'start', '-n', f'{h.package}/.MainActivity')
    time.sleep(0.8)
    home = h.home_wait()
    assert 'continue-bot' in [i['id'] for i in home['items']]
    assert_continue('continue-bot', bot)
    checks.append('Back on home leaves the activity; relaunch opens home and preserves the bot game')
    assert not [e for e in h.events() if e['event'] in ('bot-error','load-error','save-error')]
    print(json.dumps({'passed': checks}, indent=2))
finally:
    for prefix, name in (('AndroidHome','home-events.json'),('AndroidHotseat','game-events.json'),('AndroidProbe','diagnostic-events.json')):
        (h.out/name).write_text(json.dumps(h.events(prefix),indent=2)+'\n')
    (h.out/'checks.json').write_text(json.dumps({'passed':checks},indent=2)+'\n')
    (h.out/'logcat.txt').write_text(h.adb('logcat','-d','-v','brief'))
