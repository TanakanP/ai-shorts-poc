import type {VoiceWord} from '../domain/voice';

const INLINE_TAG = /\[(?:pause|long-pause|laugh|chuckle)\]/gi;
const WRAP_TAG = /<\/?(?:emphasis|fast|slow|loud)>/gi;

export function stripSpeechTags(text: string): string {
  return text.replace(INLINE_TAG, ' ').replace(WRAP_TAG, '').replace(/\s+/g, ' ').trim();
}

export function captionWords(words: readonly VoiceWord[]): VoiceWord[] {
  return words
    .map((word) => ({...word, text: word.text.replace(INLINE_TAG, '').replace(WRAP_TAG, '')}))
    .filter((word) => word.text.replace(/\s+/g, '').length > 0);
}
