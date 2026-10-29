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
import { RESUME_OPTION } from '../../native/src/screen';
import { Option } from '../../native/src/Option';
import { safeInsets } from '../../native/src/layout';
import { THEME } from '../../native/src/theme';
import { androidDirection } from './androidRemote';
import {
  GAME_KEY,
  GAME_STORE,
  legacyGameStoreId,
  readSavedGame,
} from './gameSession';
import {
  homeItems,
  legacyGames,
  migrateGame,
  gameMode,
  type HomeItem,
  type LegacyGame,
} from './homeMenu';
import type { Game } from '../../src/core/game';
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
  const [store] = useState(() => createStore(GAME_STORE));
  const [saved, setSaved] = useState<{
    game: Game | null;
    legacy: LegacyGame[];
    unreadable: boolean;
  }>(() => {
    try {
      const game = readSavedGame(store);
      return {
        game,
        legacy: game
          ? []
          : legacyGames((mode) =>
              createStore(legacyGameStoreId(mode)).getString(GAME_KEY),
            ),
        unreadable: false,
      };
    } catch {
      return { game: null, legacy: [], unreadable: true };
    }
  });
  const [error, setError] = useState('');
  const migrating = saved.legacy.length > 0;
  const items = migrating
    ? saved.legacy.map(({ mode, label, description }) => ({
        id: `migrate-${mode}`,
        label,
        description,
      }))
    : homeItems(saved.game, saved.unreadable);
  const choose = () => {
    if (!activity.isActive()) return;
    if (migrating) {
      try {
        const game = migrateGame(store, saved.legacy[selected]);
        setError('');
        setSaved({ game, legacy: [], unreadable: false });
        setSelected(0);
        if (game.phase === 'ended')
          onChoose({
            id: 'resume',
            label: RESUME_OPTION,
            description: '',
            action: { kind: 'game', mode: gameMode(game), intent: 'continue' },
          });
      } catch (failure) {
        setError(
          `${failure instanceof Error ? failure.message : String(failure)}. Original saves are unchanged. Back returns to the choice.`,
        );
      }
    } else {
      onChoose(homeItems(saved.game, saved.unreadable)[selected]);
    }
  };
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
    if (!direction || !activity.isActive() || error) return;
    const step = direction === 'up' || direction === 'left' ? -1 : 1;
    setSelected((index) => (index + step + items.length) % items.length);
  });
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!activity.isActive()) return true;
      if (error) {
        setError('');
        return true;
      }
      console.info('[AndroidHome] ' + JSON.stringify({ event: 'exit' }));
      BackHandler.exitApp();
      return true;
    });
    return () => back.remove();
  }, [activity, error]);
  useEffect(() => {
    console.info(
      '[AndroidHome] ' +
        JSON.stringify({
          event: 'state',
          detail: { items, selected: items[selected].id, migrating, error },
        }),
    );
  }, [items, selected, migrating, error]);
  return (
    <View
      style={[
        styles.root,
        { paddingHorizontal: insets.x, paddingVertical: insets.y },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {migrating ? 'Choose a saved game' : 'Dice Chess'}
        </Text>
        <Text style={styles.subtitle}>
          {migrating
            ? 'Choose the current game. Original saves will be kept.'
            : 'Play against the computer or share the remote with a friend.'}
        </Text>
        <Pressable
          hasTVPreferredFocus
          accessibilityLabel={items[selected].label}
          onPress={choose}
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
        <Text style={styles.description}>
          {error || items[selected].description}
        </Text>
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
