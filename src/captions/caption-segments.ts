import type {VoiceWord} from '../domain/voice';
import {activeCaptionClause, chunkCaptionClauses} from './caption-clauses';
import {captionWords, stripSpeechTags} from './speech-tags';

export const CHANNEL_OUTRO_SCENE_ID = 'channel-outro';

const normalizeToken = (text: string): string => text.toLowerCase().replace(/[^a-z0-9']/g, '');

export function ensureCaptionBars(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || trimmed.includes('|')) return trimmed;

  const dashed = trimmed
    .split(/\s*[—–―]\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (dashed.length >= 2) return dashed.slice(0, 3).join(' | ');

  const sentences = trimmed
    .split(/(?<=[.?!])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (sentences.length >= 2) return sentences.slice(0, 3).join(' | ');

  return trimmed;
}

export function spokenSceneText(text: string): string {
  return text
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ');
}

export function parseCaptionSegments(text: string): string[] {
  return text.split('|').map((part) => part.trim());
}

const tokensMatch = (needed: string, spoken: string): boolean =>
  needed === spoken || needed.startsWith(spoken) || spoken.startsWith(needed);

export function alignCaptionSegments(
  segments: readonly string[],
  words: readonly VoiceWord[],
): VoiceWord[][] {
  if (words.length === 0) return [];
  if (segments.length <= 1) return [words.slice()];

  const chunks: VoiceWord[][] = [];
  let wordIndex = 0;

  for (const [segmentIndex, segment] of segments.entries()) {
    if (segmentIndex === segments.length - 1) {
      const rest = words.slice(wordIndex);
      if (rest.length === 0) return [words.slice()];
      chunks.push(rest);
      break;
    }

    const needed = segment.split(/\s+/).map(normalizeToken).filter(Boolean);
    const chunk: VoiceWord[] = [];
    let neededIndex = 0;

    while (neededIndex < needed.length && wordIndex < words.length) {
      const spoken = normalizeToken(words[wordIndex]?.text ?? '');
      if (!spoken) {
        wordIndex += 1;
        continue;
      }
      const want = needed[neededIndex];
      if (!want || !tokensMatch(want, spoken)) return [words.slice()];
      chunk.push(words[wordIndex]!);
      wordIndex += 1;
      neededIndex += 1;
    }

    if (neededIndex < needed.length || chunk.length === 0) return [words.slice()];
    chunks.push(chunk);
  }

  return chunks;
}

export function liveCaptionLines(
  scene: {id: string; text: string; words: readonly VoiceWord[]},
  timeMs: number,
): VoiceWord[][] {
  const words = captionWords(scene.words);
  const segments = parseCaptionSegments(scene.text).map(stripSpeechTags).filter(Boolean);
  const chunks = segments.length > 1 ? alignCaptionSegments(segments, words) : chunkCaptionClauses(words);
  if (scene.id === CHANNEL_OUTRO_SCENE_ID) return chunks;
  const live = activeCaptionClause(chunks, timeMs);
  return live.length === 0 ? [] : [live];
}
