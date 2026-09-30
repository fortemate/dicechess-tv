// High-contrast, 10-foot UI speech bubble for bot character dialogue (#158).
import React from 'react';
import { View, Text } from 'react-native';

export type SpeechBubbleProps = {
  text: string;
};

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
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderBottomWidth: 6,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: '#2b425b',
          marginLeft: 24,
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
          paddingVertical: 7,
          maxWidth: '100%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <Text
          testID="speech-bubble-text"
          style={{
            color: '#f0f4f8',
            fontSize: 15,
            fontWeight: '600',
            lineHeight: 20,
            letterSpacing: 0.2,
          }}
        >
          {text}
        </Text>
      </View>
    </View>
  );
};
