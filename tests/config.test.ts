import {mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {findEnvFile, loadConfig} from '../src/config';

describe('loadConfig', () => {
  const base = {PEXELS_API_KEY: 'px', CHANNEL_BRAND: 'Test Brand', CHANNEL_SIGNOFF: 'Follow along.'};
  it('keeps V3 as default, supports V4/V5 brief paths and rejects unknown engines', () => {
    const env = {...base, OPENAI_API_KEY: 'oa', XAI_API_KEY: 'xa'};
    expect(loadConfig(env).contentEngineVersion).toBe('v3');
    expect(loadConfig({...env, CONTENT_ENGINE_VERSION: 'v4', CONTENT_BRIEF_PATH: 'content/v4/straw-refraction.json'}))
      .toMatchObject({contentEngineVersion: 'v4', contentBriefPath: 'content/v4/straw-refraction.json'});
    expect(loadConfig({...env, CONTENT_ENGINE_VERSION: 'v5', CONTENT_BRIEF_PATH: 'content/v5/pen-cap-hole.json'}))
      .toMatchObject({contentEngineVersion: 'v5', contentBriefPath: 'content/v5/pen-cap-hole.json'});
    expect(() => loadConfig({...env, CONTENT_ENGINE_VERSION: 'v6'})).toThrow(/CONTENT_ENGINE_VERSION/);
  });
  it('accepts V5 without Pexels while V3/V4 still require it, and keeps selected credentials required', () => {
    const creds = {OPENAI_API_KEY: 'oa', XAI_API_KEY: 'xa', CHANNEL_BRAND: 'Test Brand', CHANNEL_SIGNOFF: 'Follow along.'};
    expect(loadConfig({...creds, CONTENT_ENGINE_VERSION: 'v5'})).toMatchObject({
      contentEngineVersion: 'v5', pexelsApiKey: '',
    });
    expect(() => loadConfig(creds)).toThrow(/PEXELS_API_KEY/);
    expect(() => loadConfig({...creds, CONTENT_ENGINE_VERSION: 'v3'})).toThrow(/PEXELS_API_KEY/);
    expect(() => loadConfig({...creds, CONTENT_ENGINE_VERSION: 'v4'})).toThrow(/PEXELS_API_KEY/);
    expect(() => loadConfig({
      CONTENT_ENGINE_VERSION: 'v5', CHANNEL_BRAND: 'Test Brand', CHANNEL_SIGNOFF: 'Follow along.',
    })).toThrow(/OPENAI_API_KEY/);
    expect(() => loadConfig({
      CONTENT_ENGINE_VERSION: 'v5', SCRIPT_PROVIDER: 'xai', CHANNEL_BRAND: 'Test Brand', CHANNEL_SIGNOFF: 'Follow along.',
    })).toThrow(/XAI_API_KEY/);
  });
  it.each(['openai', 'xai'])('validates only selected keys for %s scripts with either voice', (script) => {
    for (const voice of ['xai', 'elevenlabs']) {
      const env = {...base, SCRIPT_PROVIDER: script, VOICE_PROVIDER: voice,
        ...(script === 'openai' ? {OPENAI_API_KEY: 'oa'} : {}),
        ...(script === 'xai' || voice === 'xai' ? {XAI_API_KEY: 'xa'} : {}),
        ...(voice === 'elevenlabs' ? {ELEVENLABS_API_KEY: 'el', ELEVENLABS_VOICE_ID: 'voice123'} : {})};
      expect(loadConfig(env)).toMatchObject({scriptProvider: script, voiceProvider: voice});
    }
  });
  it('rejects invalid providers and missing ElevenLabs settings', () => {
    expect(() => loadConfig({...base, SCRIPT_PROVIDER: 'bad-secret'})).toThrow(/SCRIPT_PROVIDER/);
    expect(() => loadConfig({...base, OPENAI_API_KEY: 'oa', VOICE_PROVIDER: 'elevenlabs'})).toThrow(/ELEVENLABS_API_KEY/);
    expect(() => loadConfig({...base, OPENAI_API_KEY: 'oa', VOICE_PROVIDER: 'elevenlabs', ELEVENLABS_API_KEY: 'el'})).toThrow(/ELEVENLABS_VOICE_ID/);
  });
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
    ).toMatchObject({
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
