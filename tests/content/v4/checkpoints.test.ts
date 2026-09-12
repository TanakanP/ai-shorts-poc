import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {withV4Checkpoints} from '../../../src/content/v4/checkpoints';
import {createShortV4, type V4Deps} from '../../../src/pipeline/create-short-v4';
import {brief, pack, proofs, contentPlan, voiced} from './fixtures';

it('resumes after a render failure without repeating approvals, generation or completed narration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v4-resume-'));
  try {
    const voice = voiced();
    for (const [i, scene] of voice.manifest.scenes.entries()) {
      scene.localAudioPath = join(dir, `voice-${i}.mp3`);
      await writeFile(scene.localAudioPath, 'test');
    }
    const deps: V4Deps = {
      createRunDirectory: vi.fn(), persistJson: async () => {},
      loadBrief: vi.fn(async () => brief), package: vi.fn(async () => pack()),
      approvePackage: vi.fn(async () => true),
      proof: vi.fn(async (_pack, _brief, _dir, record, previous) => {
        const values = previous?.length ? previous : proofs(); await record(values); return values;
      }),
      story: vi.fn(async () => contentPlan()), approveStory: vi.fn(async () => true),
      synthesize: vi.fn(async () => voice), reviewTiming: vi.fn(async () => null),
      render: vi.fn().mockRejectedValueOnce(new Error('render failed')).mockResolvedValue(undefined),
      probe: async () => ({durationSec: 28, width: 1080, height: 1920, fps: 30}),
      channel: {brand: 'Tell Me Why', signoff: 'Look closer every day.'},
      voiceProvider: 'xai', backgroundMusicPath: '/tmp/music.mp3',
    };
    const run = {runId: 'resume-test', runDir: dir};
    await expect(createShortV4(brief.topic, withV4Checkpoints(deps, run))).rejects.toThrow('render failed');
    await createShortV4(brief.topic, withV4Checkpoints(deps, run));
    for (const operation of [deps.loadBrief, deps.package, deps.approvePackage, deps.story, deps.approveStory, deps.synthesize])
      expect(operation).toHaveBeenCalledTimes(1);
    expect(deps.proof).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), dir, expect.any(Function), proofs());
    expect(deps.render).toHaveBeenCalledTimes(2);
    expect(deps.createRunDirectory).not.toHaveBeenCalled();
  } finally {await rm(dir, {recursive: true, force: true});}
});
it('does not cache a declined approval or reuse approval for changed content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v4-approval-'));
  try {
    const approvePackage = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const deps = {approvePackage} as unknown as V4Deps;
    const wrapped = withV4Checkpoints(deps, {runId: 'test', runDir: dir});
    expect(await wrapped.approvePackage(pack())).toBe(false);
    expect(await wrapped.approvePackage(pack())).toBe(true);
    expect(await wrapped.approvePackage(pack())).toBe(true);
    await wrapped.approvePackage({...pack(), title: 'Changed claim'});
    expect(approvePackage).toHaveBeenCalledTimes(3);
  } finally {await rm(dir, {recursive: true, force: true});}
});
