import React from 'react';
import { View, Text } from 'react-native';
import { Option } from './Option';
import { settingsItems, type ScreenSettings, type SettingId } from './screen';
import { settingsHint } from './settingsHint';
import { MUSIC_STEPS, DEFAULT_MUSIC, musicHeard } from './musicSetting';
import { DEFAULT_SOUND, soundHeard } from './soundSetting';
import { DEFAULT_VOICES, voicesHeard } from './voiceSetting';

// The volume as rings, like an opponent's level: filled up to the setting. Small
// enough that the label and ten rings fit the panel, which measured about
// 380 dp wide on the virtual device.
const RING = 10;
const VolumeRings = ({
  volume,
  focused,
}: {
  volume: number;
  focused: boolean;
}) => (
  <View style={{ flexDirection: 'row', marginLeft: 10 }}>
    {Array.from({ length: MUSIC_STEPS }, (_, i) => ringOf(i, volume, focused))}
  </View>
);

const ringOf = (i: number, volume: number, focused: boolean) => {
  const ink = focused ? '#f0f4f8' : '#aab8c9';
  return (
    <View
      key={i}
      testID={i < volume ? 'ring-filled' : 'ring-empty'}
      style={{
        width: RING,
        height: RING,
        borderRadius: RING / 2,
        borderWidth: 2,
        borderColor: ink,
        backgroundColor: i < volume ? ink : 'transparent',
        marginRight: 4,
      }}
    />
  );
};

export const Choices = ({
  title,
  note,
  description,
  options,
  index,
  pressed = false,
  befores = [],
  afters = [],
}: {
  title: string;
  note?: string;
  description?: string;
  options: readonly string[];
  index: number;
  // OK is held on the focused option.
  pressed?: boolean;
  // Drawn before an option's label, by position.
  befores?: (React.ReactNode | undefined)[];
  // Drawn after an option's label, by position.
  afters?: (React.ReactNode | undefined)[];
}) => (
  <View style={{ marginTop: 12 }}>
    {/* No heading role, here or on the other screens' titles: VoiceView reads
        a heading by itself as it appears, and on the Virtual Device that cut
        off the result announced just before it (#257). The title is
        announced with the menu instead (screenSpeech.ts). */}
    <Text style={{ color: '#f0f4f8', fontSize: 30, marginBottom: 8 }}>
      {title}
    </Text>
    {note ? (
      <Text style={{ color: '#aab8c9', fontSize: 20, marginBottom: 10 }}>
        {note}
      </Text>
    ) : null}
    {options.map((option, i) => (
      <Option
        key={option}
        label={option}
        focused={i === index}
        pressed={pressed}
        before={befores[i]}
        after={afters[i]}
      />
    ))}
    {description !== undefined ? (
      <Text
        style={{
          color: '#aab8c9',
          fontSize: 20,
          lineHeight: 24,
          minHeight: 24,
          marginTop: 10,
        }}
      >
        {description}
      </Text>
    ) : null}
  </View>
);

// Platforms may expose only settings backed by their runtime. Vega uses all rows.
export function SettingsPanel({
  settings,
  index,
  pressed = false,
  only,
}: {
  readonly settings: Partial<ScreenSettings>;
  readonly index: number;
  readonly pressed?: boolean;
  readonly only?: readonly SettingId[];
}) {
  const rows = settingsItems(settings).filter(
    (row) => !only || only.includes(row.id),
  );
  const sound = settings.sound ?? DEFAULT_SOUND;
  const music = settings.music ?? DEFAULT_MUSIC;
  const voices = settings.voices ?? DEFAULT_VOICES;
  const volumes: Partial<Record<SettingId, number>> = {
    sounds: soundHeard(sound) ? sound.volume : 0,
    music: musicHeard(music) ? music.volume : 0,
    voices: voicesHeard(voices) ? voices.volume : 0,
  };
  return (
    <Choices
      title="Settings"
      {...settingsHint(rows[index]?.id)}
      options={rows.map((row) => row.label)}
      index={index}
      pressed={pressed}
      afters={rows.map((row, i) =>
        volumes[row.id] === undefined ? undefined : (
          <VolumeRings
            key={row.id}
            volume={volumes[row.id]!}
            focused={i === index}
          />
        ),
      )}
    />
  );
}
