import type {VoiceWord} from '../domain/voice';

export function activeWordsAt(words: readonly VoiceWord[], timeMs: number): VoiceWord[] {
  if (words.length === 0) return [];
  const first = words[0];
  if (!first || timeMs < first.startMs) return [];
  return words.filter((word) => timeMs >= word.startMs);
}

export function currentWordIndexAt(words: readonly VoiceWord[], timeMs: number): number | null {
  let current: number | null = null;
  for (const [index, word] of words.entries()) {
    if (timeMs >= word.startMs) current = index;
  }
  return current;
}
