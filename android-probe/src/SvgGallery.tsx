import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useTVEventHandler,
} from 'react-native';
import { PIECES } from '../../native/src/pieces';
import { FACES } from '../../native/src/faces';
import type { Activity } from '../../native/src/activity';

// Import the actual game components, including all three portrait fallbacks.
const artwork = [...Object.entries(PIECES), ...Object.entries(FACES)];
const columns = 5;

export function SvgGallery({ activity }: { activity: Activity }) {
  const [selected, setSelected] = useState(0);
  const [size, setSize] = useState(48);
  useTVEventHandler((event) => {
    if (!activity.isActive() || event.eventKeyAction === 0) return;
    const step = { left: -1, right: 1, up: -columns, down: columns }[
      event.eventType
    ];
    if (step !== undefined)
      setSelected((index) => (index + step + artwork.length) % artwork.length);
  });
  useEffect(() => {
    console.info(
      `[AndroidProbe] ${JSON.stringify({
        event: 'svg-state',
        detail: {
          selected,
          name: artwork[selected][0],
          size,
          count: artwork.length,
        },
      })}`,
    );
  }, [selected, size]);
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Shared SVG artwork · Android TV</Text>
      <Text style={styles.help}>
        D-pad selects · OK switches 48 / 114 dp · Back returns · size {size} dp
      </Text>
      <Pressable
        hasTVPreferredFocus
        accessibilityLabel={`${artwork[selected][0]}, ${size} dp. Change artwork size`}
        onPress={() => {
          if (activity.isActive())
            setSize((value) => (value === 48 ? 114 : 48));
        }}
        style={styles.grid}
      >
        {artwork.map(([name, Artwork], index) => (
          <View key={name} style={styles.cell}>
            <View
              style={[
                styles.frame,
                index % 2 === 0 ? styles.light : styles.dark,
                selected === index && styles.selected,
              ]}
            >
              <Artwork size={size} />
            </View>
            <Text style={styles.label}>{name}</Text>
          </View>
        ))}
      </Pressable>
      <Text style={styles.help}>
        12 pieces + 3 fallback faces · emulator probe
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#102122', padding: 16 },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  help: { color: '#a8c6c4', fontSize: 14, marginVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '20%', height: 138, alignItems: 'center' },
  frame: {
    width: 120,
    height: 120,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  light: { backgroundColor: '#e7ddc6' },
  dark: { backgroundColor: '#65766b' },
  selected: { borderColor: '#ffd166' },
  label: { color: '#ffffff', fontSize: 11, marginTop: 2 },
});
