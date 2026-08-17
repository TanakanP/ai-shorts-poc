import {AbsoluteFill, interpolate, OffthreadVideo, useCurrentFrame} from 'remotion';
import type {ResolvedScene} from '../domain/resolved-video';

type SceneProps = {
  scene: ResolvedScene;
  durationInFrames: number;
  assetBaseUrl?: string;
  localAssetPaths?: Record<string, string>;
};

export const SCENE_FADE_FRAMES = 6;

const clamped = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

export const getVideoSource = (
  path: string,
  assetBaseUrl?: string,
  localAssetPaths?: Record<string, string>,
): string => {
  const localAssetPath = localAssetPaths?.[path] ?? (path.startsWith('/') ? path : undefined);
  if (assetBaseUrl && localAssetPath) {
    const url = new URL('/asset', assetBaseUrl);
    url.searchParams.set('path', localAssetPath);
    return url.href;
  }
  if (!path.startsWith('/')) return path;
  return `file://${path.split('/').map(encodeURIComponent).join('/')}`;
};

export const Scene = ({scene, durationInFrames, assetBaseUrl, localAssetPaths}: SceneProps) => {
  const frame = useCurrentFrame();
  const sceneOpacity = Math.min(
    interpolate(frame, [0, SCENE_FADE_FRAMES], [0, 1], clamped),
    interpolate(
      frame,
      [durationInFrames - SCENE_FADE_FRAMES, durationInFrames],
      [1, 0],
      clamped,
    ),
  );
  const videoScale = interpolate(
    frame,
    [0, Math.max(1, durationInFrames - 1)],
    [1, 1.04],
    clamped,
  );

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <OffthreadVideo
        src={getVideoSource(scene.localVideoPath, assetBaseUrl, localAssetPaths)}
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
    </AbsoluteFill>
  );
};
