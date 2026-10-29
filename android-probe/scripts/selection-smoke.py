"""Opponent/side selection with real remote events and normal random rolls.

Replaces the probe's current game through its UI. Run after smoke.py to also
exercise first launch with no bot save. No dice, positions or moves are injected.
"""
import importlib.util
import json
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('remote', Path(__file__).with_name('hotseat-smoke.py'))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
checks = []


def human_ready(state):
    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        state = h.wait()
        if state['view']['side'] == state['game']['human']:
            return state
        if state['game']['phase'] == 'handoff' and not state['game']['moves']:
            time.sleep(0.8)  # Shared empty-roll OK guard.
            state = h.press(23)
        else:
            time.sleep(0.1)
    raise AssertionError(f'Opponent did not finish: {state}')


def human_move(state):
    for _ in range(30):
        state = human_ready(state)
        if state['game']['phase'] == 'roll':
            state = h.press(23)
        if state['game']['phase'] == 'move':
            return h.move(state)
        time.sleep(0.8)
        state = h.press(23)
    raise AssertionError('No playable human roll')


try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    state = h.open_game(2)
    if state['overlay']['kind'] == 'opponent':
        h.snapshot('opponent-chooser.png')
        h.press(20)
        h.press(23, lambda s: s['overlay']['kind'] == 'colour')
        h.snapshot('side-chooser.png')
        state = h.press(4, lambda s: s['overlay']['kind'] == 'opponent')
        assert state['overlay']['index'] == 1
        h.press(4, lambda s: s['overlay']['kind'] == 'home')
        h.adb('shell', 'am', 'force-stop', h.package)
        state = h.open_game(2)
        assert state['overlay']['kind'] == 'opponent'
        checks.append('Back unwinds side/opponent selection; first-launch cancellation creates no bot save')

    for index, mode in enumerate(('random', 'greedy', 'aggressive')):
        for colour_index, colour in enumerate(('random', 'w', 'b')):
            start = len(h.events())
            state = h.choose_bot(state, index, colour_index)
            game = state['game']
            assert game['mode'] == mode and game['colour'] == colour
            assert game['human'] in ('w', 'b')
            if colour != 'random':
                assert game['human'] == colour
            state = human_ready(state)
            assert state['game']['id'] == game['id']
            if game['human'] == 'b':
                states = [e['detail'] for e in h.events()[start:]
                          if e['event'] == 'state' and e['detail']['game']['id'] == game['id']]
                # An empty opening roll is legal; a nonempty one must be played.
                rolled = [s for s in states if s['view']['side'] == 'w' and s['game']['phase'] == 'move']
                if rolled:
                    assert any(s['game']['moves'] for s in states if s['view']['side'] == 'w')
                    assert any(e['event'] == 'bot-request' and e['detail']['id'] == game['id']
                               for e in h.events()[start:])
            state = human_move(state)
            h.snapshot(f'{mode}-{colour}-human-move.png')
            saved = state['game']
            # Keep the exact resolved random side and canonical partial turn.
            h.adb('shell', 'am', 'force-stop', h.package)
            restart = len(h.events())
            state = h.open_game(2)
            first = [e['detail'] for e in h.events()[restart:] if e['event'] == 'state'][0]
            assert first['game'] == saved
            checks.append(f'{mode}/{colour}: selection, human move with D-pad/OK, exact process recovery ({game["human"]})')

    # A proposed replacement must not erase the existing game before Yes.
    saved = state['game']
    h.press(4)
    h.key(20, 2)
    h.press(23, lambda s: s['overlay']['kind'] == 'opponent')
    h.press(23, lambda s: s['overlay']['kind'] == 'colour')
    h.press(23, lambda s: s['overlay']['kind'] == 'confirm')
    state = h.press(23, lambda s: s['overlay']['kind'] == 'menu')
    assert state['game'] == saved
    h.press(4)
    h.adb('shell', 'am', 'force-stop', h.package)
    state = h.open_game(2)
    assert state['game'] == saved
    checks.append('Cancel replacement preserves the prior opponent, side and partial turn after restart')
    assert not [e for e in h.events() if e['event'] in ('bot-error', 'load-error', 'save-error')]
    print(json.dumps({'passed': checks}, indent=2))
finally:
    (h.out / 'events.json').write_text(json.dumps(h.events(), indent=2) + '\n')
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2) + '\n')
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
