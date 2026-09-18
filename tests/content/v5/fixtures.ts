import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {
  VOICED_BEATS, generatedBindingSchema, promptPackSchema, v5BriefSchema,
  type GeneratedBinding, type PromptPack, type SceneId, type V5ContentPlan, type V5Package,
} from '../../../src/content/v5/contracts';
import {evaluateV5Package} from '../../../src/content/v5/rules';
import {videoPlanFromV5} from '../../../src/content/v5/adapter';
import {hashFile} from '../../../src/content/v5/assets';
import {requiredSourceFrames} from '../../../src/content/v5/timing';
import {attachChannelOutro} from '../../../src/pipeline/attach-channel-outro';
import type {SynthesizeSceneVoicesResult} from '../../../src/voice/synthesize-scene-voices';

const keyFor = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const rawBrief = JSON.parse(readFileSync('tests/content/v4/straw-brief.fixture.json', 'utf8'));
delete rawBrief.localProof;
rawBrief.visualStyle = 'Clean 3D educational animation';
export const brief = v5BriefSchema.parse(rawBrief);
export const CHANNEL = {brand: 'Tell Me Why', signoff: 'Look closer every day.'};
export const okMedia = {durationSec: 6, width: 1080, height: 1920, fps: 30};

export function rawPackage(): V5Package {
  return {contradictionType: 'VISUAL_PARADOX', packagingClaim: 'Straight straw looks bent', firstFrameProof: 'Visible displacement at waterline',
    secondReveal: brief.facts[1].statement, secondRevealFactId: 'consequence',
    rubric: {visibleContradiction: 5, recognizability: 5, familiarity: 5, curiosityGap: 5, secondReveal: 5, payoff: 5, explainable: 5},
    rubricReasons: ['A reviewed refraction demonstration supports the package'],
    hooks: ['This straight straw looks broken in water.', 'Water makes this straight straw look snapped.',
      'This straw stays straight beneath that bend.', 'The straw only seems broken at the surface.',
      'That glass makes a straight straw look crooked.'].map((text, i) => ({
        id: `hook-${i}`, text, displayText: 'Straight. Looks broken.', score: 5 - i / 10, clarity: 5,
        contradictionClear: true, mechanismLeaked: false, reason: 'Visible contradiction', wordCountException: null})),
    shots: VOICED_BEATS.map(beatId => ({beatId, visualIntent: 'A straight straw visibly displaced by water',
      factIds: [beatId === 'second_reveal' || beatId === 'payoff' ? 'consequence' : 'mechanism']})),
    title: 'Generated title', description: 'Generated description'};
}
export const pack = () => evaluateV5Package(rawPackage(), brief);

export function contentPlan(): V5ContentPlan {
  const p = pack();
  const lines = ['', p.hooks[0].text, 'Look closely at the place where the water meets air.',
    'Light changes direction crossing that boundary, shifting where the underwater section appears.',
    'Lift the same straight straw out, and the apparent break disappears immediately.',
    'The straw stayed straight through the whole demonstration.'];
  const ids = ['paradox', ...VOICED_BEATS] as const;
  const targets = [0, 1, 3, 8.2, 14, 19.5, 24];
  return {version: 'v5', topicId: brief.topicId, topic: brief.topic, package: p, facts: brief.facts,
    factBoundaries: brief.factBoundaries, title: p.title, description: p.description,
    editorial: {factsSupported: true, distinctSecondReveal: true, earlyMechanismLeak: false, reasons: ['Distinct visible reversal']},
    beats: ids.map((id, i) => ({id, sceneId: id === 'paradox' ? 'contradiction' : id, spokenText: lines[i],
      displayText: i === 1 ? p.hooks[0].displayText : 'Watch the waterline',
      newInformation: i < 4 ? `Observation ${i}` : `Visible reversal ${i}`,
      factIds: [i >= 4 ? 'consequence' : 'mechanism'],
      targetStartSec: targets[i], targetEndSec: targets[i + 1]}))};
}

export function voiced(durations?: number[], plan = contentPlan()): SynthesizeSceneVoicesResult {
  const video = attachChannelOutro(videoPlanFromV5(plan), CHANNEL.brand, CHANNEL.signoff);
  const timedPlan = durations
    ? {...video, scenes: video.scenes.map((s, i) => ({...s, durationSeconds: durations[i] ?? s.durationSeconds}))}
    : video;
  return {timedPlan, manifest: {voiceId: 'eve', language: 'en', scenes: timedPlan.scenes.map(s => ({
    sceneId: s.id, localAudioPath: `/tmp/${s.id}.mp3`, voiceId: 'eve', audioDurationSeconds: s.durationSeconds - 0.3,
    durationSeconds: s.durationSeconds, words: [{text: 'Word', startMs: 0, endMs: 100}]}))}};
}

export function promptContinuity() {
  return 'Same clear glass, same straight straw, same waterline, consistent 9:16 educational lighting.';
}

export function generatedPromptScenes() {
  return VOICED_BEATS.map(sceneId => ({
    sceneId,
    imagePrompt: `Still first frame for ${sceneId}: a straight straw displaced at the waterline.`,
    videoPrompt: `From that still, animate ${sceneId} so the required action finishes inside the used interval.`,
  }));
}

export function promptPack(plan = contentPlan(), timedPlan = voiced(undefined, plan).timedPlan): PromptPack {
  const continuity = promptContinuity();
  const scenes = VOICED_BEATS.map(sceneId => {
    const index = timedPlan.scenes.findIndex(s => s.id === sceneId);
    const scene = timedPlan.scenes[index]!;
    const shot = plan.package.shots.find(s => s.beatId === sceneId)!;
    const requiredFrames = requiredSourceFrames(scene.durationSeconds, index);
    const generated = generatedPromptScenes().find(item => item.sceneId === sceneId)!;
    return {
      sceneId, factIds: shot.factIds, visualIntent: shot.visualIntent,
      imagePrompt: generated.imagePrompt, videoPrompt: generated.videoPrompt,
      durationSeconds: 6 as const, aspectRatio: '9:16' as const, requiredFrames,
      promptHash: keyFor({
        sceneId, imagePrompt: generated.imagePrompt, videoPrompt: generated.videoPrompt,
        visualStyle: brief.visualStyle, continuity, factIds: shot.factIds, visualIntent: shot.visualIntent,
        requiredFrames, durationSeconds: 6, aspectRatio: '9:16',
      }),
    };
  });
  return promptPackSchema.parse({
    schemaVersion: 1, engineVersion: 'v5', planHash: keyFor(plan), visualStyle: brief.visualStyle, continuity, scenes,
  });
}

export function binding(sceneId: SceneId, extra: Partial<GeneratedBinding> & Pick<GeneratedBinding, 'fileName' | 'localPath' | 'sha256'>): GeneratedBinding {
  const scene = promptPack().scenes.find(item => item.sceneId === sceneId)!;
  return generatedBindingSchema.parse({
    sceneId, kind: 'generated', provider: 'grok-imagine',
    fileName: extra.fileName, localPath: extra.localPath, sha256: extra.sha256, promptHash: extra.promptHash ?? scene.promptHash,
    trimStartSec: extra.trimStartSec ?? 0, cropPosition: extra.cropPosition ?? '50% 50%',
    media: extra.media ?? okMedia, observedAction: extra.observedAction ?? `Visible ${sceneId} action`, approved: true,
  });
}

export async function writeVoice(dir: string, result = voiced()): Promise<SynthesizeSceneVoicesResult> {
  return {timedPlan: result.timedPlan, manifest: {voiceId: result.manifest.voiceId, language: result.manifest.language,
    scenes: await Promise.all(result.manifest.scenes.map(async scene => {
      const localAudioPath = join(dir, `voice-${scene.sceneId}.mp3`);
      await writeFile(localAudioPath, `audio-${scene.sceneId}`);
      return {...scene, localAudioPath};
    }))}};
}

export async function writeBindings(dir: string, pack = promptPack(), names?: Partial<Record<SceneId, string>>): Promise<GeneratedBinding[]> {
  const bindings: GeneratedBinding[] = [];
  for (const scene of pack.scenes) {
    const fileName = names?.[scene.sceneId] ?? (scene.sceneId === 'mechanism' ? 'Ptko4.mp4' : `${scene.sceneId}.mp4`);
    const localPath = join(dir, fileName);
    await writeFile(localPath, `generated-clip-${scene.sceneId}`);
    bindings.push(binding(scene.sceneId, {fileName, localPath, sha256: await hashFile(localPath), promptHash: scene.promptHash}));
  }
  return bindings;
}
