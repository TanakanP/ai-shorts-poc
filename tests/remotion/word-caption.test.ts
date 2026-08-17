import {describe, expect, it} from 'vitest';
import {captionTimeMs} from '../../src/remotion/WordCaption';

describe('captionTimeMs', () => {
  it('converts composition frames to milliseconds', () => {
    expect(captionTimeMs(0, 30)).toBe(0);
    expect(captionTimeMs(15, 30)).toBe(500);
    expect(captionTimeMs(30, 30)).toBe(1000);
  });
});
