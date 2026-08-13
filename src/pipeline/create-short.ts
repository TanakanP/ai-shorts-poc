import {join} from 'node:path';
import type {ResolvedScene, ResolvedVideo} from '../domain/resolved-video';
import type {VideoPlan} from '../domain/video-plan';
import type {ProviderDiagnostic} from '../domain/provider-error';

type RunStage = 'generation' | 'stock-resolution' | 'render';

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
  resolveSceneAssets: (plan: VideoPlan, runDir: string) => Promise<ResolvedScene[]>;
  renderShort: (video: ResolvedVideo, outputPath: string) => Promise<void>;
};

export type CreateShortResult = {
  runId: string;
  outputPath: string;
  planPath: string;
  resolvedPath: string;
};

export async function createShort(
  topic: string,
  deps: CreateShortDeps,
): Promise<CreateShortResult> {
  const startedAt = new Date().toISOString();
  const {runId, runDir} = await deps.createRunDirectory(topic);
  const planPath = join(runDir, 'plan.json');
  const resolvedPath = join(runDir, 'resolved.json');
  const outputPath = join(runDir, 'output.mp4');
  const runPath = join(runDir, 'run.json');
  let stage: RunStage = 'generation';
  let attribution:
    | Array<{sourcePageUrl: string; creatorName: string; creatorUrl: string}>
    | undefined;

  try {
    const plan = await deps.generateVideoPlan(topic);
    await deps.persistJson(planPath, plan);

    stage = 'stock-resolution';
    const resolvedScenes = await deps.resolveSceneAssets(plan, runDir);
    const resolvedVideo: ResolvedVideo = {
      runId,
      title: plan.title,
      fps: 30,
      width: 1080,
      height: 1920,
      scenes: resolvedScenes,
    };
    attribution = resolvedScenes.map(({sourcePageUrl, creatorName, creatorUrl}) => ({
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
      status: 'rendered',
      startedAt,
      finishedAt: new Date().toISOString(),
      attribution,
    });

    return {runId, outputPath, planPath, resolvedPath};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostic = error instanceof SafeStageError ? error.diagnostic : undefined;
    try {
      await deps.persistJson(runPath, {
        runId,
        topic,
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
