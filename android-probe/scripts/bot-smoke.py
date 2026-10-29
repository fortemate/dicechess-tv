"""Remote-only Rolly game checks on an explicitly selected Android emulator.

Replaces the bot save through confirmation; keeps the separate hotseat save.
Uses normal random rolls and the packaged worker, with no state/dice injection.
"""
import importlib.util
import json
from pathlib import Path
import time
import sys

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('remote', Path(__file__).with_name('hotseat-smoke.py'))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
checks = []


def settled():
    return h.wait(predicate=lambda s: s['game']['mode'] == 'random')


def no_advance(saved, seconds=1.5):
    time.sleep(seconds)
    assert settled()['game'] == saved


def next_bot_turn(state):
    for _ in range(30):
        if state['view']['side'] == 'w':
            if state['game']['phase'] == 'roll':
                state = h.press(23)
            while state['game']['phase'] == 'move':
                state = h.move(state)
            time.sleep(0.8)
            state = h.press(23)
        start = len(h.events())
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            state = settled()
            if state['view']['side'] == 'b' and state['game']['phase'] == 'move':
                return state
            if state['game']['phase'] == 'ended':
                raise AssertionError('Unexpected early result')
            if state['view']['side'] == 'b' and state['game']['phase'] == 'handoff' and not state['game']['moves']:
                time.sleep(0.8)
                state = h.press(23)
                break
            time.sleep(0.08)
        else:
            raise AssertionError(f'No bot move phase: {h.events()[start:]}')
    raise AssertionError('No playable bot roll in 30 turns')


try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    state = h.open_game(2)
    assert state['game']['mode'] == 'random' and state['game']['human'] == 'w'
    h.press(4)
    if state['game']['phase'] != 'ended':
        h.key(20, 2)
    h.press(23, lambda s: s['overlay']['kind'] == 'confirm')
    h.key(20)
    state = h.press(23, lambda s: s['game']['phase'] == 'roll' and s['view']['side'] == 'w')
    h.snapshot('new-bot-game.png')
    checks.append('Rolly/White starts through confirmed replacement with a separate save')
    state = next_bot_turn(state)
    # Pause while the worker is outstanding or its paced path is being presented.
    state = h.press(4, lambda s: s['overlay']['kind'] == 'menu')
    saved = state['game']
    assert state['view']['side'] == 'b' and saved['phase'] in ('move', 'handoff')
    no_advance(saved)
    h.snapshot('paused-bot.png')
    checks.append('Back opens the bot-turn menu and stops further move presentation')
    # A process restart exposes exactly the saved bot snapshot before continuing.
    h.adb('shell', 'am', 'force-stop', h.package)
    start = len(h.events())
    state = h.open_game(2)
    first = [e['detail'] for e in h.events()[start:] if e['event'] == 'state'][0]
    assert first['game'] == saved
    # Home while the restored bot step/search is pending; no commit in background.
    h.key(3)
    time.sleep(0.3)
    away = settled()['game']
    no_advance(away, 2)
    resume_start = len(h.events())
    h.adb('shell', 'am', 'start', '-n', f'{h.package}/.MainActivity')
    state = h.wait(resume_start, predicate=lambda s: s['view']['side'] == 'w' and s['game']['phase'] == 'roll', timeout=30)
    assert state['game']['id'] == saved['id']
    checks.append('process death restores the bot snapshot; Home pauses commits and return completes its turn')
    h.snapshot('human-after-bot.png')
    # Verify a bot reply actually came through the worker and moved pieces.
    all_events = h.events()
    assert any(e['event'] == 'bot-request' for e in all_events)
    bot_states = [e['detail'] for e in all_events if e['event'] == 'state' and e['detail']['view']['side'] == 'b']
    assert any(s['game']['moves'] for s in bot_states)
    checks.append('packaged background worker produces a legal bot move and hands control back')
    # Human partial turn survives diagnostics and process restart too.
    for _ in range(30):
        if state['view']['side'] == 'w' and state['game']['phase'] == 'roll':
            state = h.press(23)
        if state['view']['side'] == 'w' and state['game']['phase'] == 'move':
            state = h.move(state)
            if state['game']['phase'] == 'move':
                break
        state = next_bot_turn(state)
        after_bot = len(h.events())
        state = h.wait(after_bot, predicate=lambda s: s['view']['side'] == 'w' and s['game']['phase'] == 'roll', timeout=30)
    else:
        raise AssertionError('No human partial turn')
    partial = state['game']
    h.press(4)
    h.key(20, 3)
    h.press(23, lambda s: s['overlay']['kind'] == 'home')
    time.sleep(0.5)
    # Adjacent hotseat entry must retain its independent game mode/save.
    h.key(20)
    friend = h.press(23)
    assert friend['game']['mode'] == 'hotseat'
    h.adb('shell', 'am', 'force-stop', h.package)
    state = h.open_game(2)
    assert state['game'] == partial
    checks.append('human partial turn survives diagnostics/relaunch; hotseat remains independent')
    h.press(4); h.key(20)
    h.press(23, lambda s: s['overlay']['kind'] == 'confirm')
    h.key(20)
    ended = h.press(23, lambda s: s['game']['phase'] == 'ended')['game']
    assert ended['result']['winner'] == 'b'
    h.snapshot('bot-result.png')
    h.press(23); h.press(23)
    canceled = h.press(23, lambda s: s['overlay']['kind'] == 'menu')
    assert canceled['game'] == ended and canceled['overlay']['index'] == 2
    h.press(23); h.key(20)
    state = h.press(23, lambda s: s['game']['phase'] == 'roll')
    assert state['game']['id'] != ended['id'] and state['game']['human'] == 'w'
    checks.append('resignation result and canceled/confirmed same-opponent rematch work with the remote')
    assert not [e for e in h.events() if e['event'] in ('bot-error','load-error','save-error')]
    print(json.dumps({'passed':checks},indent=2))
finally:
    (h.out/'events.json').write_text(json.dumps(h.events(),indent=2)+'\n')
    (h.out/'checks.json').write_text(json.dumps({'passed':checks},indent=2)+'\n')
    (h.out/'logcat.txt').write_text(h.adb('logcat','-d','-v','brief'))
