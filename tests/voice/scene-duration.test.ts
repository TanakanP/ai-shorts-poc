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

  it('accepts a punchy 1.2x line just under 2.5s', () => {
    expect(sceneDurationFromAudio(2.2)).toBe(2.2 + VOICE_TAIL_PAD_SECONDS);
  });

  it('rejects audio shorter than 1.5s', () => {
    expect(() => sceneDurationFromAudio(1.49)).toThrow(/1\.5/);
  });

  it('rejects audio longer than 12s', () => {
    expect(() => sceneDurationFromAudio(12.01)).toThrow(/12/);
  });
});

describe('assertVoicedTimeline', () => {
  it('attributes timeline validation to the selected voice provider', () => {
    try { assertVoicedTimeline([34], 'elevenlabs'); }
    catch (error) { expect(error).toMatchObject({diagnostic: {provider: 'elevenlabs'}}); return; }
    throw new Error('Expected timeline rejection');
  });
  it('accepts exactly 33 seconds including the outro', () => {
    expect(() => assertVoicedTimeline([3, 5, 5, 6, 7, 7])).not.toThrow();
  });

  it('accepts voiced timelines between 30 and 33s', () => {
    expect(() => assertVoicedTimeline([6.3, 6.3, 6.3, 6.3, 6.3])).not.toThrow();
  });

  it('rejects just above 33s', () => {
    expect(() => assertVoicedTimeline([30, 3.001])).toThrow(/15-33s/);
  });

  it('accepts a punchy 4-beat outro timeline just under 20s', () => {
    expect(() => assertVoicedTimeline([3.07, 4.24, 4.66, 4.32, 3.46])).not.toThrow();
  });

  it('rejects a total below 15s', () => {
    expect(() => assertVoicedTimeline([2.8, 2.8, 2.8, 2.8, 2.8])).toThrow(/15/);
  });

  it('rejects a total above 33s', () => {
    expect(() => assertVoicedTimeline([12.3, 12.3, 12.3, 12.3, 12.3])).toThrow(/33/);
  });
});
