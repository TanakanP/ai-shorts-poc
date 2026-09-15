import {expect, it, vi} from 'vitest';
import {resolveV4Proof, type ProofDeps} from '../../../src/content/v4/proof';
import {VOICED_BEATS} from '../../../src/content/v4/contracts';
import {cropFractions} from '../../../src/content/v4/media';
import {brief, pack} from './fixtures';

function localSetup() {
  const localBrief = {...brief, localProof: VOICED_BEATS.map(beatId => ({beatId, path: `/tmp/${beatId}.mp4`,
    licenseNote: 'Owned proof', trimStartSec: 1.12, cropPosition: '25% 50%'}))};
  const deps: ProofDeps = {
    searchVideos: vi.fn(async () => []), download: vi.fn(async () => {}),
    probe: async () => ({durationSec: 20, width: 1920, height: 1080, fps: 30}),
    chooseView: async (_shot, _path, _duration, defaults) => defaults,
    preview: vi.fn(async () => ({stillPath: '/tmp/still.jpg', previewPath: '/tmp/preview.mp4'})),
    review: vi.fn(async () => ({approved: true, observedAction: 'Straight object displaced at waterline'})),
  };
  return {localBrief, deps};
}
it('binds approved local proof without a stock lookup', async () => {
  const {localBrief, deps} = localSetup();
  const result = await resolveV4Proof(pack(), localBrief, '/tmp', deps);
  expect(result).toHaveLength(5);
  expect(deps.searchVideos).not.toHaveBeenCalled();
  expect(result[0].trimStartSec).toBe(34 / 30);
  expect(result[0].beatIds).toEqual(['paradox', 'contradiction']);
  expect(result[0].cropPosition).toBe('25% 50%');
});
it('holds declined proof instead of selecting an unrelated fallback', async () => {
  const {localBrief, deps} = localSetup(); deps.review = async () => ({approved: false, observedAction: ''});
  await expect(resolveV4Proof(pack(), localBrief, '/tmp', deps)).rejects.toThrow(/No approved proof/);
});
it('rejects intervals beyond the media and never previews them', async () => {
  const {localBrief, deps} = localSetup(); deps.chooseView = async () => ({start: 21, crop: '50% 50%'});
  await expect(resolveV4Proof(pack(), localBrief, '/tmp', deps)).rejects.toThrow(/interval/);
  expect(deps.preview).not.toHaveBeenCalled();
});
it('rejects invalid crop positions', () => {
  expect(() => cropFractions('101% 50%')).toThrow();
  expect(() => cropFractions('center;evil')).toThrow();
});
it('requires a concrete observed action for approval', async () => {
  const {localBrief, deps} = localSetup(); deps.review = async () => ({approved: true, observedAction: ''});
  await expect(resolveV4Proof(pack(), localBrief, '/tmp', deps)).rejects.toThrow();
});
it('keeps earlier footage approvals when a later review is interrupted', async () => {
  const {localBrief, deps} = localSetup();
  let saved: Awaited<ReturnType<typeof resolveV4Proof>> = [];
  deps.record = async values => {saved = structuredClone(values);};
  deps.review = vi.fn().mockResolvedValueOnce({approved: true, observedAction: 'Visible proof'})
    .mockRejectedValueOnce(new Error('interrupted'));
  await expect(resolveV4Proof(pack(), localBrief, '/tmp', deps)).rejects.toThrow('interrupted');
  expect(saved).toHaveLength(1);
  deps.review = vi.fn(async () => ({approved: true, observedAction: 'Visible proof'}));
  const result = await resolveV4Proof(pack(), localBrief, '/tmp', {...deps, previous: saved});
  expect(result).toHaveLength(5);
  expect(result[0]).toEqual(saved[0]);
  expect(deps.review).toHaveBeenCalledTimes(4);
});
it('rejects an unsuitable original before asking for trim/crop or making previews', async () => {
  const {localBrief, deps} = localSetup();
  deps.reviewCandidate = vi.fn(async () => false);
  deps.chooseView = vi.fn();
  await expect(resolveV4Proof(pack(), localBrief, '/tmp', deps)).rejects.toThrow(/No approved proof/);
  expect(deps.chooseView).not.toHaveBeenCalled();
  expect(deps.preview).not.toHaveBeenCalled();
  expect(deps.review).not.toHaveBeenCalled();
});
it('checks the original before crop selection and still reviews the final crop', async () => {
  const {localBrief, deps} = localSetup(); const order: string[] = [];
  deps.reviewCandidate = async () => {order.push('original'); return true;};
  deps.chooseView = async (_s, _p, _d, defaults) => {order.push('crop'); return defaults;};
  deps.review = async () => {order.push('final'); return {approved: true, observedAction: 'Proof'};};
  await resolveV4Proof(pack(), localBrief, '/tmp', deps);
  expect(order).toEqual(VOICED_BEATS.flatMap(() => ['original', 'crop', 'final']));
});
it('uses manual keywords exclusively and asks before any Pexels request', async () => {
  const {deps} = localSetup(); const order: string[] = [];
  deps.chooseSearch = async () => {order.push('choose'); return ['my exact keywords'];};
  deps.searchVideos = vi.fn(async () => {order.push('search'); return [];});
  await expect(resolveV4Proof(pack(), brief, '/tmp', deps)).rejects.toThrow(/No approved proof/);
  expect(order).toEqual(['choose', 'search', 'search']);
  expect(deps.searchVideos).toHaveBeenNthCalledWith(1, 'my exact keywords', {orientation: 'portrait', perPage: 15});
  expect(deps.searchVideos).toHaveBeenNthCalledWith(2, 'my exact keywords', {orientation: 'landscape', perPage: 15});
});
it('does not repeat search or original/crop reviews for resumed approved scenes', async () => {
  const {localBrief, deps} = localSetup();
  const saved = await resolveV4Proof(pack(), localBrief, '/tmp', deps);
  deps.chooseSearch = vi.fn(); deps.reviewCandidate = vi.fn(); deps.chooseView = vi.fn();
  deps.review = vi.fn();
  expect(await resolveV4Proof(pack(), localBrief, '/tmp', {...deps, previous: saved})).toEqual(saved);
  expect(deps.chooseSearch).not.toHaveBeenCalled();
  expect(deps.reviewCandidate).not.toHaveBeenCalled();
  expect(deps.chooseView).not.toHaveBeenCalled();
  expect(deps.review).not.toHaveBeenCalled();
});
