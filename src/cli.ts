import {writeFile} from 'node:fs/promises';
import {resolve as resolvePath} from 'node:path';
import {pathToFileURL} from 'node:url';
import {config as loadDotenv} from 'dotenv';
import {findEnvFile, loadConfig} from './config';
import {ProviderError} from './domain/provider-error';
import {
  hookCandidatesEnvelopeSchema,
  storyBeatsEnvelopeSchema,
} from './domain/video-plan';
import {generateHooks} from './generation/generate-hooks';
import {generateStory} from './generation/generate-story';
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
  const topic = args[0]?.trim() ?? '';
  const research = args.slice(1).join(' ').trim();
  if (!topic) {
    io.error('Usage: npm run generate -- "<topic>" ["<creative-brief>"]');
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
        io.log(`[1/4] Generated ${plan.beats.length}-scene plan`);
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
  } catch (cause) {
    io.error(`Failed during ${stage}. Run directory: ${runDir}`);
    if (stage === 'setup' && cause instanceof Error) {
      io.error(cause.message);
    }
    if (cause instanceof SafeStageError && cause.diagnostic?.detail) {
      io.error(cause.diagnostic.detail);
    }
    return 1;
  }
}

function createProductionDeps(research: string): CreateShortDeps {
  const config = loadConfig();
  const generateHookStructured = createOpenAIStructuredPlanGenerator(
    config.openAiApiKey,
    hookCandidatesEnvelopeSchema,
    'hook_candidates',
  );
  const generateStoryStructured = createOpenAIStructuredPlanGenerator(
    config.openAiApiKey,
    storyBeatsEnvelopeSchema,
    'story_beats',
  );
  const pexels = new PexelsClient(config.pexelsApiKey);
  const synthesize = createXaiSpeechSynthesizer(config.xaiApiKey);

  return {
    createRunDirectory,
    research,
    generateVideoPlan: (topic) =>
      generateVideoPlan(topic, {
        research,
        generateHooks: (nextTopic, creativeBrief) =>
          generateHooks(nextTopic, creativeBrief, {
            generateStructured: async (args) => {
              const parsed = await generateHookStructured(args);
              return hookCandidatesEnvelopeSchema.parse(parsed).hookCandidates;
            },
          }),
        generateStory: (input) =>
          generateStory(input, {
            generateStructured: async (args) => {
              const parsed = await generateStoryStructured(args);
              return storyBeatsEnvelopeSchema.parse(parsed).beats.map((beat) => ({
                ...beat,
                curiosityTarget: beat.curiosityTarget ?? undefined,
              }));
            },
          }),
      }),
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
    channel: {brand: config.channelBrand, signoff: config.channelSignoff},
    backgroundMusicPath: config.backgroundMusicPath,
  };
}

const entryPath = process.argv[1] ? pathToFileURL(resolvePath(process.argv[1])).href : undefined;
if (import.meta.url === entryPath) {
  const envPath = findEnvFile(process.cwd());
  loadDotenv(envPath ? {path: envPath, quiet: true} : {quiet: true});
  const argv = process.argv.slice(2);
  const research = argv.slice(1).join(' ').trim();
  void runCli(argv, () => createProductionDeps(research)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
