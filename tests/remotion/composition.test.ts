import {describe, expect, it} from 'vitest';
import type {ResolvedVideo} from '../../src/domain/resolved-video';
import {calculateVideoMetadata} from '../../src/remotion/Root';
import {
  createSceneTimeline,
  createVoiceTimeline,
  loopFadeOpacity,
  LOOP_FADE_FRAMES,
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
      durationSeconds: 4,
      text: 'First scene text',
      searchQuery: 'first scene',
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
      durationSeconds: 7,
      text: 'Second scene text',
      searchQuery: 'second scene',
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

  it('exports an 8-frame loop fade', () => {
    expect(LOOP_FADE_FRAMES).toBe(8);
  });

  it('keeps the opening overlay hidden until the last 8 frames', () => {
    expect(loopFadeOpacity(0, 330)).toBe(0);
    expect(loopFadeOpacity(321, 330)).toBe(0);
  });

  it('fades the opening overlay from 0 to 1 across the last 8 frames', () => {
    expect(loopFadeOpacity(322, 330)).toBeGreaterThan(0);
    expect(loopFadeOpacity(329, 330)).toBe(1);
  });
});
