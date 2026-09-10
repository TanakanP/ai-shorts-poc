import type {AppConfig} from './config';
import {hookCandidatesEnvelopeSchema, storyBeatsEnvelopeSchema} from './domain/video-plan';
import {createOpenAIStructuredPlanGenerator, createXaiStructuredPlanGenerator} from './generation/generate-video-plan';
import {createXaiSpeechSynthesizer} from './voice/xai-tts-client';
import {createElevenLabsSpeechSynthesizer} from './voice/elevenlabs-tts-client';

export function createProviders(config: AppConfig) {
  const script = (schema: typeof hookCandidatesEnvelopeSchema | typeof storyBeatsEnvelopeSchema, name: string) =>
    config.scriptProvider === 'xai'
      ? createXaiStructuredPlanGenerator(config.xaiApiKey, schema, name, config.xaiScriptModel)
      : createOpenAIStructuredPlanGenerator(config.openAiApiKey, schema, name);
  return {
    generateHookStructured: script(hookCandidatesEnvelopeSchema, 'hook_candidates'),
    generateStoryStructured: script(storyBeatsEnvelopeSchema, 'story_beats'),
    synthesize: config.voiceProvider === 'elevenlabs'
      ? createElevenLabsSpeechSynthesizer(config.elevenLabsApiKey, config.elevenLabsModel)
      : createXaiSpeechSynthesizer(config.xaiApiKey),
    voiceId: config.voiceProvider === 'elevenlabs' ? config.elevenLabsVoiceId : config.xaiVoiceId,
  };
}
