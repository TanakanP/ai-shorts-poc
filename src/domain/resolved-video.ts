import type {VideoScene} from './video-plan.js';
import type {VoiceWord} from './voice.js';

export type ResolvedScene = VideoScene & {
  selectedSearchQuery: string;
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
  localVideoPath: string;
  localAudioPath: string;
  audioDurationSeconds: number;
  words: VoiceWord[];
  generatedAsset?: {provider: 'grok-imagine' | 'google-flow'; sceneId: string; sha256: string; promptHash: string};
};

export type StockScene = Omit<
  ResolvedScene,
  'localAudioPath' | 'audioDurationSeconds' | 'words'
>;

export type ResolvedVideo = {
  engineVersion?: 'v4' | 'v5';
  runId: string;
  title: string;
  fps: 30;
  width: 1080;
  height: 1920;
  backgroundMusicPath?: string;
  /** Loop-friendly ending: music plays at full level to the last frame so the end flows into the start. */
  loopEnding?: boolean;
  scenes: ResolvedScene[];
};
