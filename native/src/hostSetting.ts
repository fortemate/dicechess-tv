// Who hosts Hot Seat games, or no one, remembered across launches (#202):
// Prowla the cat (#258), who hosts though no bot plays her yet, or Rolly.
//
// Prowla unless the viewer turned the host off or chose another; Rolly was the
// default until the owner chose Prowla on 2026-10-06. Anything but an explicit
// "off" or a host's id reads as Prowla, like the voices, so a damaged value
// cannot dismiss her for good. The "on" an early build stored, when Rolly was
// the only host, now reads as Prowla too.
import { DEFAULT_HOST, HOST_IDS, type HostId } from '../../src/core/hostVoice';
import type { CharacterId } from './Portrait';
import type { KeyValueStore } from './mmkvStore';

export { DEFAULT_HOST, type HostId };

// The characters who can host, as Settings names them, and the portrait each
// shows beside her line.
const HOST_INFO: Readonly<
  Record<HostId, { readonly name: string; readonly portrait: CharacterId }>
> = {
  rolly: { name: 'Rolly', portrait: 'rolly' },
  prowla: { name: 'Prowla', portrait: 'cat' },
};

export const HOSTS = HOST_IDS.map((id) => ({ id, ...HOST_INFO[id] }));

// Who hosts: one of the characters, or no one.
export type HostChoice = HostId | 'off';

export const hostPortrait = (host: HostId): CharacterId =>
  HOST_INFO[host].portrait;

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
