import {AbsoluteFill, Html5Audio, interpolate, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import type {ResolvedScene, ResolvedVideo} from '../domain/resolved-video';
import {getVideoSource, Scene, SCENE_FADE_FRAMES} from './Scene';
import {WordCaption} from './WordCaption';

export const LOOP_FADE_FRAMES = 8;

const clamped = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

export const loopFadeOpacity = (frame: number, durationInFrames: number): number => {
  if (durationInFrames <= LOOP_FADE_FRAMES) return 0;
  const start = durationInFrames - LOOP_FADE_FRAMES;
  if (frame < start) return 0;
  return interpolate(frame, [start - 1, durationInFrames - 1], [0, 1], clamped);
};

export type ShortCompositionProps = {
  video: ResolvedVideo;
  assetBaseUrl?: string;
  localAssetPaths?: Record<string, string>;
};

export type SceneTimelineItem = {
  scene: ResolvedScene;
  from: number;
  durationInFrames: number;
};

export const createSceneTimeline = (video: ResolvedVideo): SceneTimelineItem[] => {
  let from = 0;

  return video.scenes.map((scene) => {
    const sceneFrames = Math.round(scene.durationSeconds * video.fps);
    const overlap = from === 0 ? 0 : SCENE_FADE_FRAMES;
    const item = {
      scene,
      from: from - overlap,
      durationInFrames: sceneFrames + overlap,
    };
    from += sceneFrames;
    return item;
  });
};

export const createVoiceTimeline = (video: ResolvedVideo): SceneTimelineItem[] => {
  let from = 0;

  return video.scenes.map((scene) => {
    const durationInFrames = Math.round(scene.durationSeconds * video.fps);
    const item = {
      scene,
      from,
      durationInFrames,
    };
    from += durationInFrames;
    return item;
  });
};

export const ShortComposition = ({video, assetBaseUrl, localAssetPaths}: ShortCompositionProps) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const progress = durationInFrames <= 1 ? 1 : frame / (durationInFrames - 1);
  const first = video.scenes[0];
  const fade = loopFadeOpacity(frame, durationInFrames);

  return (
    <AbsoluteFill style={{backgroundColor: '#080808'}}>
      {createSceneTimeline(video).map(({scene, from, durationInFrames: sceneDuration}) => (
        <Sequence key={scene.id} from={from} durationInFrames={sceneDuration} name={scene.id}>
          <Scene
            scene={scene}
            durationInFrames={sceneDuration}
            assetBaseUrl={assetBaseUrl}
            localAssetPaths={localAssetPaths}
          />
        </Sequence>
      ))}

      {createVoiceTimeline(video).map(({scene, from, durationInFrames: voiceDuration}) => (
        <Sequence key={`${scene.id}-voice`} from={from} durationInFrames={voiceDuration} name={`${scene.id}-voice`}>
          <Html5Audio src={getVideoSource(scene.localAudioPath, assetBaseUrl, localAssetPaths)} />
          <WordCaption scene={scene} />
        </Sequence>
      ))}

      {first && fade > 0 ? (
        <AbsoluteFill style={{opacity: fade, zIndex: 1}}>
          <OffthreadVideo
            src={getVideoSource(first.localVideoPath, assetBaseUrl, localAssetPaths)}
            muted
            style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center'}}
          />
          <AbsoluteFill style={{backgroundColor: 'rgba(0, 0, 0, 0.46)'}} />
        </AbsoluteFill>
      ) : null}

      <div
        style={{
          position: 'absolute',
          zIndex: 3,
          top: 0,
          left: 0,
          width: `${progress * 100}%`,
          height: 6,
          backgroundColor: '#f5f5f5',
        }}
      />
    </AbsoluteFill>
  );
};
