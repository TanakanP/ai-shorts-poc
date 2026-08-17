import {join} from 'node:path';
import type {ResolvedVideo, StockScene} from '../domain/resolved-video';
import type {VideoPlan} from '../domain/video-plan';
import type {ProviderDiagnostic} from '../domain/provider-error';
import type {SynthesizeSceneVoicesResult} from '../voice/synthesize-scene-voices';
import {attachChannelOutro} from './attach-channel-outro';
import {bookendLastScene} from './bookend-last-scene';

type RunStage = 'generation' | 'voice' | 'stock-resolution' | 'render';

type RunDirectory = {runId: string; runDir: string};

export class SafeStageError extends Error {
  constructor(message: string, readonly diagnostic?: ProviderDiagnostic, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SafeStageError';
  }
}

export type CreateShortDeps = {
  createRunDirectory: (topic: string) => Promise<RunDirectory>;
  generateVideoPlan: (topic: string) => Promise<VideoPlan>;
  persistJson: (path: string, value: unknown) => Promise<void>;
  synthesizeSceneVoices: (plan: VideoPlan, runDir: string) => Promise<SynthesizeSceneVoicesResult>;
  resolveSceneAssets: (plan: VideoPlan, runDir: string) => Promise<StockScene[]>;
  renderShort: (video: ResolvedVideo, outputPath: string) => Promise<void>;
  channel: {brand: string; signoff: string};
  research: string;
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
    const plan = attachChannelOutro(
      await deps.generateVideoPlan(topic),
      deps.channel.brand,
      deps.channel.signoff,
    );
    await deps.persistJson(planPath, plan);

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
    await deps.persistJson(runPath, {
      runId,
      topic,
      research: deps.research,
      channel: deps.channel,
      status: 'rendered',
      startedAt,
      finishedAt: new Date().toISOString(),
      attribution,
    });

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
