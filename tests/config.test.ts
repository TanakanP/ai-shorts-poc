import {describe, expect, it} from 'vitest';
import {loadConfig} from '../src/config';

describe('loadConfig', () => {
  it('requires OPENAI_API_KEY, PEXELS_API_KEY, and XAI_API_KEY', () => {
    expect(() => loadConfig({})).toThrow(/OPENAI_API_KEY/);
    expect(() =>
      loadConfig({OPENAI_API_KEY: 'oa-test', PEXELS_API_KEY: 'px-test'}),
    ).toThrow(/XAI_API_KEY/);
  });

  it('returns validated config with the default voice', () => {
    expect(
      loadConfig({
        OPENAI_API_KEY: 'oa-test',
        PEXELS_API_KEY: 'px-test',
        XAI_API_KEY: 'xai-test',
      }),
    ).toEqual({
      openAiApiKey: 'oa-test',
      pexelsApiKey: 'px-test',
      xaiApiKey: 'xai-test',
      xaiVoiceId: 'eve',
    });
  });

  it('accepts an override voice id', () => {
    expect(
      loadConfig({
        OPENAI_API_KEY: 'oa-test',
        PEXELS_API_KEY: 'px-test',
        XAI_API_KEY: 'xai-test',
        XAI_VOICE_ID: 'leo',
      }).xaiVoiceId,
    ).toBe('leo');
  });

  it('rejects a blank override voice id', () => {
    expect(() =>
      loadConfig({
        OPENAI_API_KEY: 'oa-test',
        PEXELS_API_KEY: 'px-test',
        XAI_API_KEY: 'xai-test',
        XAI_VOICE_ID: ' ',
      }),
    ).toThrow(/XAI_VOICE_ID/);
  });
});
