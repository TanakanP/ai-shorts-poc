import {existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {z} from 'zod';

export type AppConfig = {
  scriptProvider: 'openai' | 'xai';
  voiceProvider: 'xai' | 'elevenlabs';
  xaiScriptModel: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsModel: string;
  openAiApiKey: string;
  pexelsApiKey: string;
  xaiApiKey: string;
  xaiVoiceId: string;
  channelBrand: string;
  channelSignoff: string;
  backgroundMusicPath: string;
};

const configSchema = z.object({
  SCRIPT_PROVIDER: z.enum(['openai', 'xai']).default('openai'),
  VOICE_PROVIDER: z.enum(['xai', 'elevenlabs']).default('xai'),
  XAI_SCRIPT_MODEL: z.string().trim().min(1).default('grok-4.3'),
  ELEVENLABS_MODEL: z.string().trim().min(1).default('eleven_multilingual_v2'),
  ELEVENLABS_API_KEY: z.string().trim().default(''),
  ELEVENLABS_VOICE_ID: z.string().trim().default(''),
  OPENAI_API_KEY: z.string().trim().default(''),
  PEXELS_API_KEY: z.string().min(1),
  XAI_API_KEY: z.string().trim().default(''),
  XAI_VOICE_ID: z.string().trim().min(1).regex(/^[a-z0-9-]+$/i).optional(),
  CHANNEL_BRAND: z.string().trim().min(2).max(40),
  CHANNEL_SIGNOFF: z.string().trim().min(8).max(80),
  BACKGROUND_MUSIC_PATH: z.string().trim().min(1).optional(),
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
  const required = [
    ...((env.SCRIPT_PROVIDER ?? 'openai') === 'openai' ? ['OPENAI_API_KEY'] : []),
    ...(env.SCRIPT_PROVIDER === 'xai' || (env.VOICE_PROVIDER ?? 'xai') === 'xai' ? ['XAI_API_KEY'] : []),
    ...(env.VOICE_PROVIDER === 'elevenlabs' ? ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID'] : []),
  ].filter(key => !env[key]?.trim());
  if (!parsed.success || required.length) {
    const keys = [...new Set([...required, ...(!parsed.success ? parsed.error.issues.map((issue) => String(issue.path[0] ?? 'unknown')) : [])])];
    throw new Error(`Missing or invalid env: ${keys.join(', ')}`);
  }

  return {
    scriptProvider: parsed.data.SCRIPT_PROVIDER,
    voiceProvider: parsed.data.VOICE_PROVIDER,
    xaiScriptModel: parsed.data.XAI_SCRIPT_MODEL,
    elevenLabsApiKey: parsed.data.ELEVENLABS_API_KEY,
    elevenLabsVoiceId: parsed.data.ELEVENLABS_VOICE_ID,
    elevenLabsModel: parsed.data.ELEVENLABS_MODEL,
    openAiApiKey: parsed.data.OPENAI_API_KEY,
    pexelsApiKey: parsed.data.PEXELS_API_KEY,
    xaiApiKey: parsed.data.XAI_API_KEY,
    xaiVoiceId: parsed.data.XAI_VOICE_ID ?? 'eve',
    channelBrand: parsed.data.CHANNEL_BRAND,
    channelSignoff: parsed.data.CHANNEL_SIGNOFF,
    backgroundMusicPath: parsed.data.BACKGROUND_MUSIC_PATH ?? 'assets/music/SOUNDTRACK.mp3',
  };
}
