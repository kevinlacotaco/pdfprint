export const range = (start: number | undefined = 1, end: number | undefined): number[] => {
  if (end == null) {
    return [];
  }
  return [...Array.from({ length: end - start + 1 }).keys()].map((index) => index + start);
};
