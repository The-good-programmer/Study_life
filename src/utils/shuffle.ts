/**
 * Uniform Fisher-Yates shuffle. Returns a new array and leaves the input untouched.
 * (`array.sort(() => Math.random() - 0.5)` is not uniform and must not be used for shuffling.)
 */
export const shuffle = <T>(items: readonly T[], random: () => number = Math.random): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
