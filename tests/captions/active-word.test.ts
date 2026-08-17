import {describe, expect, it} from 'vitest';
import {activeWordAt} from '../../src/captions/active-word';
import type {VoiceWord} from '../../src/domain/voice';

const words: VoiceWord[] = [
  {text: 'Did', startMs: 80, endMs: 260},
  {text: 'you', startMs: 300, endMs: 420},
  {text: 'ever', startMs: 480, endMs: 700},
  {text: 'wonder', startMs: 760, endMs: 1100},
];

describe('activeWordAt', () => {
  it('returns null before the first word starts', () => {
    expect(activeWordAt(words, 79)).toBeNull();
  });

  it('returns the first word at its start', () => {
    expect(activeWordAt(words, 80)).toBe('Did');
  });

  it('holds a short word until the next word starts', () => {
    expect(activeWordAt(words, 280)).toBe('Did');
    expect(activeWordAt(words, 299)).toBe('Did');
    expect(activeWordAt(words, 300)).toBe('you');
  });

  it('holds the last word after its endMs', () => {
    expect(activeWordAt(words, 2000)).toBe('wonder');
  });

  it('keeps punctuation on the token', () => {
    expect(activeWordAt([{text: 'reason,', startMs: 0, endMs: 200}], 50)).toBe('reason,');
  });

  it('returns null for an empty word list', () => {
    expect(activeWordAt([], 0)).toBeNull();
  });
});
