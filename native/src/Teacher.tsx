// Thinkle the wizard as he stands in the panel beside the board, teaching the
// tutorial (#264) or offering to on a first launch (#244). The screen's title
// comes first, at the board's top edge. Under it are his portrait with his name
// and a line beside them, and then his bubble, its tail pointing up at his
// face. Both screens draw him the same way, so the offer looks like the lessons
// it leads to.
import React from 'react';
import { View, Text } from 'react-native';
import { Portrait, type CharacterId } from './Portrait';
import { SpeechBubble } from './SpeechBubble';

// Who teaches: Thinkle, whose portrait ships for this (#262).
export const TEACHER: CharacterId = 'thinkle';

// Thinkle's portrait, and the rows his bubble may take: about 170 characters,
// in the layout the owner chose from the mockups (#264). The rows above the
// task and the dice leave about 24 dp spare for a task of three rows.
export const TEACHER_PORTRAIT = 72;
export const TEACHER_BUBBLE_ROWS = 5;

// A line of text has room above its capitals. This pulls the title's capitals
// up to the board's top edge: measured on the Virtual Device (#264), they meet
// it to within a pixel of a 1080p capture.
const TITLE_LEAD = 7;

export const TeacherTitle = ({ children }: { children: string }) => (
  <Text
    style={{
      color: '#f0f4f8',
      fontSize: 34,
      marginTop: -TITLE_LEAD,
      marginBottom: 14,
    }}
  >
    {children}
  </Text>
);

export const Teacher = ({
  caption,
  text,
}: {
  // Under his name: the lesson he is on, or what he is.
  caption: string;
  // What he says, all his lines together.
  text: string;
}) => (
  <View testID="teacher" style={{ marginBottom: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Portrait character={TEACHER} kind="card" size={TEACHER_PORTRAIT} />
      <View style={{ marginLeft: 12 }}>
        <Text
          style={{
            color: '#f0f4f8',
            fontSize: 20,
            fontWeight: '700',
            letterSpacing: 1,
          }}
        >
          THINKLE
        </Text>
        <Text style={{ color: '#8dc9b6', fontSize: 20 }}>{caption}</Text>
      </View>
    </View>
    <SpeechBubble
      text={text}
      rows={TEACHER_BUBBLE_ROWS}
      tail="up"
      tailAt={TEACHER_PORTRAIT / 2}
    />
  </View>
);
