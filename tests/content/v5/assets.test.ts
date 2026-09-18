import {copyFile, mkdir, mkdtemp, realpath, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {probeMedia} from '../../../src/content/v4/media';
import {
  duplicateStoryScene, hashFile, inspectGeneratedAsset, requiredImportFrames, resolveGeneratedFile,
} from '../../../src/content/v5/assets';
import {okMedia, promptPack, voiced} from './fixtures';

const probe = async () => okMedia;

async function runDir() {
  return mkdtemp(join(tmpdir(), 'v5-assets-'));
}

it('rejects missing, reserved, escaped and non-basename paths including out-of-run symlinks', async () => {
  const dir = await runDir();
  const outside = await mkdtemp(join(tmpdir(), 'v5-escape-'));
  try {
    await writeFile(join(dir, 'ok.mp4'), 'inside');
    await writeFile(join(dir, 'output.mp4'), 'render');
    await mkdir(join(dir, 'folder.mp4'));
    await mkdir(join(dir, 'asset-previews'));
    await writeFile(join(dir, 'asset-previews', 'preview.mp4'), 'preview');
    await symlink(join(dir, 'asset-previews', 'preview.mp4'), join(dir, 'sneak.mp4'));
    await writeFile(join(outside, 'secret.mp4'), 'secret');
    await symlink(join(outside, 'secret.mp4'), join(dir, 'escaped.mp4'));
    await expect(resolveGeneratedFile(dir, 'missing.mp4')).rejects.toThrow(/not found/);
    await expect(resolveGeneratedFile(dir, 'output.mp4')).rejects.toThrow(/output\.mp4/);
    await expect(resolveGeneratedFile(dir, 'sneak.mp4')).rejects.toThrow(/preview|application-owned/);
    await expect(resolveGeneratedFile(dir, '../secret.mp4')).rejects.toThrow(/basename/);
    await expect(resolveGeneratedFile(dir, '/tmp/secret.mp4')).rejects.toThrow(/basename/);
    await expect(resolveGeneratedFile(dir, 'https://example.test/a.mp4')).rejects.toThrow(/basename/);
    await expect(resolveGeneratedFile(dir, 'nested/clip.mp4')).rejects.toThrow(/basename/);
    await expect(resolveGeneratedFile(dir, 'clip\\path.mp4')).rejects.toThrow(/basename/);
    await expect(resolveGeneratedFile(dir, '..')).rejects.toThrow(/basename/);
    await expect(resolveGeneratedFile(dir, 'folder.mp4')).rejects.toThrow(/directory/);
    await expect(resolveGeneratedFile(dir, 'escaped.mp4')).rejects.toThrow(/inside the run directory/);
    expect(await resolveGeneratedFile(dir, 'ok.mp4')).toBe(await realpath(join(dir, 'ok.mp4')));
  } finally {
    await rm(dir, {recursive: true, force: true});
    await rm(outside, {recursive: true, force: true});
  }
});

it('accepts an arbitrary valid basename including Ptko4.mp4 and an in-run symlink', async () => {
  const dir = await runDir();
  try {
    await writeFile(join(dir, 'real.mp4'), 'bytes');
    await symlink(join(dir, 'real.mp4'), join(dir, 'Ptko4.mp4'));
    expect(await resolveGeneratedFile(dir, 'Ptko4.mp4')).toBe(await realpath(join(dir, 'real.mp4')));
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('hashes real file bytes and rejects nonfinite, too-short, invalid trim/crop and empty observed action', async () => {
  const dir = await runDir();
  try {
    const fileName = 'clip.mp4';
    await copyFile('tests/fixtures/tiny-video.mp4', join(dir, fileName));
    const scene = promptPack().scenes[0];
    const approved = await inspectGeneratedAsset({
      runDir: dir, fileName, scene, trimStartSec: 0, cropPosition: '25% 50%', observedAction: 'Straw breaks at the waterline',
    }, {probe});
    expect(approved.sha256).toBe(await hashFile(join(dir, fileName)));
    expect(approved.trimStartSec).toBe(0);
    await expect(inspectGeneratedAsset({
      runDir: dir, fileName, scene, trimStartSec: 0, cropPosition: '50% 50%', observedAction: '  ',
    }, {probe})).rejects.toThrow(/Observed action/);
    await expect(inspectGeneratedAsset({
      runDir: dir, fileName, scene, trimStartSec: -1, cropPosition: '50% 50%', observedAction: 'Action',
    }, {probe})).rejects.toThrow(/trim start/);
    await expect(inspectGeneratedAsset({
      runDir: dir, fileName, scene, trimStartSec: 0, cropPosition: '101% 50%', observedAction: 'Action',
    }, {probe})).rejects.toThrow(/Crop/);
    await expect(inspectGeneratedAsset({
      runDir: dir, fileName, scene: {...scene, requiredFrames: 181}, trimStartSec: 0, cropPosition: '50% 50%',
      observedAction: 'Action',
    }, {probe: async () => ({...okMedia, durationSec: 6})})).rejects.toThrow(/cover the reviewed scene interval/);
    await expect(inspectGeneratedAsset({
      runDir: dir, fileName, scene, trimStartSec: 0, cropPosition: '50% 50%', observedAction: 'Action',
    }, {probe: async () => ({durationSec: Number.NaN, width: 1080, height: 1920, fps: 30})}))
      .rejects.toThrow(/finite/);
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('rejects a nondecodable file when probing real bytes', async () => {
  const dir = await runDir();
  try {
    await writeFile(join(dir, 'broken.mp4'), 'not a video');
    await expect(inspectGeneratedAsset({
      runDir: dir, fileName: 'broken.mp4', scene: promptPack().scenes[0],
      trimStartSec: 0, cropPosition: '50% 50%', observedAction: 'Action',
    }, {probe: probeMedia})).rejects.toThrow();
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('treats identical bytes under two filenames as a duplicate story clip', async () => {
  const dir = await runDir();
  try {
    await writeFile(join(dir, 'a.mp4'), 'same-bytes');
    await writeFile(join(dir, 'b.mp4'), 'same-bytes');
    const sceneA = promptPack().scenes[0];
    const sceneB = promptPack().scenes[1];
    const first = await inspectGeneratedAsset({
      runDir: dir, fileName: 'a.mp4', scene: sceneA, trimStartSec: 0, cropPosition: '50% 50%', observedAction: 'One',
    }, {probe});
    const second = await inspectGeneratedAsset({
      runDir: dir, fileName: 'b.mp4', scene: sceneB, trimStartSec: 0, cropPosition: '50% 50%', observedAction: 'Two',
    }, {probe});
    expect(first.sha256).toBe(second.sha256);
    expect(duplicateStoryScene([first], second)).toBe('contradiction');
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('requires the opening import to cover the reused outro interval', () => {
  const timed = voiced().timedPlan;
  const opening = promptPack().scenes[0];
  expect(requiredImportFrames(opening, timed)).toBe(126);
  expect(requiredImportFrames(opening, timed)).toBeGreaterThan(opening.requiredFrames);
  expect(requiredImportFrames(promptPack().scenes[4], timed)).toBe(promptPack().scenes[4].requiredFrames);
});
