import {describe, expect, it} from 'vitest';
import {
  alignCaptionSegments,
  parseCaptionSegments,
  spokenSceneText,
} from '../../src/captions/caption-segments';
import type {VoiceWord} from '../../src/domain/voice';

const timed = (texts: string[]): VoiceWord[] =>
  texts.map((text, index) => ({
    text,
    startMs: index * 200,
    endMs: index * 200 + 150,
  }));

describe('spokenSceneText', () => {
  it('strips caption bars and squeezes spaces for TTS', () => {
    expect(
      spokenSceneText('Milk is at the back of the store | because your walk is valuable.'),
    ).toBe('Milk is at the back of the store because your walk is valuable.');
  });

  it('leaves a line without bars unchanged', () => {
    expect(spokenSceneText('Milk is a staple.')).toBe('Milk is a staple.');
  });
});

describe('parseCaptionSegments', () => {
  it('splits on bars into trimmed clauses', () => {
    expect(
      parseCaptionSegments('Milk is at the back of the store | because your walk is valuable.'),
    ).toEqual(['Milk is at the back of the store', 'because your walk is valuable.']);
  });

  it('returns one segment when there is no bar', () => {
    expect(parseCaptionSegments('Milk is a staple.')).toEqual(['Milk is a staple.']);
  });
});

describe('alignCaptionSegments', () => {
  const words = timed([
    'Milk',
    'is',
    'at',
    'the',
    'back',
    'of',
    'the',
    'store',
    'because',
    'your',
    'walk',
    'is',
    'valuable.',
  ]);

  it('maps each AI clause onto the matching timed words', () => {
    expect(
      alignCaptionSegments(
        ['Milk is at the back of the store', 'because your walk is valuable.'],
        words,
      ).map((chunk) => chunk.map((word) => word.text)),
    ).toEqual([
      ['Milk', 'is', 'at', 'the', 'back', 'of', 'the', 'store'],
      ['because', 'your', 'walk', 'is', 'valuable.'],
    ]);
  });

  it('falls back to the whole line when words do not match the clauses', () => {
    expect(
      alignCaptionSegments(['Milk is hidden', 'because shoppers walk'], words).map((chunk) =>
        chunk.map((word) => word.text),
      ),
    ).toEqual([words.map((word) => word.text)]);
  });
});
