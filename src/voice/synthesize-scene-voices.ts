import {join} from 'node:path';
import {CHANNEL_OUTRO_SCENE_ID, spokenSceneText} from '../captions/caption-segments';
import {narrationSource, type VideoPlan} from '../domain/video-plan';
import type {SceneVoice, VoiceManifest} from '../domain/voice';
import {assertVoicedTimeline, sceneDurationFromAudio} from './scene-duration';
import type {SpeechSynthesizer} from './xai-tts-client';
import {lengthenOutroWhy} from './lengthen-outro-why';

export type SynthesizeSceneVoicesDeps = {
  // V4 owns its frame-rounded final-duration policy and a single rewrite pass.
  deferTotalValidation?: boolean;
  previous?: SynthesizeSceneVoicesResult;
  provider?: 'xai' | 'elevenlabs';
  synthesize: SpeechSynthesizer;
  writeAudioFile: (path: string, bytes: Buffer) => Promise<void>;
};

export type SynthesizeSceneVoicesResult = {
  timedPlan: VideoPlan;
  manifest: VoiceManifest;
};

export async function synthesizeSceneVoices(
  plan: VideoPlan,
  runDir: string,
  voiceId: string,
  deps: SynthesizeSceneVoicesDeps,
): Promise<SynthesizeSceneVoicesResult> {
  const scenes: SceneVoice[] = [];
  const timedScenes = [];

  for (const [index, scene] of plan.scenes.entries()) {
    const previousScene = deps.previous?.timedPlan.scenes.find(s => s.id === scene.id);
    const previousVoice = deps.previous?.manifest.scenes.find(s => s.sceneId === scene.id);
    if (previousScene && previousVoice && previousVoice.voiceId === voiceId &&
      narrationSource(previousScene) === narrationSource(scene)) {
      scenes.push(previousVoice);
      timedScenes.push({...scene, durationSeconds: previousVoice.durationSeconds});
      continue;
    }
    let spoken = await deps.synthesize({text: spokenSceneText(narrationSource(scene)), voiceId});
    if (
      scene.id === CHANNEL_OUTRO_SCENE_ID
      && deps.provider !== 'elevenlabs'
      && /\bwhy{2,}\b/i.test(scene.text.split('|')[0] ?? '')
    ) {
      spoken = await lengthenOutroWhy(spoken);
    }
    const durationSeconds = sceneDurationFromAudio(spoken.durationSeconds);
    const localAudioPath = join(runDir, `voice-${String(index + 1).padStart(2, '0')}.mp3`);
    await deps.writeAudioFile(localAudioPath, spoken.audio);
    scenes.push({
      sceneId: scene.id,
      localAudioPath,
      voiceId,
      audioDurationSeconds: spoken.durationSeconds,
      durationSeconds,
      words: spoken.words,
    });
    timedScenes.push({...scene, durationSeconds});
  }

  if (!deps.deferTotalValidation) assertVoicedTimeline(timedScenes.map((scene) => scene.durationSeconds), deps.provider);

  return {
    timedPlan: {...plan, scenes: timedScenes},
    manifest: {voiceId, language: 'en', scenes},
  };
}
