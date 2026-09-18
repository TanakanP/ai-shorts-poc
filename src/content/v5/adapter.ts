import {ensureCaptionBars} from '../../captions/caption-segments';
import {sanitizeEmphasisWords} from '../../domain/video-plan';
import type {VideoPlan, BeatRole} from '../../domain/video-plan';
import {VOICED_BEATS, type V5ContentPlan} from './contracts';
import {openingEmphasis} from '../v4/adapter';

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
