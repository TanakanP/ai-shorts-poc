import {describe, expect, it} from 'vitest';
import {
  sceneDurationFromAudio,
  assertVoicedTimeline,
  VOICE_TAIL_PAD_SECONDS,
} from '../../src/voice/scene-duration';

describe('sceneDurationFromAudio', () => {
  it('adds the tail pad', () => {
    expect(sceneDurationFromAudio(6)).toBe(6 + VOICE_TAIL_PAD_SECONDS);
  });

  it('rejects audio shorter than 2.5s', () => {
    expect(() => sceneDurationFromAudio(2.49)).toThrow(/2\.5/);
  });

  it('rejects audio longer than 12s', () => {
    expect(() => sceneDurationFromAudio(12.01)).toThrow(/12/);
  });
});

describe('assertVoicedTimeline', () => {
  it('accepts a 5-scene 32s voiced timeline', () => {
    expect(() => assertVoicedTimeline([6.3, 6.3, 6.3, 6.3, 6.3])).not.toThrow();
  });

  it('accepts a punchy 4-beat outro timeline just under 20s', () => {
    expect(() => assertVoicedTimeline([3.07, 4.24, 4.66, 4.32, 3.46])).not.toThrow();
  });

  it('rejects a total below 15s', () => {
    expect(() => assertVoicedTimeline([2.8, 2.8, 2.8, 2.8, 2.8])).toThrow(/15/);
  });

  it('rejects a total above 60s', () => {
    expect(() => assertVoicedTimeline([12.3, 12.3, 12.3, 12.3, 12.3])).toThrow(/60/);
  });
});
