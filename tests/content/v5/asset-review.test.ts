import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {ContentHold} from '../../../src/content/v5/contracts';
import {reviewGeneratedAssets} from '../../../src/content/v5/asset-review';
import {hashFile} from '../../../src/content/v5/assets';
import {contentPlan, okMedia, promptPack, voiced, writeBindings} from './fixtures';

const files = {
  contradiction: 'opening.mp4', clue: 'clue.mp4', mechanism: 'Ptko4.mp4',
  second_reveal: 'reveal.mp4', payoff: 'payoff.mp4',
} as const;

function scriptedAsk(lines: string[]) {
  const remaining = [...lines];
  const questions: string[] = [];
  return {
    questions,
    ask: async (question: string) => {
      questions.push(question);
      if (!remaining.length) throw new Error(`unexpected question: ${question}`);
      return remaining.shift()!;
    },
  };
}

function approve(file: string, observed = `Action ${file}`) {
  return [file, '', '', 'y', observed];
}

async function prepare(dir: string, extras: string[] = []) {
  for (const name of [...Object.values(files), ...extras]) {
    await writeFile(join(dir, name), `bytes-${name}`);
  }
}

it('assigns shuffled filenames by scene ID, including Ptko4.mp4 for mechanism', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-review-'));
  try {
    await prepare(dir);
    const prompts = {...promptPack(), workflow: 'gemini-flow' as const};
    const recorded: unknown[] = [];
    const {ask, questions} = scriptedAsk([
      ...approve(files.contradiction), ...approve(files.clue), ...approve(files.mechanism),
      ...approve(files.second_reveal), ...approve(files.payoff), '',
    ]);
    const preview = vi.fn(async (_p, _s, _c, outputBase) => ({stillPath: `${outputBase}.jpg`, previewPath: `${outputBase}.mp4`}));
    const result = await reviewGeneratedAssets(
      {runDir: dir, prompts, timedPlan: voiced().timedPlan, previous: []},
      {ask, log: () => {}, probe: async () => okMedia, preview, record: async value => {recorded.push(structuredClone(value));}},
    );
    expect(result.status).toBe('ready');
    expect(result.bindings.every(binding => binding.provider === 'google-flow')).toBe(true);
    expect(result.bindings.map(b => `${b.sceneId}:${b.fileName}`)).toEqual([
      'contradiction:opening.mp4', 'clue:clue.mp4', 'mechanism:Ptko4.mp4', 'second_reveal:reveal.mp4', 'payoff:payoff.mp4',
    ]);
    expect(questions.some(q => /mechanism/.test(q))).toBe(true);
    expect(preview.mock.calls.some(call => String(call[3]).includes('channel-outro'))).toBe(true);
    expect(recorded.at(-1)).toHaveLength(5);
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('FAST_MODE keeps trim but skips crop and review for every scene, including after resume', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-fast-review-'));
  try {
    await prepare(dir);
    const prompts = {...promptPack(), workflow: 'gemini-flow' as const};
    const {ask, questions} = scriptedAsk([
      files.contradiction, '0.5', files.clue, '0.25', files.mechanism, '0.5',
      files.second_reveal, '0', files.payoff, '1',
    ]);
    const preview = vi.fn(async (_p, _s, _c, outputBase) => ({stillPath: `${outputBase}.jpg`, previewPath: `${outputBase}.mp4`}));
    const input = {runDir: dir, prompts, timedPlan: voiced().timedPlan, previous: [], fastMode: true};
    const result = await reviewGeneratedAssets(input, {
      ask, log: () => {}, probe: async () => ({...okMedia, durationSec: 7}), preview, record: async () => {},
    });
    expect(result.status).toBe('ready');
    expect(result.bindings[0]).toMatchObject({
      sceneId: 'contradiction', trimStartSec: 0.5, cropPosition: '50% 50%',
      observedAction: '', reviewMode: 'fast', approved: true,
    });
    expect(result.bindings.find(b => b.sceneId === 'mechanism')?.trimStartSec).toBe(0.5);
    expect(result.bindings.every(b => b.cropPosition === '50% 50%' && b.observedAction === '' && b.reviewMode === 'fast')).toBe(true);
    expect(questions.filter(q => /Clip start in seconds/.test(q))).toHaveLength(5);
    expect(questions).toHaveLength(10);
    expect(questions.some(q => /Crop position|Does this exact crop|observed action/.test(q))).toBe(false);
    expect(preview).not.toHaveBeenCalled();
    const resumeAsk = scriptedAsk([
      files.mechanism, '0.5', files.second_reveal, '0', files.payoff, '1',
    ]);
    const resumed = await reviewGeneratedAssets({...input, previous: result.bindings.slice(0, 2)}, {
      ask: resumeAsk.ask, log: () => {}, probe: async () => ({...okMedia, durationSec: 7}), preview, record: async () => {},
    });
    expect(resumed.status).toBe('ready');
    expect(resumed.bindings).toHaveLength(5);
    expect(resumed.bindings[0]).toMatchObject({trimStartSec: 0.5, observedAction: '', reviewMode: 'fast'});
    expect(resumeAsk.questions.filter(q => /Clip start in seconds/.test(q))).toHaveLength(3);
    expect(resumeAsk.questions).toHaveLength(6);
    expect(resumeAsk.questions.some(q => /Crop position|Does this exact crop|observed action/.test(q))).toBe(false);
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('holds an invalid prompt pack instead of throwing a schema dump', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-review-pack-'));
  try {
    await expect(reviewGeneratedAssets(
      {runDir: dir, prompts: {...promptPack(), scenes: []} as never, timedPlan: voiced().timedPlan, previous: []},
      {ask: async () => '', log: () => {}, probe: async () => okMedia, record: async () => {}},
    )).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ContentHold);
      expect((error as ContentHold).decision).toBe('hold');
      return true;
    });
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('retries an invalid filename on the same scene and keeps earlier approvals on quit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-partial-'));
  try {
    await prepare(dir);
    const logs: string[] = [];
    const {ask} = scriptedAsk([
      ...approve(files.contradiction), 'not-here.mp4', files.clue, '', '', 'y', 'Clue action', 'q',
    ]);
    const result = await reviewGeneratedAssets(
      {runDir: dir, prompts: promptPack(), timedPlan: voiced().timedPlan, previous: []},
      {ask, log: value => logs.push(value), probe: async () => okMedia,
        preview: async (_p, _s, _c, outputBase) => ({stillPath: `${outputBase}.jpg`, previewPath: `${outputBase}.mp4`}),
        record: async () => {}},
    );
    expect(result.status).toBe('awaiting-assets');
    expect(result.bindings.map(b => b.sceneId)).toEqual(['contradiction', 'clue']);
    expect(logs.join('\n')).toMatch(/not found/);
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('resumes partial imports and clears only scenes whose prompt or media hash changed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-resume-assets-'));
  try {
    await prepare(dir, ['fresh.mp4']);
    const prompts = promptPack();
    const previous = await writeBindings(dir, prompts, files);
    const changedPrompt = previous.map(b => b.sceneId === 'clue' ? {...b, promptHash: 'stale-prompt'} : b);
    await writeFile(join(dir, files.payoff), 'changed-payoff-bytes');
    const {ask} = scriptedAsk([
      ...approve(files.clue, 'Clue again'), ...approve('fresh.mp4', 'Payoff again'), '',
    ]);
    const result = await reviewGeneratedAssets(
      {runDir: dir, prompts, timedPlan: voiced().timedPlan, previous: changedPrompt},
      {ask, log: () => {}, probe: async () => okMedia,
        preview: async (_p, _s, _c, outputBase) => ({stillPath: `${outputBase}.jpg`, previewPath: `${outputBase}.mp4`}),
        record: async () => {}},
    );
    expect(result.status).toBe('ready');
    expect(result.bindings.find(b => b.sceneId === 'contradiction')?.fileName).toBe('opening.mp4');
    expect(result.bindings.find(b => b.sceneId === 'clue')?.promptHash).toBe(prompts.scenes[1].promptHash);
    expect(result.bindings.find(b => b.sceneId === 'payoff')?.fileName).toBe('fresh.mp4');
    expect(result.bindings.find(b => b.sceneId === 'payoff')?.sha256).toBe(await hashFile(join(dir, 'fresh.mp4')));
    expect(result.bindings.find(b => b.sceneId === 'mechanism')?.fileName).toBe('Ptko4.mp4');
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('keeps the previous valid clip when a replacement is declined', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-replace-'));
  try {
    await prepare(dir, ['replacement.mp4']);
    const prompts = promptPack();
    const previous = await writeBindings(dir, prompts, files);
    const original = previous.find(b => b.sceneId === 'mechanism')!;
    const {ask} = scriptedAsk(['mechanism', 'replacement.mp4', '', '', 'n', 'q']);
    const result = await reviewGeneratedAssets(
      {runDir: dir, prompts, timedPlan: voiced().timedPlan, previous},
      {ask, log: () => {}, probe: async () => okMedia,
        preview: async (_p, _s, _c, outputBase) => ({stillPath: `${outputBase}.jpg`, previewPath: `${outputBase}.mp4`}),
        record: async () => {}},
    );
    expect(result.status).toBe('awaiting-assets');
    expect(result.bindings.find(b => b.sceneId === 'mechanism')).toMatchObject({
      fileName: 'Ptko4.mp4', sha256: original.sha256,
    });
  } finally {await rm(dir, {recursive: true, force: true});}
});
