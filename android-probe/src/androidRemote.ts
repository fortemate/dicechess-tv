import type { RemoteEvent } from '../../native/src/remoteInput';

const directions = new Set(['up', 'down', 'left', 'right']);

// The single Android TV focus target delivers direction releases. Adapt each
// completed press to the shared channel; do not also consume native OK events,
// because Pressable.onPress is the sole source of completed OK presses.
export function androidDirection(event: {
  eventType: string;
  eventKeyAction?: number;
}): RemoteEvent['key'] | null {
  return event.eventKeyAction === 1 && directions.has(event.eventType)
    ? (event.eventType as RemoteEvent['key'])
    : null;
}

export function pulseKey(
  emit: (event: RemoteEvent) => void,
  key: RemoteEvent['key'],
) {
  emit({ key, phase: 'down' });
  emit({ key, phase: 'up' });
}
