import type {VoiceWord} from '../domain/voice';

export function activeWordsAt(words: readonly VoiceWord[], timeMs: number): VoiceWord[] {
  if (words.length === 0) return [];
  const first = words[0];
  if (!first || timeMs < first.startMs) return [];
  return words.filter((word) => timeMs >= word.startMs);
}
