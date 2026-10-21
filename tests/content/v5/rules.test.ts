import {describe, expect, it, vi} from 'vitest';
import {evaluateHookRules, nearDuplicate, preflightScore, selectV4Hook} from '../../../src/content/v4/rules';
import {evaluateV5Package, titleLeaksAnswer} from '../../../src/content/v5/rules';
import {planV5Package} from '../../../src/content/v5/plan';
import {brief, pack, rawPackage} from './fixtures';

describe('V5 hook gates', () => {
  it.each(['Why does this straight straw look so broken in the water?', 'Why this straw looks broken in water.', '“<slow>Did you know</slow> a straw bends?',
    'This straw has a secret; in this video we reveal it.', 'A mysterious object seems broken underwater.'])('rejects %s', text => {
    expect(evaluateHookRules(text, brief).length).toBeGreaterThan(0);
  });
  it('accepts one short guess-question about the visible object', () => {
    expect(evaluateHookRules('This straw looks broken. Guess why?', brief)).toEqual([]);
  });
  it('accepts a declarative concrete subject after markup', () => {
    expect(evaluateHookRules('<slow>This straight straw</slow> | looks broken in water.', brief)).toEqual([]);
  });
  it('recognizes near duplicates, not unrelated subjects', () => {
    expect(nearDuplicate('The straight straw looks broken in water', 'Straight straw looks broken in water!')).toBe(true);
    expect(nearDuplicate('water rises through paper', 'ice floats on water')).toBe(false);
  });
  it('drops an answer-first title seed but keeps the description seed and invents no stock queries', () => {
    const selected = pack();
    expect(titleLeaksAnswer(brief.titleSeed!, brief).length).toBeGreaterThan(0);
    expect(selected).toMatchObject({title: rawPackage().title, description: brief.descriptionSeed});
    expect(selected.shots.every(shot => !('searchQueries' in shot))).toBe(true);
  });
  it('keeps a title seed that hides the answer', () => {
    expect(evaluateV5Package(rawPackage(), {...brief, titleSeed: 'This Straw Looks Broken. It Isn\'t.'}).title)
      .toBe('This Straw Looks Broken. It Isn\'t.');
  });
  it('rejects titles that state the cause', () => {
    expect(titleLeaksAnswer('The straw looks bent because of water', brief)).toContain('states the cause');
    expect(titleLeaksAnswer('Why does this straw look broken?', brief)).toEqual([]);
  });
  it('refuses duplicate IDs and unknown facts', () => {
    const p = rawPackage(); p.hooks[1].id = p.hooks[0].id;
    expect(() => evaluateV5Package(p, brief)).toThrow(/IDs/);
    p.hooks[1].id = 'other'; p.secondRevealFactId = 'invented';
    expect(() => evaluateV5Package(p, brief)).toThrow(/unknown facts/);
  });
  it('never lets model scores override hard rejection', () => {
    const p = rawPackage(); p.hooks[0].text = 'Why does this straight straw look so broken in the water?';
    const evaluated = evaluateV5Package(p, brief);
    expect(evaluated.selectedHookId).not.toBe('hook-0');
    expect(evaluated.evaluatedHooks[0].violations.length).toBeGreaterThan(0);
  });
  it('breaks score ties by clarity then ID', () => {
    const a = pack().evaluatedHooks[0];
    expect(selectV4Hook([{...a, id: 'b'}, {...a, id: 'a'}]).id).toBe('a');
  });
  it.each([74, 75, 84, 85])('computes %s-point rubric locally', score => {
    const p = rawPackage();
    for (const key of Object.keys(p.rubric) as Array<keyof typeof p.rubric>) p.rubric[key] = score / 20;
    expect(preflightScore(p.rubric)).toBeCloseTo(score);
  });
  it.each([74, 75, 84, 85])('gates a %s-point package', async score => {
    const p = rawPackage();
    for (const key of Object.keys(p.rubric) as Array<keyof typeof p.rubric>) p.rubric[key] = score / 20;
    const generate = vi.fn(async () => p);
    if (score >= 85) await expect(planV5Package(brief, generate)).resolves.toMatchObject({preflightScore: 85});
    else await expect(planV5Package(brief, generate)).rejects.toThrow(/preflight/);
    expect(generate).toHaveBeenCalledTimes(score >= 75 && score < 85 ? 2 : 1);
  });
  it('records local violations and stops after one revision when none survives', async () => {
    const p = rawPackage(); p.hooks.forEach(h => {h.text = 'Why does this straight straw look so broken in the water?';});
    const record = vi.fn(async (_value: unknown) => {});
    const generate = vi.fn(async () => p);
    await expect(planV5Package(brief, generate, record)).rejects.toThrow(/No hook/);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(record.mock.calls)).toContain('Question hook over 9 words');
  });
});
