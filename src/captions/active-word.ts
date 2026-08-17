import type {VoiceWord} from '../domain/voice';

export function activeWordsAt(words: readonly VoiceWord[], timeMs: number): VoiceWord[] {
  if (words.length === 0) return [];
  const first = words[0];
  if (!first || timeMs < first.startMs) return [];
  return words.filter((word) => timeMs >= word.startMs);
}

export function activeWordAt(words: readonly VoiceWord[], timeMs: number): string | null {
  const live = activeWordsAt(words, timeMs);
  return live.at(-1)?.text ?? null;
}
