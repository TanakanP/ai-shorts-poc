import {expect, it} from 'vitest';
import {evaluateV5Timing, requiredSourceFrames} from '../../../src/content/v5/timing';
import {voiced} from './fixtures';

it('budgets incoming transition frames inside six seconds', () => {
  expect(requiredSourceFrames(6, 0)).toBe(180);
  expect(requiredSourceFrames(5.8, 1)).toBe(180);
  expect(requiredSourceFrames(5.8 + 1 / 30, 1)).toBe(181);
});

it('counts later-scene transitions against six-second source capacity', () => {
  const v = voiced([3, 5.8 + 1 / 30, 5.8, 5.5, 4.5, 4]);
  const t = evaluateV5Timing(v.timedPlan, v.manifest);
  expect(t.requiredFramesByScene.clue).toBe(181);
  expect(t.capacityReasons.some(reason => /clue/.test(reason))).toBe(true);
  expect(t.gate.decision).toBe('hold');
  expect(t.needsRewrite).toBe(true);
});

it('accepts a feasible six-second-source timeline', () => {
  const v = voiced();
  const t = evaluateV5Timing(v.timedPlan, v.manifest);
  expect(t.gate.decision).toBe('ready');
  expect(t.capacityReasons).toEqual([]);
  expect(t.requiredFramesByScene.contradiction).toBe(90);
  expect(t.requiredFramesByScene.mechanism).toBe(180);
  expect(t.actualDurationSec).toBe(28);
});

it('holds an oversized story scene as a rewrite and an oversized outro as a sign-off problem', () => {
  const longStory = voiced([3, 5.2, 7, 5.5, 4.5, 4]);
  const story = evaluateV5Timing(longStory.timedPlan, longStory.manifest);
  expect(story.needsRewrite).toBe(true);
  expect(story.gate.decision).toBe('hold');
  expect(story.capacityReasons.join(' ')).toMatch(/mechanism/);

  const longOutro = voiced([3, 5.2, 5.8, 4, 3, 6]);
  const outro = evaluateV5Timing(longOutro.timedPlan, longOutro.manifest);
  expect(outro.actualDurationSec).toBeLessThanOrEqual(29);
  expect(outro.gate.decision).toBe('hold');
  expect(outro.needsRewrite).toBe(false);
  expect(outro.capacityReasons.join(' ')).toMatch(/sign-off/);
});

it('refuses missing or impossible caption timing', () => {
  const v = voiced(); v.manifest.scenes[0].words[0].endMs = 90000;
  expect(() => evaluateV5Timing(v.timedPlan, v.manifest)).toThrow(/alignment/);
});
