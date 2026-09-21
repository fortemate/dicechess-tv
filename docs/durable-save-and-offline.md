# Durable save and offline verification — 21 September 2026

## Problem and change

The localStorage version could display `Reply validated and saved`, then restore an older position after a rapid forced stop. Waiting longer before stopping happened to restore the new position, but a delay is not a save protocol.

`SaveStore` uses IndexedDB read/write transactions with `durability: 'strict'`. A snapshot is validated and serialized before yielding. The promise resolves only on the transaction's `complete` event, not on the individual `put` request's success. The app advances its visible snapshot and starts the next bot only after this acknowledgment. Unsupported strict mode, transaction aborts and damaged data surface errors. Loading and pending writes suppress input; accepted bot replies stop their computation watchdog before saving.

Legacy localStorage data is migrated only if the database has no snapshot. It must validate and commit successfully first. A committed reset remains authoritative over the retained legacy entry.

This follows the [IndexedDB transaction durability contract](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction). Browser implementation behavior still needs device evidence; strict mode is not a claim of protection from every power failure or storage fault.

## Verified environment and results

- Same Apple Silicon MacBook Air; Vega CLI 1.3.4, SDK 0.23.9221, VVD OS 1.1; RN 0.72 / WebView 3.5.7.
- The owner confirmed the board, selecting/moving the knight, and `done` / `Reply validated and saved`.
- The existing completed localStorage game migrated into IndexedDB and restored.
- A committed reset survived forced stop and relaunch without resurrecting the old game.
- Three successive b1-c3 / Random reply runs were force-stopped automatically as soon as a committed `done` snapshot was reported. The CLI stop took approximately one second. Each relaunch matched the complete saved DFEN and `done`, with `Completed result restored`.
- Browser keyboard play/reload also matched the exact DFEN; moved pieces and the restored state were visually inspected.
- The VVD crash-history buffer remained empty.

The local harness observes the DOM's phase, save status and `data-dfen` via the SDK WebView bridge. A temporary loopback receiver triggers force-stop and compares the next launch. It does not provide game rules, assets, bot computation or saves. Harness code and raw reports remain local outside this repository.

## Offline test

Both guest network links (emulated Ethernet and Wi-Fi) were disabled at the emulator monitor for a 27-second window. The host Mac's network was unchanged. A prepared in-guest SDK input/lifecycle script ran within that window:

1. An external HTTP connectivity control that succeeded online failed with a timeout offline.
2. Force-stop the app and cold-launch the installed package.
3. Reset the diagnostic; select b1 and play a3 using D-pad/OK input.
4. Wait for the local bot reply and committed save.
5. Force-stop and cold-launch again.

DOM reports during the offline window showed the new a3 position, a committed local bot reply and restoration of exactly the same completed DFEN. Guest logs timestamped the full scenario inside the disabled interval. The monitor restored both links in a `finally` block, and the same connectivity control succeeded afterward. A debug/reverse-port channel was used only for observation; no development server served the game.

This tests app cold launches on the running VVD, not an emulator reboot or physical-device power cycle. Physical Fire TV testing and interrupted full-game states remain future gates.

## Regression coverage

The Node tests use development-only fake-indexeddb to check transaction semantics, not physical disk durability:

- Close/reopen after acknowledged initial, human-only and completed snapshots preserves their derived position, dice and phase.
- A successful put followed by transaction abort rejects and retains the previous snapshot.
- Valid legacy migration works; a later reset takes precedence over legacy data.
- Invalid migration/write cannot create or replace a valid save.
- Ignored strict durability is rejected.
- Mutating the caller's object cannot alter a pending captured snapshot.

The installed-runtime forced-stop checks provide the complementary evidence that an in-memory IndexedDB test cannot supply.
