// High-contrast, 10-foot UI speech bubble for bot character dialogue (#158).
//
// Its text is 20 dp like every other caption (#168), in at most two rows: the
// speech zone under the bot's badge is sized for two, and every voice line is
// short enough for them (test/botVoice.test.ts).
//
// A bot's bubble points up at its badge. The Hot Seat host's points left at his
// face, which sits beside it in the speech zone, apart from the players' badges
// (#202).
import React from 'react';
import { View, Text } from 'react-native';

export type SpeechBubbleProps = {
  text: string;
  // Where the speaker is: above, a bot's badge; to the left, the host's face.
  tail?: 'up' | 'left';
};

export const BUBBLE_TEXT = 20;
export const BUBBLE_ROWS = 2;
// The tail's size, and the room the body's padding and border take across.
export const BUBBLE_TAIL = 7;
export const BUBBLE_INSET = 2 * (12 + 1.5);

const TAIL_COLOUR = '#2b425b';

// Kept as one object and spread into fresh ones: the web bench's shim takes no
// style arrays.
const BODY = {
  backgroundColor: '#112233',
  borderWidth: 1.5,
  borderColor: TAIL_COLOUR,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 6,
} as const;

const Line = ({ text }: { text: string }) => (
  <Text
    testID="speech-bubble-text"
    numberOfLines={BUBBLE_ROWS}
    style={{
      color: '#f0f4f8',
      fontSize: BUBBLE_TEXT,
      fontWeight: '600',
      lineHeight: 24,
    }}
  >
    {text}
  </Text>
);

export const SpeechBubble = ({ text, tail = 'up' }: SpeechBubbleProps) => {
  if (tail === 'left')
    return (
      <View
        testID="speech-bubble"
        style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}
      >
        <View
          testID="speech-bubble-tail"
          style={{
            width: 0,
            height: 0,
            backgroundColor: 'transparent',
            borderStyle: 'solid',
            borderTopWidth: BUBBLE_TAIL,
            borderBottomWidth: BUBBLE_TAIL,
            borderRightWidth: BUBBLE_TAIL,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderRightColor: TAIL_COLOUR,
          }}
        />
        <View testID="speech-bubble-body" style={{ ...BODY, flexShrink: 1 }}>
          <Line text={text} />
        </View>
      </View>
    );
  return (
    <View
      testID="speech-bubble"
      style={{
        alignItems: 'flex-start',
        width: '100%',
      }}
    >
      <View
        testID="speech-bubble-tail"
        style={{
          width: 0,
          height: 0,
          backgroundColor: 'transparent',
          borderStyle: 'solid',
          borderLeftWidth: BUBBLE_TAIL,
          borderRightWidth: BUBBLE_TAIL,
          borderBottomWidth: BUBBLE_TAIL,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: TAIL_COLOUR,
          // Under the middle of the avatar.
          marginLeft: 30 - BUBBLE_TAIL,
        }}
      />
      <View
        testID="speech-bubble-body"
        style={{
          ...BODY,
          // No shadow: on this background it could not be seen, and a bubble
          // the width of the panel cast it into the TV's safe margin (#168).
          maxWidth: '100%',
        }}
      >
        <Line text={text} />
      </View>
    </View>
  );
};
