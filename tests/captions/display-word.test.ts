import {describe, expect, it} from 'vitest';
import {displaySpokenWord} from '../../src/captions/display-word';

describe('displaySpokenWord', () => {
  it('strips commas periods colons and semicolons', () => {
    expect(displaySpokenWord('reason,')).toBe('reason');
    expect(displaySpokenWord('accident.')).toBe('accident');
    expect(displaySpokenWord('wait:')).toBe('wait');
    expect(displaySpokenWord('now;')).toBe('now');
  });

  it('keeps apostrophes question marks and exclamation marks', () => {
    expect(displaySpokenWord("That's")).toBe("That's");
    expect(displaySpokenWord('door?')).toBe('door?');
    expect(displaySpokenWord('Wait!')).toBe('Wait!');
  });

  it('returns empty when the token is only stripped marks', () => {
    expect(displaySpokenWord(',')).toBe('');
    expect(displaySpokenWord('...')).toBe('');
  });
});
