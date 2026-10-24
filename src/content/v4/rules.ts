import {stripSpeechTags} from '../../captions/speech-tags';
import {ContentHold, RUBRIC_WEIGHTS, VOICED_BEATS, type TopicBrief, type V4Package,
  type EvaluatedHook, type SelectedPackage} from './contracts';

export const plainSpeech = (text: string) => stripSpeechTags(text.replaceAll('|', ' ')).trim();
export const countSpokenWords = (text: string) => plainSpeech(text).split(/\s+/u).filter(Boolean).length;
export const comparable = (text: string) => plainSpeech(text).toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/gu, ' ');

export function evaluateHookRules(text: string, brief: Pick<TopicBrief, 'subjectAliases'>): string[] {
  const plain = plainSpeech(text);
  const normalized = comparable(plain);
  const violations: string[] = [];
  if (!normalized) violations.push('Empty hook');
  const isQuestion = plain.includes('?');
  if (isQuestion && countSpokenWords(text) > 9) violations.push('Question hook over 9 words');
  if (/^(why|how|what|who|when|where)\b/u.test(normalized) && !isQuestion) violations.push('Question opener without question');
  if (/\b(did you know|have you ever wondered|ever wonder|ever notice|today we will|in this video|welcome to)\b/u.test(normalized))
    violations.push('Generic setup phrase');
  if (countSpokenWords(text) > 12) violations.push('Hook exceeds 12 words');
  const clause = comparable(plain.replace(/^[\s“”"'‘’]+/u, '').split(/[.!?;:,—]/u)[0] ?? '');
  if (!brief.subjectAliases.some(a => (` ${clause} `).includes(` ${comparable(a)} `)))
    violations.push('Concrete subject missing from opening clause');
  return violations;
}

export function nearDuplicate(a: string, b: string): boolean {
  const left = new Set(comparable(a).split(' '));
  const right = new Set(comparable(b).split(' '));
  const union = new Set([...left, ...right]);
  return [...left].filter(t => right.has(t)).length / union.size >= 0.8;
}

export function preflightScore(rubric: V4Package['rubric']): number {
  return Object.entries(RUBRIC_WEIGHTS).reduce((total, [key, weight]) =>
    total + rubric[key as keyof typeof rubric] / 5 * weight, 0);
}

export function selectV4Hook(candidates: EvaluatedHook[]): EvaluatedHook {
  const surviving = candidates.filter(c => c.violations.length === 0).sort((a, b) =>
    b.score - a.score || b.clarity - a.clarity || a.id.localeCompare(b.id));
  if (!surviving[0]) throw new ContentHold(['No hook survived the V4 rules'], 'revise', {candidates});
  return surviving[0];
}

export function evaluatePackage(pack: V4Package, brief: TopicBrief): SelectedPackage {
  if (new Set(pack.hooks.map(h => h.id)).size !== 5) throw new ContentHold(['Hook IDs must be unique']);
  if (new Set(pack.shots.map(s => s.beatId)).size !== 5 ||
    VOICED_BEATS.some(id => !pack.shots.some(s => s.beatId === id))) throw new ContentHold(['Every voiced beat needs a shot']);
  const facts = new Set(brief.facts.map(f => f.id));
  if (!facts.has(pack.secondRevealFactId) || pack.shots.some(s => s.factIds.some(id => !facts.has(id))))
    throw new ContentHold(['Package references unknown facts']);
  if (pack.shots.some(s => new Set(s.searchQueries.map(comparable)).size !== 3))
    throw new ContentHold(['Shot queries must be distinct']);
  const evaluatedHooks = pack.hooks.map((h, i): EvaluatedHook => {
    const violations = evaluateHookRules(h.text, brief);
    const wordCount = countSpokenWords(h.text);
    if ((wordCount < 5 || wordCount > 10) && !h.wordCountException?.trim()) violations.push('Word-count exception requires a reason');
    if (!h.contradictionClear) violations.push('Editorial review: contradiction unclear');
    if (h.mechanismLeaked) violations.push('Editorial review: mechanism disclosed too early');
    if (pack.hooks.slice(0, i).some(other => nearDuplicate(h.text, other.text))) violations.push('Duplicate or near-duplicate hook');
    if (countSpokenWords(h.displayText) > 5) violations.push('Opening display copy exceeds five words');
    return {...h, wordCount, violations};
  });
  // Keep all evaluated candidates available even if selection will hold.
  const selected = selectV4Hook(evaluatedHooks);
  return {...pack, evaluatedHooks, selectedHookId: selected.id, preflightScore: preflightScore(pack.rubric),
    title: brief.titleSeed ?? pack.title,
    description: brief.descriptionSeed ?? `${pack.description.replace(/#\S+/gu, '').trim()} #Shorts #EverydayScience`};
}
