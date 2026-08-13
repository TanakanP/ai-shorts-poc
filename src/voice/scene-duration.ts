export const VOICE_TAIL_PAD_SECONDS = 0.3;
export const MIN_AUDIO_SECONDS = 2.5;
export const MAX_AUDIO_SECONDS = 12;
export const MIN_TOTAL_SECONDS = 20;
export const MAX_TOTAL_SECONDS = 60;

export function sceneDurationFromAudio(audioDurationSeconds: number): number {
  if (audioDurationSeconds < MIN_AUDIO_SECONDS || audioDurationSeconds > MAX_AUDIO_SECONDS) {
    throw new Error(
      `Audio duration ${audioDurationSeconds}s is outside ${MIN_AUDIO_SECONDS}-${MAX_AUDIO_SECONDS}s`,
    );
  }
  return audioDurationSeconds + VOICE_TAIL_PAD_SECONDS;
}

export function assertVoicedTimeline(sceneDurations: number[]): void {
  const total = sceneDurations.reduce((sum, value) => sum + value, 0);
  if (total < MIN_TOTAL_SECONDS || total > MAX_TOTAL_SECONDS) {
    throw new Error(
      `Voiced timeline ${total}s is outside ${MIN_TOTAL_SECONDS}-${MAX_TOTAL_SECONDS}s`,
    );
  }
}
