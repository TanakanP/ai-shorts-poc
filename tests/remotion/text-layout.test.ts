import {describe, expect, it} from 'vitest';
import {layoutSceneText} from '../../src/remotion/text-layout';

describe('layoutSceneText', () => {
  it('uses the large two-line tier for text up to 28 characters', () => {
    const layout = layoutSceneText('Build habits now');

    expect(layout.fontSize).toBe(96);
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines).toEqual(['Build habits', 'now']);
  });

  it('uses the three-line tier for 29 to 55 characters', () => {
    const layout = layoutSceneText('Small steps compound into life changing results');

    expect(layout.fontSize).toBe(82);
    expect(layout.lines).toHaveLength(3);
    expect(layout.lines).toEqual(['Small steps', 'compound into life', 'changing results']);
  });

  it('uses the four-line tier for 56 to 100 characters', () => {
    const layout = layoutSceneText(
      'The best ideas become useful when you take one small action each day without fail',
    );

    expect(layout.fontSize).toBe(70);
    expect(layout.lines).toHaveLength(4);
  });

  it.each([
    [28, 96],
    [29, 82],
    [55, 82],
    [56, 70],
  ])('selects the %i-character boundary tier', (length, fontSize) => {
    expect(layoutSceneText('x'.repeat(length)).fontSize).toBe(fontSize);
  });

  it.each([
    ['two', 'aaaaaaa bbbbbbb ccccccc', 2],
    ['three', 'aaaaaaaaaa bbbbbbbbbb cccccccccc dddddddddd eeeeeeeeeee', 3],
    [
      'four',
      'aaaaaaaaaa bbbbbbbbbb cccccccccc dddddddddd eeeeeeeeee ffffffffff gggggggggg hhhhhhhhhh iiiiiiiiiiii',
      4,
    ],
  ])('never exceeds the %s-line tier when greedy wrapping would overflow', (_tier, text, maxLines) => {
    const layout = layoutSceneText(text);

    expect(layout.lines).toHaveLength(maxLines);
    expect(layout.lines.join(' ')).toBe(text);
  });

  it('preserves every word in order without blank lines', () => {
    const layout = layoutSceneText('Focus   on\twhat matters most');

    expect(layout.lines.join(' ')).toBe('Focus on what matters most');
    expect(layout.lines.every((line) => line.trim().length > 0)).toBe(true);
  });

  it('emergency-splits a valid overlong token without adding characters', () => {
    const text = 'x'.repeat(100);
    const layout = layoutSceneText(text);

    expect(layout.lines).toHaveLength(4);
    expect(layout.lines.every((line) => line.length <= 25)).toBe(true);
    expect(layout.lines.join('')).toBe(text);
  });

  it('keeps every line within budget across multiple overlong tokens', () => {
    const text = `${'a'.repeat(26)} ${'b'.repeat(26)} ${'c'.repeat(26)}`;
    const layout = layoutSceneText(text);

    expect(layout.lines.every((line) => Array.from(line).length <= 25)).toBe(true);
    expect(layout.lines.join(' ').replaceAll(' ', '')).toBe(text.replaceAll(' ', ''));
  });

  it('does not split non-BMP characters into invalid halves', () => {
    const text = '😀'.repeat(40);
    const layout = layoutSceneText(text);

    expect(layout.lines.join('')).toBe(text);
    expect(layout.lines.every((line) => !/[\uD800-\uDBFF]$|^[\uDC00-\uDFFF]/.test(line))).toBe(true);
  });

  it('rejects text longer than 100 characters', () => {
    expect(() => layoutSceneText('x'.repeat(101))).toThrow('Scene text must be 100 characters or fewer');
  });

  it('rejects whitespace-only text', () => {
    expect(() => layoutSceneText(' \t ')).toThrow('Scene text cannot be blank');
  });
});
