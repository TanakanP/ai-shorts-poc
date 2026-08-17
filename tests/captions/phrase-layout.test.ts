import {describe, expect, it} from 'vitest';
import {layoutAccumulatedPhrase} from '../../src/captions/phrase-layout';

describe('layoutAccumulatedPhrase', () => {
  it('uses 72px for short phrases', () => {
    expect(layoutAccumulatedPhrase('Did you')).toEqual({fontSize: 72});
  });

  it('uses 60px for mid phrases', () => {
    expect(layoutAccumulatedPhrase('Did you ever wonder why milk')).toEqual({fontSize: 60});
  });

  it('uses 52px for long phrases', () => {
    expect(
      layoutAccumulatedPhrase('Did you ever wonder why milk is always at the back of the store'),
    ).toEqual({fontSize: 52});
  });

  it('rejects blank phrases', () => {
    expect(() => layoutAccumulatedPhrase('   ')).toThrow(/blank/i);
  });
});
