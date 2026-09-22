// Where the dice get their randomness on this device.
//
// The web probe uses crypto.getRandomValues. Vega ships no such guarantee and
// no crypto package: @amazon-devices/react-native-get-random-values does not
// exist, and the community module of that name is native code that will not
// link here. So the source is chosen at runtime and **named**, because a game
// that quietly rolls weaker dice than it claims is worse than one that says so.
//
// Both paths feed the same rejection sampling in src/core/game.ts, so neither
// has the modulo bias of an arbitrary byte % 6.

export type RandomSource = {
  fill: (bytes: Uint8Array<ArrayBuffer>) => void;
  // What the app should tell the player, and what a report should record.
  name: 'crypto.getRandomValues' | 'Math.random';
};

type MaybeCrypto = {
  crypto?: { getRandomValues?: (bytes: Uint8Array) => unknown };
};

export function randomSource(scope: unknown = globalThis): RandomSource {
  const provided = (scope as MaybeCrypto)?.crypto?.getRandomValues;
  if (typeof provided === 'function') {
    const host = (scope as MaybeCrypto).crypto!;
    return {
      name: 'crypto.getRandomValues',
      fill: (bytes) => {
        host.getRandomValues!(bytes);
      },
    };
  }
  return {
    name: 'Math.random',
    fill: (bytes) => {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    },
  };
}
