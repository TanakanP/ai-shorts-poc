import {describe, expect, it} from 'vitest';
import {reviewClip} from '../../src/stock/review-clip';

const scene = {
  id: 'mechanism', visualIntent: 'Show the nozzle sensing hole',
  requiredVisualObjects: ['nozzle hole'],
};
const clip = {
  sourcePageUrl: 'https://www.pexels.com/video/nozzle-12/',
  downloadUrl: 'https://videos.pexels.com/nozzle.mp4',
};

describe('reviewClip', () => {
  it('shows proof requirements and playable links, accepting only an explicit yes', async () => {
    const output: string[] = [];
    const answers = ['maybe', '', ' YES '];
    expect(await reviewClip(scene, clip, async () => answers.shift()!, (line) => output.push(line))).toBe(true);
    expect(output.join('\n')).toContain('nozzle hole');
    expect(output.join('\n')).toContain(clip.downloadUrl);
    expect(output.join('\n')).toContain(clip.sourcePageUrl);
    expect(answers).toEqual([]);
  });

  it('rejects on no and stops on quit', async () => {
    expect(await reviewClip(scene, clip, async () => 'n', () => {})).toBe(false);
    await expect(reviewClip(scene, clip, async () => 'q', () => {})).rejects.toThrow(/stopped/i);
  });
});
