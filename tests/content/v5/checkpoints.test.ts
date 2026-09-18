import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {keyFor, parseV5Resume, v5BriefIdentity, withV5Checkpoints, writeCheckpoint} from '../../../src/content/v5/checkpoints';
import {createShortV5, type V5Deps} from '../../../src/pipeline/create-short-v5';
import {persistJson} from '../../../src/pipeline/persist-json';
import {brief, contentPlan, pack, promptPack, voiced, writeBindings, writeVoice} from './fixtures';

const settings = {
  scriptProvider: 'openai' as const, scriptModel: 'gpt-5.6', voiceProvider: 'xai' as const, voiceId: 'eve',
  elevenLabsModel: 'eleven_multilingual_v2', channelBrand: 'Tell Me Why', channelSignoff: 'Look closer every day.',
  musicContentHash: 'abc', promptContractVersion: 1 as const,
};

it('rejects malformed and cross-version resume checkpoints', () => {
  expect(() => parseV5Resume({topic: brief.topic, research: '', settings})).toThrow(/not a V5 checkpoint/);
  expect(() => parseV5Resume({schemaVersion: 1, engineVersion: 'v4', topic: brief.topic, research: '', settings}))
    .toThrow(/not a V5 checkpoint/);
  expect(() => parseV5Resume({schemaVersion: 1, engineVersion: 'v5', topic: brief.topic, research: ''}))
    .toThrow(/Malformed V5 resume/);
});

it('ignores a V4-shaped stage checkpoint missing the V5 envelope', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-v4-ckpt-'));
  try {
    const selected = pack();
    await writeCheckpoint(join(dir, `checkpoint-package-${keyFor(brief)}.json`), {value: selected});
    const perform = vi.fn(async () => selected);
    const wrapped = withV5Checkpoints({package: perform} as unknown as V5Deps, {runId: 'test', runDir: dir});
    expect(await wrapped.package(brief, async () => {})).toEqual(selected);
    expect(perform).toHaveBeenCalledTimes(1);
    expect(await wrapped.package(brief, async () => {})).toMatchObject({selectedHookId: selected.selectedHookId});
    expect(perform).toHaveBeenCalledTimes(1);
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('does not cache a declined approval or reuse approval for changed content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-approval-'));
  try {
    const approvePackage = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const wrapped = withV5Checkpoints({approvePackage} as unknown as V5Deps, {runId: 'test', runDir: dir});
    expect(await wrapped.approvePackage(pack())).toBe(false);
    expect(await wrapped.approvePackage(pack())).toBe(true);
    expect(await wrapped.approvePackage(pack())).toBe(true);
    await wrapped.approvePackage({...pack(), title: 'Changed claim'});
    expect(approvePackage).toHaveBeenCalledTimes(3);
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('rejects a changed brief identity saved on the run', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-brief-id-'));
  try {
    await writeCheckpoint(join(dir, 'resume.json'), {
      schemaVersion: 1, engineVersion: 'v5', topic: brief.topic, research: '',
      briefIdentity: 'stale', settings, visualStyle: brief.visualStyle, topicId: brief.topicId,
    });
    const wrapped = withV5Checkpoints({
      loadBrief: async () => brief,
    } as unknown as V5Deps, {runId: 'test', runDir: dir});
    await expect(wrapped.loadBrief(brief.topic)).rejects.toThrow(/fresh run/);
    expect(v5BriefIdentity(brief)).not.toBe('stale');
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('resumes after a render failure without repeating approvals, prompts or completed narration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-resume-'));
  try {
    await writeFile(join(dir, 'music.mp3'), 'music');
    const plan = contentPlan();
    const voice = await writeVoice(dir, voiced(undefined, plan));
    const prompts = promptPack(plan, voice.timedPlan);
    const bindings = await writeBindings(dir, prompts);
    const deps: V5Deps = {
      createRunDirectory: vi.fn(), persistJson,
      loadBrief: vi.fn(async () => brief), package: vi.fn(async () => plan.package),
      approvePackage: vi.fn(async () => true), story: vi.fn(async () => plan), approveStory: vi.fn(async () => true),
      synthesize: vi.fn(async () => voice), reviewTiming: vi.fn(async () => null),
      prompts: vi.fn(async () => prompts), approvePrompts: vi.fn(async () => true),
      exportPrompts: vi.fn(async () => {}),
      assets: vi.fn(async (_p, _t, _d, record, previous) => {
        const values = previous?.length ? previous : bindings;
        await record(values);
        return {status: 'ready' as const, bindings: values};
      }),
      validateAssets: vi.fn(async () => {}),
      render: vi.fn().mockRejectedValueOnce(new Error('render failed')).mockImplementation(async (_v, outputPath) => {
        await writeFile(outputPath, 'mp4');
      }),
      probe: async (path: string) => path.endsWith('output.mp4')
        ? {durationSec: 28, width: 1080, height: 1920, fps: 30} : {durationSec: 6, width: 1080, height: 1920, fps: 30},
      channel: {brand: 'Tell Me Why', signoff: 'Look closer every day.'},
      voiceProvider: 'xai', backgroundMusicPath: join(dir, 'music.mp3'), resume: true,
    };
    const run = {runId: 'resume-test', runDir: dir};
    await expect(createShortV5(brief.topic, withV5Checkpoints(deps, run))).rejects.toThrow('render failed');
    await createShortV5(brief.topic, withV5Checkpoints(deps, run));
    for (const operation of [deps.loadBrief, deps.package, deps.approvePackage, deps.story, deps.approveStory,
      deps.synthesize, deps.prompts, deps.approvePrompts])
      expect(operation).toHaveBeenCalledTimes(1);
    expect(deps.render).toHaveBeenCalledTimes(2);
    expect(deps.createRunDirectory).not.toHaveBeenCalled();
  } finally {await rm(dir, {recursive: true, force: true});}
});
