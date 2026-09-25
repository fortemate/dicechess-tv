// The options of an open list — a menu or the rules topics — as a test reads
// them: each label, and whether it has focus and is held. The focused option is
// framed in the cursor's colour and a held one is filled more strongly (#51).
import type renderer from 'react-test-renderer';
import { THEME } from '../src/theme';

type Instance = renderer.ReactTestInstance;
type Style = Record<string, unknown>;

export type OptionView = { label: string; focused: boolean; pressed: boolean };

export const optionViews = (root: Instance): OptionView[] =>
  root
    .findAll(
      (node) =>
        (node.type as unknown as string) === 'View' &&
        node.props.testID === 'option',
    )
    .map((box) => {
      const style = box.props.style as Style;
      const text = box.findAll(
        (node) => (node.type as unknown as string) === 'Text',
      )[0];
      return {
        label: String(text.props.children),
        focused: style.borderColor === THEME.cursor,
        pressed: style.backgroundColor === THEME.pressedFill,
      };
    });

export const focusedLabel = (root: Instance): string | undefined =>
  optionViews(root).find((option) => option.focused)?.label;
