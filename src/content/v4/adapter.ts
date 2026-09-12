import {ensureCaptionBars} from '../../captions/caption-segments';
import {sanitizeEmphasisWords} from '../../domain/video-plan';
import type {VideoPlan, BeatRole} from '../../domain/video-plan';
import type {ResolvedScene} from '../../domain/resolved-video';
import type {VoiceManifest} from '../../domain/voice';
import {ContentHold, VOICED_BEATS, type ProofBinding, type V4ContentPlan} from './contracts';

const roles: Record<typeof VOICED_BEATS[number], BeatRole> = {
  contradiction: 'hook', clue: 'context', mechanism: 'mechanism', second_reveal: 'curiosity-reset', payoff: 'payoff',
};
export function videoPlanFromV4(plan: V4ContentPlan): VideoPlan {
  return {topic: plan.topic, title: plan.title, viralAngle: plan.package.packagingClaim,
    scenes: VOICED_BEATS.map(id => {
      const beat = plan.beats.find(b => b.id === id)!;
      const shot = plan.package.shots.find(s => s.beatId === id)!;
      const spoken = ensureCaptionBars(beat.spokenText);
      return {id, role: roles[id], durationSeconds: beat.targetEndSec - (id === 'contradiction' ? 0 : beat.targetStartSec),
        text: spoken, spokenText: spoken, displayText: beat.displayText,
        emphasisWords: id === 'contradiction' ? openingEmphasis(beat.displayText, beat.emphasisWords) : sanitizeEmphasisWords(beat.displayText, beat.emphasisWords ?? []),
        beatPurpose: beat.newInformation, newInformation: beat.newInformation,
        visualIntent: shot.visualIntent, searchQueries: shot.searchQueries, requiredVisualObjects: [shot.visualIntent]};
    })};
}

export function bindV4Scenes(timedPlan: VideoPlan, manifest: VoiceManifest, proofs: ProofBinding[]): ResolvedScene[] {
  return timedPlan.scenes.map((scene, i) => {
    const beatId = scene.id === 'channel-outro' ? 'contradiction' : scene.id;
    const proof = proofs.find(p => p.beatIds.some(id => id === beatId) && p.approved);
    const voice = manifest.scenes.find(v => v.sceneId === scene.id);
    if (!proof || !voice?.words.length) throw new ContentHold([`Missing approved proof or aligned voice for ${scene.id}`]);
    if (proof.usableDurationSec + 0.001 < Math.round(scene.durationSeconds * 30) / 30 + (i === 0 ? 0 : 0.2))
      throw new ContentHold([`Approved footage is too short after TTS for ${scene.id}; review a longer interval or different clip`]);
    return {...scene, selectedSearchQuery: proof.selectedSearchQuery ?? '',
      sourcePageUrl: proof.sourcePageUrl ?? '', creatorName: proof.creatorName ?? 'Local proof', creatorUrl: proof.creatorUrl ?? '',
      localVideoPath: proof.localPath, videoTrimStartSec: proof.trimStartSec, videoCropPosition: proof.cropPosition,
      proofAssetId: proof.id, localAudioPath: voice.localAudioPath, audioDurationSeconds: voice.audioDurationSeconds, words: voice.words};
  });
}

// Old saved plans have no emphasis field. Keep their approved copy and highlight
// its last meaningful token instead of silently rendering an all-white title.
export function openingEmphasis(display: string, words: readonly string[] = []): string[] {
  const tokens = display.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
  const selected = sanitizeEmphasisWords(display, words)
    .find(word => tokens.some(token => token.toLowerCase() === word.toLowerCase()));
  if (selected) return [selected];
  const meaningful = tokens.filter(w => !/^(a|an|the|is|are|in|on|at|to|of|and|or|it|this|that)$/iu.test(w));
  return (meaningful.length ? meaningful : tokens).slice(-1);
}
