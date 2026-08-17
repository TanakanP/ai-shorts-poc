import {AbsoluteFill, Html5Audio, interpolate, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import type {ResolvedScene, ResolvedVideo} from '../domain/resolved-video';
import {getVideoSource, Scene, SCENE_FADE_FRAMES} from './Scene';
import {WordCaption} from './WordCaption';

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

export const BACKGROUND_MUSIC_VOLUME = 0.15;
export const BACKGROUND_MUSIC_FADE_FRAMES = 12;

const clamped = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

export const backgroundMusicVolume = (frame: number, durationInFrames: number): number => {
  if (durationInFrames <= BACKGROUND_MUSIC_FADE_FRAMES * 2) return BACKGROUND_MUSIC_VOLUME;
  const fadeIn = interpolate(frame, [0, BACKGROUND_MUSIC_FADE_FRAMES], [0, BACKGROUND_MUSIC_VOLUME], clamped);
  const fadeOut = interpolate(
    frame,
    [durationInFrames - BACKGROUND_MUSIC_FADE_FRAMES, durationInFrames - 1],
    [BACKGROUND_MUSIC_VOLUME, 0],
    clamped,
  );
  return Math.min(fadeIn, fadeOut);
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

  return (
    <AbsoluteFill style={{backgroundColor: '#080808'}}>
      {createSceneTimeline(video).map(({scene, from, durationInFrames: sceneDuration}, index, items) => (
        <Sequence key={scene.id} from={from} durationInFrames={sceneDuration} name={scene.id}>
          <Scene
            scene={scene}
            durationInFrames={sceneDuration}
            fadeIn={index > 0}
            fadeOut={index < items.length - 1}
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

      {video.backgroundMusicPath ? (
        <Html5Audio
          src={getVideoSource(video.backgroundMusicPath, assetBaseUrl, localAssetPaths)}
          loop
          volume={backgroundMusicVolume(frame, durationInFrames)}
        />
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
