import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import type {ResolvedScene, ResolvedVideo} from '../domain/resolved-video';
import {Scene, SCENE_FADE_FRAMES} from './Scene';

export type ShortCompositionProps = {
  video: ResolvedVideo;
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

export const ShortComposition = ({video}: ShortCompositionProps) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const progress = durationInFrames <= 1 ? 1 : frame / (durationInFrames - 1);

  return (
    <AbsoluteFill style={{backgroundColor: '#080808'}}>
      {createSceneTimeline(video).map(({scene, from, durationInFrames: sceneDuration}) => (
        <Sequence key={scene.id} from={from} durationInFrames={sceneDuration} name={scene.id}>
          <Scene scene={scene} durationInFrames={sceneDuration} />
        </Sequence>
      ))}

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
