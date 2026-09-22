// The saving contract both frontends honour, and the one rule neither may skip.
//
// The web probe stores through IndexedDB with strict transactions; the native
// board stores through MMKV. They differ in everything except this: a snapshot
// is serialised and validated *before* anything is written, so a damaged
// snapshot can never replace a good one and a caller cannot mutate a write that
// is already in flight.

export interface SnapshotStore<T> {
  // Returns null when nothing has been saved. Throws if what was saved no
  // longer decodes, rather than silently starting a new game over it.
  load(): Promise<T | null>;
  save(snapshot: T): Promise<void>;
}

// Serialise and validate in one step, before the caller yields. Throws exactly
// what `decode` throws, so a store never has to decide what a damaged snapshot
// means.
export function encodeSnapshot<T>(
  snapshot: T,
  decode: (raw: string) => T,
): string {
  const raw = JSON.stringify(snapshot);
  decode(raw);
  return raw;
}
