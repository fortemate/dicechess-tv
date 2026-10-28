"""Exercise only the disposable probe app via a specified Android device.

Run after installing the standalone APK. This clears the probe's saved data.
It does not install, stop, or clear the Vega/product application.
"""
import argparse
import json
from pathlib import Path
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--adb', default='adb')
parser.add_argument('--serial', required=True)
parser.add_argument('--output', default='build/smoke')
args = parser.parse_args()
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
package = 'com.fortemate.dicechesstv.probe'


def adb(*command, binary=False):
    return subprocess.check_output([args.adb, '-s', args.serial, *command], text=not binary)


def events():
    result = []
    for line in adb('logcat', '-d', '-v', 'brief', 'ReactNativeJS:I', '*:S').splitlines():
        if '[AndroidProbe] ' in line:
            try:
                result.append(json.loads(line.split('[AndroidProbe] ', 1)[1]))
            except json.JSONDecodeError:
                pass
    return result


def wait(event, since=0, timeout=45, predicate=lambda detail: True):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        observed = events()[since:]
        failures = [e for e in observed if e['event'] in ('action-fail', 'bot-fail')]
        if failures:
            raise AssertionError(failures)
        matches = [e for e in observed if e['event'] == event and predicate(e['detail'])]
        if matches:
            return matches[-1]['detail']
        time.sleep(0.25)
    raise AssertionError(f'Timed out waiting for {event}; last events: {events()[-8:]}')


def key(code, times=1):
    for _ in range(times):
        adb('shell', 'input', 'keyevent', str(code))
        time.sleep(0.12)


def launch():
    adb('shell', 'am', 'start', '-n', f'{package}/.MainActivity')


checks = []
try:
    adb('shell', 'am', 'force-stop', package)
    adb('shell', 'pm', 'clear', package)
    adb('logcat', '-c')
    launch()
    ready = wait('ready')
    assert ready['tv'], ready
    checks.append('TV launch')
    key(23)  # OK: real canonical bot + stale result + invalid request
    wait('bot-pass')
    wait('stale-pass')
    wait('error-pass')
    checks.append('canonical bot, stale reply rejection, worker error')

    key(20)  # Slow worker
    start = len(events())
    key(23)
    assert wait('bot-start', start)['slow']
    key(20)  # Move selection during background work
    wait('selection', start, predicate=lambda detail: detail == 2)
    key(4)   # Back cancels while background work is still pending
    wait('dispose-pass', start)
    time.sleep(3.3)
    assert not any(e['event'] == 'bot-pass' for e in events()[start:])
    checks.append('D-pad and Back during busy runtime; disposed reply discarded')

    key(19)  # Select the slow worker again
    start = len(events())
    key(23)
    assert wait('bot-start', start)['slow']
    key(20)  # Replace game while the old runtime is still computing
    key(23)
    wait('dispose-pass', start)
    assert any(e == {'event': 'canceled', 'detail': 'replacement'} for e in events()[start:])
    time.sleep(3.3)
    assert not any(e['event'] == 'bot-pass' for e in events()[start:])
    checks.append('new-game replacement discards the old runtime response')

    key(20)  # Selected 3: save partial turn
    start = len(events())
    key(23)
    saved = wait('save-pass', start)
    assert saved['phase'] == 'move' and saved['moves'] and saved['roll'] == [1, 1, 1]
    adb('shell', 'am', 'force-stop', package)
    start = len(events())
    launch()
    restored = wait('ready', start)
    assert restored['restored'] and restored['game'] == saved
    checks.append('process-death MMKV recovery preserves partial turn and dice')

    key(20)  # Slow worker after restart
    start = len(events())
    key(23)
    wait('bot-start', start)
    key(3)   # Home
    wait('lifecycle', start)
    time.sleep(0.5)
    launch()
    result = wait('bot-pass', start)
    assert result['heartbeats'] > 20, result
    wait('error-pass', start)
    checks.append('background/resume and RN heartbeat while runtime is busy')

    key(20, 4)  # From 1 to 5: audio
    start = len(events())
    key(23)
    wait('audio-finished', start)
    checks.append('packaged PCM audio native completion event')
    key(20)  # Seek + parallel
    start = len(events())
    key(23)
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        finished = [e for e in events()[start:] if e['event'] == 'audio-finished']
        if len(finished) >= 2:
            break
        time.sleep(0.2)
    assert len(finished) == 2, events()[start:]
    checks.append('seek and parallel players complete')

    key(20)  # Tutorial voice
    start = len(events())
    key(23)
    voice = wait('audio-start', start)
    assert voice['voice']
    wait('audio-finished', start)
    checks.append('pinned tutorial MP3 native completion event')

    key(19, 2)  # One player, then interrupt it with Home
    start = len(events())
    key(23)
    wait('audio-start', start)
    key(3)
    time.sleep(1.3)
    assert not any(e['event'] == 'audio-finished' for e in events()[start:])
    launch()
    checks.append('background releases audio before completion')
    key(20, 3)  # From audio (5) to SVG gallery (8)
    start = len(events())
    key(23)
    state = wait('svg-state', start)
    assert state == {'selected': 0, 'name': 'b', 'size': 48, 'count': 15}, state
    time.sleep(0.5)  # Let the native SVG renderer draw before capturing pixels.
    (out / 'svg-48.png').write_bytes(adb('exec-out', 'screencap', '-p', binary=True))
    names = [state['name']]
    for index in range(1, 15):
        start = len(events())
        key(22)  # Right visits all shared pieces and fallback faces.
        state = wait('svg-state', start, predicate=lambda detail: detail['selected'] == index)
        names.append(state['name'])
    assert names == ['b', 'k', 'n', 'p', 'q', 'r', 'B', 'K', 'N', 'P', 'Q', 'R',
                     'money-mouth-face', 'smiling-face-with-horns', 'zany-face'], names
    # Check horizontal wrap and both vertical directions, then return to index 0.
    for code, selected in [(22, 0), (21, 14), (19, 9), (20, 14), (22, 0)]:
        start = len(events())
        key(code)
        wait('svg-state', start, predicate=lambda detail: detail['selected'] == selected)
    start = len(events())
    key(23)
    wait('svg-state', start, predicate=lambda detail: detail['size'] == 114)
    time.sleep(0.5)
    (out / 'svg-114.png').write_bytes(adb('exec-out', 'screencap', '-p', binary=True))
    start = len(events())
    key(23)
    wait('svg-state', start, predicate=lambda detail: detail['size'] == 48)
    key(4)
    wait('svg-closed', start)
    start = len(events())
    key(23)  # Focus must return to the same menu action, without another D-pad press.
    wait('svg-state', start, predicate=lambda detail: detail['selected'] == 0 and detail['size'] == 48)
    key(4)
    wait('svg-closed', start)
    checks.append('SVG gallery: 15 selections, four directions, wrap, 48/114/48 sizes, Back and reopen')
    (out / 'screen.png').write_bytes(adb('exec-out', 'screencap', '-p', binary=True))
    print(json.dumps({'passed': checks}, indent=2))
finally:
    (out / 'events.json').write_text(json.dumps(events(), indent=2) + '\n')
    (out / 'logcat.txt').write_text(adb('logcat', '-d', '-v', 'brief'))
    (out / 'checks.json').write_text(json.dumps({'passed': checks}, indent=2) + '\n')
