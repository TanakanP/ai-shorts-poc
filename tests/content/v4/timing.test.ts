import {expect, it} from 'vitest';
import {evaluateV4Timing} from '../../../src/content/v4/timing';
import {voiced} from './fixtures';

it.each([[29, 'ready'], [30, 'revise'], [30 + 1 / 30, 'hold']] as const)('gates total %ss', (total, decision) => {
  const v = voiced([3, 4, 7, 7, 4, total - 25]);
  const t = evaluateV4Timing(v.timedPlan, v.manifest);
  expect(t.actualDurationSec).toBeCloseTo(total);
  expect(t.gate.decision).toBe(decision);
});
it('uses frame rounding and word offsets for actual reveal starts', () => {
  const v = voiced([3.016, 4.016, 7, 7, 4, 3]);
  v.manifest.scenes[2].words[0] = {text: 'Light', startMs: 200, endMs: 400};
  const t = evaluateV4Timing(v.timedPlan, v.manifest);
  expect(t.actualBeatStarts.mechanism).toBeCloseTo(7.2);
  expect(t.actualDurationSec).toBe(28);
});
it('requests one rewrite for an early mechanism or reset', () => {
  const v = voiced([3, 3, 5, 7, 4, 3]);
  expect(evaluateV4Timing(v.timedPlan, v.manifest).needsRewrite).toBe(true);
});
it('does not automatically pad a short, otherwise valid story', () => {
  const v = voiced([3, 4, 7, 4, 3, 3]);
  const t = evaluateV4Timing(v.timedPlan, v.manifest);
  expect(t.gate.decision).toBe('revise');
  expect(t.needsRewrite).toBe(false);
});
it('refuses missing or impossible caption timing', () => {
  const v = voiced(); v.manifest.scenes[0].words[0].endMs = 90000;
  expect(() => evaluateV4Timing(v.timedPlan, v.manifest)).toThrow(/alignment/);
});
