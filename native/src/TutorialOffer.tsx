// The first launch's offer of the tutorial (#244), in the panel beside the
// board a game opens on. Thinkle, who teaches the tutorial, asks whether the
// game is new to the player, aloud as in the lessons. He is drawn as the
// lessons draw him, and the two answers stand under his bubble. The screen's
// reducer owns the choice; this only draws it and says his lines, which stop
// when the player answers.
import React from 'react';
import { View } from 'react-native';
import { OFFER_LINES } from '../../src/core/tutorial';
import { Option } from './Option';
import { Teacher, TeacherTitle } from './Teacher';
import { offerOptions } from './screen';
import { useTutorialVoice, type TutorialVoice } from './useTutorialVoice';

export const TutorialOffer = ({
  index,
  pressed,
  voice,
}: {
  index: number;
  // OK is held on the focused answer (#51).
  pressed: boolean;
  // Where his lines are said, as in the tutorial. Without it he is silent.
  voice?: TutorialVoice;
}) => {
  useTutorialVoice(voice, OFFER_LINES);
  return (
    <>
      <TeacherTitle>Dice Chess</TeacherTitle>
      <Teacher
        caption="Your teacher"
        text={OFFER_LINES.map((line) => line.text).join(' ')}
      />
      <View>
        {offerOptions.map((option, i) => (
          <Option
            key={option}
            label={option}
            focused={i === index}
            pressed={pressed}
          />
        ))}
      </View>
    </>
  );
};
