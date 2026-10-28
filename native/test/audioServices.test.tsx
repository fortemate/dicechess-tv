import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import React from 'react';
import { act } from 'react-test-renderer';
import { GameApp, type AppProps } from '../src/GameApp';
import { GameScreen } from '../src/GameScreen';
import type { AppEnvironment } from '../src/appEnvironment';
import type { Catalogue, SoundConfig, MusicConfig } from '../src/audio';
import { soundGain } from '../src/soundSetting';
import { voiceGain } from '../src/voiceSetting';
import { musicGain } from '../src/musicSetting';
import {
  fakeTimers,
  fixedOptions,
  memoryStore,
  mount,
  silentSounds,
  silentMusic,
  unmount,
} from './support';

fakeTimers();

const fixture = (initial: Record<string, string> = {}, state = 'active') => {
  const calls: string[] = [];
  const soundConfigs: SoundConfig[] = [];
  const musicConfigs: MusicConfig[] = [];
  const catalogues: (Catalogue | null)[] = [];
  const spoken: string[] = [];
  const ducked: boolean[] = [];
  const suspended: { sounds?: boolean; music?: boolean } = {};
  const levels: { sound?: number; voice?: number; music?: number } = {};
  const listeners = new Map<string, (state: unknown) => void>();
  let resolveCatalogue: ((catalogue: Catalogue | null) => void) | undefined;
  const pending = new Promise<Catalogue | null>((resolve) => {
    resolveCatalogue = resolve;
  });
  const sounds = {
    ...silentSounds(),
    say: (line: { id: string }) => {
      spoken.push(line.id);
    },
    setSoundVolume: (gain: number) => {
      levels.sound = gain;
    },
    setVoiceVolume: (gain: number) => {
      levels.voice = gain;
    },
    setSuspended: (on: boolean) => {
      suspended.sounds = on;
    },
    dispose: () => {
      calls.push('dispose sounds');
    },
  };
  const music = silentMusic({
    setDucked: (on) => {
      ducked.push(on);
    },
    setCatalogue: (catalogue) => {
      catalogues.push(catalogue);
    },
    setVolume: (gain) => {
      levels.music = gain;
    },
    setSuspended: (on) => {
      suspended.music = on;
    },
    dispose: () => {
      calls.push('dispose music');
    },
  });
  const storage = memoryStore(initial);
  const environment: AppEnvironment = {
    openStorage: () => storage,
    reportFullyDrawn() {},
    appState: {
      getCurrentState: () => state,
      addEventListener(event, listener) {
        listeners.set(event, listener);
        return {
          remove: () => {
            listeners.delete(event);
          },
        };
      },
    },
    audio: {
      createSounds(config) {
        calls.push('create sounds');
        soundConfigs.push(config);
        return sounds;
      },
      createMusic(config) {
        calls.push('create music');
        musicConfigs.push(config);
        return music;
      },
      loadCatalogue() {
        calls.push('catalogue');
        return pending;
      },
    },
  };
  const options = fixedOptions();
  return {
    environment,
    calls,
    soundConfigs,
    musicConfigs,
    catalogues,
    spoken,
    ducked,
    suspended,
    levels,
    sounds,
    music,
    app: (props: AppProps = {}) => (
      <GameApp environment={environment} options={options} {...props} />
    ),
    event: (name: 'focus' | 'blur' | 'change', value?: string) =>
      act(() => {
        listeners.get(name)?.(value);
      }),
    finish: (catalogue: Catalogue | null) =>
      act(async () => {
        resolveCatalogue?.(catalogue);
      }),
  };
};

const answered = { 'dicechess-tv.tutorialOffer.v1': 'answered' };
const catalogue: Catalogue = {
  tracks: { menu: { file: 'menu.mp3', loopStart: 0, loopEnd: 30, gainDb: 0 } },
};

test('game and screen imports do not pull in a Vega audio backend', () => {
  const bundled = buildSync({
    entryPoints: ['src/GameApp.tsx'],
    bundle: true,
    write: false,
    metafile: true,
    packages: 'external',
    platform: 'neutral',
    format: 'esm',
    logLevel: 'silent',
  });
  const inputs = Object.keys(bundled.metafile.inputs);
  assert.ok(inputs.includes('src/speechTiming.ts'));
  assert.deepEqual(
    inputs.filter((file) => /\/(sound|music|vegaAudio)\.ts$/.test(file)),
    [],
  );
  const imports = Object.values(bundled.metafile.outputs).flatMap(
    (output) => output.imports,
  );
  assert.equal(
    imports.some((item) => item.path.includes('w3cmedia')),
    false,
  );
});

test('audio factories run after the first commit and receive stored settings', () => {
  const rig = fixture({
    ...answered,
    'dicechess-tv.sound.v1': 'off',
    'dicechess-tv.soundVolume.v1': '3',
    'dicechess-tv.voiceVolume.v1': '4',
    'dicechess-tv.musicVolume.v1': '5',
  });
  let during: string[] | undefined;
  const Probe = () => {
    React.useLayoutEffect(() => {
      during = [...rig.calls];
    }, []);
    return null;
  };
  const tree = mount(
    <>
      {rig.app()}
      <Probe />
    </>,
  );
  assert.deepEqual(during, []);
  assert.deepEqual(rig.calls, ['create music', 'create sounds', 'catalogue']);
  const config = rig.soundConfigs[0];
  assert.equal(config.muted, true);
  assert.equal(config.soundVolume, soundGain(3));
  assert.equal(config.voices, true);
  assert.equal(config.voiceVolume, voiceGain(4));
  assert.equal(config.suspended, false);
  assert.equal(rig.levels.music, musicGain(5));
  const screen = tree.root.findByType(GameScreen);
  act(() => {
    screen.props.onSound({ on: true, volume: 6 });
    screen.props.onVoices({ on: true, volume: 7 });
    screen.props.onMusic({ on: true, volume: 8 });
    config.onSpeech?.(true);
    config.onSpeech?.(false);
  });
  assert.deepEqual(rig.levels, {
    sound: soundGain(6),
    voice: voiceGain(7),
    music: musicGain(8),
  });
  assert.deepEqual(rig.ducked, [true, false]);
});

test('the first tutorial line reaches the service when its player attaches', () => {
  const rig = fixture();
  mount(rig.app());
  assert.deepEqual(rig.spoken, ['thinkle_tutor_offer_1']);
});

test('background launch is suspended and focus, blur and disposal reach both services', () => {
  const rig = fixture(answered, 'background');
  mount(rig.app());
  assert.equal(rig.soundConfigs[0].suspended, true);
  assert.deepEqual(rig.suspended, { sounds: true, music: true });
  rig.event('focus');
  assert.deepEqual(rig.suspended, { sounds: false, music: false });
  rig.event('blur');
  rig.event('change', 'active');
  assert.deepEqual(rig.suspended, { sounds: true, music: true });
  unmount();
  assert.deepEqual(rig.calls.slice(-2), ['dispose sounds', 'dispose music']);
});

test('a stable service is retained on rerender while diagnostics use the latest reporter', () => {
  const rig = fixture(answered);
  const first: string[] = [];
  const next: string[] = [];
  const tree = mount(rig.app({ onState: (line) => first.push(line) }));
  act(() => {
    tree.update(rig.app({ onState: (line) => next.push(line) }));
  });
  rig.soundConfigs[0].report?.('sound diagnostic');
  rig.musicConfigs[0].report?.('music diagnostic');
  assert.equal(first.includes('sound diagnostic'), false);
  assert.ok(next.includes('sound diagnostic'));
  assert.ok(next.includes('music diagnostic'));
  assert.deepEqual(rig.calls, ['create music', 'create sounds', 'catalogue']);
});

for (const result of [catalogue, null]) {
  test(`catalogue completion ${result ? 'enables' : 'omits'} the music setting`, async () => {
    const rig = fixture(answered);
    const tree = mount(rig.app());
    assert.equal(tree.root.findByType(GameScreen).props.musicAvailable, false);
    await rig.finish(result);
    assert.deepEqual(rig.catalogues, [result]);
    assert.equal(
      tree.root.findByType(GameScreen).props.musicAvailable,
      result !== null,
    );
  });
}

test('a catalogue arriving after unmount never reaches a disposed player', async () => {
  const rig = fixture(answered);
  mount(rig.app());
  unmount();
  await rig.finish(catalogue);
  assert.deepEqual(rig.catalogues, []);
});

test('explicit test players bypass factories and remain owned by the caller', () => {
  const rig = fixture(answered);
  mount(rig.app({ sounds: rig.sounds, music: rig.music }));
  unmount();
  assert.deepEqual(rig.calls, []);
});
