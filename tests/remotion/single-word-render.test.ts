import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import type {ResolvedScene} from '../../src/domain/resolved-video';
import {WordCaption} from '../../src/remotion/WordCaption';

const clock = vi.hoisted(() => ({frame: 6}));
vi.mock('remotion', async (original) => ({
  ...await original<typeof import('remotion')>(),
  useCurrentFrame: () => clock.frame,
  useVideoConfig: () => ({fps: 30}),
}));
vi.mock('../../src/remotion/caption-font', () => ({captionFontFamily: 'sans-serif'}));

const scene = {
  id: 'hook', text: 'Hello there!',
  words: [
    {text: 'Hello', startMs: 0, endMs: 300},
    {text: 'there!', startMs: 350, endMs: 600},
  ],
} as ResolvedScene;

describe('one-word caption rendering', () => {
  it('renders one white word, replaces it, and clears after speech', () => {
    clock.frame = 6;
    const first = renderToStaticMarkup(createElement(WordCaption, {scene}));
    expect(first).toContain('Hello');
    expect(first).not.toContain('there!');
    expect(first).not.toContain('#ffe14d');
    clock.frame = 12;
    const second = renderToStaticMarkup(createElement(WordCaption, {scene}));
    expect(second).toContain('there!');
    expect(second).not.toContain('Hello');
    clock.frame = 18;
    expect(renderToStaticMarkup(createElement(WordCaption, {scene}))).toBe('');
  });

  it('preserves full sign-off text for the separate outro', () => {
    clock.frame = 6;
    const html = renderToStaticMarkup(createElement(WordCaption, {
      scene: {...scene, id: 'channel-outro', text: 'Hello | there!'},
    }));
    expect(html).toContain('Hello');
    expect(html).toContain('there!');
  });
});
