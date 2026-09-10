import {ProviderError} from '../domain/provider-error';

export const VOICE_TAIL_PAD_SECONDS = 0.3;
export const MIN_AUDIO_SECONDS = 1.5;
export const MAX_AUDIO_SECONDS = 12;
export const MIN_TOTAL_SECONDS = 15;
export const MAX_TOTAL_SECONDS = 35;

export function sceneDurationFromAudio(audioDurationSeconds: number): number {
  if (audioDurationSeconds < MIN_AUDIO_SECONDS || audioDurationSeconds > MAX_AUDIO_SECONDS) {
    throw new Error(
      `Audio duration ${audioDurationSeconds}s is outside ${MIN_AUDIO_SECONDS}-${MAX_AUDIO_SECONDS}s`,
    );
  }
  return audioDurationSeconds + VOICE_TAIL_PAD_SECONDS;
}

export function assertVoicedTimeline(sceneDurations: number[], provider: 'xai' | 'elevenlabs' = 'xai'): void {
  const total = sceneDurations.reduce((sum, value) => sum + value, 0);
  if (total < MIN_TOTAL_SECONDS || total > MAX_TOTAL_SECONDS) {
    const advice = total > MAX_TOTAL_SECONDS
      ? 'Shorten the spoken script or sign-off and retry; narration has not been truncated.'
      : 'Expand the spoken script and retry.';
    const detail = `Voiced timeline ${Number(total.toFixed(3))}s is outside ${MIN_TOTAL_SECONDS}-${MAX_TOTAL_SECONDS}s including padding and outro. ${advice}`;
    throw new ProviderError(detail, {provider, kind: 'validation', detail});
  }
}
