import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import type {VideoPlan} from '../../domain/video-plan';
import {cropFractions, previewProof, probeMedia} from '../v4/media';
import {
  ContentHold, parseOrHold, promptPackSchema, VOICED_BEATS, type GeneratedBinding, type MediaInfo, type PromptPack,
  type SceneId, type ScenePrompt,
} from './contracts';
import {
  duplicateStoryScene, GENERATED_PREVIEW_DIR, inspectGeneratedAsset, requiredImportFrames, resolveGeneratedFile,
  revalidateGeneratedBinding, availableSourceFrames,
} from './assets';
import {requiredSourceFrames} from './timing';

export type ReviewGeneratedAssetsInput = {
  runDir: string; prompts: PromptPack; timedPlan: VideoPlan; previous: GeneratedBinding[]; fastMode?: boolean;
};
export type ReviewGeneratedAssetsDeps = {
  ask: (question: string) => Promise<string>;
  log: (value: string) => void;
  probe?: (path: string) => Promise<MediaInfo>;
  preview?: typeof previewProof;
  record: (bindings: GeneratedBinding[]) => Promise<void>;
};
export type ReviewGeneratedAssetsResult = {status: 'ready' | 'awaiting-assets'; bindings: GeneratedBinding[]};

type AskResult = {kind: 'quit'} | {kind: 'value'; value: string};
type PreviewFn = typeof previewProof;

function holdMessage(error: unknown): string {
  if (error instanceof ContentHold) return error.reasons.join('; ');
  if (error instanceof Error) return error.message;
  return 'Invalid generated video';
}

function orderedBindings(bindings: GeneratedBinding[]): GeneratedBinding[] {
  return VOICED_BEATS.map(id => bindings.find(item => item.sceneId === id)).filter(
    (item): item is GeneratedBinding => Boolean(item),
  );
}

function upsertBinding(bindings: GeneratedBinding[], binding: GeneratedBinding): GeneratedBinding[] {
  return orderedBindings([...bindings.filter(item => item.sceneId !== binding.sceneId), binding]);
}

function outroRequirement(timedPlan: VideoPlan): {frames: number; durationSec: number} | undefined {
  const outroIndex = timedPlan.scenes.findIndex(item => item.id === 'channel-outro');
  if (outroIndex < 0) return undefined;
  const frames = requiredSourceFrames(timedPlan.scenes[outroIndex].durationSeconds, outroIndex);
  return {frames, durationSec: frames / 30};
}

async function askLine(ask: ReviewGeneratedAssetsDeps['ask'], question: string): Promise<AskResult> {
  const value = (await ask(question)).trim();
  if (value.toLowerCase() === 'q') return {kind: 'quit'};
  return {kind: 'value', value};
}

function showScene(log: (value: string) => void, scene: ScenePrompt, timedPlan: VideoPlan) {
  const timed = timedPlan.scenes.find(item => item.id === scene.sceneId);
  const narration = timed?.spokenText ?? timed?.text ?? '';
  log([
    `${scene.sceneId}`,
    `Narration: ${narration}`,
    `Visual intent: ${scene.visualIntent}`,
    `Image prompt:\n${scene.imagePrompt}`,
    `Video prompt:\n${scene.videoPrompt}`,
  ].join('\n'));
}

async function revalidatePrevious(
  input: ReviewGeneratedAssetsInput, probe: (path: string) => Promise<MediaInfo>, log: (value: string) => void,
): Promise<GeneratedBinding[]> {
  const kept: GeneratedBinding[] = [];
  const seen = new Set<string>();
  for (const sceneId of VOICED_BEATS) {
    const saved = input.previous.find(item => item.sceneId === sceneId);
    if (!saved) continue;
    const valid = await revalidateGeneratedBinding(saved, input, {probe});
    if (!valid) {
      log(`${sceneId}: previous clip is no longer valid; review it again`);
      continue;
    }
    if (seen.has(valid.sha256)) {
      log(`${sceneId}: previous clip duplicates another story scene; review it again`);
      continue;
    }
    seen.add(valid.sha256);
    kept.push(valid);
  }
  return kept;
}

async function reviewOneScene(input: {
  runDir: string; scene: ScenePrompt; timedPlan: VideoPlan; approved: GeneratedBinding[];
  fastMode?: boolean;
  provider: GeneratedBinding['provider'];
  ask: ReviewGeneratedAssetsDeps['ask']; log: (value: string) => void;
  probe: (path: string) => Promise<MediaInfo>; preview: PreviewFn;
}): Promise<{kind: 'quit'} | {kind: 'binding'; binding: GeneratedBinding}> {
  const {scene, timedPlan, ask, log, probe, preview, runDir} = input;
  const requiredFrames = requiredImportFrames(scene, timedPlan);
  const usedDurationSec = scene.requiredFrames / 30;
  const outro = scene.sceneId === 'contradiction' ? outroRequirement(timedPlan) : undefined;
  showScene(log, scene, timedPlan);

  filenameLoop: for (;;) {
    const fileAnswer = await askLine(ask, `Video filename for ${scene.sceneId} (or q to save and stop): `);
    if (fileAnswer.kind === 'quit') return {kind: 'quit'};
    if (!fileAnswer.value) {log('Video filename must be a single .mp4 basename'); continue;}

    let localPath: string;
    try {localPath = await resolveGeneratedFile(runDir, fileAnswer.value);}
    catch (error) {log(holdMessage(error)); continue;}

    let trimStartSec = 0;
    let cropPosition = '50% 50%';
    for (;;) {
      const startAnswer = await askLine(ask, 'Clip start in seconds [0]: ');
      if (startAnswer.kind === 'quit') return {kind: 'quit'};
      const start = startAnswer.value ? Number(startAnswer.value) : 0;
      if (!Number.isFinite(start) || start < 0) {
        log(`${scene.sceneId}: trim start must be a finite non-negative number`);
        continue;
      }
      trimStartSec = Math.round(start * 30) / 30;
      if (!input.fastMode) {
        const cropAnswer = await askLine(ask, 'Crop position x% y% [50% 50%]: ');
        if (cropAnswer.kind === 'quit') return {kind: 'quit'};
        cropPosition = cropAnswer.value || '50% 50%';
      }
      try {cropFractions(cropPosition);}
      catch (error) {log(holdMessage(error)); continue;}
      try {
        const media = await probe(localPath);
        if (![media.durationSec, media.fps, media.width, media.height].every(value => Number.isFinite(value) && value > 0)) {
          throw new ContentHold([
            `${scene.sceneId}: media metadata must be finite with positive duration, fps and dimensions`]);
        }
        const availableFrames = availableSourceFrames(media.durationSec, trimStartSec);
        if (availableFrames < requiredFrames) {
          throw new ContentHold([`${scene.sceneId}: clip does not cover the reviewed scene interval`]);
        }
      } catch (error) {log(holdMessage(error)); continue filenameLoop;}
      break;
    }

    if (input.fastMode) {
      try {
        const binding = await inspectGeneratedAsset({
          runDir, fileName: fileAnswer.value, scene: {...scene, requiredFrames},
          trimStartSec, cropPosition, observedAction: '', fastMode: true, provider: input.provider,
        }, {probe});
        const duplicate = duplicateStoryScene(input.approved, binding);
        if (duplicate) throw new ContentHold([
          `${scene.sceneId}: story clips must use distinct source files (same bytes as ${duplicate})`]);
        log(`FAST_MODE: ${scene.sceneId} accepted at ${cropPosition} after trim ${trimStartSec}s without visual review`);
        return {kind: 'binding', binding};
      } catch (error) {log(holdMessage(error)); continue;}
    }

    try {
      const outputBase = join(runDir, GENERATED_PREVIEW_DIR, scene.sceneId);
      const previews = await preview(localPath, trimStartSec, cropPosition, outputBase, usedDurationSec);
      log(`Review portrait still: ${previews.stillPath}\nReview motion (used interval): ${previews.previewPath}`);
      if (outro) {
        const outroBase = join(runDir, GENERATED_PREVIEW_DIR, 'channel-outro');
        const outroPreviews = await preview(localPath, trimStartSec, cropPosition, outroBase, outro.durationSec);
        log(`Review outro used interval still: ${outroPreviews.stillPath}\nReview outro used interval motion: ${outroPreviews.previewPath}`);
      }
      log(`Required action: ${scene.visualIntent}`);
    } catch (error) {log(holdMessage(error)); continue;}

    let approved = false;
    for (;;) {
      const confirm = await askLine(ask, 'Does this exact crop show the required action with consistent continuity? [y/n/q] ');
      if (confirm.kind === 'quit') return {kind: 'quit'};
      const answer = confirm.value.toLowerCase();
      if (['y', 'yes'].includes(answer)) {approved = true; break;}
      if (['n', 'no'].includes(answer)) break;
      log('Choose y, n or q.');
    }
    if (!approved) continue;

    let observedAction = '';
    for (;;) {
      const observed = await askLine(ask, 'Briefly describe the observed action: ');
      if (observed.kind === 'quit') return {kind: 'quit'};
      if (observed.value) {observedAction = observed.value; break;}
      log('Observed action is required.');
    }

    try {
      const binding = await inspectGeneratedAsset({
        runDir, fileName: fileAnswer.value, scene: {...scene, requiredFrames},
        trimStartSec, cropPosition, observedAction, provider: input.provider,
      }, {probe});
      const duplicate = duplicateStoryScene(input.approved, binding);
      if (duplicate) {
        throw new ContentHold([`${scene.sceneId}: story clips must use distinct source files (same bytes as ${duplicate})`]);
      }
      return {kind: 'binding', binding};
    } catch (error) {log(holdMessage(error));}
  }
}

export async function reviewGeneratedAssets(
  input: ReviewGeneratedAssetsInput, deps: ReviewGeneratedAssetsDeps,
): Promise<ReviewGeneratedAssetsResult> {
  const prompts = parseOrHold(promptPackSchema, input.prompts, 'Prompt pack is invalid');
  const provider = prompts.workflow === 'gemini-flow' ? 'google-flow' : 'grok-imagine';
  const probe = deps.probe ?? probeMedia;
  const preview = deps.preview ?? previewProof;
  await mkdir(join(input.runDir, GENERATED_PREVIEW_DIR), {recursive: true});
  let approved = await revalidatePrevious({...input, prompts}, probe, deps.log);
  await deps.record(approved);

  for (const scene of prompts.scenes) {
    if (approved.some(item => item.sceneId === scene.sceneId)) continue;
    const result = await reviewOneScene({
      runDir: input.runDir, scene, timedPlan: input.timedPlan, approved, provider, fastMode: input.fastMode,
      ask: deps.ask, log: deps.log, probe, preview,
    });
    if (result.kind === 'quit') return {status: 'awaiting-assets', bindings: approved};
    approved = upsertBinding(approved, result.binding);
    await deps.record(approved);
  }

  if (input.fastMode) return {status: 'ready', bindings: approved};

  for (;;) {
    deps.log(`Approved generated clips:\n${approved.map(item => `${item.sceneId}: ${item.fileName}`).join('\n')}`);
    const replace = await askLine(deps.ask, 'Enter a scene ID to replace, or press Enter to continue: ');
    if (replace.kind === 'quit') return {status: 'awaiting-assets', bindings: approved};
    if (!replace.value) return {status: 'ready', bindings: approved};
    if (!(VOICED_BEATS as readonly string[]).includes(replace.value)) {
      deps.log('Enter a voiced scene ID, q to save and stop, or press Enter to continue.');
      continue;
    }
    const sceneId = replace.value as SceneId;
    const scene = prompts.scenes.find(item => item.sceneId === sceneId);
    if (!scene) {deps.log(`Unknown scene ${replace.value}`); continue;}
    const others = approved.filter(item => item.sceneId !== sceneId);
    const result = await reviewOneScene({
      runDir: input.runDir, scene, timedPlan: input.timedPlan, approved: others, provider, fastMode: input.fastMode,
      ask: deps.ask, log: deps.log, probe, preview,
    });
    if (result.kind === 'quit') return {status: 'awaiting-assets', bindings: approved};
    approved = upsertBinding(approved, result.binding);
    await deps.record(approved);
  }
}
