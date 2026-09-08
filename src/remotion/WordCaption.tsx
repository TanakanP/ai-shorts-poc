import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {currentWordIndexAt, singleCaptionWordAt} from '../captions/active-word';
import {CHANNEL_OUTRO_SCENE_ID, liveCaptionLines} from '../captions/caption-segments';
import type {ResolvedScene} from '../domain/resolved-video';
import {captionFontFamily} from './caption-font';

export const captionTimeMs = (frame: number, fps: number): number =>
  Math.round((frame / fps) * 1000);

export const WORD_CAPTION_JUSTIFY = 'flex-end' as const;
export const WORD_CAPTION_PADDING = '0 86px 280px';

export const CAPTION_FILL = '#f5f5f5';
export const CAPTION_KARAOKE_FILL = '#ffe14d';
export const CAPTION_FONT_WEIGHT = 900;
export const CAPTION_FONT_SIZE = 72;
export const CAPTION_STROKE = '6px #000';
export const CAPTION_SHADOW = '0 4px 12px rgba(0,0,0,0.65)';

export const WordCaption = ({scene}: {scene: ResolvedScene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (scene.words.length === 0) return null;
  const timeMs = captionTimeMs(frame, fps);
  const isOutro = scene.id === CHANNEL_OUTRO_SCENE_ID;
  const word = isOutro ? null : singleCaptionWordAt(scene.words, timeMs);
  const lines = isOutro ? liveCaptionLines(scene, timeMs) : word ? [[word]] : [];
  if (lines.length === 0) return null;
  const current = currentWordIndexAt(scene.words, timeMs);
  const currentWord = current === null ? null : scene.words[current];

  return (
    <AbsoluteFill
      style={{
        zIndex: 2,
        alignItems: 'center',
        justifyContent: WORD_CAPTION_JUSTIFY,
        padding: WORD_CAPTION_PADDING,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          rowGap: 8,
          maxWidth: 908,
          fontFamily: captionFontFamily,
          fontSize: CAPTION_FONT_SIZE,
          fontWeight: CAPTION_FONT_WEIGHT,
          WebkitTextStroke: CAPTION_STROKE,
          paintOrder: 'stroke fill',
          textShadow: CAPTION_SHADOW,
          lineHeight: 1.08,
          textAlign: 'center',
        }}
      >
        {lines.map((line, lineIndex) => (
          <div
            key={`line-${lineIndex}`}
            style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.35em', rowGap: 4}}
          >
            {line.map((word, index) => (
              <span
                key={`${lineIndex}-${index}-${word.startMs}-${word.text}`}
                style={{
                  color:
                    isOutro && currentWord !== null &&
                    word.startMs === currentWord.startMs &&
                    word.text === currentWord.text
                      ? CAPTION_KARAOKE_FILL
                      : CAPTION_FILL,
                }}
              >
                {word.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
