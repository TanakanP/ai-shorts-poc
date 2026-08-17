import {mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {findEnvFile, loadConfig} from '../src/config';

describe('loadConfig', () => {
  it('requires OPENAI_API_KEY, PEXELS_API_KEY, and XAI_API_KEY', () => {
    expect(() => loadConfig({})).toThrow(/OPENAI_API_KEY/);
    expect(() =>
      loadConfig({OPENAI_API_KEY: 'oa-test', PEXELS_API_KEY: 'px-test'}),
    ).toThrow(/XAI_API_KEY/);
    expect(() =>
      loadConfig({
        OPENAI_API_KEY: 'oa-test',
        PEXELS_API_KEY: 'px-test',
        XAI_API_KEY: 'xai-test',
      }),
    ).toThrow(/CHANNEL_BRAND|CHANNEL_SIGNOFF/);
  });

  it('returns validated config with the default voice', () => {
    expect(
      loadConfig({
        OPENAI_API_KEY: 'oa-test',
        PEXELS_API_KEY: 'px-test',
        XAI_API_KEY: 'xai-test',
        CHANNEL_BRAND: 'Curious Cart',
        CHANNEL_SIGNOFF: 'If that made you look twice, follow along.',
      }),
    ).toEqual({
      openAiApiKey: 'oa-test',
      pexelsApiKey: 'px-test',
      xaiApiKey: 'xai-test',
      xaiVoiceId: 'eve',
      channelBrand: 'Curious Cart',
      channelSignoff: 'If that made you look twice, follow along.',
      backgroundMusicPath: 'assets/music/SOUNDTRACK.mp3',
    });
  });

  it('accepts an override voice id', () => {
    expect(
      loadConfig({
        OPENAI_API_KEY: 'oa-test',
        PEXELS_API_KEY: 'px-test',
        XAI_API_KEY: 'xai-test',
        XAI_VOICE_ID: 'leo',
        CHANNEL_BRAND: 'Curious Cart',
        CHANNEL_SIGNOFF: 'If that made you look twice, follow along.',
      }).xaiVoiceId,
    ).toBe('leo');
  });

  it('walks up from a nested directory to find .env', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ai-shorts-env-'));
    const nested = join(root, 'worktrees', 'feat-experiment');
    await mkdir(nested, {recursive: true});
    const envPath = join(root, '.env');
    await writeFile(envPath, 'OPENAI_API_KEY=test\n');

    expect(findEnvFile(nested)).toBe(envPath);
  });

  it('returns undefined when no .env exists above the start directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ai-shorts-no-env-'));
    expect(findEnvFile(root)).toBeUndefined();
  });

  it('rejects a blank override voice id', () => {
    expect(() =>
      loadConfig({
        OPENAI_API_KEY: 'oa-test',
        PEXELS_API_KEY: 'px-test',
        XAI_API_KEY: 'xai-test',
        XAI_VOICE_ID: ' ',
        CHANNEL_BRAND: 'Curious Cart',
        CHANNEL_SIGNOFF: 'If that made you look twice, follow along.',
      }),
    ).toThrow(/XAI_VOICE_ID/);
  });
});
