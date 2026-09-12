import {mkdtemp, writeFile, rm, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {briefSchema, packageSchema} from '../../../src/content/v4/contracts';
import {loadV4Brief} from '../../../src/content/v4/brief';
import {validateV4Story} from '../../../src/content/v4/plan';
import {brief, pack, contentPlan, proofs, rawPackage} from './fixtures';

it('rejects empty sources and duplicate fact IDs', () => {
  const copy = structuredClone(brief); copy.facts[0].sourceUrls = [];
  expect(() => briefSchema.parse(copy)).toThrow();
  copy.facts = [brief.facts[0], brief.facts[0]];
  expect(() => briefSchema.parse(copy)).toThrow(/unique/);
});
it('requires first-frame proof and exactly five hooks', () => {
  expect(() => packageSchema.parse({...rawPackage(), firstFrameProof: ''})).toThrow();
  expect(() => packageSchema.parse({...rawPackage(), hooks: []})).toThrow();
});
it('validates every supplied rollout brief and preserves its stable ID', async () => {
  const files = (await readdir('content/v4')).filter(f => f.endsWith('.json'));
  expect(files).toHaveLength(14);
  for (const file of files) {
    const {readFile} = await import('node:fs/promises');
    const raw = JSON.parse(await readFile(join('content/v4', file), 'utf8'));
    expect((await loadV4Brief(raw.topic, '', join('content/v4', file))).topicId).toBe(raw.topicId);
  }
});
it('rejects mismatched file topic and resolves local media relative to the brief', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v4-brief-'));
  try {
    const path = join(dir, 'brief.json');
    await writeFile(path, JSON.stringify({...brief, localProof: [{beatId: 'contradiction', path: 'proof.mp4', licenseNote: 'Owned'}]}));
    await expect(loadV4Brief('Other topic', '', path)).rejects.toThrow(/match/);
    const loaded = await loadV4Brief(brief.topic, '', path);
    expect(loaded.localProof[0].path).toBe(join(dir, 'proof.mp4'));
  } finally {await rm(dir, {recursive: true});}
});
it('does not treat an invented source as a reviewed brief', async () => {
  const confirmFacts = vi.fn(async () => true);
  await expect(loadV4Brief('Straw', 'See https://example.org/original', undefined,
    {interpret: async () => brief, confirmFacts})).rejects.toThrow(/not supplied/);
  expect(confirmFacts).not.toHaveBeenCalled();
});
it('requires explicit factual review for interpreted free text', async () => {
  await expect(loadV4Brief(brief.topic, brief.facts[0].sourceUrls[0], undefined,
    {interpret: async () => brief, confirmFacts: async () => false})).rejects.toThrow(/not confirmed/);
});
it('accepts distinct supported second reveal', () => {
  expect(() => validateV4Story(contentPlan(), brief, pack(), proofs(), 'Tell Me Why. Look closer.')).not.toThrow();
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
    expect(() => validateV4Story(p, brief, pack(), proofs(), '')).toThrow();
  });
