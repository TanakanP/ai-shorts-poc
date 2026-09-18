import {expect, it, vi} from 'vitest';
import {V5StoryRevisionNeeded} from '../../../src/content/v5/contracts';
import {planV5Story, validateV5Story} from '../../../src/content/v5/plan';
import {CHANNEL, brief, contentPlan, pack} from './fixtures';

const outro = `${CHANNEL.brand}. ${CHANNEL.signoff}`;
function rawStory() {
  const plan = contentPlan();
  return {beats: plan.beats.map(b => ({...b, emphasisWords: b.id === 'contradiction' ? ['broken'] : []})),
    editorial: plan.editorial};
}

it('accepts the V5 target skeleton and a distinct supported second reveal', () => {
  expect(() => validateV5Story(contentPlan(), brief, pack(), outro)).not.toThrow();
});

it.each(['missing-reset', 'unknown-fact', 'changed-hook', 'unsupported', 'early-leak', 'repeated-reveal'])(
  'rejects story defect %s', defect => {
    const p = contentPlan();
    if (defect === 'missing-reset') p.beats.splice(4, 1);
    if (defect === 'unknown-fact') p.beats[2].factIds = ['invented'];
    if (defect === 'changed-hook') p.beats[1].spokenText = 'Something else';
    if (defect === 'unsupported') p.editorial.factsSupported = false;
    if (defect === 'early-leak') p.editorial.earlyMechanismLeak = true;
    if (defect === 'repeated-reveal') p.beats[4].newInformation = p.beats[3].newInformation;
    expect(() => validateV5Story(p, brief, pack(), outro)).toThrow();
  });

it('raises V5StoryRevisionNeeded with a v5 draft when editorial review fails', async () => {
  const story = rawStory();
  story.beats[1].spokenText = 'Something else entirely.';
  const generate = vi.fn(async () => story);
  await expect(planV5Story(brief, pack(), generate, outro)).rejects.toSatisfy((error: unknown) => {
    expect(error).toBeInstanceOf(V5StoryRevisionNeeded);
    expect((error as V5StoryRevisionNeeded).draft.version).toBe('v5');
    expect((error as V5StoryRevisionNeeded).draft.topicId).toBe(brief.topicId);
    return /hook/i.test((error as Error).message);
  });
});

it('returns a versioned plan that preserves selected hook and metadata', async () => {
  const plan = await planV5Story(brief, pack(), async () => rawStory(), outro);
  expect(plan).toMatchObject({version: 'v5', topicId: brief.topicId, title: brief.titleSeed});
  expect(plan.beats[1].spokenText).toBe(pack().hooks[0].text);
  expect(plan.beats[0].sceneId).toBe('contradiction');
  expect(plan.beats.map(b => b.id)).toEqual(['paradox', 'contradiction', 'clue', 'mechanism', 'second_reveal', 'payoff']);
});
