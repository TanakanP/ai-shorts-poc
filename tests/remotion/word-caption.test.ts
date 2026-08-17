import {describe, expect, it} from 'vitest';
import {
  captionTimeMs,
  WORD_CAPTION_JUSTIFY,
  WORD_CAPTION_PADDING,
} from '../../src/remotion/WordCaption';

describe('captionTimeMs', () => {
  it('converts composition frames to milliseconds', () => {
    expect(captionTimeMs(0, 30)).toBe(0);
    expect(captionTimeMs(15, 30)).toBe(500);
    expect(captionTimeMs(30, 30)).toBe(1000);
  });
});

describe('word caption placement', () => {
  it('sits in a lower subtitle band instead of the frame center', () => {
    expect(WORD_CAPTION_JUSTIFY).toBe('flex-end');
    expect(WORD_CAPTION_PADDING).toBe('0 86px 360px');
  });
});
