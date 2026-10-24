import {describe, expect, it} from 'vitest';
import {renderedDurationSec, v5RenderScenes} from '../../src/pipeline/create-short-v5';
import {backgroundMusicVolume, BACKGROUND_MUSIC_VOLUME} from '../../src/remotion/ShortComposition';

const scenes = [
  {id: 'paradox', durationSeconds: 2}, {id: 'payoff', durationSeconds: 5.5}, {id: 'channel-outro', durationSeconds: 2.2},
];

describe('v5 loop ending', () => {
  it('drops the channel sting by default and keeps it when opted in', () => {
    expect(v5RenderScenes(scenes).map(s => s.id)).toEqual(['paradox', 'payoff']);
    expect(v5RenderScenes(scenes, true)).toHaveLength(3);
  });
  it('expected MP4 duration matches only the rendered scenes', () => {
    expect(renderedDurationSec(v5RenderScenes(scenes))).toBeCloseTo(7.5, 5);
  });
  it('keeps music at full level to the last frame when looping', () => {
    expect(backgroundMusicVolume(749, 750, true)).toBe(0);
    expect(backgroundMusicVolume(734, 750, true)).toBe(BACKGROUND_MUSIC_VOLUME);
    expect(backgroundMusicVolume(749, 750)).toBe(0);
  });
});
