import {resolve as resolvePath} from 'node:path';
import {pathToFileURL} from 'node:url';
import {config as loadDotenv} from 'dotenv';
import {loadConfig} from './config';
import {ProviderError} from './domain/provider-error';
import {
  createOpenAIStructuredPlanGenerator,
  generateVideoPlan,
} from './generation/generate-video-plan';
import {createRunDirectory} from './pipeline/create-run-directory';
import {
  createShort,
  SafeStageError,
  type CreateShortDeps,
} from './pipeline/create-short';
import {persistJson} from './pipeline/persist-json';
import {renderShort} from './remotion/render-short';
import {downloadFile} from './stock/download-file';
import {PexelsClient} from './stock/pexels-client';
import {resolveSceneAssets} from './stock/resolve-scene-assets';

type CliIo = {
  log: (message: string) => void;
  error: (message: string) => void;
};

type CliStage = 'setup' | 'generation' | 'stock-resolution' | 'render';

const consoleIo: CliIo = {
  log: (message) => console.log(message),
  error: (message) => console.error(message),
};

async function withSafeFailure<T>(
  message: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (cause) {
    throw new SafeStageError(
      message,
      cause instanceof ProviderError ? cause.diagnostic : undefined,
      {cause},
    );
  }
}

export async function runCli(
  args: string[],
  getDeps: () => CreateShortDeps,
  io: CliIo = consoleIo,
): Promise<number> {
  const topic = args.join(' ').trim();
  if (!topic) {
    io.error('Usage: npm run generate -- "<topic>"');
    return 1;
  }

  let stage: CliStage = 'setup';
  let runDir = 'not created';

  try {
    const deps = getDeps();
    io.log(`Creating short: ${topic}`);

    const result = await createShort(topic, {
      ...deps,
      createRunDirectory: async (runTopic) => {
        const run = await deps.createRunDirectory(runTopic);
        runDir = run.runDir;
        return run;
      },
      generateVideoPlan: async (runTopic) => {
        stage = 'generation';
        const plan = await withSafeFailure('Video plan generation failed', () =>
          deps.generateVideoPlan(runTopic),
        );
        const duration = plan.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
        io.log(`[1/3] Generated ${plan.scenes.length}-scene plan (${duration}s)`);
        return plan;
      },
      resolveSceneAssets: async (plan, directory) => {
        stage = 'stock-resolution';
        const scenes = await withSafeFailure('Stock clip resolution failed', () =>
          deps.resolveSceneAssets(plan, directory),
        );
        io.log(`[2/3] Resolved ${scenes.length} stock clips`);
        return scenes;
      },
      renderShort: async (video, outputPath) => {
        stage = 'render';
        await withSafeFailure('Video rendering failed', () => deps.renderShort(video, outputPath));
        io.log('[3/3] Rendered video');
      },
    });

    io.log(`Done: ${result.outputPath}`);
    return 0;
  } catch {
    io.error(`Failed during ${stage}. Run directory: ${runDir}`);
    return 1;
  }
}

function createProductionDeps(): CreateShortDeps {
  const config = loadConfig();
  const generateStructured = createOpenAIStructuredPlanGenerator(config.openAiApiKey);
  const pexels = new PexelsClient(config.pexelsApiKey);

  return {
    createRunDirectory,
    generateVideoPlan: (topic) => generateVideoPlan(topic, {generateStructured}),
    persistJson,
    synthesizeSceneVoices: async () => {
      throw new Error('Voice synthesis is not wired');
    },
    resolveSceneAssets: (plan, runDir) =>
      resolveSceneAssets(plan, runDir, {
        searchVideos: (query, options) => pexels.searchVideos(query, options),
        download: downloadFile,
      }),
    renderShort,
  };
}

const entryPath = process.argv[1] ? pathToFileURL(resolvePath(process.argv[1])).href : undefined;
if (import.meta.url === entryPath) {
  loadDotenv({quiet: true});
  void runCli(process.argv.slice(2), createProductionDeps).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
