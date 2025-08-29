import { expect, test, describe } from 'vitest';
import { parsePrintRange } from './parsePrintRange';

describe('parsePrintRange tests', () => {
  test('returns all pages inclusive sorted', () => {
    expect(parsePrintRange('1-5')).toStrictEqual([1, 2, 3, 4, 5]);
  });

  test('allows specifying with comma separated ranges', () => {
    expect(parsePrintRange('1-5, 7, 10')).toStrictEqual([1, 2, 3, 4, 5, 7, 10]);
  });

  test('allows specifying out of order with comma separated ranges', () => {
    expect(parsePrintRange('10, 7, 1-5')).toStrictEqual([1, 2, 3, 4, 5, 7, 10]);
  });
});
