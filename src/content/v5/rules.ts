import {ContentHold, VOICED_BEATS, type V5Brief, type V5Package, type V5SelectedPackage} from './contracts';
import {countSpokenWords, evaluateHookRules, nearDuplicate, preflightScore, selectV4Hook} from '../v4/rules';

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
  return {...pack, evaluatedHooks, selectedHookId: selected.id, preflightScore: preflightScore(pack.rubric),
    title: brief.titleSeed ?? pack.title,
    description: brief.descriptionSeed ?? `${pack.description.replace(/#\S+/gu, '').trim()} #Shorts #EverydayScience`};
}
