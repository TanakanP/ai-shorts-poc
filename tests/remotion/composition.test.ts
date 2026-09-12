import {describe, expect, it} from 'vitest';
import type {ResolvedVideo} from '../../src/domain/resolved-video';
import {calculateVideoMetadata} from '../../src/remotion/Root';
import * as composition from '../../src/remotion/ShortComposition';
import {
  BACKGROUND_MUSIC_FADE_FRAMES,
  BACKGROUND_MUSIC_VOLUME,
  backgroundMusicVolume,
  createSceneTimeline,
  createVoiceTimeline,
} from '../../src/remotion/ShortComposition';

const video: ResolvedVideo = {
  runId: 'fixture-run',
  title: 'Fixture short',
  fps: 30,
  width: 1080,
  height: 1920,
  scenes: [
    {
      id: 'hook',
      role: 'hook',
      durationSeconds: 4,
      text: 'First scene text',
      visualIntent: 'First scene supermarket footage',
      searchQueries: ['first scene', 'opening grocery clip'],
      selectedSearchQuery: 'first scene',
      sourcePageUrl: 'https://example.com/one',
      creatorName: 'Creator One',
      creatorUrl: 'https://example.com/creators/one',
      localVideoPath: '/tmp/scene one.mp4',
      localAudioPath: '/tmp/voice-01.mp3',
      audioDurationSeconds: 5,
      words: [{text: 'Hello', startMs: 0, endMs: 400}],
    },
    {
      id: 'payoff',
      role: 'payoff',
      durationSeconds: 7,
      text: 'Second scene text',
      visualIntent: 'Second scene supermarket footage',
      searchQueries: ['second scene', 'closing grocery clip'],
      selectedSearchQuery: 'second scene',
      sourcePageUrl: 'https://example.com/two',
      creatorName: 'Creator Two',
      creatorUrl: 'https://example.com/creators/two',
      localVideoPath: '/tmp/scene-two.mp4',
      localAudioPath: '/tmp/voice-01.mp3',
      audioDurationSeconds: 5,
      words: [{text: 'Hello', startMs: 0, endMs: 400}],
    },
  ],
};

describe('SilentShort composition timing', () => {
  it('uses the same per-scene frame rounding as V4 voice and duration gates', () => {
    const fractional: ResolvedVideo = {...video, engineVersion: 'v4',
      scenes: video.scenes.map(s => ({...s, durationSeconds: 3.016}))};
    const frames = createVoiceTimeline(fractional).reduce((total, s) => total + s.durationInFrames, 0);
    expect(calculateVideoMetadata(fractional).durationInFrames).toBe(frames);
    expect(frames).toBe(180);
  });
  it('derives metadata duration from the supplied scene durations', () => {
    expect(calculateVideoMetadata(video)).toEqual({durationInFrames: 330});
  });

  it('overlaps scene fades without changing the total duration', () => {
    expect(createSceneTimeline(video)).toEqual([
      {scene: video.scenes[0], from: 0, durationInFrames: 120},
      {scene: video.scenes[1], from: 114, durationInFrames: 216},
    ]);
  });

  it('places voice clips sequentially with no fade overlap', () => {
    expect(createVoiceTimeline(video)).toEqual([
      {scene: video.scenes[0], from: 0, durationInFrames: 120},
      {scene: video.scenes[1], from: 120, durationInFrames: 210},
    ]);
  });

  it('does not fade the opening clip over the last frames', () => {
    expect(composition).not.toHaveProperty('LOOP_FADE_FRAMES');
    expect(composition).not.toHaveProperty('loopFadeOpacity');
  });

  it('keeps background music under the voice', () => {
    expect(BACKGROUND_MUSIC_VOLUME).toBe(0.15);
    expect(BACKGROUND_MUSIC_FADE_FRAMES).toBe(12);
  });

  it('fades the music bed in and out', () => {
    expect(backgroundMusicVolume(0, 330)).toBe(0);
    expect(backgroundMusicVolume(12, 330)).toBe(BACKGROUND_MUSIC_VOLUME);
    expect(backgroundMusicVolume(200, 330)).toBe(BACKGROUND_MUSIC_VOLUME);
    expect(backgroundMusicVolume(329, 330)).toBe(0);
  });
});
