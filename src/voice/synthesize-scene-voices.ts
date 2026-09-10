import {join} from 'node:path';
import {CHANNEL_OUTRO_SCENE_ID, spokenSceneText} from '../captions/caption-segments';
import {narrationSource, type VideoPlan} from '../domain/video-plan';
import type {SceneVoice, VoiceManifest} from '../domain/voice';
import {assertVoicedTimeline, sceneDurationFromAudio} from './scene-duration';
import type {SpeechSynthesizer} from './xai-tts-client';
import {lengthenOutroWhy} from './lengthen-outro-why';

export type SynthesizeSceneVoicesDeps = {
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
    let spoken = await deps.synthesize({text: spokenSceneText(narrationSource(scene)), voiceId});
    if (scene.id === CHANNEL_OUTRO_SCENE_ID && /\bwhy{2,}\b/i.test(scene.text.split('|')[0] ?? '')) {
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

  assertVoicedTimeline(timedScenes.map((scene) => scene.durationSeconds), deps.provider);

  return {
    timedPlan: {...plan, scenes: timedScenes},
    manifest: {voiceId, language: 'en', scenes},
  };
}
