import {writeFile} from 'node:fs/promises';
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
import {synthesizeSceneVoices} from './voice/synthesize-scene-voices';
import {createXaiSpeechSynthesizer} from './voice/xai-tts-client';

type CliIo = {
  log: (message: string) => void;
  error: (message: string) => void;
};

type CliStage = 'setup' | 'generation' | 'voice' | 'stock-resolution' | 'render';

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
        io.log(`[1/4] Generated ${plan.scenes.length}-scene plan`);
        return plan;
      },
      synthesizeSceneVoices: async (plan, directory) => {
        stage = 'voice';
        const voiced = await withSafeFailure('Voice synthesis failed', () =>
          deps.synthesizeSceneVoices(plan, directory),
        );
        const total = voiced.timedPlan.scenes.reduce(
          (sum, scene) => sum + scene.durationSeconds,
          0,
        );
        io.log(`[2/4] Synthesized voice (${Number(total.toFixed(1))}s)`);
        return voiced;
      },
      resolveSceneAssets: async (plan, directory) => {
        stage = 'stock-resolution';
        const scenes = await withSafeFailure('Stock clip resolution failed', () =>
          deps.resolveSceneAssets(plan, directory),
        );
        io.log(`[3/4] Resolved ${scenes.length} stock clips`);
        return scenes;
      },
      renderShort: async (video, outputPath) => {
        stage = 'render';
        await withSafeFailure('Video rendering failed', () => deps.renderShort(video, outputPath));
        io.log('[4/4] Rendered video');
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
  const synthesize = createXaiSpeechSynthesizer(config.xaiApiKey);

  return {
    createRunDirectory,
    generateVideoPlan: (topic) => generateVideoPlan(topic, {generateStructured}),
    persistJson,
    synthesizeSceneVoices: (plan, runDir) =>
      synthesizeSceneVoices(plan, runDir, config.xaiVoiceId, {
        synthesize,
        writeAudioFile: async (path, bytes) => {
          await writeFile(path, bytes);
        },
      }),
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
