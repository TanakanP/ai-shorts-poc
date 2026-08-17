import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {activeWordAt} from '../captions/active-word';
import {displaySpokenWord} from '../captions/display-word';
import {layoutSpokenWord} from '../captions/word-layout';
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
  const spoken = activeWordAt(scene.words, captionTimeMs(frame, fps));
  if (!spoken) return null;
  const word = displaySpokenWord(spoken);
  if (!word) return null;
  const {fontSize} = layoutSpokenWord(word);

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
          color: CAPTION_FILL,
          fontFamily: captionFontFamily,
          fontSize,
          fontWeight: CAPTION_FONT_WEIGHT,
          lineHeight: 1.04,
          textAlign: 'center',
          WebkitTextStroke: CAPTION_STROKE,
          paintOrder: 'stroke fill',
          textShadow: CAPTION_SHADOW,
        }}
      >
        {word}
      </div>
    </AbsoluteFill>
  );
};
