"""Play the hotseat slice using only remote keys on an explicitly selected device.

Force-stops the disposable probe but does not clear its data. Starts a new game
through the confirmation UI, replacing only its hotseat save. No fixture or dice
is injected. Requires Node from mise and the installed standalone probe APK.
"""
import argparse
import json
from pathlib import Path
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--adb', default='adb')
parser.add_argument('--serial', required=True)
parser.add_argument('--output', default='build/hotseat-smoke')
args = parser.parse_args()
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
package = 'com.fortemate.dicechesstv.probe'
script_dir = Path(__file__).resolve().parent


def adb(*command, binary=False):
    return subprocess.check_output([args.adb, '-s', args.serial, *command], text=not binary)


def events(prefix='AndroidHotseat'):
    result = []
    for line in adb('logcat', '-d', '-v', 'brief', 'ReactNativeJS:I', '*:S').splitlines():
        marker = f'[{prefix}] '
        if marker in line:
            try:
                result.append(json.loads(line.split(marker, 1)[1]))
            except json.JSONDecodeError:
                pass
    return result


def wait(since=0, predicate=lambda state: True, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        observed = events()[since:]
        failures = [e for e in observed if e['event'] in ('load-error', 'save-error')]
        if failures:
            raise AssertionError(failures)
        states = [e['detail'] for e in observed if e['event'] == 'state' and predicate(e['detail'])]
        if states:
            return states[-1]
        time.sleep(0.15)
    raise AssertionError(f'No expected state: {events()[-4:]}')


def key(code, times=1):
    for _ in range(times):
        adb('shell', 'input', 'keyevent', str(code))
        time.sleep(0.2)


def press(code, predicate=lambda state: True):
    start = len(events())
    key(code)
    return wait(start, predicate)


def open_game():
    before = len(events('AndroidProbe'))
    adb('shell', 'am', 'start', '-n', f'{package}/.MainActivity')
    deadline = time.monotonic() + 30
    while not any(e['event'] == 'ready' for e in events('AndroidProbe')[before:]):
        if time.monotonic() >= deadline:
            raise AssertionError('Diagnostic app did not become ready')
        time.sleep(0.2)
    time.sleep(0.5)  # Native focus follows the first React commit.
    key(19)  # Diagnostic menu wraps from first to its last item: hotseat.
    return press(23)


def navigate(state, target):
    command = ['node', str(script_dir / 'hotseat-route.mjs')]
    path = json.loads(subprocess.check_output(command, input=json.dumps({**state, 'target': target}), text=True))
    for direction in path:
        state = press({'up': 19, 'down': 20, 'left': 21, 'right': 22}[direction])
    assert state['focus']['cursor'] == target, state
    return state


def move(state):
    assert state['game']['phase'] == 'move'
    chosen = state['view']['legal'][0]
    state = navigate(state, chosen[:2])
    state = press(23, lambda s: s['focus']['selected'] == chosen[:2])
    state = navigate(state, chosen[2:4])
    old_revision = state['game']['revision']
    state = press(23)
    if state['overlay']['kind'] == 'promotion':
        state = press(23)
    assert state['game']['revision'] == old_revision + 1, state
    assert state['game']['lastMove'][:4] == chosen[:4], state
    return state


def snapshot(name):
    time.sleep(0.4)
    (out / name).write_bytes(adb('exec-out', 'screencap', '-p', binary=True))


checks = []
try:
    adb('shell', 'am', 'force-stop', package)
    adb('logcat', '-c')
    state = open_game()
    checks.append('game opens from the diagnostics with native remote focus')
    # Start a fresh game by the same confirmed menu path a player uses.
    state = press(4)
    if state['game']['phase'] != 'ended':
        key(20, 3)
    state = press(23, lambda s: s['overlay']['kind'] == 'confirm')
    key(20)
    state = press(23, lambda s: s['game']['phase'] == 'roll' and s['overlay']['kind'] == 'none')
    snapshot('new-game.png')
    # Find a genuine partial turn under normal random rolls, without changing dice.
    for _ in range(30):
        if state['game']['phase'] != 'move':
            time.sleep(0.8)  # Respect the shared guard after an empty roll.
            state = press(23)
        if state['game']['phase'] == 'move':
            state = move(state)
            if state['game']['phase'] == 'move' and state['game']['moves']:
                break
    else:
        raise AssertionError('No partial turn reached within 30 normal rolls/actions')
    saved = state['game']
    saved_view = state['view']
    checks.append('normal random roll and a legal remote move leave a partial turn')
    snapshot('partial-turn.png')
    # Cancel a piece selection without modifying the game or opening the menu.
    state = press(23, lambda s: s['focus']['selected'] is not None)
    state = press(4, lambda s: s['focus']['selected'] is None and s['overlay']['kind'] == 'none')
    assert state['game'] == saved
    # Pause, cancel replacement, return to diagnostics, reopen the same game.
    state = press(4)
    snapshot('game-menu.png')
    key(20, 3)
    state = press(23, lambda s: s['overlay']['kind'] == 'confirm')
    state = press(23, lambda s: s['overlay']['kind'] == 'menu')
    assert state['game'] == saved
    key(20, 4)
    press(23, lambda s: s['overlay']['kind'] == 'home')
    time.sleep(0.5)
    state = press(23)
    assert state['game'] == saved and state['view'] == saved_view
    checks.append('Back deselects then pauses; replacement Cancel and diagnostics preserve the game')
    # System Home and warm return retain the same game; focus works afterward.
    key(3)
    time.sleep(0.5)
    adb('shell', 'am', 'start', '-n', f'{package}/.MainActivity')
    time.sleep(0.8)
    state = press(4, lambda s: s['overlay']['kind'] == 'menu')
    assert state['game'] == saved
    press(4, lambda s: s['overlay']['kind'] == 'none')
    checks.append('Home/resume restores input without changing the partial turn')
    # Process death must recover the complete canonical snapshot and legal view.
    adb('shell', 'am', 'force-stop', package)
    start = len(events())
    state = open_game()
    assert len(events()) > start
    assert state['game'] == saved and state['view'] == saved_view
    snapshot('restored-turn.png')
    checks.append('force-stop/relaunch restores position, roll, spent dice, phase and legal actions exactly')
    # Finish this side and then play at least one move for the other player.
    while state['game']['phase'] == 'move':
        state = move(state)
    assert state['game']['phase'] == 'handoff', state
    old_turn = state['game']['turn']
    old_side = state['view']['side']
    state = press(23)
    assert state['game']['turn'] == old_turn + 1 and state['view']['side'] != old_side
    for _ in range(30):
        if state['game']['phase'] == 'move':
            if state['view']['side'] != old_side:
                state = move(state)
                break
            while state['game']['phase'] == 'move':
                state = move(state)
        time.sleep(0.8)
        state = press(23)
    else:
        raise AssertionError('No legal move for the next player')
    snapshot('continued-game.png')
    checks.append('restored turn finishes and control passes to the next player for continued play')
    # End through the shared confirmation flow, then restore that result.
    before_resign = state['game']
    press(4, lambda s: s['overlay']['kind'] == 'menu')
    key(20)
    press(23, lambda s: s['overlay']['kind'] == 'confirm')
    state = press(23, lambda s: s['overlay']['kind'] == 'menu')
    assert state['game'] == before_resign
    key(20)
    press(23, lambda s: s['overlay']['kind'] == 'confirm')
    key(20)
    state = press(23, lambda s: s['game']['phase'] == 'ended')
    ended = state['game']
    assert ended['result']['reason'] == 'resigned'
    snapshot('finished-game.png')
    adb('shell', 'am', 'force-stop', package)
    state = open_game()
    assert state['game'] == ended
    press(23, lambda s: s['overlay']['kind'] == 'menu')
    press(23, lambda s: s['overlay']['kind'] == 'confirm')
    state = press(23, lambda s: s['overlay']['kind'] == 'menu')  # Cancel replacement after a result.
    assert state['overlay']['index'] == 3 and state['game'] == ended
    press(23, lambda s: s['overlay']['kind'] == 'confirm')
    key(20)
    state = press(23, lambda s: s['game']['phase'] == 'roll')
    assert state['game']['id'] != ended['id'] and not state['game']['moves']
    checks.append('resignation Cancel, confirmed result, result recovery and confirmed new game')
    (out / 'saved-partial.json').write_text(json.dumps({'game': saved, 'view': saved_view}, indent=2) + '\n')
    print(json.dumps({'passed': checks}, indent=2))
finally:
    (out / 'events.json').write_text(json.dumps(events(), indent=2) + '\n')
    (out / 'logcat.txt').write_text(adb('logcat', '-d', '-v', 'brief'))
    (out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2) + '\n')
