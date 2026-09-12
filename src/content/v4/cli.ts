import {writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';
import type {AppConfig} from '../../config';
import {ProviderError} from '../../domain/provider-error';
import {loadConfig} from '../../config';
import {createProviders} from '../../providers';
import {createRunDirectory} from '../../pipeline/create-run-directory';
import {persistJson} from '../../pipeline/persist-json';
import {createShortV4, type V4Deps} from '../../pipeline/create-short-v4';
import {PexelsClient} from '../../stock/pexels-client';
import {downloadFile} from '../../stock/download-file';
import {synthesizeSceneVoices} from '../../voice/synthesize-scene-voices';
import {renderShort} from '../../remotion/render-short';
import {ContentHold, interpretedBriefSchema, packageSchema, storySchema} from './contracts';
import {loadV4Brief} from './brief';
import {planV4Package, planV4Story} from './plan';
import {resolveV4Proof} from './proof';
import {probeMedia} from './media';

export function createV4ProductionDeps(config: AppConfig, research: string,
  ask: (question: string) => Promise<string>, log: (value: string) => void): V4Deps {
  const providers = createProviders(config);
  const pexels = new PexelsClient(config.pexelsApiKey);
  const yes = async (question: string) => /^(y|yes)$/iu.test((await ask(`${question} [y/N] `)).trim());
  const outro = `${config.channelBrand}. ${config.channelSignoff}`;
  return {
    channel: {brand: config.channelBrand, signoff: config.channelSignoff},
    voiceProvider: config.voiceProvider, backgroundMusicPath: config.backgroundMusicPath,
    createRunDirectory, persistJson,
    stage: stage => log(`[v4] ${stage}`),
    loadBrief: topic => loadV4Brief(topic, research, config.contentBriefPath, {
      interpret: providers.structured(interpretedBriefSchema, 'v4_brief'),
      confirmFacts: async brief => {log(JSON.stringify(brief.facts, null, 2)); return yes('Have you checked these claims against their linked sources?');},
    }),
    package: (brief, record) => planV4Package(brief, providers.structured(packageSchema, 'v4_package'), record),
    approvePackage: async pack => {
      log(JSON.stringify({hook: pack.hooks.find(h => h.id === pack.selectedHookId), proof: pack.firstFrameProof,
        secondReveal: pack.secondReveal, score: pack.preflightScore, title: pack.title, description: pack.description}, null, 2));
      return yes('Does this package create a clear contradiction without revealing the full mechanism?');
    },
    proof: (pack, brief, dir, record) => resolveV4Proof(pack, brief, dir, {
      searchVideos: (q, options) => pexels.searchVideos(q, options), download: downloadFile, record,
      chooseView: async (shot, path, duration, defaults) => {
        log(`${shot.beatId}: ${shot.visualIntent}\nSource file: ${path} (${duration.toFixed(1)}s)`);
        const start = await ask(`Proof start in seconds [${defaults.start}]: `);
        const crop = await ask(`Crop position x% y% [${defaults.crop}]: `);
        return {start: start.trim() ? Number(start) : defaults.start, crop: crop.trim() || defaults.crop};
      },
      review: async (shot, previews, candidate) => {
        log(`Review portrait still: ${previews.stillPath}\nReview motion: ${previews.previewPath}\nSource: ${candidate.source}\nRequired: ${shot.visualIntent}`);
        const answer = (await ask('Does this exact crop show the required object/action honestly? [y/n/q] ')).trim().toLowerCase();
        if (answer === 'q') throw new ContentHold(['Proof review stopped']);
        if (!['y', 'yes'].includes(answer)) return {approved: false, observedAction: ''};
        const observedAction = (await ask('Briefly describe what is visibly demonstrated: ')).trim();
        return {approved: Boolean(observedAction), observedAction};
      },
    }),
    story: (brief, pack, proof, revision) => planV4Story(brief, pack, proof,
      providers.structured(storySchema, 'v4_story'), outro, revision),
    approveStory: async plan => {
      log(plan.beats.map(b => `${b.id}: ${b.spokenText || '[opening visual]'}\nNew: ${b.newInformation}`).join('\n'));
      return yes('Are the facts accurate, the explanation delayed, and the second reveal genuinely new?');
    },
    synthesize: (plan, runDir, previous) => synthesizeSceneVoices(plan, runDir, providers.voiceId, {
      provider: config.voiceProvider, synthesize: providers.synthesize, deferTotalValidation: true, previous,
      writeAudioFile: writeFile,
    }),
    reviewTiming: async timing => {
      log(timing.gate.reasons.join('\n'));
      const reason = (await ask('Accept this timing exception for factual clarity? Enter a reason, or leave blank to hold: ')).trim();
      return reason || null;
    },
    render: renderShort, probe: probeMedia,
  };
}

export async function runV4Cli(args: string[]): Promise<number> {
  let terminal: ReturnType<typeof createInterface> | undefined;
  try {
    const topic = args[0]?.trim();
    if (!topic) throw new Error('Usage: npm run generate -- "topic" "creative brief"');
    if (!process.stdin.isTTY) throw new Error('Run V4 in an interactive terminal to review factual claims and proof footage.');
    const config = loadConfig();
    terminal = createInterface({input: process.stdin, output: process.stdout});
    const deps = createV4ProductionDeps(config, args.slice(1).join(' '), question => terminal!.question(question), console.log);
    const result = await createShortV4(topic, deps);
    console.log(`Done: ${result.outputPath}\nManifest: ${result.manifestPath}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'V4 generation failed');
    if (error instanceof ProviderError) console.error(JSON.stringify(error.diagnostic));
    return 1;
  } finally {terminal?.close();}
}
