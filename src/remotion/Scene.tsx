import {AbsoluteFill, interpolate, OffthreadVideo, useCurrentFrame, useVideoConfig} from 'remotion';
import type {ResolvedScene} from '../domain/resolved-video';
import type {BeatRole} from '../domain/video-plan';
import {captionFontFamily} from './caption-font';
import {layoutSceneText} from './text-layout';

type SceneProps = {
  scene: ResolvedScene;
  durationInFrames: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
  assetBaseUrl?: string;
  localAssetPaths?: Record<string, string>;
};

export const SCENE_FADE_FRAMES = 6;
export const SCENE_WASH_OPACITY = 0;

export const DISPLAY_CARD_JUSTIFY = 'flex-start' as const;
export const DISPLAY_CARD_PADDING = '220px 86px 640px';
export const DISPLAY_FILL = '#f5f5f5';
export const DISPLAY_EMPHASIS_FILL = '#ffe14d';
export const DISPLAY_FONT_WEIGHT = 900;
export const DISPLAY_STROKE = '6px #000';
export const DISPLAY_SHADOW = '0 4px 12px rgba(0,0,0,0.65)';

const HOOK_DISPLAY_FONT_SIZE = 96;
const STORY_DISPLAY_FONT_SIZE = 82;
const OUTRO_DISPLAY_FONT_SIZE = 70;

const clamped = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

/** Reframes cycled inside one clip: scale plus a pan offset (% of frame) so each cut reads as a new shot. */
export const CUT_FRAMINGS = [
  {scale: 1, x: 0, y: 0},
  {scale: 1.16, x: -4, y: -3},
  {scale: 1.08, x: 3, y: 2},
  {scale: 1.2, x: 4, y: -4},
] as const;
const FIRST_CUT_SEC = 1.5;
export type CutFraming = {scale: number; x: number; y: number};

/** Framing for a frame: first cut by 1.5s, then a new framing every interval, so a 6s clip never holds one shot. */
export function cutFraming(frame: number, fps: number, intervalSec: number): CutFraming {
  if (!(intervalSec > 0)) return CUT_FRAMINGS[0];
  const t = frame / fps;
  const segment = t < FIRST_CUT_SEC ? 0 : 1 + Math.floor((t - FIRST_CUT_SEC) / intervalSec);
  return CUT_FRAMINGS[segment % CUT_FRAMINGS.length];
}

export function punchInScale(frame: number, fps: number, intervalSec: number): number {
  return cutFraming(frame, fps, intervalSec).scale;
}

export function cutTransform(frame: number, fps: number, intervalSec: number): string {
  const f = cutFraming(frame, fps, intervalSec);
  return `scale(${f.scale}) translate(${f.x}%, ${f.y}%)`;
}

export const sceneOpacity = (
  frame: number,
  durationInFrames: number,
  edges: {fadeIn: boolean; fadeOut: boolean},
): number => {
  const fadeInOpacity = edges.fadeIn
    ? interpolate(frame, [0, SCENE_FADE_FRAMES], [0, 1], clamped)
    : 1;
  const fadeOutOpacity = edges.fadeOut
    ? interpolate(frame, [durationInFrames - SCENE_FADE_FRAMES, durationInFrames], [1, 0], clamped)
    : 1;
  return Math.min(fadeInOpacity, fadeOutOpacity);
};

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

export function primaryDisplayText(scene: {role: BeatRole; displayText?: string}): string {
  if (scene.role !== 'hook') return '';
  return scene.displayText?.trim() ?? '';
}

export function shouldRenderDisplayCard(scene: {role: BeatRole; displayText?: string}): boolean {
  return primaryDisplayText(scene).length > 0;
}

export function displayFontSizeForRole(role: BeatRole): number {
  if (role === 'hook') return HOOK_DISPLAY_FONT_SIZE;
  if (role === 'outro') return OUTRO_DISPLAY_FONT_SIZE;
  return STORY_DISPLAY_FONT_SIZE;
}

export function isDisplayEmphasis(word: string, emphasisWords: readonly string[] = []): boolean {
  const normalized = word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  if (!normalized) return false;
  return emphasisWords.some((emphasis) => {
    const target = emphasis.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    return target.length > 0 && normalized.includes(target);
  });
}

export const Scene = ({
  scene,
  durationInFrames,
  fadeIn = true,
  fadeOut = true,
  assetBaseUrl,
  localAssetPaths,
}: SceneProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = sceneOpacity(frame, durationInFrames, {fadeIn, fadeOut});
  const videoScale = interpolate(
    frame,
    [0, Math.max(1, durationInFrames - 1)],
    [1, 1.04],
    clamped,
  );
  const displayText = primaryDisplayText(scene);
  const layout = displayText ? layoutSceneText(displayText) : null;

  return (
    <AbsoluteFill style={{opacity}}>
      <OffthreadVideo
        src={getVideoSource(scene.localVideoPath, assetBaseUrl, localAssetPaths)}
        trimBefore={Math.round((scene.videoTrimStartSec ?? 0) * fps)}
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: scene.videoCropPosition ?? 'center center',
          transform: scene.cutIntervalSec
            ? cutTransform(frame, fps, scene.cutIntervalSec)
            : `scale(${scene.proofAssetId || scene.disableVideoZoom ? 1 : videoScale})`,
        }}
      />

      {SCENE_WASH_OPACITY > 0 ? (
        <AbsoluteFill style={{backgroundColor: `rgba(0, 0, 0, ${SCENE_WASH_OPACITY})`}} />
      ) : null}

      {layout ? (
        <AbsoluteFill
          style={{
            zIndex: 2,
            alignItems: 'center',
            justifyContent: DISPLAY_CARD_JUSTIFY,
            padding: DISPLAY_CARD_PADDING,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              maxWidth: 908,
              fontFamily: captionFontFamily,
              fontSize: displayFontSizeForRole(scene.role),
              fontWeight: DISPLAY_FONT_WEIGHT,
              WebkitTextStroke: DISPLAY_STROKE,
              paintOrder: 'stroke fill',
              textShadow: DISPLAY_SHADOW,
              lineHeight: 1.04,
              textAlign: 'center',
            }}
          >
            {layout.lines.map((line, lineIndex) => (
              <div
                key={`${lineIndex}-${line}`}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  columnGap: '0.35em',
                  rowGap: 4,
                }}
              >
                {line.split(/\s+/).map((word, wordIndex) => (
                  <span
                    key={`${lineIndex}-${wordIndex}-${word}`}
                    style={{
                      color: isDisplayEmphasis(word, scene.emphasisWords ?? [])
                        ? DISPLAY_EMPHASIS_FILL
                        : DISPLAY_FILL,
                    }}
                  >
                    {word}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
