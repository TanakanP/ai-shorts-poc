import {captionWords} from './speech-tags';
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

/** Hold across tiny word gaps, but leave real pauses and the speech tail blank. */
export function singleCaptionWordAt(words: readonly VoiceWord[], timeMs: number): VoiceWord | null {
  const visible = captionWords(words);
  const index = currentWordIndexAt(visible, timeMs);
  if (index === null) return null;
  const word = visible[index];
  const next = visible[index + 1];
  if (timeMs < word.endMs) return word;
  if (next && next.startMs - word.endMs <= 150 && timeMs < next.startMs) return word;
  return null;
}
