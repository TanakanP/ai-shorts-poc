import type {HookConcept, HookScores} from '../domain/video-plan';

export function totalHookScore(scores: HookScores): number {
  return (
    scores.stopScroll +
    scores.clarity +
    scores.contradiction +
    scores.personalRelevance +
    scores.visualizability
  );
}

function compareHooks(a: HookConcept, b: HookConcept): number {
  return (
    totalHookScore(b.scores) - totalHookScore(a.scores) ||
    b.scores.clarity - a.scores.clarity ||
    b.scores.visualizability - a.scores.visualizability ||
    b.scores.stopScroll - a.scores.stopScroll ||
    a.id.localeCompare(b.id)
  );
}

export function selectHook(candidates: HookConcept[]): HookConcept {
  if (candidates.length !== 3) {
    throw new Error(`Expected exactly 3 hook candidates; received ${candidates.length}`);
  }

  return [...candidates].sort(compareHooks)[0];
}
