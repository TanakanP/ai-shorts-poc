import {join} from 'node:path';
import {CHANNEL_OUTRO_SCENE_ID} from '../captions/caption-segments';
import type {ResolvedScene, ResolvedVideo, StockScene} from '../domain/resolved-video';
import {videoPlanFromV3, type VideoPlan, type VideoPlanV3} from '../domain/video-plan';
import type {ProviderDiagnostic} from '../domain/provider-error';
import {totalHookScore} from '../generation/select-hook';
import type {SynthesizeSceneVoicesResult} from '../voice/synthesize-scene-voices';
import {attachChannelOutro} from './attach-channel-outro';
import {bookendLastScene} from './bookend-last-scene';

const HOOK_SELECTION_RULE = 'total>clarity>visualizability>stopScroll>id';

const countWords = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;

export function serializeVideoPlanV3(plan: VideoPlanV3) {
  return {
    ...plan,
    hookCandidates: plan.hookCandidates.map((candidate) => ({
      ...candidate,
      totalScore: totalHookScore(candidate.scores),
    })),
    selection: {
      selectedHookId: plan.selectedHookId,
      rule: HOOK_SELECTION_RULE,
    },
  };
}

type RunStage = 'generation' | 'voice' | 'stock-resolution' | 'render';

function storyScenes<T extends {id: string}>(scenes: T[]): T[] {
  return scenes.filter((scene) => scene.id !== CHANNEL_OUTRO_SCENE_ID);
}

export function buildRunSummary(args: {
  runId: string;
  topic: string;
  research: string;
  channel: {brand: string; signoff: string};
  plan: VideoPlanV3;
  timedPlan: VideoPlan;
  resolvedScenes: ResolvedScene[];
  status: 'rendered' | 'failed';
  startedAt: string;
  finishedAt: string;
  attribution?: Array<{sourcePageUrl: string; creatorName: string; creatorUrl: string}>;
  error?: {stage: RunStage; message: string} & Partial<ProviderDiagnostic>;
}) {
  const selectedHook = args.plan.hookCandidates.find(
    (candidate) => candidate.id === args.plan.selectedHookId,
  );
  const storyBeats = args.plan.beats;
  const storyResolved = storyScenes(args.resolvedScenes);

  return {
    runId: args.runId,
    formatVersion: 'retention-v3' as const,
    topic: args.topic,
    research: args.research,
    channel: args.channel,
    contentPattern: args.plan.contentPattern,
    selectedHookId: args.plan.selectedHookId,
    selectedHookTotalScore: selectedHook ? totalHookScore(selectedHook.scores) : 0,
    storyDurationSeconds: storyBeats.reduce((sum, beat) => sum + beat.durationSeconds, 0),
    finalDurationSeconds: args.timedPlan.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    beatCount: storyBeats.length,
    spokenWordCounts: storyBeats.map((beat) => countWords(beat.spokenText)),
    displayWordCounts: storyBeats.map((beat) => countWords(beat.displayText)),
    selectedSearchQueries: storyResolved.map((scene) => scene.selectedSearchQuery),
    status: args.status,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt,
    ...(args.attribution ? {attribution: args.attribution} : {}),
    ...(args.error ? {error: args.error} : {}),
  };
}

type RunDirectory = {runId: string; runDir: string};

export class SafeStageError extends Error {
  constructor(message: string, readonly diagnostic?: ProviderDiagnostic, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SafeStageError';
  }
}

export type CreateShortDeps = {
  createRunDirectory: (topic: string) => Promise<RunDirectory>;
  generateVideoPlan: (topic: string) => Promise<VideoPlanV3>;
  persistJson: (path: string, value: unknown) => Promise<void>;
  synthesizeSceneVoices: (plan: VideoPlan, runDir: string) => Promise<SynthesizeSceneVoicesResult>;
  resolveSceneAssets: (plan: VideoPlan, runDir: string) => Promise<StockScene[]>;
  renderShort: (video: ResolvedVideo, outputPath: string) => Promise<void>;
  channel: {brand: string; signoff: string};
  research: string;
  backgroundMusicPath: string;
};

export type CreateShortResult = {
  runId: string;
  outputPath: string;
  planPath: string;
  voicePath: string;
  resolvedPath: string;
};

export async function createShort(
  topic: string,
  deps: CreateShortDeps,
): Promise<CreateShortResult> {
  const startedAt = new Date().toISOString();
  const {runId, runDir} = await deps.createRunDirectory(topic);
  const planPath = join(runDir, 'plan.json');
  const voicePath = join(runDir, 'voice.json');
  const resolvedPath = join(runDir, 'resolved.json');
  const outputPath = join(runDir, 'output.mp4');
  const runPath = join(runDir, 'run.json');
  let stage: RunStage = 'generation';
  let attribution:
    | Array<{sourcePageUrl: string; creatorName: string; creatorUrl: string}>
    | undefined;

  try {
    const v3Plan = await deps.generateVideoPlan(topic);
    await deps.persistJson(planPath, serializeVideoPlanV3(v3Plan));
    const plan = attachChannelOutro(
      videoPlanFromV3(v3Plan),
      deps.channel.brand,
      deps.channel.signoff,
    );

    stage = 'voice';
    const {timedPlan, manifest} = await deps.synthesizeSceneVoices(plan, runDir);
    await deps.persistJson(voicePath, manifest);

    stage = 'stock-resolution';
    const stockScenes = await deps.resolveSceneAssets(timedPlan, runDir);
    const resolvedScenes = stockScenes.map((scene, index) => {
      const voice = manifest.scenes[index];
      if (!voice || voice.sceneId !== scene.id) {
        throw new Error(`Voice manifest missing scene ${scene.id}`);
      }
      if (voice.words.length === 0) {
        throw new Error(`Voice manifest has no words for scene ${scene.id}`);
      }
      return {
        ...scene,
        localAudioPath: voice.localAudioPath,
        audioDurationSeconds: voice.audioDurationSeconds,
        words: voice.words,
      };
    });
    const loopedScenes = bookendLastScene(resolvedScenes);
    const resolvedVideo: ResolvedVideo = {
      runId,
      title: plan.title,
      fps: 30,
      width: 1080,
      height: 1920,
      backgroundMusicPath: deps.backgroundMusicPath,
      scenes: loopedScenes,
    };
    attribution = loopedScenes.map(({sourcePageUrl, creatorName, creatorUrl}) => ({
      sourcePageUrl,
      creatorName,
      creatorUrl,
    }));
    await deps.persistJson(resolvedPath, resolvedVideo);

    stage = 'render';
    await deps.renderShort(resolvedVideo, outputPath);
    await deps.persistJson(runPath, buildRunSummary({
      runId,
      topic,
      research: deps.research,
      channel: deps.channel,
      plan: v3Plan,
      timedPlan,
      resolvedScenes: loopedScenes,
      status: 'rendered',
      startedAt,
      finishedAt: new Date().toISOString(),
      attribution,
    }));

    return {runId, outputPath, planPath, voicePath, resolvedPath};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostic = error instanceof SafeStageError ? error.diagnostic : undefined;
    try {
      await deps.persistJson(runPath, {
        runId,
        topic,
        research: deps.research,
        channel: deps.channel,
        status: 'failed',
        startedAt,
        finishedAt: new Date().toISOString(),
        error: {stage, message, ...diagnostic},
        ...(attribution ? {attribution} : {}),
      });
    } finally {
      throw error;
    }
  }
}
