"""Check back-to-back remote navigation and value keys on the Settings screen."""
import importlib.util
import json
import sys
import time
from pathlib import Path
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('settings_smoke', Path(__file__).with_name('settings-smoke.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
h = s.h
checks = []

def state():
    """Read the latest complete report and reject settings errors."""
    s.settings_wait()
    return [e['detail'] for e in h.events('AndroidSettings') if e['event'] == 'state'][-1]

def burst(codes, index):
    """Send one Android keyevent command without inter-key sleeps, then assert the final row."""
    before = len(h.events('AndroidSettings'))
    h.adb('shell', 'input', 'keyevent', *map(str, codes))
    s.settings_wait(before)
    time.sleep(0.5)
    result = state()
    assert result['index'] == index, result
    return result

try:
    h.adb('shell', 'am', 'force-stop', h.package)
    h.adb('logcat', '-c')
    h.open_home()
    s.enter()
    before = state()
    after = burst([20] * 28 + [22], 4)
    assert after['autoSelect'] and after['sound'] == before['sound'] and after['highlights'] == before['highlights']
    after = burst([19] * 25 + [21], 3)
    choices = ['standard', 'enhanced', 'colour-blind', 'high-contrast']
    assert after['highlights'] == choices[(choices.index(before['highlights']) - 1) % 4]
    assert after['autoSelect'] and after['sound'] == before['sound']
    after = burst([20, 20, 20, 22], 6)
    assert after['turnHotseat']
    assert after['voices'] == before['voices']
    h.snapshot('burst-settings.png')
    s.restart()
    s.enter()
    restored = state()
    for field in ('music', 'sound', 'voices', 'highlights', 'autoSelect', 'turnHotseat'):
        assert restored[field] == after[field], (field, restored, after)
    checks.append('28 Down and 25 Up events wrap correctly; immediate value keys affect only the final row; preferences survive restart')
    burst([20, 20, 20, 20, 21], 4)
    burst([20, 20, 21], 6)
    burst([19, 19, 19], 3)
    while state()['highlights'] != 'standard': s.change(22)
    s.leave()
    print(json.dumps({'passed': checks}, indent=2))
finally:
    (h.out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2))
    (h.out / 'events.json').write_text(json.dumps(h.events('AndroidSettings'), indent=2))
    (h.out / 'logcat.txt').write_text(h.adb('logcat', '-d', '-v', 'brief'))
