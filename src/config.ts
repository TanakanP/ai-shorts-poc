import {z} from 'zod';

export type AppConfig = {
  openAiApiKey: string;
  pexelsApiKey: string;
};

const configSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  PEXELS_API_KEY: z.string().min(1),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config = configSchema.parse(env);

  return {
    openAiApiKey: config.OPENAI_API_KEY,
    pexelsApiKey: config.PEXELS_API_KEY,
  };
}
