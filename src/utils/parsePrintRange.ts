import { range } from './range';

export const parsePrintRange = (printRange: string): number[] => {
  const parts = printRange.split(',');

  return Array.from(
    new Set(
      parts.reduce((acc: number[], part: string) => {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);

          acc = acc.concat(range(start, end));
        } else {
          acc.push(parseInt(part, 10));
        }

        return acc;
      }, [])
    )
  ).sort((a, b) => a - b);
};
