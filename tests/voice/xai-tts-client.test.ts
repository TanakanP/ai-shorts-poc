import {afterEach, describe, expect, it, vi} from 'vitest';
import {createXaiSpeechSynthesizer} from '../../src/voice/xai-tts-client';

const payload = {
  audio: Buffer.from('fake-mp3').toString('base64'),
  content_type: 'audio/mpeg',
  duration: 3.2,
  audio_timestamps: {
    graph_chars: ['H', 'i'],
    graph_times: [
      [0, 0.12],
      [0.12, 0.24],
    ],
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('createXaiSpeechSynthesizer', () => {
  it('posts to /v1/tts with timestamps and returns audio plus words', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {headers: {'content-type': 'application/json'}}),
    );
    const synthesize = createXaiSpeechSynthesizer('xai-secret', fetchImpl);

    await expect(synthesize({text: 'Hi', voiceId: 'eve'})).resolves.toEqual({
      audio: Buffer.from('fake-mp3'),
      durationSeconds: 3.2,
      words: [{text: 'Hi', startMs: 0, endMs: 240}],
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://api.x.ai/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer xai-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Hi',
        voice_id: 'eve',
        language: 'en',
        output_format: {codec: 'mp3', sample_rate: 44100, bit_rate: 192000},
        with_timestamps: true,
        speed: 1.2,
      }),
    });
  });

  it('maps 401 to an xAI auth ProviderError without leaking the key', async () => {
    const synthesize = createXaiSpeechSynthesizer(
      'xai-secret',
      vi.fn().mockResolvedValue(new Response('nope', {status: 401})),
    );

    await expect(synthesize({text: 'Hi', voiceId: 'eve'})).rejects.toMatchObject({
      name: 'ProviderError',
      message: 'xAI speech synthesis failed',
      diagnostic: {provider: 'xai', kind: 'auth', status: 401},
    });
  });

  it('maps 429 to quota and malformed JSON to validation', async () => {
    const quota = createXaiSpeechSynthesizer(
      'xai-secret',
      vi.fn().mockResolvedValue(new Response('slow', {status: 429})),
    );
    await expect(quota({text: 'Hi', voiceId: 'eve'})).rejects.toMatchObject({
      diagnostic: {provider: 'xai', kind: 'quota', status: 429},
    });

    const invalid = createXaiSpeechSynthesizer(
      'xai-secret',
      vi.fn().mockResolvedValue(
        new Response('{"audio":true}', {headers: {'content-type': 'application/json'}}),
      ),
    );
    await expect(invalid({text: 'Hi', voiceId: 'eve'})).rejects.toMatchObject({
      diagnostic: {provider: 'xai', kind: 'validation'},
    });
  });

  it('maps graph_chars/graph_times length mismatch to xAI validation without leaking the key', async () => {
    const apiKey = 'xai-secret-should-not-leak';
    const mismatched = {
      audio: Buffer.from('fake-mp3').toString('base64'),
      content_type: 'audio/mpeg',
      duration: 1.5,
      audio_timestamps: {
        graph_chars: ['H', 'i'],
        graph_times: [[0, 0.12]],
      },
    };
    const synthesize = createXaiSpeechSynthesizer(
      apiKey,
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mismatched), {
          headers: {'content-type': 'application/json'},
        }),
      ),
    );

    const error = await synthesize({text: 'Hi', voiceId: 'eve'}).catch((e: unknown) => e);
    expect(error).toMatchObject({
      name: 'ProviderError',
      message: 'xAI speech synthesis failed',
      diagnostic: {provider: 'xai', kind: 'validation'},
    });
    const serialized = JSON.stringify(error);
    expect(serialized).not.toContain(apiKey);
    expect((error as Error).message).not.toContain(apiKey);
  });
});
