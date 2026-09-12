import {expect, it} from 'vitest';
import {bindV4Scenes, videoPlanFromV4} from '../../../src/content/v4/adapter';
import {contentPlan, proofs, voiced} from './fixtures';

it('maps six functions to five voiced scenes with a visible hook card', () => {
  const plan = videoPlanFromV4(contentPlan());
  expect(plan.scenes.map(s => s.role)).toEqual(['hook', 'context', 'mechanism', 'curiosity-reset', 'payoff']);
  expect(plan.scenes[0]).toMatchObject({durationSeconds: 3, displayText: 'Straight. Looks broken.'});
  expect(plan.scenes.every(s => Boolean(s.spokenText))).toBe(true);
});
it('preserves the approved crop/trim, payoff, karaoke and explicit outro bookend', () => {
  const voice = voiced();
  const scenes = bindV4Scenes(voice.timedPlan, voice.manifest, proofs());
  expect(scenes[0]).toMatchObject({videoTrimStartSec: 2, videoCropPosition: '25% 50%', proofAssetId: 'proof-contradiction'});
  expect(scenes[4].localVideoPath).toBe('/tmp/payoff.mp4');
  expect(scenes[5].localVideoPath).toBe(scenes[0].localVideoPath);
  expect(scenes[5].text).toContain('Tell Me Why');
  expect(scenes.every(s => s.words.length)).toBe(true);
});
it('rejects footage too short for the rewritten scene plus transition', () => {
  const voice = voiced(); const proof = proofs(); proof[2].usableDurationSec = 7;
  expect(() => bindV4Scenes(voice.timedPlan, voice.manifest, proof)).toThrow(/too short/);
});
it('restores yellow opening emphasis for old plans and preserves explicit keywords', () => {
  const draft = contentPlan();
  expect(videoPlanFromV4(draft).scenes[0].emphasisWords).toEqual(['broken']);
  draft.beats[1].emphasisWords = ['Straight', 'invented'];
  expect(videoPlanFromV4(draft).scenes[0].emphasisWords).toEqual(['Straight']);
  expect(bindV4Scenes(voiced().timedPlan, voiced().manifest, proofs())[0].emphasisWords).toEqual(['broken']);
});
