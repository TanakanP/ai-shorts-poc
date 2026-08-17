import type {VideoScene} from './video-plan.js';
import type {VoiceWord} from './voice.js';

export type ResolvedScene = VideoScene & {
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
  localVideoPath: string;
  localAudioPath: string;
  audioDurationSeconds: number;
  words: VoiceWord[];
};

export type StockScene = Omit<
  ResolvedScene,
  'localAudioPath' | 'audioDurationSeconds' | 'words'
>;

export type ResolvedVideo = {
  runId: string;
  title: string;
  fps: 30;
  width: 1080;
  height: 1920;
  scenes: ResolvedScene[];
};
