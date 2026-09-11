import type {VideoPlan} from '../../domain/video-plan';
import type {VoiceManifest} from '../../domain/voice';
import type {GateResult} from './contracts';

export type TimingResult = {
  gate: GateResult; needsRewrite: boolean; actualDurationSec: number;
  actualBeatStarts: Record<string, number>;
};
export function evaluateV4Timing(plan: VideoPlan, voice: VoiceManifest, fps = 30): TimingResult {
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('Positive fps required');
  let frame = 0;
  const actualBeatStarts: Record<string, number> = {};
  const reasons: string[] = [];
  for (const scene of plan.scenes) {
    if (!Number.isFinite(scene.durationSeconds) || scene.durationSeconds <= 0) throw new Error('Invalid scene duration');
    const audio = voice.scenes.find(s => s.sceneId === scene.id);
    if (!audio?.words.length) throw new Error(`No word alignment for ${scene.id}`);
    if (audio.words.some((w, i) => !Number.isFinite(w.startMs) || !Number.isFinite(w.endMs) || w.startMs < 0 ||
      w.endMs < w.startMs || w.endMs > audio.audioDurationSeconds * 1000 + 100 ||
      (i > 0 && w.startMs < audio.words[i - 1].startMs))) throw new Error(`Invalid word alignment for ${scene.id}`);
    actualBeatStarts[scene.id] = frame / fps + audio.words[0].startMs / 1000;
    frame += Math.round(scene.durationSeconds * fps);
  }
  const actualDurationSec = frame / fps;
  if (actualDurationSec > 29) reasons.push(`Final timeline ${actualDurationSec.toFixed(3)}s exceeds 29s target`);
  if (actualDurationSec < 25) reasons.push(`Final timeline ${actualDurationSec.toFixed(3)}s is below target; inspect missing proof, do not pad`);
  if (actualDurationSec < 23) reasons.push('Under 23s: inspect whether meaningful proof or explanation is missing');
  const mechanism = actualBeatStarts.mechanism;
  const reset = actualBeatStarts.second_reveal;
  if (mechanism === undefined || mechanism < 7) reasons.push('Mechanism starts before 7s or is missing');
  if (reset === undefined || reset < 14 || reset > 21) reasons.push('Second reveal must start between 14s and 21s');
  return {actualDurationSec, actualBeatStarts,
    needsRewrite: actualDurationSec > 29 || mechanism === undefined || mechanism < 7 || reset === undefined || reset < 14 || reset > 21,
    gate: {decision: actualDurationSec > 30 ? 'hold' : reasons.length ? 'revise' : 'ready', reasons}};
}
