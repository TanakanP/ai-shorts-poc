import {describe, expect, it} from 'vitest';
import {singleCaptionWordAt} from '../../src/captions/active-word';

const words = [
  {text: 'Exit', startMs: 100, endMs: 300},
  {text: '145,', startMs: 400, endMs: 600},
  {text: 'miles.', startMs: 1000, endMs: 1300},
];

describe('singleCaptionWordAt', () => {
  it.each([
    [0, null], [100, 'Exit'], [350, 'Exit'], [400, '145,'],
    [599, '145,'], [600, null], [900, null], [1000, 'miles.'], [1300, null],
  ])('shows only the current word at %i ms', (time, expected) => {
    expect(singleCaptionWordAt(words, time)?.text ?? null).toBe(expected);
  });

  it('handles empty words and strips speech tags without displaying pause tokens', () => {
    expect(singleCaptionWordAt([], 200)).toBeNull();
    expect(singleCaptionWordAt([
      {text: '[pause]', startMs: 0, endMs: 100},
      {text: '<emphasis>Hello!</emphasis>', startMs: 200, endMs: 400},
    ], 250)?.text).toBe('Hello!');
  });
});
