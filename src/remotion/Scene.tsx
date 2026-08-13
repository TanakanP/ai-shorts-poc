import {AbsoluteFill, interpolate, OffthreadVideo, useCurrentFrame} from 'remotion';
import type {ResolvedScene} from '../domain/resolved-video';
import {layoutSceneText} from './text-layout';

type SceneProps = {
  scene: ResolvedScene;
  durationInFrames: number;
};

export const SCENE_FADE_FRAMES = 6;

const clamped = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

const getVideoSource = (path: string): string => {
  if (!path.startsWith('/')) return path;
  return `file://${path.split('/').map(encodeURIComponent).join('/')}`;
};

export const Scene = ({scene, durationInFrames}: SceneProps) => {
  const frame = useCurrentFrame();
  const layout = layoutSceneText(scene.text);
  const sceneOpacity = Math.min(
    interpolate(frame, [0, SCENE_FADE_FRAMES], [0, 1], clamped),
    interpolate(
      frame,
      [durationInFrames - SCENE_FADE_FRAMES, durationInFrames],
      [1, 0],
      clamped,
    ),
  );
  const textProgress = interpolate(frame, [0, 8], [0, 1], clamped);
  const videoScale = interpolate(
    frame,
    [0, Math.max(1, durationInFrames - 1)],
    [1, 1.04],
    clamped,
  );

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <OffthreadVideo
        src={getVideoSource(scene.localVideoPath)}
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          transform: `scale(${videoScale})`,
        }}
      />

      <AbsoluteFill style={{backgroundColor: 'rgba(0, 0, 0, 0.46)'}} />

      <AbsoluteFill
        style={{
          zIndex: 2,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '360px 86px 440px',
          opacity: textProgress,
          transform: `translateY(${24 * (1 - textProgress)}px)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            color: '#f5f5f5',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: layout.fontSize,
            fontWeight: 700,
            lineHeight: 1.04,
            textAlign: 'center',
          }}
        >
          {layout.lines.map((line, index) => (
            <span key={`${index}-${line}`}>{line}</span>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
