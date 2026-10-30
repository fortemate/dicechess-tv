"""Play the hotseat slice using only remote keys on an explicitly selected device.

Force-stops the disposable probe but does not clear its data. Starts a new game
through the confirmation UI, replacing its current save. No fixture or dice
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
parser.add_argument('--audio', action='store_true', help='Also verify gameplay effect and lifecycle events')
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


def audio_wait(event, since=0, cue=None, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        observed = events('AndroidEffects')[since:]
        failures = [e for e in observed if e['event'] in ('error', 'timeout')]
        assert not failures, failures
        matches = [e for e in observed if e['event'] == event and (cue is None or e['detail'].get('cue') == cue)]
        if matches:
            return matches[-1]
        time.sleep(0.05)
    raise AssertionError(f'No audio {event}/{cue}: {observed}')


def silent_since(start):
    time.sleep(0.7)
    assert not any(e['event'] in ('requested', 'playing') for e in events('AndroidEffects')[start:])


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


def home_wait(since=0, predicate=lambda state: True, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        states = [e['detail'] for e in events('AndroidHome')[since:]
                  if e['event'] == 'state' and predicate(e['detail'])]
        if states:
            return states[-1]
        time.sleep(0.1)
    raise AssertionError(f'No expected home state: {events("AndroidHome")[-3:]}')


def open_home():
    before = len(events('AndroidHome'))
    adb('shell', 'am', 'start', '-n', f'{package}/.MainActivity')
    state = home_wait(before)
    time.sleep(0.5)  # Native focus follows the first React commit.
    return state


def home_select(item):
    state = home_wait()
    assert any(i['id'] == item for i in state['items']), state
    while state['selected'] != item:
        before = len(events('AndroidHome'))
        key(20)
        state = home_wait(before)
    key(23)


def open_diagnostics():
    before = len(events('AndroidProbe'))
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'dicechess-probe://diagnostics', '-n', f'{package}/.MainActivity')
    deadline = time.monotonic() + 30
    while not any(e['event'] == 'ready' for e in events('AndroidProbe')[before:]):
        if time.monotonic() >= deadline:
            raise AssertionError('Diagnostics did not become ready')
        time.sleep(0.2)
    time.sleep(0.5)


def open_game(up=1):
    home = open_home()
    if any(i['id'] == 'resume' for i in home['items']):
        before = len(events())
        home_select('resume')
        return wait(before)
    before = len(events())
    home_select('hotseat' if up == 1 else 'computer')
    return wait(before)


def return_home(state):
    if state['focus']['selected']:
        state = press(4)
    if state['game']['phase'] == 'ended':
        start = len(events('AndroidHome'))
        key(4)
        return home_wait(start)
    if state['overlay']['kind'] != 'menu':
        state = press(4, lambda s: s['overlay']['kind'] == 'menu')
    target = 4 if state['game']['mode'] == 'hotseat' else 3
    for _ in range(6):
        if state['overlay']['index'] == target:
            break
        state = press(20)
    assert state['overlay']['index'] == target
    start = len(events('AndroidHome'))
    key(23)
    home = home_wait(start)
    time.sleep(0.5)
    return home


def configure_play_as(choice):
    """Set the side preference through Settings while home is visible."""
    def current(since):
        """Wait for this action's complete preference report, rejecting storage errors."""
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            observed = events('AndroidSettings')[since:]
            assert not [e for e in observed if e['event'].endswith('error')], observed
            reports = [e['detail'] for e in observed if e['event'] == 'state']
            if reports:
                assert not reports[-1]['error']
                return reports[-1]
            time.sleep(0.1)
        raise AssertionError('No fresh Settings report')

    before = len(events('AndroidSettings'))
    home_select('settings')
    state = current(before)
    for _ in range(5):
        if state['index'] == 3: break
        before = len(events('AndroidSettings'))
        key(20)
        state = current(before)
    assert state['index'] == 3
    for _ in range(4):
        if state['playAs'] == choice: break
        before = len(events('AndroidSettings'))
        key(22)
        state = current(before)
    assert state['playAs'] == choice
    start = len(events('AndroidHome'))
    key(4)
    return home_wait(start)


def choose_bot(state, opponent=0, colour=1):
    """Start through the shared opponent/side menus, confirming replacement."""
    if state['overlay']['kind'] != 'opponent':
        if state['overlay']['kind'] != 'menu':
            state = press(4, lambda s: s['overlay']['kind'] == 'menu')
        if state['game']['mode'] == 'hotseat':
            return_home(state)
            before = len(events())
            home_select('computer')
            state = wait(before, lambda s: s['overlay']['kind'] == 'opponent')
        while state['overlay']['kind'] == 'menu' and state['overlay']['index'] != 2:
            state = press(20)
        if state['overlay']['kind'] == 'menu':
            state = press(23, lambda s: s['overlay']['kind'] == 'opponent')
    while state['overlay']['index'] != opponent:
        state = press(20)
    state = press(23, lambda s: s['overlay']['kind'] == 'colour')
    while state['overlay']['index'] != colour:
        state = press(20)
    state = press(23)
    if state['overlay']['kind'] == 'confirm':
        state = press(20)
        state = press(23, lambda s: s['overlay']['kind'] == 'none')
    return state


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


def main():
    checks = []
    try:
        adb('shell', 'am', 'force-stop', package)
        adb('logcat', '-c')
        state = open_game()
        if args.audio:
            audio_wait('ready')
            silent_since(0)
        if state['game']['mode'] != 'hotseat':
            return_home(state)
            before = len(events())
            home_select('hotseat')
            state = wait(before)
            if state['overlay']['kind'] == 'confirm':
                press(20)
                state = press(23)
        checks.append('game opens from home with native remote focus')
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
        if args.audio:
            audio_wait('finished', cue='dice_roll')
            audio_wait('finished', cue='piece_move')
            checks.append('native playing/completion events for normal rolls and moves')
        saved = state['game']
        saved_view = state['view']
        checks.append('normal random roll and a legal remote move leave a partial turn')
        snapshot('partial-turn.png')
        # Cancel a piece selection without modifying the game or opening the menu.
        state = press(23, lambda s: s['focus']['selected'] is not None)
        state = press(4, lambda s: s['focus']['selected'] is None and s['overlay']['kind'] == 'none')
        assert state['game'] == saved
        # Pause, cancel replacement, return home, reopen the same game.
        state = press(4)
        snapshot('game-menu.png')
        key(20, 3)
        state = press(23, lambda s: s['overlay']['kind'] == 'confirm')
        state = press(23, lambda s: s['overlay']['kind'] == 'menu')
        assert state['game'] == saved
        key(20, 4)
        press(23, lambda s: s['overlay']['kind'] == 'home')
        time.sleep(0.5)
        audio_start = len(events('AndroidEffects'))
        before = len(events())
        home_select('resume')
        state = wait(before)
        assert state['game'] == saved and state['view'] == saved_view
        if args.audio:
            audio_wait('ready', audio_start)
            silent_since(audio_start)
        checks.append('Back deselects then pauses; replacement Cancel and home preserve the game')
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
        audio_start = len(events('AndroidEffects'))
        state = open_game()
        assert len(events()) > start
        assert state['game'] == saved and state['view'] == saved_view
        if args.audio:
            audio_wait('ready', audio_start)
            silent_since(audio_start)
            checks.append('home reopen and process restore do not replay prior sounds')
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
        # End through the shared confirmation flow, then return home.
        before_resign = state['game']
        press(4, lambda s: s['overlay']['kind'] == 'menu')
        key(20)
        press(23, lambda s: s['overlay']['kind'] == 'confirm')
        state = press(23, lambda s: s['overlay']['kind'] == 'menu')
        assert state['game'] == before_resign
        key(20)
        press(23, lambda s: s['overlay']['kind'] == 'confirm')
        key(20)
        audio_start = len(events('AndroidEffects'))
        state = press(23, lambda s: s['game']['phase'] == 'ended')
        if args.audio:
            audio_wait('playing', audio_start, 'game_win')
            key(3)
            audio_wait('released', audio_start, 'game_win')
            time.sleep(1)
            assert not any(e['event'] == 'finished' and e['detail']['cue'] == 'game_win' for e in events('AndroidEffects')[audio_start:])
            resume_start = len(events('AndroidEffects'))
            adb('shell', 'am', 'start', '-n', f'{package}/.MainActivity')
            time.sleep(0.8)
            silent_since(resume_start)
            checks.append('Home interrupts the playing result jingle; return does not replay it')
        ended = state['game']
        assert ended['result']['reason'] == 'resigned'
        snapshot('finished-game.png')
        home_start = len(events('AndroidHome'))
        key(23)
        home = home_wait(home_start)
        assert not any(i['id'] == 'resume' for i in home['items'])
        adb('shell', 'am', 'force-stop', package)
        audio_start = len(events('AndroidEffects'))
        state = open_game()
        assert state['game']['id'] != ended['id'] and state['game']['phase'] == 'roll'
        if args.audio:
            audio_wait('ready', audio_start)
            silent_since(audio_start)
        checks.append('hotseat result returns home; restart hides Resume and a new game starts directly')
        if args.audio:
            # A second result completes naturally after a fresh game, proving playback resumes.
            press(4)
            key(20, 2)
            audio_start = len(events('AndroidEffects'))
            press(23, lambda s: s['game']['phase'] == 'ended')
            audio_wait('finished', audio_start, 'game_draw')
            observed = events('AndroidEffects')
            assert not [e for e in observed if e['event'] in ('error', 'timeout')]
            for cue in ('dice_roll', 'piece_move', 'game_win', 'game_draw'):
                assert any(e['event'] == 'playing' and e['detail']['cue'] == cue for e in observed), cue
            checks.append('fresh result plays to native completion after interruption and relaunch')
        (out / 'saved-partial.json').write_text(json.dumps({'game': saved, 'view': saved_view}, indent=2) + '\n')
        print(json.dumps({'passed': checks}, indent=2))
    finally:
        (out / 'audio-events.json').write_text(json.dumps(events('AndroidEffects'), indent=2) + '\n')
        (out / 'events.json').write_text(json.dumps(events(), indent=2) + '\n')
        (out / 'logcat.txt').write_text(adb('logcat', '-d', '-v', 'brief'))
        (out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2) + '\n')


if __name__ == '__main__':
    main()
