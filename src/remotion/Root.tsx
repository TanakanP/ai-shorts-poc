import {Composition, type CalculateMetadataFunction} from 'remotion';
import videoPlanFixture from '../../tests/fixtures/video-plan.json';
import type {ResolvedVideo} from '../domain/resolved-video';
import {ShortComposition, type ShortCompositionProps} from './ShortComposition';

const FPS = 30;
const fixtureVideoUrl = new URL('../../tests/fixtures/tiny-video.mp4', import.meta.url).href;

const fixtureVideo: ResolvedVideo = {
  runId: 'fixture-preview',
  title: videoPlanFixture.title,
  fps: FPS,
  width: 1080,
  height: 1920,
  scenes: videoPlanFixture.scenes.map((scene, index) => ({
    ...scene,
    text:
      index === 3
        ? 'Store layouts guide every trip, placing everyday essentials beyond products you might never see.'
        : scene.text,
    sourcePageUrl: 'https://www.pexels.com/',
    creatorName: 'Fixture footage',
    creatorUrl: 'https://www.pexels.com/',
    localVideoPath: fixtureVideoUrl,
    localAudioPath: '/tmp/voice-01.mp3',
    audioDurationSeconds: 5,
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
