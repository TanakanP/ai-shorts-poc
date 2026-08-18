import {spokenSceneText} from '../captions/caption-segments';

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'at',
  'to',
  'of',
  'and',
  'or',
  'for',
  'with',
  'that',
  'this',
  'it',
  'in',
  'on',
  'your',
  'you',
  'not',
  'so',
  'as',
  'be',
  'are',
  'was',
  'from',
  'by',
  'often',
  'always',
  'why',
]);

export function matchTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function scoreStockMatch(videoUrl: string, searchQuery: string, sceneText: string): number {
  const slug = videoUrl.toLowerCase();
  const wanted = new Set([...matchTokens(searchQuery), ...matchTokens(spokenSceneText(sceneText))]);
  let score = 0;
  for (const token of wanted) {
    if (slug.includes(token)) score += 1;
  }
  return score;
}
