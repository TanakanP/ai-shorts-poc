import {basename, resolve, join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';
import type {AppConfig} from '../../config';
import {ProviderError} from '../../domain/provider-error';
import {loadConfig} from '../../config';
import {createProviders} from '../../providers';
import {createRunDirectory} from '../../pipeline/create-run-directory';
import {persistJson} from '../../pipeline/persist-json';
import {createShortV5, type V5Deps} from '../../pipeline/create-short-v5';
import {synthesizeSceneVoices} from '../../voice/synthesize-scene-voices';
import {renderShort} from '../../remotion/render-short';
import {
  ContentHold, VOICED_BEATS, interpretedBriefSchema, parseOrHold, promptPackGenerationSchema, promptPackSchema,
  v5PackageGenerationSchema, v5StoryGenerationSchema, type GeneratedBinding, type PromptPack,
} from './contracts';
import {loadV5Brief} from './brief';
import {planV5Package, planV5Story} from './plan';
import {generateVisualPrompts, formatVisualPrompts, promptFileBase} from './prompts';
import {reviewGeneratedAssets} from './asset-review';
import {availableSourceFrames, hashFile, requiredImportFrames} from './assets';
import {probeMedia} from '../v4/media';
import {
  V5_PROMPT_CONTRACT_VERSION, parseV5Resume, v5ResumeSettingsSchema, withV5Checkpoints, writeCheckpoint,
  readCheckpoint,
} from './checkpoints';
import type {VideoPlan} from '../../domain/video-plan';

function scriptModel(config: AppConfig): string {
  return config.scriptProvider === 'xai' ? config.xaiScriptModel : config.openAiScriptModel;
}

function voiceId(config: AppConfig): string {
  return config.voiceProvider === 'elevenlabs' ? config.elevenLabsVoiceId : config.xaiVoiceId;
}

async function resumeSettings(config: AppConfig) {
  return v5ResumeSettingsSchema.parse({
    scriptProvider: config.scriptProvider, scriptModel: scriptModel(config),
    voiceProvider: config.voiceProvider, voiceId: voiceId(config),
    elevenLabsModel: config.elevenLabsModel, channelBrand: config.channelBrand, channelSignoff: config.channelSignoff,
    musicContentHash: await hashFile(config.backgroundMusicPath),
    promptContractVersion: V5_PROMPT_CONTRACT_VERSION,
  });
}

async function validateGeneratedAssets(pack: PromptPack, timed: VideoPlan, bindings: GeneratedBinding[]): Promise<GeneratedBinding[]> {
  const prompts = parseOrHold(promptPackSchema, pack, 'Prompt pack is invalid');
  const seen = new Set<string>();
  for (const id of VOICED_BEATS) {
    const binding = bindings.find(item => item.sceneId === id && item.approved);
    if (!binding) throw new ContentHold([`Missing approved generated clip for ${id}`]);
    const scene = prompts.scenes.find(item => item.sceneId === id);
    if (!scene || binding.promptHash !== scene.promptHash)
      throw new ContentHold([`${id}: prompt hash does not match the approved prompt pack`]);
    let sha: string;
    try {sha = await hashFile(binding.localPath);}
    catch {throw new ContentHold([`${id}: approved media is missing or changed`]);}
    if (sha !== binding.sha256) throw new ContentHold([`${id}: file bytes changed since approval`]);
    if (seen.has(sha)) throw new ContentHold([`${id}: story clips must use distinct source files`]);
    seen.add(sha);
    if (availableSourceFrames(binding.media.durationSec, binding.trimStartSec) < requiredImportFrames(scene, timed))
      throw new ContentHold([`${id}: clip does not cover the reviewed scene interval`]);
  }
  return bindings;
}

export function createV5ProductionDeps(config: AppConfig, research: string,
  ask: (question: string) => Promise<string>, log: (value: string) => void): V5Deps {
  const providers = createProviders(config);
  const yes = async (question: string) => /^(y|yes)$/iu.test((await ask(`${question} [y/N] `)).trim());
  const outro = `${config.channelBrand}.`; // V5: no spoken CTA sign-off; the payoff loops into the hook
  return {
    channel: {brand: config.channelBrand, signoff: config.channelSignoff},
    voiceProvider: config.voiceProvider, backgroundMusicPath: config.backgroundMusicPath,
    createRunDirectory, persistJson, resume: false,
    stage: stage => log(`[v5] ${stage}`),
    loadBrief: topic => loadV5Brief(topic, research, config.contentBriefPath, {
      interpret: providers.structured(interpretedBriefSchema, 'v5_brief'),
      confirmFacts: async brief => {
        log(JSON.stringify(brief.facts, null, 2));
        return yes('Have you checked these claims against their linked sources?');
      },
    }),
    package: (brief, record) => planV5Package(brief, providers.structured(v5PackageGenerationSchema, 'v5_package'), record),
    approvePackage: async pack => {
      log(JSON.stringify({
        hook: pack.hooks.find(h => h.id === pack.selectedHookId), secondReveal: pack.secondReveal,
        score: pack.preflightScore, title: pack.title, description: pack.description,
      }, null, 2));
      return yes('Does this package create a clear contradiction without revealing the full mechanism?');
    },
    story: (brief, pack, revision) => planV5Story(brief, pack,
      providers.structured(v5StoryGenerationSchema, 'v5_story'), outro, revision),
    approveStory: async plan => {
      log(plan.beats.map(b => `${b.id}: ${b.spokenText || '[opening visual]'}\nNew: ${b.newInformation}`).join('\n'));
      return yes('Are the facts accurate, the explanation delayed, and the second reveal genuinely new?');
    },
    synthesize: (plan, runDir, previous) => synthesizeSceneVoices(plan, runDir, voiceId(config), {
      provider: config.voiceProvider, synthesize: providers.synthesize, deferTotalValidation: true, previous,
      writeAudioFile: writeFile,
    }),
    reviewTiming: async timing => {
      log(timing.gate.reasons.join('\n'));
      const reason = (await ask('Accept this timing exception for factual clarity? Enter a reason, or leave blank to hold: ')).trim();
      return reason || null;
    },
    prompts: (brief, plan, timed) => generateVisualPrompts(brief, plan, timed,
      providers.structured(promptPackGenerationSchema, 'v5_prompts')),
    approvePrompts: async pack => {
      log(JSON.stringify({
        visualStyle: pack.visualStyle, continuity: pack.continuity,
        scenes: pack.scenes.map(scene => ({sceneId: scene.sceneId, factIds: scene.factIds, visualIntent: scene.visualIntent,
          requiredFrames: scene.requiredFrames, imagePrompt: scene.imagePrompt, videoPrompt: scene.videoPrompt})),
      }, null, 2));
      return yes('Do these image and video prompts match the reviewed story, style and used intervals?');
    },
    exportPrompts: async (runDir, pack, plan) => {
      const base = promptFileBase(pack);
      await persistJson(join(runDir, `${base}.json`), pack);
      await writeFile(join(runDir, `${base}.md`), `${formatVisualPrompts(pack, plan)}\n`);
    },
    assets: (pack, timed, runDir, record, previous) => reviewGeneratedAssets(
      {runDir, prompts: pack, timedPlan: timed, previous: previous ?? [], fastMode: config.fastMode},
      {ask, log, probe: probeMedia, record},
    ),
    validateAssets: validateGeneratedAssets,
    render: renderShort, probe: probeMedia,
  };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function resumeCommand(runDir: string, briefPath?: string, fastMode = false): string {
  const brief = briefPath ? ` CONTENT_BRIEF_PATH=${shellQuote(briefPath)}` : '';
  return `CONTENT_ENGINE_VERSION=v5${brief}${fastMode ? ' FAST_MODE=true' : ''} npm run generate -- --resume ${shellQuote(runDir)}`;
}

export async function runV5Cli(args: string[]): Promise<number> {
  let terminal: ReturnType<typeof createInterface> | undefined;
  try {
    if (args[0] === '--resume' && (!args[1] || args.length !== 2))
      throw new Error('Usage: npm run generate -- --resume runs/<runId>');
    const resumeDir = args[0] === '--resume' ? args[1] : undefined;
    const runDir = resumeDir ? resolve(resumeDir) : undefined;
    const savedRaw = runDir ? await readCheckpoint<unknown>(join(runDir, 'resume.json')) : undefined;
    if (runDir && savedRaw === undefined)
      throw new Error('This run has no resumable V5 checkpoints. Start a fresh run.');
    const saved = savedRaw === undefined ? undefined : parseV5Resume(savedRaw);
    const topic = saved?.topic ?? args[0]?.trim();
    if (!topic) throw new Error('Usage: npm run generate -- "topic" "creative brief"');
    if (!process.stdin.isTTY)
      throw new Error('Run V5 in an interactive terminal to review factual claims, prompts and generated videos.');
    const config = loadConfig();
    terminal = createInterface({input: process.stdin, output: process.stdout});
    const research = saved?.research ?? args.slice(1).join(' ');
    const settings = await resumeSettings(config);
    const briefFileHash = config.contentBriefPath ? await hashFile(config.contentBriefPath) : '';
    if (saved && JSON.stringify({
      scriptProvider: saved.settings.scriptProvider, scriptModel: saved.settings.scriptModel,
      voiceProvider: saved.settings.voiceProvider, voiceId: saved.settings.voiceId,
      elevenLabsModel: saved.settings.elevenLabsModel, channelBrand: saved.settings.channelBrand,
      channelSignoff: saved.settings.channelSignoff, musicContentHash: saved.settings.musicContentHash,
      promptContractVersion: saved.settings.promptContractVersion,
    }) !== JSON.stringify({
      scriptProvider: settings.scriptProvider, scriptModel: settings.scriptModel,
      voiceProvider: settings.voiceProvider, voiceId: settings.voiceId,
      elevenLabsModel: settings.elevenLabsModel, channelBrand: settings.channelBrand,
      channelSignoff: settings.channelSignoff, musicContentHash: settings.musicContentHash,
      promptContractVersion: settings.promptContractVersion,
    }))
      throw new Error('Script provider/model, voice, channel, music or prompt-contract settings changed. Start a fresh run.');
    if (saved?.briefFileHash !== undefined && saved.briefFileHash !== briefFileHash)
      throw new Error('Brief file changed. Start a fresh run.');
    const run = runDir ? {runDir, runId: basename(runDir)} : await createRunDirectory(topic);
    if (!saved) {
      await writeCheckpoint(join(run.runDir, 'resume.json'), {
        schemaVersion: 1, engineVersion: 'v5', topic, research, settings, briefFileHash,
      });
    }
    console.log(`Resume this run after interruption:\n${resumeCommand(run.runDir, config.contentBriefPath, config.fastMode)}`);
    const production = createV5ProductionDeps(config, research, question => terminal!.question(question), console.log);
    const providers = createProviders(config);
    const deps = withV5Checkpoints({
      ...production,
      resume: Boolean(runDir),
      prompts: async (brief, plan, timed) => {
        const attempts: unknown[] = [];
        return generateVisualPrompts(brief, plan, timed, providers.structured(promptPackGenerationSchema, 'v5_prompts'),
          async value => {
            attempts.push(value);
            await persistJson(join(run.runDir, 'prompt-attempts.json'), attempts);
          });
      },
    }, run);
    const result = await createShortV5(topic, deps);
    if (result.status === 'awaiting-assets') {
      console.log(`Status: awaiting-assets`);
      console.log(`Missing videos: ${result.missingSceneIds.join(', ')}`);
      console.log(`Prompts: ${result.promptsPath}`);
      console.log(`Resume this run:\n${resumeCommand(result.runDir, config.contentBriefPath, config.fastMode)}`);
      return 0;
    }
    console.log(`Done: ${result.outputPath}\nManifest: ${result.manifestPath}`);
    return 0;
  } catch (error) {
    if (error instanceof ContentHold) {
      for (const reason of error.reasons) console.error(reason);
    } else {
      console.error(error instanceof Error ? error.message : 'V5 generation failed');
    }
    if (error instanceof ProviderError) console.error(JSON.stringify(error.diagnostic));
    return 1;
  } finally {terminal?.close();}
}
