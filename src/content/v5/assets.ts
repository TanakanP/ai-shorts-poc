import {createHash} from 'node:crypto';
import {createReadStream, constants} from 'node:fs';
import {access, lstat, realpath, stat} from 'node:fs/promises';
import {basename, isAbsolute, join, relative, sep} from 'node:path';
import {cropFractions} from '../v4/media';
import {z} from 'zod';
import {
  ContentHold, generatedBindingSchema, mediaInfoSchema, parseOrHold, type GeneratedBinding, type MediaInfo,
  type PromptPack, type SceneId, type ScenePrompt,
} from './contracts';
import {requiredSourceFrames} from './timing';
import type {VideoPlan} from '../../domain/video-plan';

export const GENERATED_PREVIEW_DIR = 'asset-previews';

export type InspectGeneratedAssetInput = {
  runDir: string; fileName: string; scene: ScenePrompt;
  trimStartSec: number; cropPosition: string; observedAction: string;
  fastMode?: boolean;
  provider?: GeneratedBinding['provider'];
};
export type InspectGeneratedAssetDeps = {probe: (path: string) => Promise<MediaInfo>};

function looksLikeUrl(value: string): boolean {
  return /:\/\//.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function isReservedGeneratedPath(realRun: string, realFile: string, fileName: string): boolean {
  if (fileName === 'output.mp4' || realFile === join(realRun, 'output.mp4')) return true;
  const previewRoot = join(realRun, GENERATED_PREVIEW_DIR);
  if (isInside(previewRoot, realFile)) return true;
  const stillName = fileName.replace(/\.mp4$/i, '.jpg');
  if (realFile === join(previewRoot, fileName) || realFile === join(previewRoot, stillName)) return true;
  return false;
}

export async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export function availableSourceFrames(durationSec: number, trimStartSec: number, fps = 30): number {
  return Math.floor((durationSec - trimStartSec) * fps + 1e-6);
}

export function requiredImportFrames(scene: ScenePrompt, timedPlan: VideoPlan): number {
  let required = scene.requiredFrames;
  if (scene.sceneId !== 'contradiction') return required;
  const outroIndex = timedPlan.scenes.findIndex(item => item.id === 'channel-outro');
  if (outroIndex < 0) return required;
  return Math.max(required, requiredSourceFrames(timedPlan.scenes[outroIndex].durationSeconds, outroIndex));
}

export function duplicateStoryScene(bindings: GeneratedBinding[], candidate: GeneratedBinding): SceneId | undefined {
  return bindings.find(item => item.sceneId !== candidate.sceneId && item.sha256 === candidate.sha256)?.sceneId;
}

export async function resolveGeneratedFile(runDir: string, fileName: string): Promise<string> {
  const trimmed = fileName.trim();
  if (!trimmed.endsWith('.mp4') || trimmed.length <= 4 || basename(trimmed) !== trimmed)
    throw new ContentHold(['Video filename must be a single .mp4 basename']);
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0') || isAbsolute(trimmed) || looksLikeUrl(trimmed))
    throw new ContentHold(['Video filename must be a single .mp4 basename']);
  if (trimmed === '.' || trimmed === '..')
    throw new ContentHold(['Video filename must be a single .mp4 basename']);
  if (trimmed === 'output.mp4')
    throw new ContentHold(['Application-owned output.mp4 cannot be imported']);

  let realRun: string;
  try {realRun = await realpath(runDir);}
  catch {throw new ContentHold(['Run directory is not accessible']);}

  const candidate = join(realRun, trimmed);
  if (!isInside(realRun, candidate))
    throw new ContentHold(['Video filename must be a single .mp4 basename']);

  let linkStats;
  try {linkStats = await lstat(candidate);}
  catch {throw new ContentHold([`${trimmed}: file not found in the run directory`]);}
  if (linkStats.isDirectory())
    throw new ContentHold([`${trimmed}: must be a video file, not a directory`]);

  let realFile: string;
  try {realFile = await realpath(candidate);}
  catch {throw new ContentHold([`${trimmed}: file is not readable`]);}
  if (!isInside(realRun, realFile))
    throw new ContentHold([`${trimmed}: file must stay inside the run directory`]);
  if (isReservedGeneratedPath(realRun, realFile, trimmed))
    throw new ContentHold([`${trimmed}: application-owned output or preview files cannot be imported`]);

  const realStats = await stat(realFile);
  if (!realStats.isFile())
    throw new ContentHold([`${trimmed}: must be a readable regular file`]);
  try {await access(realFile, constants.R_OK);}
  catch {throw new ContentHold([`${trimmed}: file is not readable`]);}
  return realFile;
}

export async function inspectGeneratedAsset(
  input: InspectGeneratedAssetInput, deps: InspectGeneratedAssetDeps,
): Promise<GeneratedBinding> {
  const observedAction = input.observedAction.trim();
  if (!observedAction && !input.fastMode)
    throw new ContentHold(['Observed action is required']);
  if (!Number.isInteger(input.scene.requiredFrames) || input.scene.requiredFrames < 1)
    throw new ContentHold([`${input.scene.sceneId}: required frames must be positive`]);
  if (!Number.isFinite(input.trimStartSec) || input.trimStartSec < 0)
    throw new ContentHold([`${input.scene.sceneId}: trim start must be a finite non-negative number`]);
  cropFractions(input.cropPosition);
  const trimStartSec = Math.round(input.trimStartSec * 30) / 30;
  const localPath = await resolveGeneratedFile(input.runDir, input.fileName);
  let media: MediaInfo;
  try {media = mediaInfoSchema.parse(await deps.probe(localPath));}
  catch (error) {
    if (error instanceof ContentHold) throw error;
    if (error instanceof z.ZodError) {
      throw new ContentHold([
        `${input.scene.sceneId}: media metadata must be finite with positive duration, fps and dimensions`]);
    }
    throw error;
  }
  const availableFrames = availableSourceFrames(media.durationSec, trimStartSec);
  if (availableFrames < input.scene.requiredFrames) {
    throw new ContentHold([`${input.scene.sceneId}: clip does not cover the reviewed scene interval`]);
  }
  return parseOrHold(generatedBindingSchema, {
    sceneId: input.scene.sceneId, kind: 'generated', provider: input.provider ?? 'grok-imagine',
    fileName: input.fileName.trim(), localPath, sha256: await hashFile(localPath),
    promptHash: input.scene.promptHash, trimStartSec, cropPosition: input.cropPosition,
    media, observedAction, ...(input.fastMode ? {reviewMode: 'fast' as const} : {}), approved: true,
  }, `${input.scene.sceneId}: generated binding is invalid`);
}

export async function revalidateGeneratedBinding(
  binding: GeneratedBinding, input: {runDir: string; prompts: PromptPack; timedPlan: VideoPlan},
  deps: InspectGeneratedAssetDeps,
): Promise<GeneratedBinding | undefined> {
  try {
    const parsed = generatedBindingSchema.parse(binding);
    const expectedProvider = input.prompts.workflow === 'gemini-flow' ? 'google-flow' : 'grok-imagine';
    if (parsed.provider !== expectedProvider) return undefined;
    const scene = input.prompts.scenes.find(item => item.sceneId === parsed.sceneId);
    if (!scene || scene.promptHash !== parsed.promptHash) return undefined;
    const inspected = await inspectGeneratedAsset({
      runDir: input.runDir, fileName: parsed.fileName,
      scene: {...scene, requiredFrames: requiredImportFrames(scene, input.timedPlan)},
      trimStartSec: parsed.trimStartSec, cropPosition: parsed.cropPosition, observedAction: parsed.observedAction,
      fastMode: parsed.reviewMode === 'fast',
      provider: parsed.provider,
    }, deps);
    if (inspected.sha256 !== parsed.sha256) return undefined;
    return inspected;
  } catch {
    return undefined;
  }
}
