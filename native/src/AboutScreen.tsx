// The About screen: who made what the player sees.
//
// It exists because a licence requires it. The sound pack's licence asks for
// visible credit, and the asset repository asks every client to show it on an
// About or Licenses screen. So this is a place a viewer can actually reach with
// a remote, not a file in the source. The open-source software the app is built
// from asks for its notices to travel with every copy: the package carries
// them, and the screen says where they are (#338).
//
// One page, nothing to navigate. OK or Back leaves.
import React from 'react';
import { View, Text } from 'react-native';
import { APP, OPEN_SOURCE, creditsFor } from '../../src/core/credits';
import type { BoardKey } from '../../src/core/boardInput';
import { Portrait } from './Portrait';
import { useRemoteInput } from './useRemoteInput';
import { THEME } from './theme';

export type AboutScreenProps = {
  onExit: () => void;
  onState?: (report: string) => void;
};

export const AboutScreen = ({ onExit, onState }: AboutScreenProps) => {
  // Leaving is decided once. A second press arriving before the parent has
  // swapped this screen out must not leave twice.
  const [leaving, leave] = React.useReducer(
    (done: boolean, key: BoardKey) =>
      done || key === 'select' || key === 'back' || key === 'menu',
    false,
  );

  useRemoteInput(leave, {
    onBack: () => {
      leave('back');
      return true;
    },
  });

  React.useEffect(() => {
    if (leaving) onExit();
  }, [leaving, onExit]);

  // Whether this build has the characters' portraits, found as the game finds
  // it: by loading one. The screen starts with them, as every build made for
  // players has them, and credits the RhosGFX faces instead if it does not
  // load (#212).
  const [portraits, setPortraits] = React.useState(true);
  const noPortraits = React.useCallback(() => setPortraits(false), []);
  const credits = creditsFor(portraits);

  React.useEffect(() => {
    onState?.(`about | credits ${credits.length} | portraits ${portraits}`);
  }, [onState, credits.length, portraits]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: THEME.background,
        paddingHorizontal: 56,
        paddingVertical: 40,
      }}
    >
      <Text
        style={{
          color: '#8dc9b6',
          fontSize: 20,
          letterSpacing: 2,
          marginBottom: 14,
        }}
      >
        ABOUT
      </Text>
      <Text style={{ color: '#f0f4f8', fontSize: 36 }}>{APP.title}</Text>
      <Text style={{ color: '#aab8c9', fontSize: 22, marginBottom: 18 }}>
        {APP.maker}
      </Text>
      {/* Not seen: one portrait, loaded only to learn whether the build has
          them. It is drawn transparent rather than at no size, since an image
          with no size may never be loaded. */}
      <View
        style={{ position: 'absolute', opacity: 0 }}
        importantForAccessibility="no-hide-descendants"
      >
        <Portrait
          character="thinkle"
          kind="badge"
          size={1}
          onMissing={noPortraits}
        />
      </View>

      {/* Two columns: four credits in one column would not fit a television
          screen, and a TV page has no scrolling a remote can be trusted with. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {credits.map((credit) => (
          <View
            key={credit.subject}
            style={{ width: '50%', paddingRight: 32, marginBottom: 18 }}
          >
            <Text style={{ color: '#8dc9b6', fontSize: 20, letterSpacing: 1 }}>
              {credit.subject}
            </Text>
            <Text style={{ color: '#f0f4f8', fontSize: 22 }}>
              {credit.line}
            </Text>
            {/* On lines of their own, so that no link breaks at a hyphen. */}
            <Text style={{ color: '#aab8c9', fontSize: 20 }}>
              {credit.licence}
            </Text>
            <Text style={{ color: '#aab8c9', fontSize: 20 }}>
              {credit.source}
            </Text>
          </View>
        ))}
      </View>

      {/* The notices themselves are far too long for a television, so this
          only says where they are. The whole width of the screen holds the
          address without a break. */}
      <Text style={{ color: '#8dc9b6', fontSize: 20, letterSpacing: 1 }}>
        {OPEN_SOURCE.subject}
      </Text>
      <Text style={{ color: '#aab8c9', fontSize: 20 }}>
        {`${OPEN_SOURCE.line} ${OPEN_SOURCE.source}`}
      </Text>

      <Text style={{ color: '#98a9ba', fontSize: 20, marginTop: 'auto' }}>
        OK or Back: return
      </Text>
    </View>
  );
};
