import { describe, expect, test } from 'vitest';
import { range } from './range';

describe('range tests', () => {
  test('fills range inclusive', () => {
    expect(range(1, 10)).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('returns empty string if there is no end', () => {
    expect(range(1)).toStrictEqual([]);
  });
});
