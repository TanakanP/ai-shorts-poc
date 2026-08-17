import {describe, expect, it} from 'vitest';
import {activeWordsAt} from '../../src/captions/active-word';
import type {VoiceWord} from '../../src/domain/voice';

const words: VoiceWord[] = [
  {text: 'Did', startMs: 80, endMs: 260},
  {text: 'you', startMs: 300, endMs: 420},
  {text: 'ever', startMs: 480, endMs: 700},
  {text: 'wonder', startMs: 760, endMs: 1100},
];

describe('activeWordsAt', () => {
  it('returns no words before the first start', () => {
    expect(activeWordsAt(words, 79)).toEqual([]);
  });

  it('returns only the first word at its start', () => {
    expect(activeWordsAt(words, 80).map((word) => word.text)).toEqual(['Did']);
  });

  it('keeps earlier words after the next word starts', () => {
    expect(activeWordsAt(words, 300).map((word) => word.text)).toEqual(['Did', 'you']);
  });

  it('keeps the full phrase after the last endMs', () => {
    expect(activeWordsAt(words, 2000).map((word) => word.text)).toEqual([
      'Did',
      'you',
      'ever',
      'wonder',
    ]);
  });

  it('keeps punctuation on tokens', () => {
    expect(activeWordsAt([{text: 'reason,', startMs: 0, endMs: 200}], 50).map((word) => word.text)).toEqual([
      'reason,',
    ]);
  });

  it('returns an empty list for no words', () => {
    expect(activeWordsAt([], 0)).toEqual([]);
  });
});
