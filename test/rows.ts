// How many rows a line takes when a bubble wraps it at word breaks into rows of
// at most `width` characters. A word longer than a row takes a row of its own.
export const rowsOf = (text: string, width: number): number => {
  let rows = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (used === 0) used = word.length;
    else if (used + 1 + word.length <= width) used += 1 + word.length;
    else {
      rows += 1;
      used = word.length;
    }
  }
  return rows;
};
