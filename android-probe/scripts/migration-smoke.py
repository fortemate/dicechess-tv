"""Upgrade two real legacy saves, verify current-game persistence and old saves.

Before running, create both games with the preceding APK/home suite and copy
that APK to build/menu-upgrade/before.apk. This suite installs old/new APKs over
one another without clearing data. It never writes fixtures into app storage.
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
root = Path(__file__).resolve().parents[1]
previous = root/'build/menu-upgrade/before'
old_apk = root/'build/menu-upgrade/before.apk'
new_apk = root/'android/app/build/outputs/apk/release/app-release.apk'
checks = []
events = json.loads((previous/'game-events.json').read_text())
old = {}
for event in events:
    if event['event'] == 'state':
        game = event['detail']['game']
        old['hotseat' if game['mode']=='hotseat' else 'bot'] = game
assert len(old)==2


def install(path):
    h.adb('shell','am','force-stop',h.package)
    h.adb('install','-r',str(path))


def choose(item):
    before = len(h.events())
    h.home_select(item)
    return h.wait(before)


try:
    install(new_apk)
    h.adb('logcat','-c')
    home = h.open_home()
    assert home['migrating']
    assert [i['id'] for i in home['items']] == ['migrate-hotseat','migrate-bot']
    h.snapshot('choose-legacy-save.png')
    h.key(4)
    h.adb('shell','am','force-stop',h.package)
    home = h.open_home()
    assert home['migrating']
    checks.append('update finds both original games; exiting before selection leaves migration pending')
    before = len(h.events('AndroidHome'))
    h.home_select('migrate-bot')
    home = h.home_wait(before,lambda s:not s['migrating'])
    assert [i['id'] for i in home['items']] == ['resume','hotseat','computer']
    state = choose('resume')
    assert state['game']==old['bot']
    h.snapshot('migrated-bot-turn.png')
    checks.append('chosen computer game migrates with identical position, dice, moves, phase and side')
    state = h.move(state)
    current = state['game']
    h.return_home(state)
    h.adb('shell','am','force-stop',h.package)
    home = h.open_home()
    assert not home['migrating']
    assert choose('resume')['game']==current
    checks.append('play advances the new current slot; restart neither repeats migration nor reimports old data')

    # Read originals using the old production-shaped UI, with no privileged
    # filesystem access and no fixture injection.
    install(old_apk)
    h.open_home()
    assert choose('continue-hotseat')['game']==old['hotseat']
    h.adb('shell','am','force-stop',h.package)
    h.open_home()
    assert choose('continue-bot')['game']==old['bot']
    checks.append('reinstalling the old APK still reads both original games exactly after new gameplay')
    install(new_apk)
    home = h.open_home()
    assert not home['migrating']
    assert choose('resume')['game']==current
    checks.append('returning to new APK resumes the new current game, not either archived legacy game')
    print(json.dumps({'passed':checks},indent=2))
finally:
    for prefix,name in (('AndroidHome','home-events.json'),('AndroidHotseat','game-events.json')):
        (h.out/name).write_text(json.dumps(h.events(prefix),indent=2)+'\n')
    (h.out/'checks.json').write_text(json.dumps({'passed':checks},indent=2)+'\n')
    (h.out/'logcat.txt').write_text(h.adb('logcat','-d','-v','brief'))
