import {Composition, type CalculateMetadataFunction} from 'remotion';
import videoPlanFixture from '../../tests/fixtures/video-plan.json';
import type {ResolvedVideo} from '../domain/resolved-video';
import type {VideoPlan} from '../domain/video-plan';
import {ShortComposition, type ShortCompositionProps} from './ShortComposition';

const planFixture = videoPlanFixture as VideoPlan;

const FPS = 30;
const fixtureVideoUrl = new URL('../../tests/fixtures/tiny-video.mp4', import.meta.url).href;
const fixtureAudioUrl = new URL('../../tests/fixtures/tiny-audio.mp3', import.meta.url).href;

const fixtureVideo: ResolvedVideo = {
  runId: 'fixture-preview',
  title: planFixture.title,
  fps: FPS,
  width: 1080,
  height: 1920,
  scenes: planFixture.scenes.map((scene, index) => ({
    ...scene,
    text:
      index === 3
        ? 'Store layouts guide every trip, placing everyday essentials beyond products you might never see.'
        : scene.text,
    selectedSearchQuery: scene.searchQueries[0] ?? '',
    sourcePageUrl: 'https://www.pexels.com/',
    creatorName: 'Fixture footage',
    creatorUrl: 'https://www.pexels.com/',
    localVideoPath: fixtureVideoUrl,
    localAudioPath: fixtureAudioUrl,
    audioDurationSeconds: 1,
    words: [{text: 'Hello', startMs: 0, endMs: 400}],
  })),
};

export const calculateVideoMetadata = (
  video: ResolvedVideo,
): {durationInFrames: number} => ({
  durationInFrames: Math.round(
    video.scenes.reduce((seconds, scene) => seconds + scene.durationSeconds, 0) * FPS,
  ),
});

const calculateMetadata: CalculateMetadataFunction<ShortCompositionProps> = ({props}) =>
  calculateVideoMetadata(props.video);

export const RemotionRoot = () => (
  <Composition
    id="SilentShort"
    component={ShortComposition}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={calculateVideoMetadata(fixtureVideo).durationInFrames}
    defaultProps={{video: fixtureVideo}}
    calculateMetadata={calculateMetadata}
  />
);
