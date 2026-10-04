// High-contrast, 10-foot UI speech bubble for a character's line (#158, #213).
//
// It stands beside the speaker's portrait, its tail pointing back at the face:
// a bot's in the dialogue block at the top of the panel, the Hot Seat host's
// above the bottom badge. In the tutorial it hangs under Thinkle's portrait
// (#264). Its text is 20 dp like every other caption (#168), in at most three
// rows for a bot and two for the host, which every voice line fits
// (test/botVoice.test.ts).
import React from 'react';
import { View, Text } from 'react-native';

export type SpeechBubbleProps = {
  text: string;
  // The most rows the line may take; the space beside the portrait is sized for
  // them.
  rows?: number;
  // Where the speaker is: beside the bubble, as in a game, or above it, as
  // Thinkle is in the tutorial (#264). A bubble under its speaker spans the
  // width it is given, and its tail points up at `tailAt` dp from its left
  // edge, under the speaker's face.
  tail?: 'left' | 'up';
  tailAt?: number;
};

export const BUBBLE_TEXT = 20;
export const BUBBLE_LINE = 24;
export const BUBBLE_ROWS = 3;
export const HOST_BUBBLE_ROWS = 2;
// Padding and border above and below the text, so a bubble of n rows is
// n * BUBBLE_LINE + BUBBLE_CHROME tall.
export const BUBBLE_CHROME = 15;
const TAIL = 7;
const EDGE = '#2b425b';

const Body = ({
  text,
  rows,
  wide,
}: {
  text: string;
  rows: number;
  wide: boolean;
}) => (
  <View
    testID="speech-bubble-body"
    style={{
      ...(wide ? { alignSelf: 'stretch' as const } : { flexShrink: 1 }),
      backgroundColor: '#112233',
      borderWidth: 1.5,
      borderColor: EDGE,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 6,
      // No shadow: on this background it could not be seen (#168).
    }}
  >
    <Text
      testID="speech-bubble-text"
      numberOfLines={rows}
      style={{
        color: '#f0f4f8',
        fontSize: BUBBLE_TEXT,
        fontWeight: '600',
        lineHeight: BUBBLE_LINE,
      }}
    >
      {text}
    </Text>
  </View>
);

export const SpeechBubble = ({
  text,
  rows = BUBBLE_ROWS,
  tail = 'left',
  tailAt = 24,
}: SpeechBubbleProps) =>
  tail === 'up' ? (
    <View testID="speech-bubble" style={{ alignItems: 'flex-start' }}>
      <View
        testID="speech-bubble-tail"
        style={{
          width: 0,
          height: 0,
          backgroundColor: 'transparent',
          borderStyle: 'solid',
          borderLeftWidth: TAIL,
          borderRightWidth: TAIL,
          borderBottomWidth: TAIL + 1,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: EDGE,
          marginLeft: tailAt - TAIL,
        }}
      />
      <Body text={text} rows={rows} wide />
    </View>
  ) : (
    <View
      testID="speech-bubble"
      style={{ flexDirection: 'row', alignItems: 'flex-start' }}
    >
      <View
        testID="speech-bubble-tail"
        style={{
          width: 0,
          height: 0,
          backgroundColor: 'transparent',
          borderStyle: 'solid',
          borderTopWidth: TAIL,
          borderBottomWidth: TAIL,
          borderRightWidth: TAIL + 1,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: EDGE,
          // Level with the first row of text.
          marginTop: 12 - TAIL / 2,
        }}
      />
      <Body text={text} rows={rows} wide={false} />
    </View>
  );
