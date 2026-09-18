import type {VideoPlan} from '../../domain/video-plan';
import type {VoiceManifest} from '../../domain/voice';
import {SCENE_FADE_FRAMES} from '../../remotion/Scene';
import {evaluateV4Timing, type TimingResult} from '../v4/timing';

const SIX_SECOND_SOURCE_SECONDS = 6;

export type V5TimingResult = TimingResult & {
  capacityReasons: string[]; requiredFramesByScene: Record<string, number>;
};

export function requiredSourceFrames(seconds: number, index: number, fps = 30): number {
  return Math.round(seconds * fps) + (index === 0 ? 0 : SCENE_FADE_FRAMES);
}

export function evaluateV5Timing(plan: VideoPlan, voice: VoiceManifest, fps = 30): V5TimingResult {
  const base = evaluateV4Timing(plan, voice, fps);
  const sourceFrames = Math.round(SIX_SECOND_SOURCE_SECONDS * fps);
  const requiredFramesByScene: Record<string, number> = {};
  const capacityReasons: string[] = [];
  let storyOverCapacity = false;
  for (const [index, scene] of plan.scenes.entries()) {
    const required = requiredSourceFrames(scene.durationSeconds, index, fps);
    requiredFramesByScene[scene.id] = required;
    if (required <= sourceFrames) continue;
    if (scene.id === 'channel-outro') {
      capacityReasons.push(
        `${scene.id}: required ${required} frames exceed six-second source capacity (${sourceFrames}); shorten the channel sign-off — story text cannot fix this`);
    } else {
      storyOverCapacity = true;
      capacityReasons.push(
        `${scene.id}: required ${required} frames exceed six-second source capacity (${sourceFrames})`);
    }
  }
  return {
    ...base,
    needsRewrite: base.needsRewrite || storyOverCapacity,
    capacityReasons,
    requiredFramesByScene,
    gate: {
      decision: capacityReasons.length ? 'hold' : base.gate.decision,
      reasons: [...base.gate.reasons, ...capacityReasons],
    },
  };
}
