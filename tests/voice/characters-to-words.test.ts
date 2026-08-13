import {describe, expect, it} from 'vitest';
import {charactersToWords} from '../../src/voice/characters-to-words';

describe('charactersToWords', () => {
  it('groups characters into words using first-start and last-end', () => {
    expect(
      charactersToWords(
        ['H', 'i', ' ', 'm', 'i', 'l', 'k', '.'],
        [
          [0, 0.06],
          [0.06, 0.12],
          [0.12, 0.16],
          [0.16, 0.22],
          [0.22, 0.28],
          [0.28, 0.34],
          [0.34, 0.42],
          [0.42, 0.5],
        ],
      ),
    ).toEqual([
      {text: 'Hi', startMs: 0, endMs: 120},
      {text: 'milk.', startMs: 160, endMs: 500},
    ]);
  });

  it('drops whitespace-only tokens', () => {
    expect(charactersToWords([' ', '\n'], [[0, 0.1], [0.1, 0.2]])).toEqual([]);
  });

  it('rejects mismatched timestamp arrays', () => {
    expect(() => charactersToWords(['A'], [])).toThrow(/length/i);
  });
});
