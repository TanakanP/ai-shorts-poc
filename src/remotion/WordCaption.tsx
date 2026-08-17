import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {activeWordsAt} from '../captions/active-word';
import {layoutAccumulatedPhrase} from '../captions/phrase-layout';
import type {ResolvedScene} from '../domain/resolved-video';
import {captionFontFamily} from './caption-font';

export const captionTimeMs = (frame: number, fps: number): number =>
  Math.round((frame / fps) * 1000);

export const WORD_CAPTION_JUSTIFY = 'flex-end' as const;
export const WORD_CAPTION_PADDING = '0 86px 360px';

export const CAPTION_FILL = '#f5f5f5';
export const CAPTION_FONT_WEIGHT = 900;
export const CAPTION_STROKE = '6px #000';
export const CAPTION_SHADOW = '0 4px 12px rgba(0,0,0,0.65)';

export const WordCaption = ({scene}: {scene: ResolvedScene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const live = activeWordsAt(scene.words, captionTimeMs(frame, fps));
  if (live.length === 0) return null;
  const texts = live.map((word) => word.text);
  const {fontSize} = layoutAccumulatedPhrase(texts.join(' '));

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
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: '0.35em',
          rowGap: 4,
          maxWidth: 908,
          color: CAPTION_FILL,
          fontFamily: captionFontFamily,
          fontSize,
          fontWeight: CAPTION_FONT_WEIGHT,
          WebkitTextStroke: CAPTION_STROKE,
          paintOrder: 'stroke fill',
          textShadow: CAPTION_SHADOW,
          lineHeight: 1.08,
          textAlign: 'center',
        }}
      >
        {texts.map((text, index) => (
          <span key={`${index}-${text}`} style={{opacity: index === texts.length - 1 ? 1 : 0.85}}>
            {text}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
