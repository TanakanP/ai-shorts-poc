import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {activeWordAt} from '../captions/active-word';
import {layoutSpokenWord} from '../captions/word-layout';
import type {ResolvedScene} from '../domain/resolved-video';

export const captionTimeMs = (frame: number, fps: number): number =>
  Math.round((frame / fps) * 1000);

export const WordCaption = ({scene}: {scene: ResolvedScene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const word = activeWordAt(scene.words, captionTimeMs(frame, fps));
  if (!word) return null;
  const {fontSize} = layoutSpokenWord(word);

  return (
    <AbsoluteFill
      style={{
        zIndex: 2,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '360px 86px 440px',
      }}
    >
      <div
        style={{
          color: '#f5f5f5',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize,
          fontWeight: 700,
          lineHeight: 1.04,
          textAlign: 'center',
        }}
      >
        {word}
      </div>
    </AbsoluteFill>
  );
};
