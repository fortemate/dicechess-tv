"""Vega menu parity and a single current game using real remote events.

Run after smoke.py for a fresh save. No game state or dice are injected.
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


def choose(item):
    start = len(h.events())
    h.home_select(item)
    return h.wait(start)


def resume(saved):
    state = choose('resume')
    assert state['game'] == saved
    return state


def partial(state):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        state = h.wait()
        game = state['game']
        assert game['phase'] != 'ended'
        if state['view']['bot']:
            if game['phase'] == 'handoff' and not game['moves']:
                time.sleep(0.8)
                h.press(23)
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
        h.press(23)
    raise AssertionError('No human partial turn')


try:
    h.adb('shell','am','force-stop',h.package)
    h.adb('logcat','-c')
    home = h.open_home()
    assert [(i['id'],i['label']) for i in home['items']] == [('hotseat','Play a friend'),('computer','Play the computer'),('learn','Learn to play'),('rules','Rules reference'),('settings','Settings'),('about','About')]
    h.snapshot('fresh-home.png')
    for code, selected in ((19,'about'),(22,'hotseat'),(20,'computer'),(21,'hotseat')):
        before = len(h.events('AndroidHome'))
        h.key(code)
        assert h.home_wait(before)['selected'] == selected
    checks.append('Vega labels/order, no Diagnostics, all four directions and wrap')
    state = choose('computer')
    assert state['overlay']['kind'] == 'opponent'
    before = len(h.events('AndroidHome'))
    h.key(4)
    home = h.home_wait(before)
    assert home['selected'] == 'computer' and len(home['items']) == 6
    checks.append('first computer selection cancels without saving a preview')

    state = partial(choose('hotseat'))
    friend = state['game']
    home = h.return_home(state)
    assert [i['id'] for i in home['items']] == ['resume','hotseat','computer','learn','rules','settings','about']
    assert home['selected'] == 'hotseat'
    state = resume(friend)
    h.adb('shell','am','force-stop',h.package)
    before = len(h.events())
    h.open_home()
    time.sleep(0.8)
    assert not h.events()[before:]
    state = resume(friend)
    h.return_home(state)
    checks.append('one Resume game restores exact partial turn after a cold restart; home starts no worker')

    state = choose('computer')
    h.press(20)
    h.press(23, lambda s:s['overlay']['kind']=='colour')
    h.press(20, lambda s:s['overlay']['index']==1)
    h.press(23, lambda s:s['overlay']['kind']=='confirm')
    before = len(h.events('AndroidHome'))
    h.key(23)
    h.home_wait(before)
    state = resume(friend)
    h.return_home(state)
    checks.append('Cancel switching friend to computer preserves the complete current game')

    h.configure_play_as('ask')
    state = h.choose_bot(choose('computer'),1,2)
    state = partial(state)
    bot = state['game']
    assert bot['mode']=='greedy' and bot['human']=='b'
    home = h.return_home(state)
    assert [i['id'] for i in home['items']] == ['resume','hotseat','computer','learn','rules','settings','about']
    h.snapshot('current-bot-home.png')
    state = resume(bot)
    h.return_home(state)
    state = choose('hotseat')
    assert state['overlay']['kind']=='confirm' and state['game']==bot
    before = len(h.events('AndroidHome'))
    h.key(23)
    h.home_wait(before)
    state = resume(bot)
    checks.append('confirmed computer game replaces the single slot; Cancel switching back preserves it')

    h.press(4)
    h.key(20)
    h.press(23,lambda s:s['overlay']['kind']=='confirm')
    h.key(20)
    state = h.press(23,lambda s:s['game']['phase']=='ended')
    ended = state['game']
    assert state['overlay']['kind']=='result'
    h.snapshot('bot-result-menu.png')
    state = h.press(23,lambda s:s['game']['id']!=ended['id'])
    assert state['game']['mode']=='greedy' and state['game']['human']=='b' and state['game']['colour']=='b'
    h.return_home(state)
    checks.append('Vega result menu Rematch restarts the same opponent and side without selectors')

    state = choose('hotseat')
    h.press(20)
    state = h.press(23,lambda s:s['game']['mode']=='hotseat' and s['overlay']['kind']=='none')
    h.press(4)
    h.key(20,2)
    state = h.press(23,lambda s:s['game']['phase']=='ended')
    assert state['game']['result']['reason']=='agreed-draw'
    before = len(h.events('AndroidHome'))
    h.key(23)
    home = h.home_wait(before)
    assert [i['id'] for i in home['items']] == ['hotseat','computer','learn','rules','settings','about']
    checks.append('confirmed friend game replaces computer; hotseat result returns home with no Resume')

    before = len(h.events('AndroidProbe'))
    h.open_diagnostics()
    assert any(e['event']=='ready' for e in h.events('AndroidProbe')[before:])
    h.key(20); h.key(23)  # Slow worker.
    h.key(19,2)  # Main menu.
    before = len(h.events('AndroidHome'))
    h.key(23)
    home = h.home_wait(before)
    time.sleep(3.5)
    assert [i['id'] for i in home['items']] == ['hotseat','computer','learn','rules','settings','about']
    checks.append('explicit diagnostic link works; exit disposes busy work and returns to ordinary home')

    h.key(4)
    time.sleep(0.8)
    resumed = [line for line in h.adb('shell','dumpsys','activity','activities').splitlines() if re.search(r'(topResumedActivity|mResumedActivity)',line)]
    assert resumed and all(h.package not in line for line in resumed),resumed
    h.adb('shell','am','force-stop',h.package)
    home = h.open_home()
    assert not home['migrating'] and not any(i['id']=='diagnostics' for i in home['items'])
    checks.append('Back exits the activity; a normal cold launch never reopens diagnostics')
    assert not [e for e in h.events() if e['event'] in ('bot-error','load-error','save-error')]
    print(json.dumps({'passed':checks},indent=2))
finally:
    for prefix,name in (('AndroidHome','home-events.json'),('AndroidHotseat','game-events.json'),('AndroidProbe','diagnostic-events.json')):
        (h.out/name).write_text(json.dumps(h.events(prefix),indent=2)+'\n')
    (h.out/'checks.json').write_text(json.dumps({'passed':checks},indent=2)+'\n')
    (h.out/'logcat.txt').write_text(h.adb('logcat','-d','-v','brief'))
