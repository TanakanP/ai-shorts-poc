import {describe, expect, it} from 'vitest';
import type {ResolvedVideo} from '../../src/domain/resolved-video';
import {calculateVideoMetadata} from '../../src/remotion/Root';
import {createSceneTimeline} from '../../src/remotion/ShortComposition';

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
});
