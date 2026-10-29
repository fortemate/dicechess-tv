import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  useTVEventHandler,
} from 'react-native';
import { ActivityContext, type Activity } from '../../native/src/activity';
import {
  createRemoteChannel,
  RemoteInputContext,
} from '../../native/src/remoteInput';
import { THEME } from '../../native/src/theme';
import { androidDirection, pulseKey } from './androidRemote';

// One native focus target feeds the existing shared remote hook. Child screens
// own navigation; Android supplies completed directional/OK presses and Back.
export function RemoteSurface({
  activity,
  label,
  children,
}: {
  activity: Activity;
  label: string;
  children: React.ReactNode;
}) {
  const [channel] = useState(createRemoteChannel);
  useTVEventHandler((event) => {
    const key = androidDirection(event);
    if (key && activity.isActive()) pulseKey(channel.emit, key);
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      channel.back,
    );
    return () => subscription.remove();
  }, [channel]);
  return (
    <RemoteInputContext.Provider value={channel.input}>
      <ActivityContext.Provider value={activity}>
        <Pressable
          style={styles.root}
          hasTVPreferredFocus
          accessibilityLabel={label}
          onPress={() => {
            if (activity.isActive()) pulseKey(channel.emit, 'select');
          }}
        >
          {children}
        </Pressable>
      </ActivityContext.Provider>
    </RemoteInputContext.Provider>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.background },
});
