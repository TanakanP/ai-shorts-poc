import {z} from 'zod';

export type AppConfig = {
  openAiApiKey: string;
  pexelsApiKey: string;
  xaiApiKey: string;
  xaiVoiceId: string;
};

const configSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  PEXELS_API_KEY: z.string().min(1),
  XAI_API_KEY: z.string().min(1),
  XAI_VOICE_ID: z.string().trim().min(1).regex(/^[a-z0-9-]+$/i).optional(),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config = configSchema.parse(env);

  return {
    openAiApiKey: config.OPENAI_API_KEY,
    pexelsApiKey: config.PEXELS_API_KEY,
    xaiApiKey: config.XAI_API_KEY,
    xaiVoiceId: config.XAI_VOICE_ID ?? 'eve',
  };
}
