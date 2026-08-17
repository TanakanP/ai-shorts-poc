import {existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
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

export function findEnvFile(startDir: string): string | undefined {
  let dir = resolve(startDir);
  while (true) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? 'unknown')))];
    throw new Error(`Missing or invalid env: ${keys.join(', ')}`);
  }

  return {
    openAiApiKey: parsed.data.OPENAI_API_KEY,
    pexelsApiKey: parsed.data.PEXELS_API_KEY,
    xaiApiKey: parsed.data.XAI_API_KEY,
    xaiVoiceId: parsed.data.XAI_VOICE_ID ?? 'eve',
  };
}
