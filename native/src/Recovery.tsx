// What the player sees when the game screen fails (#255).
//
// A throw while the game screen renders, the engine rejecting a game it was
// handed for instance, would otherwise unmount the whole app, and a television
// has no console to say why. The boundary catches it and puts up one screen a
// viewer can read from the sofa, with a way back. It never touches the saved
// game: OK returns to the home screen over it, as a relaunch would, and only
// the player can choose to start fresh without it.
import React from 'react';
import { View, Text } from 'react-native';
import type { BoardKey } from '../../src/core/boardInput';
import { Option } from './Option';
import { THEME } from './theme';
import { useRemoteInput } from './useRemoteInput';

export const RECOVERY_TITLE = 'Something went wrong';
export const MENU_OPTION = 'Back to the menu';
export const FRESH_OPTION = 'Start fresh';

// What the player chose: the home screen over the saved game, or the home
// screen without it.
export type Recovery = 'menu' | 'fresh';

const CHOICES: readonly { label: string; choice: Recovery }[] = [
  { label: MENU_OPTION, choice: 'menu' },
  { label: FRESH_OPTION, choice: 'fresh' },
];

type RecoveryState = { index: number; chosen: Recovery | null };

// The arrows walk the two options, as on the home screen, and OK takes one.
// The choice is made once: a second press arriving before the app has swapped
// this screen out must not choose again.
export const recoveryReducer = (
  state: RecoveryState,
  key: BoardKey,
): RecoveryState => {
  if (state.chosen) return state;
  if (key === 'select')
    return { ...state, chosen: CHOICES[state.index].choice };
  if (key === 'back' || key === 'menu') return state;
  const by = key === 'up' || key === 'left' ? -1 : 1;
  return {
    ...state,
    index: (state.index + by + CHOICES.length) % CHOICES.length,
  };
};

// Back closes the app, as it does on the home screen: there is nowhere behind
// this screen to go back to.
const closeApp = () => false;

const RecoveryScreen = ({
  onRecover,
  onState,
}: {
  onRecover: (choice: Recovery) => void;
  onState?: (report: string) => void;
}) => {
  const [{ index, chosen }, dispatch] = React.useReducer(recoveryReducer, {
    index: 0,
    chosen: null,
  });
  const [pressed, setPressed] = React.useState(false);
  useRemoteInput(dispatch, { onBack: closeApp, onPress: setPressed });

  React.useEffect(() => {
    if (chosen) onRecover(chosen);
  }, [chosen, onRecover]);

  React.useEffect(() => {
    onState?.(`overlay recovery#${index}`);
  }, [index, onState]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: THEME.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: 480 }}>
        <Text style={{ color: '#f0f4f8', fontSize: 38, marginBottom: 8 }}>
          {RECOVERY_TITLE}
        </Text>
        <Text style={{ color: '#aab8c9', fontSize: 22, marginBottom: 16 }}>
          Your saved game is kept.
        </Text>
        {CHOICES.map(({ label }, i) => (
          <Option
            key={label}
            label={label}
            focused={i === index}
            pressed={pressed}
          />
        ))}
        <Text style={{ color: '#98a9ba', fontSize: 20, marginTop: 16 }}>
          Start fresh deletes the saved game.
        </Text>
      </View>
    </View>
  );
};

export type GameBoundaryProps = {
  children: React.ReactNode;
  // Told what was caught, once per failure.
  onError: (error: unknown) => void;
  // Told what the player chose. The app remounts the boundary with what is
  // behind it, which is how this screen goes away.
  onRecover: (choice: Recovery) => void;
  onState?: (report: string) => void;
};

// Only a class can catch a render error. It catches the errors of everything
// under it, the game screen and the screens it hands over to, but not its own
// fallback's, so the fallback is kept to text and two options.
export class GameBoundary extends React.Component<
  GameBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <RecoveryScreen
        onRecover={this.props.onRecover}
        onState={this.props.onState}
      />
    );
  }
}
