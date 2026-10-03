// High-contrast, 10-foot UI speech bubble for a character's line (#158, #213).
//
// It stands beside the speaker's portrait, its tail pointing back at the face:
// a bot's in the dialogue block at the top of the panel, the Hot Seat host's
// above the bottom badge. Its text is 20 dp like every other caption (#168),
// in at most three rows for a bot and two for the host, which every voice line
// fits (test/botVoice.test.ts).
import React from 'react';
import { View, Text } from 'react-native';

export type SpeechBubbleProps = {
  text: string;
  // The most rows the line may take; the space beside the portrait is sized for
  // them.
  rows?: number;
};

export const BUBBLE_TEXT = 20;
export const BUBBLE_LINE = 24;
export const BUBBLE_ROWS = 3;
export const HOST_BUBBLE_ROWS = 2;
// Padding and border above and below the text, so a bubble of n rows is
// n * BUBBLE_LINE + BUBBLE_CHROME tall.
export const BUBBLE_CHROME = 15;
const TAIL = 7;

export const SpeechBubble = ({
  text,
  rows = BUBBLE_ROWS,
}: SpeechBubbleProps) => (
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
        borderRightColor: '#2b425b',
        // Level with the first row of text.
        marginTop: 12 - TAIL / 2,
      }}
    />
    <View
      testID="speech-bubble-body"
      style={{
        flexShrink: 1,
        backgroundColor: '#112233',
        borderWidth: 1.5,
        borderColor: '#2b425b',
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
  </View>
);
