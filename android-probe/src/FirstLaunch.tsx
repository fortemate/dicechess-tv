import React, { useEffect, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Board } from '../../native/src/Board';
import { TutorialOffer } from '../../native/src/TutorialOffer';
import { useRemoteInput } from '../../native/src/useRemoteInput';
import {
  BOARD_GAP,
  boardSide,
  drawnSide,
  safeInsets,
} from '../../native/src/layout';
import { THEME } from '../../native/src/theme';
import type { Activity } from '../../native/src/activity';
import type { BoardKey } from '../../src/core/boardInput';
import { viewGame } from '../../src/core/game';
import { RemoteSurface } from './RemoteSurface';
import { useAndroidVoice } from './useAndroidVoice';
import { createStore } from './store';
import { SETTINGS_STORE } from './soundPreferences';
import {
  createTutorialOffer,
  shouldOfferTutorial,
  type TutorialAnswer,
} from './tutorialOffer';

const report = (event: string, detail: unknown) =>
  console.info('[AndroidTutorialOffer] ' + JSON.stringify({ event, detail }));

/** Resolve first-launch eligibility once, before mounting home or any game services. */
export function FirstLaunch({
  activity,
  enabled,
  onLearn,
  children,
}: {
  activity: Activity;
  enabled: boolean;
  onLearn(): void;
  children: React.ReactNode;
}) {
  const [offering, setOffering] = useState(() => {
    if (!enabled) return false;
    try {
      return shouldOfferTutorial(createStore(SETTINGS_STORE), createStore);
    } catch (error) {
      // Failed reads never classify a returning player as a new install.
      report('read-error', String(error));
      return false;
    }
  });
  return offering && enabled ? (
    <RemoteSurface activity={activity} label="Learn to play or skip">
      <Offer
        activity={activity}
        onAnswer={(answer) => {
          setOffering(false);
          if (answer === 'learn') onLearn();
        }}
      />
    </RemoteSurface>
  ) : (
    children
  );
}

/** Draw Vega's board and Thinkle offer; only the settings store receives an answer. */
function Offer({
  activity,
  onAnswer,
}: {
  activity: Activity;
  onAnswer(answer: TutorialAnswer): void;
}) {
  const [session] = useState(() =>
    createTutorialOffer(createStore(SETTINGS_STORE)),
  );
  const [state, setState] = useState(session.read);
  const [pressed, setPressed] = useState(false);
  const [error, setError] = useState('');
  const voice = useAndroidVoice(activity);
  const { width, height } = useWindowDimensions();
  const insets = safeInsets(width, height);
  const size = boardSide(width, height);
  /** Persist the answer before routing; a failed write leaves this offer available. */
  const key = (key: BoardKey, repeat = false) => {
    try {
      const answer = session.press(key, repeat);
      setState(session.read());
      setError('');
      if (answer) {
        report('answered', answer);
        onAnswer(answer);
      }
    } catch (failure) {
      report('write-error', String(failure));
      setError('Could not remember your choice. Please try again.');
    }
  };
  useRemoteInput(key, {
    onPress: setPressed,
    onBack: () => {
      key('back');
      return true;
    },
  });
  const index = state.overlay.kind === 'offer' ? state.overlay.index : 0;
  useEffect(() => {
    report('state', { index, error });
  }, [index, error]);
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.background,
        paddingHorizontal: insets.x,
        paddingVertical: insets.y,
      }}
    >
      <Board
        size={size}
        board={viewGame(state.game).dfen.split(' ')[0]}
        legal={[]}
        selected={null}
        cursor={null}
      />
      <View
        style={{ flex: 1, height: drawnSide(size), paddingLeft: BOARD_GAP }}
      >
        <TutorialOffer index={index} pressed={pressed} voice={voice} />
        {error ? (
          <Text style={{ color: '#ffffff', fontSize: 20 }}>{error}</Text>
        ) : null}
      </View>
    </View>
  );
}
