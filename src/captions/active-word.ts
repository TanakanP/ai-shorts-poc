import type {VoiceWord} from '../domain/voice';

export function activeWordAt(words: readonly VoiceWord[], timeMs: number): string | null {
  if (words.length === 0) return null;
  const first = words[0];
  if (!first || timeMs < first.startMs) return null;

  let current = first.text;
  for (const word of words) {
    if (timeMs >= word.startMs) current = word.text;
    else break;
  }
  return current;
}
