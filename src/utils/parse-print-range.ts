import { range } from './range';

export const parsePrintRange = (printRange: string): number[] => {
  const parts = printRange.split(',');

  return [
    ...new Set(
      parts.reduce((accumulator: number[], part: string) => {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map((value) => (value.trim().length > 0 ? Number(value) : undefined));

          accumulator = [...accumulator, ...range(start, end)];
        } else {
          accumulator.push(Number.parseInt(part, 10));
        }

        return accumulator;
      }, [])
    ),
  ].sort((a, b) => a - b);
};
