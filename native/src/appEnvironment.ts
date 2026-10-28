import type { RemoteInput } from './remoteInput';
import type { AudioServices } from './audio';
import type { KeyValueStore } from './keyValueStore';

// Startup services supplied by a platform wrapper. Keep their identities stable
// for a mounted app; switching storage requires a fresh mount, just like launch.
export type AppEnvironment = {
  audio: AudioServices;
  remote: RemoteInput;
  // Each handle must access the same persistent namespace. Reads and writes are
  // synchronous so the first frame contains the saved game and settings.
  openStorage(): KeyValueStore;
  appState: {
    // Unknown at launch is treated as foreground. A platform adapter must map
    // its states to active/background/inactive, and forward focus/blur events.
    // Focus alone resumes after Home; active alone cannot dismiss a blur.
    getCurrentState(): unknown;
    addEventListener(
      event: 'change' | 'blur' | 'focus',
      listener: (state: unknown) => void,
    ): { remove(): void };
  };
  // Report the initial frame and each return from the background. Platforms
  // without a fully-drawn metric can supply a no-op.
  reportFullyDrawn(): void;
};
