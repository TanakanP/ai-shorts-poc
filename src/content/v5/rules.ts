import {ContentHold, VOICED_BEATS, type V5Brief, type V5Package, type V5SelectedPackage} from './contracts';
import {comparable, countSpokenWords, evaluateHookRules, nearDuplicate, preflightScore, selectV4Hook} from '../v4/rules';

export function evaluateV5Package(pack: V5Package, brief: V5Brief): V5SelectedPackage {
  if (new Set(pack.hooks.map(h => h.id)).size !== 5) throw new ContentHold(['Hook IDs must be unique']);
  if (new Set(pack.shots.map(s => s.beatId)).size !== 5 ||
    VOICED_BEATS.some(id => !pack.shots.some(s => s.beatId === id))) throw new ContentHold(['Every voiced beat needs a shot']);
  const facts = new Set(brief.facts.map(f => f.id));
  if (!facts.has(pack.secondRevealFactId) || pack.shots.some(s => s.factIds.some(id => !facts.has(id))))
    throw new ContentHold(['Package references unknown facts']);
  const evaluatedHooks = pack.hooks.map((h, i) => {
    const violations = evaluateHookRules(h.text, brief);
    const wordCount = countSpokenWords(h.text);
    if ((wordCount < 5 || wordCount > 10) && !h.wordCountException?.trim()) violations.push('Word-count exception requires a reason');
    if (!h.contradictionClear) violations.push('Editorial review: contradiction unclear');
    if (h.mechanismLeaked) violations.push('Editorial review: mechanism disclosed too early');
    if (pack.hooks.slice(0, i).some(other => nearDuplicate(h.text, other.text))) violations.push('Duplicate or near-duplicate hook');
    if (countSpokenWords(h.displayText) > 5) violations.push('Opening display copy exceeds five words');
    return {...h, wordCount, violations};
  });
  const selected = selectV4Hook(evaluatedHooks);
  const seedLeaks = brief.titleSeed ? titleLeaksAnswer(brief.titleSeed, brief) : [];
  const title = brief.titleSeed && !seedLeaks.length ? brief.titleSeed : pack.title;
  const leaks = titleLeaksAnswer(title, brief);
  if (leaks.length) throw new ContentHold([`Title gives away the reveal: ${leaks.join(', ')}`], 'revise');
  return {...pack, evaluatedHooks, selectedHookId: selected.id, preflightScore: preflightScore(pack.rubric),
    title,
    description: brief.descriptionSeed ?? `${pack.description.replace(/#\S+/gu, '').trim()} #Shorts #EverydayScience`};
}

export function titleLeaksAnswer(title: string, brief: Pick<V5Brief, 'facts'>): string[] {
  const normalized = comparable(title);
  const mechanism = brief.facts.find(f => f.id === 'mechanism')?.statement ?? '';
  const mechWords = new Set(comparable(mechanism).split(' ').filter(w => w.length > 4));
  const leaked = [...new Set(normalized.split(' ').filter(w => mechWords.has(w)))];
  const reasons: string[] = [];
  if (leaked.length >= 2) reasons.push(`uses mechanism words (${leaked.join(' ')})`);
  if (/\b(that s why|thats why|because|so that)\b/u.test(normalized)) reasons.push('states the cause');
  return reasons;
}
