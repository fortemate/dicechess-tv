// The first launch's offer of the tutorial (#244), in the panel beside the
// board a game opens on. Thinkle, who teaches the tutorial, asks whether the
// game is new to the player. He is drawn as the lessons draw him, and the two
// answers stand under his bubble. The screen's reducer owns the choice; this
// only draws it.
import React from 'react';
import { View } from 'react-native';
import { OFFER_SPEECH } from '../../src/core/tutorial';
import { Option } from './Option';
import { Teacher, TeacherTitle } from './Teacher';
import { offerOptions } from './screen';

export const TutorialOffer = ({
  index,
  pressed,
}: {
  index: number;
  // OK is held on the focused answer (#51).
  pressed: boolean;
}) => (
  <>
    <TeacherTitle>Dice Chess</TeacherTitle>
    <Teacher caption="Your teacher" text={OFFER_SPEECH.join(' ')} />
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
