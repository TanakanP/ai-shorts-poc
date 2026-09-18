import {mkdtemp, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {z} from 'zod';
import {ContentHold, V5StoryRevisionNeeded, VOICED_BEATS} from '../../src/content/v5/contracts';
import {withV5Checkpoints} from '../../src/content/v5/checkpoints';
import {planV5Story} from '../../src/content/v5/plan';
import {createShortV5, type V5Deps} from '../../src/pipeline/create-short-v5';
import {persistJson} from '../../src/pipeline/persist-json';
import {CHANNEL, brief, contentPlan, promptPack, voiced, writeBindings, writeVoice} from '../content/v5/fixtures';

async function setup(dir: string, resume = false) {
  await writeFile(join(dir, 'music.mp3'), 'music');
  const plan = contentPlan();
  const voice = await writeVoice(dir, voiced(undefined, plan));
  const prompts = promptPack(plan, voice.timedPlan);
  const bindings = await writeBindings(dir, prompts);
  const order: string[] = [];
  const deps: V5Deps = {
    createRunDirectory: async () => ({runId: 'test', runDir: dir}),
    persistJson,
    loadBrief: async () => brief,
    package: vi.fn(async () => plan.package),
    approvePackage: async () => true,
    story: vi.fn(async () => {order.push('story'); return plan;}),
    approveStory: async () => true,
    synthesize: vi.fn(async () => {order.push('voice'); return voice;}),
    reviewTiming: vi.fn(async () => null),
    prompts: vi.fn(async () => {order.push('prompts'); return prompts;}),
    approvePrompts: async () => true,
    exportPrompts: vi.fn(async () => {order.push('export');}),
    assets: vi.fn(async (_p, _t, _d, record) => {
      order.push('assets');
      await record(bindings);
      return {status: 'ready' as const, bindings};
    }),
    validateAssets: vi.fn(async () => {}),
    render: vi.fn(async (_v, outputPath) => {order.push('render'); await writeFile(outputPath, 'mp4');}),
    probe: async (path: string) => path.endsWith('output.mp4')
      ? {durationSec: 28, width: 1080, height: 1920, fps: 30} : {durationSec: 6, width: 1080, height: 1920, fps: 30},
    channel: {brand: 'Tell Me Why', signoff: 'Look closer every day.'},
    voiceProvider: 'xai', backgroundMusicPath: join(dir, 'music.mp3'), resume,
  };
  return {deps, order, plan, voice, prompts, bindings};
}

async function manifest(dir: string) {
  return JSON.parse(await readFile(join(dir, 'generation-manifest.json'), 'utf8'));
}

it('exports prompts and waits on the first run without importing or rendering', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-wait-'));
  try {
    const {deps, order} = await setup(dir, false);
    const result = await createShortV5(brief.topic, deps);
    expect(result).toMatchObject({status: 'awaiting-assets', missingSceneIds: [...VOICED_BEATS]});
    expect(order).toEqual(['story', 'voice', 'prompts', 'export']);
    expect(deps.assets).not.toHaveBeenCalled();
    expect(deps.render).not.toHaveBeenCalled();
    expect(await manifest(dir)).toMatchObject({status: 'awaiting-assets', engineVersion: 'v5'});
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('resumes approved story, prompts and audio and binds imported clips', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-resume-pipe-'));
  try {
    const {deps} = await setup(dir, false);
    const run = {runId: 'test', runDir: dir};
    const first = await createShortV5(brief.topic, withV5Checkpoints({...deps, resume: false}, run));
    expect(first.status).toBe('awaiting-assets');
    const second = await createShortV5(brief.topic, withV5Checkpoints({...deps, resume: true}, run));
    expect(second.status).toBe('rendered');
    expect(deps.story).toHaveBeenCalledTimes(1);
    expect(deps.prompts).toHaveBeenCalledTimes(1);
    expect(deps.synthesize).toHaveBeenCalledTimes(1);
    expect(deps.assets).toHaveBeenCalledTimes(1);
    expect(deps.render).toHaveBeenCalledTimes(1);
    const resolved = JSON.parse(await readFile(join(dir, 'resolved.json'), 'utf8'));
    expect(resolved.engineVersion).toBe('v5');
    expect(resolved.scenes[5].localVideoPath).toBe(resolved.scenes[0].localVideoPath);
    expect(resolved.scenes[2].localVideoPath).toMatch(/Ptko4\.mp4$/);
    expect(resolved.scenes.every((s: {words: unknown[]; disableVideoZoom?: boolean}) => s.words.length && s.disableVideoZoom)).toBe(true);
    expect(resolved.backgroundMusicPath).toBe(join(dir, 'music.mp3'));
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('keeps the single rewrite cap across resume', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-rewrite-cap-'));
  try {
    const {deps, plan} = await setup(dir, false);
    deps.story = vi.fn()
      .mockRejectedValueOnce(new V5StoryRevisionNeeded(['Early mechanism leak'], plan))
      .mockResolvedValue(plan);
    const run = {runId: 'test', runDir: dir};
    await createShortV5(brief.topic, withV5Checkpoints({...deps, resume: false}, run));
    expect(deps.story).toHaveBeenCalledTimes(2);
    expect(JSON.parse(await readFile(join(dir, 'rewrite-count.json'), 'utf8'))).toEqual({rewriteCount: 1});
    await createShortV5(brief.topic, withV5Checkpoints({...deps, resume: true}, run));
    expect(deps.story).toHaveBeenCalledTimes(2);
    expect(deps.synthesize).toHaveBeenCalledTimes(1);
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('uses the rewrite budget when paradox does not map to contradiction', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-map-rewrite-'));
  try {
    const {deps, plan} = await setup(dir, false);
    const outro = `${CHANNEL.brand}. ${CHANNEL.signoff}`;
    const bad = {
      beats: plan.beats.map(beat => ({
        ...beat, sceneId: beat.id === 'paradox' ? 'clue' : beat.sceneId,
        emphasisWords: beat.id === 'contradiction' ? ['broken'] : [],
      })),
      editorial: plan.editorial,
    };
    deps.story = vi.fn()
      .mockImplementationOnce((briefArg, packArg) => planV5Story(briefArg, packArg, async () => bad, outro))
      .mockResolvedValue(plan);
    await createShortV5(brief.topic, deps);
    expect(deps.story).toHaveBeenCalledTimes(2);
    expect(JSON.parse(await readFile(join(dir, 'rewrite-count.json'), 'utf8'))).toEqual({rewriteCount: 1});
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('does not take a second timing rewrite if rewrite-count is missing after accept', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-rewrite-heal-'));
  try {
    const {deps, plan} = await setup(dir, false);
    deps.story = vi.fn()
      .mockRejectedValueOnce(new V5StoryRevisionNeeded(['Early mechanism leak'], plan))
      .mockResolvedValue(plan);
    deps.synthesize = vi.fn(async () => voiced([3, 4, 7, 7, 4, 3]));
    const run = {runId: 'test', runDir: dir};
    await expect(createShortV5(brief.topic, withV5Checkpoints({...deps, resume: false}, run)))
      .rejects.toThrow(/frames exceed six-second source/);
    expect(deps.story).toHaveBeenCalledTimes(2);
    await rm(join(dir, 'rewrite-count.json'));
    await expect(createShortV5(brief.topic, withV5Checkpoints({...deps, resume: true}, run)))
      .rejects.toThrow(/frames exceed six-second source/);
    expect(deps.story).toHaveBeenCalledTimes(2);
    expect(JSON.parse(await readFile(join(dir, 'rewrite-count.json'), 'utf8'))).toEqual({rewriteCount: 1});
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('never renders when clip capacity still fails after the rewrite', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-capacity-'));
  try {
    const {deps} = await setup(dir, true);
    const long = voiced([3, 4, 7, 7, 4, 3]);
    deps.synthesize = vi.fn(async () => long);
    await expect(createShortV5(brief.topic, deps)).rejects.toThrow(/frames exceed six-second source/);
    expect(deps.story).toHaveBeenCalledTimes(2);
    expect(deps.prompts).not.toHaveBeenCalled();
    expect(deps.assets).not.toHaveBeenCalled();
    expect(deps.render).not.toHaveBeenCalled();
    expect(await manifest(dir)).toMatchObject({status: 'hold'});
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('does not claim rendered success when rendering fails', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-fail-render-'));
  try {
    const {deps} = await setup(dir, true);
    deps.render = async () => {throw new Error('Render failed');};
    await expect(createShortV5(brief.topic, deps)).rejects.toThrow('Render failed');
    expect(await manifest(dir)).toMatchObject({status: 'failed', stage: 'render'});
    await expect(readFile(join(dir, 'checkpoint-rendered.json'), 'utf8')).rejects.toThrow();
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('does not record success when inputs change during render', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-edit-during-'));
  try {
    const {deps, bindings} = await setup(dir, true);
    deps.render = async (_v, outputPath) => {
      await writeFile(bindings[0].localPath, 'changed-during-render');
      await writeFile(outputPath, 'mp4');
    };
    await expect(createShortV5(brief.topic, deps)).rejects.toThrow(/changed during render/);
    expect(await manifest(dir)).not.toMatchObject({status: 'rendered'});
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('cannot reuse a final output after source bytes change', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-edit-input-'));
  try {
    const {deps, bindings} = await setup(dir, true);
    const run = {runId: 'test', runDir: dir};
    const first = await createShortV5(brief.topic, withV5Checkpoints({...deps, resume: true}, run));
    expect(first.status).toBe('rendered');
    await writeFile(bindings[0].localPath, 'edited-source');
    await expect(createShortV5(brief.topic, withV5Checkpoints({...deps, resume: true}, run)))
      .rejects.toThrow(/missing or changed/);
    expect(deps.render).toHaveBeenCalledTimes(1);
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('holds invalid imported bindings instead of failing with a schema dump', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-bind-zod-'));
  try {
    const {deps, bindings} = await setup(dir, true);
    deps.assets = vi.fn(async (_p, _t, _d, record) => {
      const invalid = bindings.map(binding => ({...binding, approved: false}));
      await record(invalid as never);
      return {status: 'ready' as const, bindings: invalid as never};
    });
    await expect(createShortV5(brief.topic, deps)).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ContentHold);
      expect(error).not.toBeInstanceOf(z.ZodError);
      return (error as ContentHold).decision === 'hold';
    });
    expect(await manifest(dir)).toMatchObject({status: 'hold'});
    expect(deps.render).not.toHaveBeenCalled();
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('renders with revalidated local paths after checkpoint asset rehash', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-revalidate-bind-'));
  try {
    const {deps, prompts} = await setup(dir, true);
    const original = await writeBindings(dir, prompts);
    const stale = original.map(binding => binding.sceneId === 'mechanism'
      ? {...binding, localPath: join(dir, 'stale-mechanism.mp4')} : binding);
    deps.assets = vi.fn(async (_p, _t, _d, record) => {
      await record(stale);
      return {status: 'ready' as const, bindings: stale};
    });
    const run = {runId: 'test', runDir: dir};
    const result = await createShortV5(brief.topic, withV5Checkpoints({...deps, resume: true}, run));
    expect(result.status).toBe('rendered');
    const resolved = JSON.parse(await readFile(join(dir, 'resolved.json'), 'utf8'));
    expect(resolved.scenes[2].localVideoPath).toBe(await realpath(join(dir, 'Ptko4.mp4')));
    expect(resolved.scenes[2].localVideoPath).not.toContain('stale-mechanism');
  } finally {await rm(dir, {recursive: true, force: true});}
});

it.each([
  [{durationSec: 28, width: 1920, height: 1920, fps: 30}, /Encoded MP4/],
  [{durationSec: 28, width: 1080, height: 1080, fps: 30}, /Encoded MP4/],
  [{durationSec: 28, width: 1080, height: 1920, fps: 24}, /Encoded MP4/],
  [{durationSec: 27, width: 1080, height: 1920, fps: 30}, /Encoded MP4/],
  [{durationSec: 30.1, width: 1080, height: 1920, fps: 30}, /Encoded MP4/],
] as const)('rejects an encoded MP4 that fails the format gate %j', async (media, pattern) => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-mp4-'));
  try {
    const {deps} = await setup(dir, true);
    deps.probe = async (path: string) => path.endsWith('output.mp4') ? media : {durationSec: 6, width: 1080, height: 1920, fps: 30};
    await expect(createShortV5(brief.topic, deps)).rejects.toThrow(pattern);
    expect(await manifest(dir)).toMatchObject({status: 'hold', stage: 'verify-mp4'});
  } finally {await rm(dir, {recursive: true, force: true});}
});
