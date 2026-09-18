import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {z} from 'zod';
import type {VideoPlan} from '../domain/video-plan';
import type {ResolvedVideo} from '../domain/resolved-video';
import {ProviderError} from '../domain/provider-error';
import type {SynthesizeSceneVoicesResult} from '../voice/synthesize-scene-voices';
import {attachChannelOutro} from './attach-channel-outro';
import {readCheckpoint, writeCheckpoint} from '../content/v4/checkpoints';
import {countSpokenWords} from '../content/v4/rules';
import {
  ContentHold, V5StoryRevisionNeeded, VOICED_BEATS, mediaInfoSchema, type GeneratedBinding, type PromptPack,
  type Revision, type SceneId, type V5Brief, type V5ContentPlan, type V5SelectedPackage,
} from '../content/v5/contracts';
import {bindV5Scenes, videoPlanFromV5} from '../content/v5/adapter';
import {hashFile} from '../content/v5/assets';
import {evaluateV5Timing, type V5TimingResult} from '../content/v5/timing';
import type {V4Deps} from './create-short-v4';

export type V5Result = {
  runId: string; runDir: string; manifestPath: string;
} & (
  {status: 'awaiting-assets'; promptsPath: string; missingSceneIds: SceneId[]}
  | {status: 'rendered'; outputPath: string}
);

export type V5Deps = {
  createRunDirectory: V4Deps['createRunDirectory'];
  persistJson: V4Deps['persistJson'];
  loadBrief: (topic: string) => Promise<V5Brief>;
  package: (brief: V5Brief, record: (value: unknown) => Promise<void>) => Promise<V5SelectedPackage>;
  approvePackage: (pack: V5SelectedPackage) => Promise<boolean>;
  story: (brief: V5Brief, pack: V5SelectedPackage, revision?: Revision) => Promise<V5ContentPlan>;
  approveStory: (plan: V5ContentPlan) => Promise<boolean>;
  synthesize: V4Deps['synthesize'];
  reviewTiming: (timing: V5TimingResult) => Promise<string | null>;
  prompts: (brief: V5Brief, plan: V5ContentPlan, timed: VideoPlan) => Promise<PromptPack>;
  approvePrompts: (pack: PromptPack) => Promise<boolean>;
  exportPrompts: (runDir: string, pack: PromptPack, plan: V5ContentPlan) => Promise<void>;
  assets: (pack: PromptPack, timed: VideoPlan, runDir: string,
    record: (bindings: GeneratedBinding[]) => Promise<void>,
    previous?: GeneratedBinding[]) => Promise<{status: 'ready' | 'awaiting-assets'; bindings: GeneratedBinding[]}>;
  validateAssets: (pack: PromptPack, timed: VideoPlan, bindings: GeneratedBinding[]) => Promise<void>;
  render: V4Deps['render']; probe: V4Deps['probe'];
  channel: V4Deps['channel']; voiceProvider: V4Deps['voiceProvider'];
  backgroundMusicPath: string; stage?: (name: string) => void;
  resume: boolean;
};

const rewriteCountSchema = z.object({rewriteCount: z.number().int().min(0).max(1)});
const renderedRecordSchema = z.object({
  engineVersion: z.literal('v5'), schemaVersion: z.literal(1),
  inputFingerprint: z.string().trim().min(1),
  sourceHashes: z.record(z.string(), z.string().trim().min(1)),
  audioHashes: z.record(z.string(), z.string().trim().min(1)),
  musicHash: z.string().trim().min(1),
  outputHash: z.string().trim().min(1),
  media: mediaInfoSchema, outputPath: z.string().trim().min(1),
});

function missingSceneIds(bindings: GeneratedBinding[]): SceneId[] {
  return VOICED_BEATS.filter(id => !bindings.some(binding => binding.sceneId === id && binding.approved));
}

async function loadRewriteCount(runDir: string): Promise<number> {
  const saved = await readCheckpoint<unknown>(join(runDir, 'rewrite-count.json'));
  if (saved === undefined) return 0;
  const parsed = rewriteCountSchema.safeParse(saved);
  if (!parsed.success) throw new Error('Malformed rewrite checkpoint. Start a fresh run.');
  return parsed.data.rewriteCount;
}

function stableRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

async function hashPaths(entries: {id: string; path: string}[]): Promise<Record<string, string>> {
  const hashed = await Promise.all(entries.map(async ({id, path}) => [id, await hashFile(path)] as const));
  return stableRecord(Object.fromEntries(hashed));
}

async function captureInputState(bindings: GeneratedBinding[], voiced: SynthesizeSceneVoicesResult,
  promptPack: PromptPack, musicPath: string) {
  const sourceHashes = await hashPaths(bindings.map(binding => ({id: binding.sceneId, path: binding.localPath})));
  const audioHashes = await hashPaths(voiced.manifest.scenes.map(scene => ({id: scene.sceneId, path: scene.localAudioPath})));
  const musicHash = await hashFile(musicPath);
  const inputFingerprint = createHash('sha256').update(JSON.stringify({
    sourceHashes, audioHashes, musicHash, promptPack,
    trims: bindings.map(binding => ({sceneId: binding.sceneId, sha256: binding.sha256, promptHash: binding.promptHash,
      trimStartSec: binding.trimStartSec, cropPosition: binding.cropPosition})),
  })).digest('hex');
  return {sourceHashes, audioHashes, musicHash, inputFingerprint};
}

async function maybeReuseRendered(runDir: string, outputPath: string, timing: V5TimingResult,
  state: Awaited<ReturnType<typeof captureInputState>>, probe: V5Deps['probe']): Promise<{
  outputPath: string;
  manifest: Record<string, unknown>;
} | undefined> {
  const saved = await readCheckpoint<unknown>(join(runDir, 'checkpoint-rendered.json'));
  const parsed = renderedRecordSchema.safeParse(saved);
  if (!parsed.success) return undefined;
  const record = parsed.data;
  if (record.inputFingerprint !== state.inputFingerprint || record.outputPath !== outputPath) return undefined;
  if (JSON.stringify(stableRecord(record.sourceHashes)) !== JSON.stringify(state.sourceHashes)) return undefined;
  if (JSON.stringify(stableRecord(record.audioHashes)) !== JSON.stringify(state.audioHashes)) return undefined;
  if (record.musicHash !== state.musicHash) return undefined;
  let outputHash: string;
  try {outputHash = await hashFile(outputPath);}
  catch {return undefined;}
  if (outputHash !== record.outputHash) return undefined;
  const media = await probe(outputPath);
  if (media.width !== 1080 || media.height !== 1920 || Math.abs(media.fps - 30) > 0.01 || media.durationSec > 30 ||
    Math.abs(media.durationSec - record.media.durationSec) > 0.01 ||
    Math.abs(media.durationSec - timing.actualDurationSec) > 0.1)
    return undefined;
  const manifest = await readCheckpoint<Record<string, unknown>>(join(runDir, 'generation-manifest.json'));
  if (!manifest || manifest.status !== 'rendered') return undefined;
  return {outputPath, manifest};
}

export async function createShortV5(topic: string, deps: V5Deps): Promise<V5Result> {
  const startedAt = new Date().toISOString();
  const {runId, runDir} = await deps.createRunDirectory(topic);
  const outputPath = join(runDir, 'output.mp4');
  const promptsPath = join(runDir, 'grok-prompts.json');
  let stage = 'brief';
  let brief: V5Brief | undefined;
  let pack: V5SelectedPackage | undefined;
  let plan: V5ContentPlan | undefined;
  let promptPack: PromptPack | undefined;
  let bindings: GeneratedBinding[] = [];
  let timing: V5TimingResult | undefined;
  let rewriteCount = await loadRewriteCount(runDir);
  let timingException: string | null = null;
  const save = (file: string, value: unknown) => deps.persistJson(join(runDir, file), value);
  const setStage = (value: string) => {stage = value; deps.stage?.(value);};
  const persistRewriteCount = async (count: number) => {
    rewriteCount = count;
    await save('rewrite-count.json', {rewriteCount: count});
    await writeCheckpoint(join(runDir, 'rewrite-count.json'), {rewriteCount: count});
  };
  const summary = (status: string) => ({
    schemaVersion: 1, engineVersion: 'v5' as const, runId, topic,
    topicId: brief?.topicId, visualStyle: brief?.visualStyle, status, stage,
    startedAt, finishedAt: new Date().toISOString(),
    facts: brief?.facts, factBoundaries: brief?.factBoundaries, package: pack,
    prompts: promptPack, bindings,
    targetDurationSec: {min: 25, max: 29, hardMax: 30}, timing, timingException, rewriteCount,
    requiredFramesByScene: timing?.requiredFramesByScene,
    title: plan?.title, description: plan?.description,
    metadataSeeds: brief ? {title: brief.titleSeed, description: brief.descriptionSeed} : undefined,
    spokenWordCount: plan ? countSpokenWords(`${plan.beats.map(b => b.spokenText).join(' ')} ${deps.channel.brand} ${deps.channel.signoff}`) : undefined,
    targetBeats: plan?.beats.map(({id, targetStartSec, targetEndSec}) => ({id, targetStartSec, targetEndSec})),
  });
  const saveTimedPlan = async (voiced: SynthesizeSceneVoicesResult) => {
    await save('timed-plan.json', {
      timedPlan: voiced.timedPlan, manifest: voiced.manifest,
      requiredFramesByScene: timing?.requiredFramesByScene, actualDurationSec: timing?.actualDurationSec,
      actualBeatStarts: timing?.actualBeatStarts, facts: brief?.facts, rewriteCount,
      planHash: promptPack?.planHash, visualStyle: brief?.visualStyle, bindings,
    });
  };
  const waitingResult = async (missing: SceneId[]): Promise<V5Result> => {
    setStage('awaiting-assets');
    const waiting = {...summary('awaiting-assets'), promptsPath, missingSceneIds: missing};
    await save('generation-manifest.json', waiting);
    await save('run.json', waiting);
    return {status: 'awaiting-assets', runId, runDir, manifestPath: join(runDir, 'generation-manifest.json'),
      promptsPath, missingSceneIds: missing};
  };
  try {
    setStage('brief');
    brief = await deps.loadBrief(topic);
    await save('brief.json', brief);
    setStage('package');
    const attempts: unknown[] = [];
    pack = await deps.package(brief, async value => {attempts.push(value); await save('package-attempts.json', attempts);});
    await save('package.json', pack);
    if (!await deps.approvePackage(pack)) throw new ContentHold(['Contradiction package not approved']);
    setStage('story');
    try {
      plan = await deps.story(brief, pack);
    } catch (error) {
      if (!(error instanceof V5StoryRevisionNeeded)) throw error;
      await persistRewriteCount(1);
      await save('rejected-story.json', {draft: error.draft, reasons: error.reasons});
      setStage('rewrite');
      plan = await deps.story(brief, pack, {previous: error.draft, feedback: error.reasons});
    }
    await save('content-plan.json', plan);
    if (!await deps.approveStory(plan)) throw new ContentHold(['Story or factual review declined']);
    const voicedPlan = () => attachChannelOutro(videoPlanFromV5(plan!), deps.channel.brand, deps.channel.signoff,
      {slowWhy: deps.voiceProvider !== 'elevenlabs'});
    setStage('voice');
    let voiced = await deps.synthesize(voicedPlan(), runDir);
    timing = evaluateV5Timing(voiced.timedPlan, voiced.manifest);
    await save('voice.json', voiced.manifest);
    await save('timing-attempt-0.json', timing);
    await saveTimedPlan(voiced);
    if (timing.needsRewrite && rewriteCount === 0) {
      await persistRewriteCount(1);
      setStage('rewrite');
      plan = await deps.story(brief, pack, {previous: plan, feedback: timing.gate.reasons});
      await save('content-plan.json', plan);
      if (!await deps.approveStory(plan)) throw new ContentHold(['Revised story not approved']);
      voiced = await deps.synthesize(voicedPlan(), runDir, voiced);
      timing = evaluateV5Timing(voiced.timedPlan, voiced.manifest);
      await save('voice.json', voiced.manifest);
      await save('timing-attempt-1.json', timing);
      await saveTimedPlan(voiced);
    }
    if (timing.gate.decision === 'hold' || timing.capacityReasons.length > 0 || timing.actualDurationSec > 30)
      throw new ContentHold(timing.gate.reasons);
    if (timing.gate.decision !== 'ready') {
      timingException = await deps.reviewTiming(timing);
      if (!timingException?.trim()) throw new ContentHold(timing.gate.reasons, 'revise');
    }
    setStage('prompts');
    try {
      promptPack = await deps.prompts(brief, plan, voiced.timedPlan);
    } catch (error) {
      if (error instanceof ContentHold && error.details !== undefined) await save('rejected-prompts.json', error.details);
      throw error;
    }
    if (!await deps.approvePrompts(promptPack)) {
      await save('rejected-prompts.json', promptPack);
      throw new ContentHold(['Grok prompts not approved'], 'hold', promptPack);
    }
    await deps.exportPrompts(runDir, promptPack, plan);
    await save('grok-prompts.json', promptPack);
    await saveTimedPlan(voiced);
    if (!deps.resume) return waitingResult([...VOICED_BEATS]);
    setStage('assets');
    const assetResult = await deps.assets(promptPack, voiced.timedPlan, runDir, async values => {
      bindings = values;
      await save('scene-assets.json', values);
    }, bindings);
    bindings = assetResult.bindings;
    await save('scene-assets.json', bindings);
    await saveTimedPlan(voiced);
    if (assetResult.status === 'awaiting-assets') return waitingResult(missingSceneIds(bindings));
    setStage('validate-assets');
    await deps.validateAssets(promptPack, voiced.timedPlan, bindings);
    setStage('resolved');
    const scenes = bindV5Scenes(voiced.timedPlan, voiced.manifest, promptPack, bindings);
    const video: ResolvedVideo = {engineVersion: 'v5', runId, title: plan.title, fps: 30, width: 1080, height: 1920,
      backgroundMusicPath: deps.backgroundMusicPath, scenes};
    await save('resolved.json', video);
    const inputState = await captureInputState(bindings, voiced, promptPack, deps.backgroundMusicPath);
    const reused = await maybeReuseRendered(runDir, outputPath, timing, inputState, deps.probe);
    if (reused) {
      await save('generation-manifest.json', reused.manifest);
      await save('run.json', reused.manifest);
      return {status: 'rendered', runId, runDir, manifestPath: join(runDir, 'generation-manifest.json'),
        outputPath: reused.outputPath};
    }
    await save('generation-manifest.json', summary('rendering'));
    setStage('render');
    await deps.render(video, outputPath);
    const afterState = await captureInputState(bindings, voiced, promptPack, deps.backgroundMusicPath);
    if (afterState.inputFingerprint !== inputState.inputFingerprint)
      throw new ContentHold(['Scene media or narration changed during render; not recording success']);
    setStage('verify-mp4');
    const media = await deps.probe(outputPath);
    if (media.durationSec > 30 || media.width !== 1080 || media.height !== 1920 || Math.abs(media.fps - 30) > 0.01 ||
      Math.abs(media.durationSec - timing.actualDurationSec) > 0.1)
      throw new ContentHold(['Encoded MP4 duration or format does not match the accepted timeline']);
    const outputHash = await hashFile(outputPath);
    const rendered = {...summary('rendered'), actualDurationSec: media.durationSec, media, outputPath,
      inputFingerprint: inputState.inputFingerprint, sourceHashes: inputState.sourceHashes,
      audioHashes: inputState.audioHashes, outputHash};
    await writeCheckpoint(join(runDir, 'checkpoint-rendered.json'), {
      engineVersion: 'v5', schemaVersion: 1, inputFingerprint: inputState.inputFingerprint,
      sourceHashes: inputState.sourceHashes, audioHashes: inputState.audioHashes, musicHash: inputState.musicHash,
      outputHash, media, outputPath,
    });
    await save('generation-manifest.json', rendered);
    await save('run.json', rendered);
    return {status: 'rendered', runId, runDir, manifestPath: join(runDir, 'generation-manifest.json'), outputPath};
  } catch (error) {
    const status = error instanceof ContentHold ? error.decision : 'failed';
    const failed = {...summary(status), error: {stage, message: error instanceof Error ? error.message : 'Generation failed',
      ...(error instanceof ProviderError ? {diagnostic: error.diagnostic} : {})}};
    await save('generation-manifest.json', failed);
    await save('run.json', failed);
    throw error;
  }
}
