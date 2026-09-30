// High-contrast, 10-foot UI speech bubble for bot character dialogue (#158).
import React from 'react';
import { View, Text } from 'react-native';

export type SpeechBubbleProps = {
  text: string;
};

const BUBBLE_CONTAINER = {
  alignItems: 'flex-start',
  width: '100%',
} as const;

const BUBBLE_TAIL = {
  width: 0,
  height: 0,
  backgroundColor: 'transparent',
  borderStyle: 'solid',
  borderLeftWidth: 6,
  borderRightWidth: 6,
  borderBottomWidth: 6,
  borderLeftColor: 'transparent',
  borderRightColor: 'transparent',
  borderBottomColor: '#2b425b',
  marginLeft: 24,
} as const;

const BUBBLE_BODY = {
  backgroundColor: '#112233',
  borderWidth: 1.5,
  borderColor: '#2b425b',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 7,
  maxWidth: '100%',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 3,
} as const;

const BUBBLE_TEXT = {
  color: '#f0f4f8',
  fontSize: 15,
  fontWeight: '600',
  lineHeight: 20,
  letterSpacing: 0.2,
} as const;

export const SpeechBubble = ({ text }: SpeechBubbleProps) => {
  return (
    <View testID="speech-bubble" style={BUBBLE_CONTAINER}>
      <View testID="speech-bubble-tail" style={BUBBLE_TAIL} />
      <View testID="speech-bubble-body" style={BUBBLE_BODY}>
        <Text testID="speech-bubble-text" style={BUBBLE_TEXT}>
          {text}
        </Text>
      </View>
    </View>
  );
};
