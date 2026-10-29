"""Exercise the shared rules screen from home and games with real remote keys.

Keeps app data; replaces only the current probe game through confirmation.
No positions, rolls or moves are injected. Captures all canonical rule topics.
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
root = Path(__file__).resolve().parents[2]
topics = json.loads(subprocess.check_output([
    'node','--input-type=module','-e',
    "import {RULES} from './src/core/rules.ts'; process.stdout.write(JSON.stringify(RULES));"
],cwd=root,text=True))
checks = []


def rule_wait(since=0, index=None):
    deadline = time.monotonic()+15
    while time.monotonic()<deadline:
        states = [e['detail'] for e in h.events('AndroidRules')[since:] if e['event']=='state']
        if index is not None:
            expected = f'rules {index+1}/{len(topics)} | topic {topics[index]["id"]}'
            states = [s for s in states if s==expected]
        if states:
            return states[-1]
        time.sleep(0.1)
    raise AssertionError(f'No rules state {index}: {h.events("AndroidRules")[-3:]}')


def rule_key(code,index):
    before = len(h.events('AndroidRules'))
    h.key(code)
    return rule_wait(before,index)


def enter_rules(state):
    if state['focus']['selected']:
        state = h.press(4)
    if state['overlay']['kind']!='menu':
        state = h.press(4,lambda s:s['overlay']['kind']=='menu')
    target = 5 if state['game']['mode']=='hotseat' else 4
    for _ in range(7):
        if state['overlay']['index']==target:
            break
        state = h.press(20)
    assert state['overlay']['index']==target
    before = len(h.events('AndroidRules'))
    state = h.press(23,lambda s:s['overlay']['kind']=='rules')
    rule_wait(before,0)
    return state


def choose(item):
    before = len(h.events())
    h.home_select(item)
    return h.wait(before)


def next_bot_turn(state):
    for _ in range(30):
        if state['view']['side']=='w':
            if state['game']['phase']=='roll':
                state=h.press(23)
            while state['game']['phase']=='move':
                state=h.move(state)
            time.sleep(0.8)
            state=h.press(23)
        deadline=time.monotonic()+20
        while time.monotonic()<deadline:
            state=h.wait()
            if state['view']['side']=='b' and state['game']['phase']=='move':
                return state
            assert state['game']['phase']!='ended'
            if state['view']['side']=='b' and state['game']['phase']=='handoff' and not state['game']['moves']:
                time.sleep(0.8)
                state=h.press(23)
                break
            time.sleep(0.08)
        else:
            raise AssertionError('No bot move phase')
    raise AssertionError('No playable bot roll')


try:
    h.adb('shell','am','force-stop',h.package)
    h.adb('logcat','-c')
    home=h.open_home()
    assert home['items'][-1]['id']=='rules' and home['items'][-1]['label']=='Rules reference'
    before=len(h.events('AndroidRules'))
    h.home_select('rules')
    rule_wait(before,0)
    assert not h.events(), 'Opening rules from home must not mount a game'
    for index,topic in enumerate(topics):
        if index: rule_key(20,index)
        h.snapshot(f'rules-{topic["id"]}.png')
    rule_key(20,0)
    rule_key(19,len(topics)-1)
    checks.append('home opens shared rules; all nine topics, Up/Down wrap and screenshots')
    stable=rule_wait()
    count=len(h.events('AndroidHome'))
    for code in (21,22,23):
        h.key(code)
        time.sleep(0.2)
        assert rule_wait()==stable
        assert len(h.events('AndroidHome'))==count
    rule_key(19,len(topics)-2)
    checks.append('Left/Right/OK keep the topic open; subsequent directional input still works')

    h.key(3)
    time.sleep(0.6)
    h.adb('shell','am','start','-n',f'{h.package}/.MainActivity')
    time.sleep(0.8)
    assert rule_wait()==f'rules {len(topics)-1}/{len(topics)} | topic {topics[-2]["id"]}'
    rule_key(20,len(topics)-1)
    before=len(h.events('AndroidHome'))
    h.key(4)
    assert h.home_wait(before)['selected']=='rules'
    checks.append('system Home/return preserves the rules topic and focus; Back restores home selection')

    state=choose('hotseat')
    if state['overlay']['kind']=='confirm':
        h.press(20)
        state=h.press(23)
    for _ in range(30):
        if state['game']['phase']!='move':
            time.sleep(0.8)
            state=h.press(23)
        if state['game']['phase']=='move':
            state=h.move(state)
            if state['game']['phase']=='move': break
    else: raise AssertionError('No partial turn')
    saved=state['game']
    state=enter_rules(state)
    rule_key(20,1)
    h.key(23)
    rule_key(20,2)
    state=h.press(4,lambda s:s['overlay']=={'kind':'menu','index':5})
    assert state['game']==saved
    state=h.press(4,lambda s:s['overlay']['kind']=='none')
    assert state['game']==saved
    h.return_home(state)
    checks.append('rules during a friend partial turn return to the same menu row and preserve the full save')

    before=len(h.events('AndroidRules'))
    h.home_select('rules')
    rule_wait(before,0)
    h.adb('shell','am','force-stop',h.package)
    h.open_home()
    state=choose('resume')
    assert state['game']==saved
    h.return_home(state)
    checks.append('process death while reading rules leaves the exact current game resumable')

    state=h.choose_bot(choose('computer'),0,1)
    state=next_bot_turn(state)
    state=enter_rules(state)
    saved=state['game']
    assert state['view']['side']=='b'
    rule_key(20,1)
    time.sleep(2)
    assert h.wait()['game']==saved and h.wait()['overlay']['kind']=='rules'
    state=h.press(4,lambda s:s['overlay']=={'kind':'menu','index':4})
    time.sleep(0.8)
    assert h.wait()['game']==saved
    before=len(h.events())
    h.key(4)
    state=h.wait(before,lambda s:s['view']['side']=='w' and s['game']['phase']=='roll',timeout=30)
    assert state['game']['id']==saved['id']
    checks.append('rules pause a real bot turn; Back preserves menu focus and the resumed bot finishes legally')
    assert not [e for e in h.events() if e['event'] in ('bot-error','load-error','save-error')]
    print(json.dumps({'passed':checks},indent=2))
finally:
    for prefix,name in (('AndroidRules','rules-events.json'),('AndroidHome','home-events.json'),('AndroidHotseat','game-events.json')):
        (h.out/name).write_text(json.dumps(h.events(prefix),indent=2)+'\n')
    (h.out/'checks.json').write_text(json.dumps({'passed':checks},indent=2)+'\n')
    (h.out/'logcat.txt').write_text(h.adb('logcat','-d','-v','brief'))
