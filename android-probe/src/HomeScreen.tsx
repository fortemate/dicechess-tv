import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
  useTVEventHandler,
  useWindowDimensions,
} from 'react-native';
import type { Activity } from '../../native/src/activity';
import { Option } from '../../native/src/Option';
import { safeInsets } from '../../native/src/layout';
import { THEME } from '../../native/src/theme';
import { androidDirection } from './androidRemote';
import { gameStoreId, readSavedGame } from './gameSession';
import { homeItems, type HomeItem } from './homeMenu';
import { createStore } from './store';

export function HomeScreen({
  activity,
  initialFocus,
  onChoose,
}: {
  activity: Activity;
  initialFocus?: string;
  onChoose: (item: HomeItem) => void;
}) {
  const [items] = useState(() =>
    homeItems((mode) => readSavedGame(createStore(gameStoreId(mode)), mode)),
  );
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      items.findIndex((item) => item.id === initialFocus),
    ),
  );
  const { width, height } = useWindowDimensions();
  const insets = safeInsets(width, height);
  useTVEventHandler((event) => {
    const direction = androidDirection(event);
    if (!direction || !activity.isActive()) return;
    const step = direction === 'up' || direction === 'left' ? -1 : 1;
    setSelected((index) => (index + step + items.length) % items.length);
  });
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!activity.isActive()) return true;
      console.info('[AndroidHome] ' + JSON.stringify({ event: 'exit' }));
      BackHandler.exitApp();
      return true;
    });
    return () => back.remove();
  }, [activity]);
  useEffect(() => {
    console.info(
      '[AndroidHome] ' +
        JSON.stringify({
          event: 'state',
          detail: { items, selected: items[selected].id },
        }),
    );
  }, [items, selected]);
  return (
    <View
      style={[
        styles.root,
        { paddingHorizontal: insets.x, paddingVertical: insets.y },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Dice Chess</Text>
        <Text style={styles.subtitle}>
          Play against the computer or share the remote with a friend.
        </Text>
        <Pressable
          hasTVPreferredFocus
          accessibilityLabel={items[selected].label}
          onPress={() => {
            if (activity.isActive()) onChoose(items[selected]);
          }}
        >
          {items.map((item, index) => (
            <Option
              key={item.id}
              label={item.label}
              focused={selected === index}
              fontSize={26}
            />
          ))}
        </Pressable>
        <Text style={styles.description}>{items[selected].description}</Text>
        <Text style={styles.footer}>
          D-pad: choose · OK: select · Back: leave the app
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { width: '100%', maxWidth: 680 },
  title: { fontSize: 44, fontWeight: '700', color: '#ffffff', marginBottom: 8 },
  subtitle: { fontSize: 18, color: '#c7d5e1', marginBottom: 24 },
  description: { fontSize: 18, color: '#c7d5e1', marginTop: 20, minHeight: 48 },
  footer: { fontSize: 16, color: '#a8c6c4', marginTop: 12 },
});
