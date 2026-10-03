// Who hosts Hot Seat games, or no one, remembered across launches (#202).
//
// For now the host is a voice over the game: he is heard, not seen, until the
// game screen is redesigned around the new character portraits. Only Rolly
// hosts so far; HOSTS is where another character would join him.
//
// Rolly unless the viewer turned the host off. Anything but an explicit "off"
// reads as Rolly, like the voices, so a damaged value cannot dismiss him for
// good, and the "on" an early build stored still means Rolly.
import type { KeyValueStore } from './mmkvStore';

// The characters who can host, as Settings names them.
export const HOSTS = [{ id: 'rolly', name: 'Rolly' }] as const;

export type HostId = (typeof HOSTS)[number]['id'];
// Who hosts: one of the characters, or no one.
export type HostChoice = HostId | 'off';

export const DEFAULT_HOST: HostId = 'rolly';

// The order Settings steps through: each host, then off.
export const HOST_CHOICES: readonly HostChoice[] = [
  ...HOSTS.map((host) => host.id),
  'off',
];

// What the Settings row says the choice is.
export const hostName = (choice: HostChoice): string =>
  HOSTS.find((host) => host.id === choice)?.name ?? 'off';

// The next choice in Settings, or with `step` -1 the one before, round the
// list.
export const cycleHost = (choice: HostChoice, step: 1 | -1 = 1): HostChoice => {
  const count = HOST_CHOICES.length;
  const at = HOST_CHOICES.indexOf(choice);
  return HOST_CHOICES[(at + step + count) % count] ?? DEFAULT_HOST;
};

const KEY = 'dicechess-tv.host.v1';

export const readHost = (store: KeyValueStore): HostChoice => {
  const stored = store.getString(KEY);
  if (stored === 'off') return 'off';
  return HOSTS.find((host) => host.id === stored)?.id ?? DEFAULT_HOST;
};

export const saveHost = (store: KeyValueStore, host: HostChoice): void =>
  store.set(KEY, host);
