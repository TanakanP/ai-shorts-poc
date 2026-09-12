import {join} from 'node:path';
import type {VideoPlan} from '../domain/video-plan';
import type {ResolvedVideo} from '../domain/resolved-video';
import {ProviderError} from '../domain/provider-error';
import type {SynthesizeSceneVoicesResult} from '../voice/synthesize-scene-voices';
import {attachChannelOutro} from './attach-channel-outro';
import {ContentHold, StoryRevisionNeeded, type TopicBrief, type SelectedPackage, type ProofBinding, type V4ContentPlan} from '../content/v4/contracts';
import {bindV4Scenes, videoPlanFromV4} from '../content/v4/adapter';
import {evaluateV4Timing, type TimingResult} from '../content/v4/timing';
import {countSpokenWords} from '../content/v4/rules';

export type V4Deps = {
  createRunDirectory: (topic: string) => Promise<{runId: string; runDir: string}>;
  persistJson: (path: string, value: unknown) => Promise<void>;
  loadBrief: (topic: string) => Promise<TopicBrief>;
  package: (brief: TopicBrief, record: (value: unknown) => Promise<void>) => Promise<SelectedPackage>;
  approvePackage: (pack: SelectedPackage) => Promise<boolean>;
  proof: (pack: SelectedPackage, brief: TopicBrief, runDir: string, record: (bindings: ProofBinding[]) => Promise<void>, previous?: ProofBinding[]) => Promise<ProofBinding[]>;
  story: (brief: TopicBrief, pack: SelectedPackage, proofs: ProofBinding[], revision?: {previous: V4ContentPlan; feedback: string[]}) => Promise<V4ContentPlan>;
  approveStory: (plan: V4ContentPlan) => Promise<boolean>;
  synthesize: (plan: VideoPlan, runDir: string, previous?: SynthesizeSceneVoicesResult) => Promise<SynthesizeSceneVoicesResult>;
  reviewTiming: (timing: TimingResult) => Promise<string | null>;
  render: (video: ResolvedVideo, outputPath: string) => Promise<void>;
  probe: (path: string) => Promise<{durationSec: number; width: number; height: number; fps: number}>;
  channel: {brand: string; signoff: string};
  voiceProvider: 'xai' | 'elevenlabs'; backgroundMusicPath: string;
  stage?: (name: string) => void;
};

export async function createShortV4(topic: string, deps: V4Deps) {
  const startedAt = new Date().toISOString();
  const {runId, runDir} = await deps.createRunDirectory(topic);
  const outputPath = join(runDir, 'output.mp4');
  let stage = 'brief';
  let brief: TopicBrief | undefined;
  let pack: SelectedPackage | undefined;
  let plan: V4ContentPlan | undefined;
  let proofs: ProofBinding[] = [];
  let timing: TimingResult | undefined;
  let rewriteCount = 0;
  let timingException: string | null = null;
  const save = (file: string, value: unknown) => deps.persistJson(join(runDir, file), value);
  const setStage = (value: string) => {stage = value; deps.stage?.(value);};
  const summary = (status: string) => ({schemaVersion: 1, engineVersion: 'v4', runId, topic,
    topicId: brief?.topicId, status, stage, startedAt, finishedAt: new Date().toISOString(),
    facts: brief?.facts, factBoundaries: brief?.factBoundaries, package: pack, proof: proofs,
    targetDurationSec: {min: 25, max: 29, hardMax: 30}, timing, timingException, rewriteCount,
    title: plan?.title, description: plan?.description,
    metadataSeeds: brief ? {title: brief.titleSeed, description: brief.descriptionSeed} : undefined,
    spokenWordCount: plan ? countSpokenWords(`${plan.beats.map(b => b.spokenText).join(' ')} ${deps.channel.brand} ${deps.channel.signoff}`) : undefined,
    targetBeats: plan?.beats.map(({id, targetStartSec, targetEndSec}) => ({id, targetStartSec, targetEndSec})),
  });
  try {
    setStage('brief');
    brief = await deps.loadBrief(topic);
    await save('brief.json', brief);
    setStage('package');
    const attempts: unknown[] = [];
    pack = await deps.package(brief, async value => {attempts.push(value); await save('package-attempts.json', attempts);});
    await save('package.json', pack);
    if (!await deps.approvePackage(pack)) throw new ContentHold(['Contradiction package not approved']);
    setStage('proof');
    proofs = await deps.proof(pack, brief, runDir, async values => {proofs = values; await save('proof.json', values);});
    await save('proof.json', proofs);
    // No model script, voice or render call until all five approved story assets exist.
    if (['contradiction', 'clue', 'mechanism', 'second_reveal', 'payoff'].some(id => !proofs.some(p => p.approved && p.beatIds.some(b => b === id))))
      throw new ContentHold(['Every story scene requires an approved proof asset']);
    setStage('story');
    try {
      plan = await deps.story(brief, pack, proofs);
    } catch (error) {
      if (!(error instanceof StoryRevisionNeeded)) throw error;
      rewriteCount = 1;
      await save('rejected-story.json', {draft: error.draft, reasons: error.reasons});
      setStage('rewrite');
      plan = await deps.story(brief, pack, proofs, {previous: error.draft, feedback: error.reasons});
    }
    await save('content-plan.json', plan);
    if (!await deps.approveStory(plan)) throw new ContentHold(['Story or factual review declined']);
    const voicedPlan = () => attachChannelOutro(videoPlanFromV4(plan!), deps.channel.brand, deps.channel.signoff,
      {slowWhy: deps.voiceProvider !== 'elevenlabs'});
    setStage('voice');
    let voiced = await deps.synthesize(voicedPlan(), runDir);
    timing = evaluateV4Timing(voiced.timedPlan, voiced.manifest);
    await save('voice.json', voiced.manifest);
    await save('timing-attempt-0.json', timing);
    if (timing.needsRewrite && rewriteCount === 0) {
      rewriteCount = 1;
      setStage('rewrite');
      plan = await deps.story(brief, pack, proofs, {previous: plan, feedback: timing.gate.reasons});
      await save('content-plan.json', plan);
      if (!await deps.approveStory(plan)) throw new ContentHold(['Revised story not approved']);
      voiced = await deps.synthesize(voicedPlan(), runDir, voiced);
      timing = evaluateV4Timing(voiced.timedPlan, voiced.manifest);
      await save('voice.json', voiced.manifest);
      await save('timing-attempt-1.json', timing);
    }
    if (timing.gate.decision === 'hold') throw new ContentHold(timing.gate.reasons);
    if (timing.gate.decision !== 'ready') {
      timingException = await deps.reviewTiming(timing);
      if (!timingException?.trim()) throw new ContentHold(timing.gate.reasons, 'revise');
    }
    setStage('asset-length');
    const scenes = bindV4Scenes(voiced.timedPlan, voiced.manifest, proofs);
    const video: ResolvedVideo = {engineVersion: 'v4', runId, title: plan.title, fps: 30, width: 1080, height: 1920,
      backgroundMusicPath: deps.backgroundMusicPath, scenes};
    await save('resolved.json', video);
    await save('generation-manifest.json', summary('rendering'));
    setStage('render');
    await deps.render(video, outputPath);
    setStage('verify-mp4');
    const media = await deps.probe(outputPath);
    if (media.durationSec > 30 || media.width !== 1080 || media.height !== 1920 || Math.abs(media.fps - 30) > 0.01 ||
      Math.abs(media.durationSec - timing.actualDurationSec) > 0.1)
      throw new ContentHold(['Encoded MP4 duration or format does not match the accepted timeline']);
    const rendered = {...summary('rendered'), actualDurationSec: media.durationSec, media, outputPath};
    await save('generation-manifest.json', rendered);
    await save('run.json', rendered);
    return {runId, outputPath, planPath: join(runDir, 'content-plan.json'), manifestPath: join(runDir, 'generation-manifest.json')};
  } catch (error) {
    const status = error instanceof ContentHold ? error.decision : 'failed';
    const failed = {...summary(status), error: {stage, message: error instanceof Error ? error.message : 'Generation failed',
      ...(error instanceof ProviderError ? {diagnostic: error.diagnostic} : {})}};
    await save('generation-manifest.json', failed);
    await save('run.json', failed);
    throw error;
  }
}
