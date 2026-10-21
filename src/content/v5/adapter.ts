import {ensureCaptionBars} from '../../captions/caption-segments';
import {sanitizeEmphasisWords} from '../../domain/video-plan';
import type {VideoPlan, BeatRole} from '../../domain/video-plan';
import type {ResolvedScene} from '../../domain/resolved-video';
import type {VoiceManifest} from '../../domain/voice';
import {openingEmphasis} from '../v4/adapter';
import {
  ContentHold, generatedBindingSchema, parseOrHold, promptPackSchema, VOICED_BEATS, type GeneratedBinding,
  type PromptPack, type SceneId, type V5ContentPlan,
} from './contracts';
import {requiredSourceFrames} from './timing';

/** Visual cut cadence for V5: each 6s generated clip is shown as 2-3s punch-in segments. */
export const V5_CUT_INTERVAL_SEC = 2.5;

const roles: Record<typeof VOICED_BEATS[number], BeatRole> = {
  contradiction: 'hook', clue: 'context', mechanism: 'mechanism', second_reveal: 'curiosity-reset', payoff: 'payoff',
};

export function videoPlanFromV5(plan: V5ContentPlan): VideoPlan {
  return {topic: plan.topic, title: plan.title, viralAngle: plan.package.packagingClaim,
    scenes: VOICED_BEATS.map(id => {
      const beat = plan.beats.find(b => b.id === id)!;
      const shot = plan.package.shots.find(s => s.beatId === id)!;
      const spoken = ensureCaptionBars(beat.spokenText);
      return {id, role: roles[id], durationSeconds: beat.targetEndSec - (id === 'contradiction' ? 0 : beat.targetStartSec),
        text: spoken, spokenText: spoken, displayText: beat.displayText,
        emphasisWords: id === 'contradiction' ? openingEmphasis(beat.displayText, beat.emphasisWords) : sanitizeEmphasisWords(beat.displayText, beat.emphasisWords ?? []),
        beatPurpose: beat.newInformation, newInformation: beat.newInformation,
        visualIntent: shot.visualIntent, searchQueries: [], requiredVisualObjects: [shot.visualIntent]};
    })};
}

export function bindV5Scenes(
  timedPlan: VideoPlan, manifest: VoiceManifest, prompts: PromptPack, bindings: GeneratedBinding[],
): ResolvedScene[] {
  const pack = parseOrHold(promptPackSchema, prompts, 'Prompt pack is invalid');
  const approved = bindings.map(binding => parseOrHold(generatedBindingSchema, binding,
    `${typeof binding === 'object' && binding && 'sceneId' in binding ? String(binding.sceneId) : 'scene'}: generated binding is invalid`));
  const byScene = new Map<SceneId, GeneratedBinding>();
  const hashes = new Set<string>();
  for (const id of VOICED_BEATS) {
    const matches = approved.filter(binding => binding.sceneId === id && binding.approved);
    if (matches.length !== 1) {
      throw new ContentHold([matches.length
        ? `${id}: multiple generated bindings` : `Missing approved generated clip for ${id}`]);
    }
    const binding = matches[0];
    if (!binding) throw new ContentHold([`Missing approved generated clip for ${id}`]);
    const scene = pack.scenes.find(item => item.sceneId === id);
    if (!scene || binding.promptHash !== scene.promptHash)
      throw new ContentHold([`${id}: prompt hash does not match the approved prompt pack`]);
    if (binding.provider !== (pack.workflow === 'gemini-flow' ? 'google-flow' : 'grok-imagine'))
      throw new ContentHold([`${id}: generated media provider does not match the prompt workflow`]);
    if (hashes.has(binding.sha256))
      throw new ContentHold([`${id}: story clips must use distinct source files`]);
    hashes.add(binding.sha256);
    byScene.set(id, binding);
  }
  return timedPlan.scenes.map((scene, index) => {
    const voice = manifest.scenes.find(item => item.sceneId === scene.id);
    if (!voice?.words.length) throw new ContentHold([`Missing aligned voice for ${scene.id}`]);
    const storyId = scene.id === 'channel-outro' ? 'contradiction' : scene.id;
    const binding = byScene.get(storyId as SceneId);
    if (!binding) throw new ContentHold([`Missing approved generated clip for ${scene.id}`]);
    const availableFrames = Math.floor((binding.media.durationSec - binding.trimStartSec) * 30 + 1e-6);
    if (availableFrames < requiredSourceFrames(scene.durationSeconds, index)) {
      throw new ContentHold([`${scene.id}: clip does not cover the reviewed scene interval`]);
    }
    return {
      ...scene, selectedSearchQuery: '', sourcePageUrl: '', creatorName: 'Owner-generated animation', creatorUrl: '',
      localVideoPath: binding.localPath, videoTrimStartSec: binding.trimStartSec, videoCropPosition: binding.cropPosition,
      disableVideoZoom: true, cutIntervalSec: V5_CUT_INTERVAL_SEC,
      generatedAsset: {
        provider: binding.provider, sceneId: binding.sceneId, sha256: binding.sha256, promptHash: binding.promptHash,
      },
      localAudioPath: voice.localAudioPath, audioDurationSeconds: voice.audioDurationSeconds, words: voice.words,
    };
  });
}
