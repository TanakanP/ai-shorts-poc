import {describe, expect, it} from 'vitest';
import {layoutSpokenWord} from '../../src/captions/word-layout';

describe('layoutSpokenWord', () => {
  it('uses 120px for short words', () => {
    expect(layoutSpokenWord('Did')).toEqual({fontSize: 120});
    expect(layoutSpokenWord('accident.')).toEqual({fontSize: 120});
  });

  it('uses 96px for mid-length words', () => {
    expect(layoutSpokenWord('supermarket')).toEqual({fontSize: 96});
  });

  it('uses 72px for long words', () => {
    expect(layoutSpokenWord('misunderstandings')).toEqual({fontSize: 72});
  });

  it('rejects blank text', () => {
    expect(() => layoutSpokenWord('   ')).toThrow(/blank/i);
  });
});
