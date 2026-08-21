import {describe, expect, it} from 'vitest';
import {captionWords, stripSpeechTags} from '../../src/captions/speech-tags';

describe('stripSpeechTags', () => {
  it('removes inline and wrapping xAI tags but keeps the spoken words', () => {
    expect(
      stripSpeechTags('<emphasis>Stores hide the milk</emphasis> [pause] on purpose!'),
    ).toBe('Stores hide the milk on purpose!');
  });

  it('leaves plain narration unchanged', () => {
    expect(stripSpeechTags('Stores hide the milk on purpose.')).toBe(
      'Stores hide the milk on purpose.',
    );
  });
});

describe('captionWords', () => {
  it('drops tag-only tokens and strips tags glued onto words', () => {
    expect(
      captionWords([
        {text: '<emphasis>Stores', startMs: 0, endMs: 200},
        {text: 'hide', startMs: 200, endMs: 320},
        {text: '[pause]', startMs: 320, endMs: 500},
        {text: 'milk</emphasis>', startMs: 500, endMs: 700},
      ]),
    ).toEqual([
      {text: 'Stores', startMs: 0, endMs: 200},
      {text: 'hide', startMs: 200, endMs: 320},
      {text: 'milk', startMs: 500, endMs: 700},
    ]);
  });
});
