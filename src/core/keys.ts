// Whether an object holds exactly these own keys, in any order. The decoders
// use it to refuse a snapshot with a missing or an unexpected field.
export const hasExactKeys = (
  value: object,
  keys: readonly string[],
): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};
