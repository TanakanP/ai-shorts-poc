import {describe, expect, it} from 'vitest';
import {chunkCaptionWords} from '../../src/captions/caption-chunk';
import type {VoiceWord} from '../../src/domain/voice';

const timed = (texts: string[]): VoiceWord[] =>
  texts.map((text, index) => ({
    text,
    startMs: index * 200,
    endMs: index * 200 + 150,
  }));

const textsOf = (chunks: VoiceWord[][]): string[][] =>
  chunks.map((chunk) => chunk.map((word) => word.text));

describe('chunkCaptionWords', () => {
  it('returns no chunks for no words', () => {
    expect(chunkCaptionWords([])).toEqual([]);
  });

  it('keeps a single word as one chunk', () => {
    expect(textsOf(chunkCaptionWords(timed(['Wow!'])))).toEqual([['Wow!']]);
  });

  it('hard-stops after a token that ends with . ? or !', () => {
    expect(textsOf(chunkCaptionWords(timed(['Wait.', 'Did', 'you?'])))).toEqual([
      ['Wait.'],
      ['Did', 'you?'],
    ]);
  });

  it('soft-stops after a comma only when the chunk already has at least 3 words', () => {
    expect(textsOf(chunkCaptionWords(timed(['The', 'longer', 'your', 'route,', 'the'])))).toEqual([
      ['The', 'longer', 'your', 'route,'],
      ['the'],
    ]);
  });

  it('does not soft-stop a two-word comma phrase', () => {
    expect(textsOf(chunkCaptionWords(timed(['Hello,', 'world'])))).toEqual([['Hello,', 'world']]);
  });

  it('caps a chunk at 5 words', () => {
    expect(
      textsOf(chunkCaptionWords(timed(['one', 'two', 'three', 'four', 'five', 'six']))),
    ).toEqual([
      ['one', 'two', 'three', 'four', 'five'],
      ['six'],
    ]);
  });

  it('starts a new chunk when adding the next word would exceed 28 characters', () => {
    expect(textsOf(chunkCaptionWords(timed(['extraordinarily', 'sophisticated'])))).toEqual([
      ['extraordinarily'],
      ['sophisticated'],
    ]);
  });

  it('keeps a single token longer than 28 characters', () => {
    const long = 'supercalifragilisticexpialidocious';
    expect(textsOf(chunkCaptionWords(timed([long, 'next'])))).toEqual([[long], ['next']]);
  });

  it('keeps apostrophes and does not treat them as stops', () => {
    expect(textsOf(chunkCaptionWords(timed(["don't", 'stop', 'now'])))).toEqual([
      ["don't", 'stop', 'now'],
    ]);
  });

  it('splits the supermarket-route sentence on the screenshot', () => {
    expect(
      textsOf(
        chunkCaptionWords(
          timed([
            'The',
            'longer',
            'your',
            'route,',
            'the',
            'more',
            'chances',
            'you',
            'have',
            'to',
            'add',
            'extras.',
          ]),
        ),
      ),
    ).toEqual([
      ['The', 'longer', 'your', 'route,'],
      ['the', 'more', 'chances', 'you', 'have'],
      ['to', 'add', 'extras.'],
    ]);
  });
});
