// High-contrast, 10-foot UI speech bubble for bot character dialogue (#158).
//
// Its text is 20 dp like every other caption (#168), in at most two rows: the
// speech zone under the bot's badge is sized for two, and every voice line is
// short enough for them (test/botVoice.test.ts).
import React from 'react';
import { View, Text } from 'react-native';

export type SpeechBubbleProps = {
  text: string;
};

export const BUBBLE_TEXT = 20;
export const BUBBLE_ROWS = 2;
const TAIL = 7;

export const SpeechBubble = ({ text }: SpeechBubbleProps) => {
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
          borderLeftWidth: TAIL,
          borderRightWidth: TAIL,
          borderBottomWidth: TAIL,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: '#2b425b',
          // Under the middle of the avatar.
          marginLeft: 30 - TAIL,
        }}
      />
      <View
        testID="speech-bubble-body"
        style={{
          backgroundColor: '#112233',
          borderWidth: 1.5,
          borderColor: '#2b425b',
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 6,
          // No shadow: on this background it could not be seen, and a bubble
          // the width of the panel cast it into the TV's safe margin (#168).
          maxWidth: '100%',
        }}
      >
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
      </View>
    </View>
  );
};
