// Per-brief "answer words": terms that give the reveal away if they appear in the hook,
// the opening display/top text, or the first two voiced lines. Checked at the text step,
// before any image, voice or video spend.

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** Singular/plural variants of one word: gate/gates, box/boxes, battery/batteries, glass/glasses. */
function wordForms(word: string): string[] {
  const w = word.toLowerCase();
  const forms = new Set([w, `${w}s`, `${w}es`]);
  if (/[^aeiou]y$/u.test(w)) forms.add(`${w.slice(0, -1)}ies`);
  if (/ies$/u.test(w)) forms.add(`${w.slice(0, -3)}y`);
  if (/es$/u.test(w)) forms.add(w.slice(0, -2));
  if (/[^s]s$/u.test(w)) forms.add(w.slice(0, -1));
  return [...forms].filter(Boolean);
}

function answerPattern(term: string): RegExp | null {
  const parts = term.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  if (!parts.length) return null;
  const head = parts.slice(0, -1).map(escape);
  const last = `(?:${wordForms(parts[parts.length - 1]).map(escape).join('|')})`;
  const body = [...head, last].join('[\\s-]+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'iu');
}

/** Returns the answer words found in text (case-insensitive, word-boundary, plural-aware). */
export function findAnswerWords(text: string, answerWords: readonly string[] = []): string[] {
  const normalized = text.replace(/[\u2019']/gu, "'");
  return [...new Set(answerWords.filter(term => answerPattern(term)?.test(normalized)))];
}

export function answerWordIssues(label: string, text: string, answerWords: readonly string[] = []): string[] {
  const found = findAnswerWords(text, answerWords);
  return found.length ? [`${label} gives the answer away early (${found.join(', ')})`] : [];
}
