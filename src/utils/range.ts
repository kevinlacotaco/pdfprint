export const range = (start: number, end: number): number[] => {
  return [...Array(end - start + 1).keys()].map((i) => i + start);
};
