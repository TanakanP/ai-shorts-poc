export type VoiceWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export type SceneVoice = {
  sceneId: string;
  localAudioPath: string;
  voiceId: string;
  audioDurationSeconds: number;
  durationSeconds: number;
  words: VoiceWord[];
};

export type VoiceManifest = {
  voiceId: string;
  language: 'en';
  scenes: SceneVoice[];
};
