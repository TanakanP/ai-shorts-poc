import {describe, expect, it} from 'vitest';
import {bookendLastScene} from '../../src/pipeline/bookend-last-scene';

const scene = (id: string, path: string) => ({
  id,
  localVideoPath: path,
  sourcePageUrl: `https://example.com/${id}`,
  creatorName: `Creator ${id}`,
  creatorUrl: `https://example.com/creators/${id}`,
});

describe('bookendLastScene', () => {
  it('copies the first clip and attribution onto the last scene', () => {
    const first = scene('hook', '/tmp/hook.mp4');
    const mid = scene('mid', '/tmp/mid.mp4');
    const last = scene('payoff', '/tmp/payoff.mp4');
    expect(bookendLastScene([first, mid, last])).toEqual([
      first,
      mid,
      {
        ...last,
        localVideoPath: first.localVideoPath,
        sourcePageUrl: first.sourcePageUrl,
        creatorName: first.creatorName,
        creatorUrl: first.creatorUrl,
      },
    ]);
  });

  it('leaves a single scene unchanged', () => {
    const only = scene('only', '/tmp/only.mp4');
    expect(bookendLastScene([only])).toEqual([only]);
  });
});
