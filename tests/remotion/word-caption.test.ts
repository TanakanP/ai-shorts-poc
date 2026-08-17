import {describe, expect, it} from 'vitest';
import {
  captionTimeMs,
  CAPTION_FILL,
  CAPTION_FONT_SIZE,
  CAPTION_FONT_WEIGHT,
  CAPTION_STROKE,
  CAPTION_SHADOW,
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
    expect(WORD_CAPTION_PADDING).toBe('0 86px 280px');
  });
});

describe('caption style', () => {
  it('uses a white fill, black stroke, and drop shadow', () => {
    expect(CAPTION_FILL).toBe('#f5f5f5');
    expect(CAPTION_FONT_WEIGHT).toBe(900);
    expect(CAPTION_STROKE).toBe('6px #000');
    expect(CAPTION_SHADOW).toBe('0 4px 12px rgba(0,0,0,0.65)');
  });
});

describe('caption size', () => {
  it('keeps a fixed large size instead of shrinking to the full sentence', () => {
    expect(CAPTION_FONT_SIZE).toBe(72);
  });
});
