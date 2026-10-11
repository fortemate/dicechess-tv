// One item of a list the remote walks: a menu choice or a rules topic.
//
// The focused item is filled and framed, so it is told apart by more than
// colour, and while OK is held it fills more strongly and shrinks a little: the
// press shows before the choice takes effect (#51). The text sits inside the
// frame, so a title that wraps keeps its second line under its first.
import React from 'react';
import { View, Text } from 'react-native';
import { THEME } from './theme';

// What an item is to a screen reader (#257). A setting that reads on or off is
// a switch, named without the state that aria-checked carries; the music row is
// a slider whose value is its volume or "off"; anything else is a menu item,
// named by its own text. The focused item is the selected one.
//
// No `accessible`: on Vega it makes a view focusable, and the remote's focus
// here is the screen reducer's, not the platform's (useRemoteInput.ts). A
// screen reader is told in words where focus moves instead (announcer.ts).
export const optionAccessibility = (label: string, focused: boolean) => {
  const music = /^(Music): (\d+|off)$/.exec(label);
  if (music)
    return {
      role: 'slider',
      'aria-label': music[1],
      'aria-valuetext': music[2],
      'aria-selected': focused,
    } as const;
  const setting = /^(.+): (on|off)$/.exec(label);
  if (setting)
    return {
      role: 'switch',
      'aria-label': setting[1],
      'aria-checked': setting[2] === 'on',
      'aria-selected': focused,
    } as const;
  return { role: 'menuitem', 'aria-selected': focused } as const;
};

export type OptionProps = {
  label: string;
  focused: boolean;
  // OK is held down while this item has focus.
  pressed?: boolean;
  fontSize?: number;
  // Drawn before the label, on the same line: a piece drawing for promotion.
  before?: React.ReactNode;
  // Drawn after the label, on the same line: the rings of a volume.
  after?: React.ReactNode;
};

export const Option = ({
  label,
  focused,
  pressed = false,
  fontSize = 26,
  before,
  after,
}: OptionProps) => {
  const fill = pressed ? THEME.pressedFill : THEME.focusFill;
  const down = focused && pressed;
  return (
    <View
      testID="option"
      {...optionAccessibility(label, focused)}
      style={{
        borderWidth: 2,
        borderRadius: 8,
        borderColor: focused ? THEME.cursor : 'transparent',
        backgroundColor: focused ? fill : 'transparent',
        paddingHorizontal: 12,
        marginBottom: 2,
        transform: [{ scale: down ? 0.97 : 1 }],
      }}
    >
      {before || after ? (
        // Wraps rather than running past the frame and the TV's safe area when
        // the panel is narrower than expected.
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {before}
          <Text style={{ color: focused ? '#f0f4f8' : '#aab8c9', fontSize }}>
            {label}
          </Text>
          {after}
        </View>
      ) : (
        <Text style={{ color: focused ? '#f0f4f8' : '#aab8c9', fontSize }}>
          {label}
        </Text>
      )}
    </View>
  );
};
