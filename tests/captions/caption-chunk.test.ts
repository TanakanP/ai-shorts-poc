import {describe, expect, it} from 'vitest';
import {activeCaptionChunk, chunkCaptionWords} from '../../src/captions/caption-chunk';
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

describe('activeCaptionChunk', () => {
  const words = timed([
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
  ]);
  const chunks = chunkCaptionWords(words);

  it('returns no words before the first start', () => {
    expect(activeCaptionChunk(chunks, -1)).toEqual([]);
  });

  it('grows the first chunk word by word', () => {
    expect(activeCaptionChunk(chunks, 0).map((word) => word.text)).toEqual(['The']);
    expect(activeCaptionChunk(chunks, 200).map((word) => word.text)).toEqual(['The', 'longer']);
    expect(activeCaptionChunk(chunks, 600).map((word) => word.text)).toEqual([
      'The',
      'longer',
      'your',
      'route,',
    ]);
  });

  it('holds the finished chunk until the next chunk starts', () => {
    expect(activeCaptionChunk(chunks, 700).map((word) => word.text)).toEqual([
      'The',
      'longer',
      'your',
      'route,',
    ]);
  });

  it('replaces with the next chunk when that chunk starts', () => {
    expect(activeCaptionChunk(chunks, 800).map((word) => word.text)).toEqual(['the']);
    expect(activeCaptionChunk(chunks, 1600).map((word) => word.text)).toEqual([
      'the',
      'more',
      'chances',
      'you',
      'have',
    ]);
  });

  it('holds the last chunk after the last word', () => {
    expect(activeCaptionChunk(chunks, 4000).map((word) => word.text)).toEqual([
      'to',
      'add',
      'extras.',
    ]);
  });

  it('returns no words for no chunks', () => {
    expect(activeCaptionChunk([], 0)).toEqual([]);
  });
});
