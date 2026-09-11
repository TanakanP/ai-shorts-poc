import type {AppConfig} from './config';
import type {ZodType} from 'zod';
import {hookCandidatesEnvelopeSchema, storyBeatsEnvelopeSchema} from './domain/video-plan';
import {createOpenAIStructuredPlanGenerator, createXaiStructuredPlanGenerator} from './generation/generate-video-plan';
import {createXaiSpeechSynthesizer} from './voice/xai-tts-client';
import {createElevenLabsSpeechSynthesizer} from './voice/elevenlabs-tts-client';

export function createProviders(config: AppConfig) {
  const script = (schema: ZodType, name: string) =>
    config.scriptProvider === 'xai'
      ? createXaiStructuredPlanGenerator(config.xaiApiKey, schema, name, config.xaiScriptModel)
      : createOpenAIStructuredPlanGenerator(config.openAiApiKey, schema, name);
  return {
    structured: script,
    generateHookStructured: script(hookCandidatesEnvelopeSchema, 'hook_candidates'),
    generateStoryStructured: script(storyBeatsEnvelopeSchema, 'story_beats'),
    synthesize: config.voiceProvider === 'elevenlabs'
      ? createElevenLabsSpeechSynthesizer(config.elevenLabsApiKey, config.elevenLabsModel)
      : createXaiSpeechSynthesizer(config.xaiApiKey),
    voiceId: config.voiceProvider === 'elevenlabs' ? config.elevenLabsVoiceId : config.xaiVoiceId,
  };
}
