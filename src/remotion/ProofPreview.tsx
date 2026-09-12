import {AbsoluteFill, OffthreadVideo} from 'remotion';

export type ProofPreviewProps = {source: string; trimStartSec: number; cropPosition: string; durationSec: number};
export const ProofPreview = ({source, trimStartSec, cropPosition}: ProofPreviewProps) => (
  <AbsoluteFill>
    <OffthreadVideo src={source} muted trimBefore={Math.round(trimStartSec * 30)}
      style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: cropPosition}} />
  </AbsoluteFill>
);
