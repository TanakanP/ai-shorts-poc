import type {VoiceWord} from '../domain/voice';
import {activeWordsAt} from './active-word';

export const CAPTION_CHUNK_MAX_WORDS = 5;
export const CAPTION_CHUNK_MAX_CHARS = 28;

const HARD_STOP = /[.?!]$/;
const SOFT_STOP = /[,;:]$/;

const joinedLength = (chunk: readonly VoiceWord[], next: VoiceWord): number =>
  [...chunk, next].map((word) => word.text).join(' ').length;

export function chunkCaptionWords(words: readonly VoiceWord[]): VoiceWord[][] {
  if (words.length === 0) return [];

  const chunks: VoiceWord[][] = [];
  let current: VoiceWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current);
    current = [];
  };

  for (const word of words) {
    if (current.length === 0) {
      current.push(word);
      continue;
    }

    const previous = current.at(-1);
    const shouldStartNew =
      previous !== undefined &&
      (HARD_STOP.test(previous.text) ||
        (SOFT_STOP.test(previous.text) && current.length >= 3) ||
        current.length >= CAPTION_CHUNK_MAX_WORDS ||
        joinedLength(current, word) > CAPTION_CHUNK_MAX_CHARS);

    if (shouldStartNew) flush();
    current.push(word);
  }

  flush();
  return chunks;
}

export function activeCaptionChunk(
  chunks: readonly VoiceWord[][],
  timeMs: number,
): VoiceWord[] {
  const current = [...chunks].reverse().find((chunk) => {
    const first = chunk[0];
    return first !== undefined && timeMs >= first.startMs;
  });
  if (!current) return [];
  return activeWordsAt(current, timeMs);
}
