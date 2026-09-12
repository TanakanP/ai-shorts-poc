import {expect, it, vi} from 'vitest';
import {createShortV4, type V4Deps} from '../../src/pipeline/create-short-v4';
import {ContentHold, StoryRevisionNeeded} from '../../src/content/v4/contracts';
import {brief, pack, proofs, contentPlan, voiced} from '../content/v4/fixtures';

function setup() {
  const files = new Map<string, any>();
  const order: string[] = [];
  const deps: V4Deps = {
    createRunDirectory: async () => ({runId: 'test', runDir: '/tmp/v4-test'}),
    persistJson: async (path, value) => {files.set(path.split('/').at(-1)!, structuredClone(value));},
    loadBrief: async () => brief, package: vi.fn(async () => pack()), approvePackage: async () => true,
    proof: vi.fn(async () => {order.push('proof'); return proofs();}),
    story: vi.fn(async () => {order.push('story'); return contentPlan();}), approveStory: async () => true,
    synthesize: vi.fn(async () => {order.push('voice'); return voiced();}),
    reviewTiming: vi.fn(async () => null),
    render: vi.fn(async () => {order.push('render');}),
    probe: async () => ({durationSec: 28, width: 1080, height: 1920, fps: 30}),
    channel: {brand: 'Tell Me Why', signoff: 'Look closer every day.'},
    voiceProvider: 'xai', backgroundMusicPath: '/tmp/music.mp3',
  };
  return {deps, files, order};
}
it('orders proof before script/voice and preserves successful provenance', async () => {
  const {deps, files, order} = setup();
  await createShortV4(brief.topic, deps);
  expect(order).toEqual(['proof', 'story', 'voice', 'render']);
  expect(files.get('generation-manifest.json')).toMatchObject({status: 'rendered', topicId: brief.topicId,
    actualDurationSec: 28, rewriteCount: 0, title: brief.titleSeed});
  expect(files.get('resolved.json').scenes[4].localVideoPath).toBe('/tmp/payoff.mp4');
});
it('holds a perfect package with no proof and spends nothing on script or TTS', async () => {
  const {deps, files} = setup(); deps.proof = async () => [];
  await expect(createShortV4(brief.topic, deps)).rejects.toThrow(/approved proof/);
  expect(deps.story).not.toHaveBeenCalled(); expect(deps.synthesize).not.toHaveBeenCalled();
  expect(deps.render).not.toHaveBeenCalled();
  expect(files.get('generation-manifest.json')).toMatchObject({status: 'hold', stage: 'proof'});
});
it('preserves explicit proof hold reasons', async () => {
  const {deps, files} = setup(); deps.proof = async () => {throw new ContentHold(['No real refraction visible']);};
  await expect(createShortV4(brief.topic, deps)).rejects.toThrow(/No real/);
  expect(files.get('run.json').error.message).toContain('No real refraction');
});
it('rewrites excessive timing once and passes previous audio for reuse', async () => {
  const {deps, files} = setup();
  const long = voiced([3, 4, 7, 7, 6, 4]);
  deps.synthesize = vi.fn().mockResolvedValueOnce(long).mockResolvedValueOnce(voiced());
  await createShortV4(brief.topic, deps);
  expect(deps.story).toHaveBeenCalledTimes(2);
  expect(deps.synthesize).toHaveBeenLastCalledWith(expect.anything(), '/tmp/v4-test', long);
  expect(files.get('generation-manifest.json').rewriteCount).toBe(1);
});
it('uses the same single revision budget for early semantic disclosure', async () => {
  const {deps, files} = setup();
  deps.story = vi.fn().mockRejectedValueOnce(new StoryRevisionNeeded(['Early mechanism leak'], contentPlan()))
    .mockResolvedValueOnce(contentPlan());
  deps.synthesize = vi.fn(async () => voiced([3, 4, 7, 7, 6, 4]));
  await expect(createShortV4(brief.topic, deps)).rejects.toThrow(/29s/);
  expect(deps.story).toHaveBeenCalledTimes(2); expect(deps.synthesize).toHaveBeenCalledTimes(1);
  expect(deps.render).not.toHaveBeenCalled();
  expect(files.get('rejected-story.json').reasons).toEqual(['Early mechanism leak']);
});
it('holds if the single timing rewrite is still longer than 30 seconds', async () => {
  const {deps, files} = setup();
  deps.synthesize = vi.fn(async () => voiced([3, 4, 7, 7, 6, 4]));
  await expect(createShortV4(brief.topic, deps)).rejects.toThrow(/29s/);
  expect(deps.synthesize).toHaveBeenCalledTimes(2);
  expect(deps.render).not.toHaveBeenCalled();
  expect(files.get('generation-manifest.json').status).toBe('hold');
});
it('does not claim rendered success when rendering fails', async () => {
  const {deps, files} = setup(); deps.render = async () => {throw new Error('Render failed');};
  await expect(createShortV4(brief.topic, deps)).rejects.toThrow('Render failed');
  expect(files.get('generation-manifest.json')).toMatchObject({status: 'failed', stage: 'render'});
});
it('rejects an encoded MP4 beyond the hard limit', async () => {
  const {deps, files} = setup(); deps.probe = async () => ({durationSec: 30.1, width: 1080, height: 1920, fps: 30});
  await expect(createShortV4(brief.topic, deps)).rejects.toThrow(/Encoded MP4/);
  expect(files.get('generation-manifest.json')).toMatchObject({status: 'hold', stage: 'verify-mp4'});
});
