import {describe, expect, it} from 'vitest';
import {loadConfig} from '../src/config';

describe('loadConfig', () => {
  it('requires OPENAI_API_KEY and PEXELS_API_KEY', () => {
    expect(() => loadConfig({})).toThrow(/OPENAI_API_KEY/);
  });

  it('returns validated config', () => {
    expect(loadConfig({OPENAI_API_KEY: 'oa-test', PEXELS_API_KEY: 'px-test'})).toEqual({
      openAiApiKey: 'oa-test',
      pexelsApiKey: 'px-test',
    });
  });
});
