// Vega observes directions/OK through TV events, but Back must use its
// consuming channel. An unclaimed Back closes the app through the native
// handler; calling exitApp here as well would request exit twice.
// UserInputManager.addListener aborted on SDK 0.24; the alternate user-input
// hook did not deliver events alongside useTVEventHandler.
import { useCallback, useEffect, useState } from 'react';
import {
  useTVEventHandler,
  useKeplerBackHandler,
  type HWEvent,
} from '@amazon-devices/react-native-kepler';
import { createRemoteChannel, type RemoteEvent } from './remoteInput';

const KEYS: ReadonlyMap<string, RemoteEvent['key']> = new Map([
  ['up', 'up'],
  ['down', 'down'],
  ['left', 'left'],
  ['right', 'right'],
  // Physical remote, VVD keyboard, and VVD on-screen keypad respectively.
  ['select', 'select'],
  ['enter', 'select'],
  ['kpenter', 'select'],
  ['menu', 'menu'],
]);

export function vegaRemoteEvent(
  event: Partial<Pick<HWEvent, 'eventType' | 'eventKeyAction'>>,
): RemoteEvent | null {
  const key = KEYS.get(String(event.eventType));
  if (!key || (event.eventKeyAction !== 0 && event.eventKeyAction !== 1))
    return null;
  return { key, phase: event.eventKeyAction === 0 ? 'down' : 'up' };
}

export function useVegaRemote() {
  const [channel] = useState(createRemoteChannel);
  useTVEventHandler(
    useCallback(
      (event: HWEvent) => {
        const normalized = vegaRemoteEvent(event);
        if (normalized) channel.emit(normalized);
      },
      [channel],
    ),
  );
  const backHandler = useKeplerBackHandler();
  useEffect(() => {
    const subscription = backHandler.addEventListener(
      'hardwareBackPress',
      channel.back,
    );
    return () => subscription.remove();
  }, [backHandler, channel]);
  return channel.input;
}
