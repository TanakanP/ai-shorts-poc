import {z} from 'zod';
import {ProviderError} from '../domain/provider-error';
import type {VoiceWord} from '../domain/voice';
import {charactersToWords} from './characters-to-words';

export type SynthesizeSpeechResult = {
  audio: Buffer;
  durationSeconds: number;
  words: VoiceWord[];
};

export type SpeechSynthesizer = (args: {
  text: string;
  voiceId: string;
}) => Promise<SynthesizeSpeechResult>;

export const TTS_SPEECH_SPEED = 1.2;

const ttsResponseSchema = z.object({
  audio: z.string().min(1),
  duration: z.number().positive(),
  audio_timestamps: z.object({
    graph_chars: z.array(z.string()),
    graph_times: z.array(z.array(z.number()).min(2)),
  }),
});

export function createXaiSpeechSynthesizer(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): SpeechSynthesizer {
  return async ({text, voiceId}) => {
    let response: Response;
    try {
      response = await fetchImpl('https://api.x.ai/v1/tts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice_id: voiceId,
          language: 'en',
          output_format: {codec: 'mp3', sample_rate: 44100, bit_rate: 192000},
          with_timestamps: true,
          speed: TTS_SPEECH_SPEED,
        }),
      });
    } catch (cause) {
      throw new ProviderError(
        'xAI speech synthesis failed',
        {provider: 'xai', kind: 'transport'},
        {cause},
      );
    }

    if (!response.ok) {
      const kind =
        response.status === 401 || response.status === 403
          ? 'auth'
          : response.status === 429
            ? 'quota'
            : response.status === 400
              ? 'validation'
              : 'transport';
      throw new ProviderError('xAI speech synthesis failed', {
        provider: 'xai',
        kind,
        status: response.status,
      });
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch (cause) {
      throw new ProviderError(
        'xAI speech synthesis failed',
        {provider: 'xai', kind: 'validation'},
        {cause},
      );
    }

    const parsed = ttsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ProviderError('xAI speech synthesis failed', {
        provider: 'xai',
        kind: 'validation',
      });
    }

    let audio: Buffer;
    try {
      audio = Buffer.from(parsed.data.audio, 'base64');
    } catch (cause) {
      throw new ProviderError(
        'xAI speech synthesis failed',
        {provider: 'xai', kind: 'validation'},
        {cause},
      );
    }
    if (audio.length === 0) {
      throw new ProviderError('xAI speech synthesis failed', {
        provider: 'xai',
        kind: 'validation',
      });
    }

    let words: VoiceWord[];
    try {
      const times: Array<readonly [number, number]> = [];
      for (const pair of parsed.data.audio_timestamps.graph_times) {
        const start = pair[0];
        const end = pair[1];
        if (start === undefined || end === undefined) {
          throw new ProviderError('xAI speech synthesis failed', {
            provider: 'xai',
            kind: 'validation',
          });
        }
        times.push([start, end] as const);
      }
      words = charactersToWords(parsed.data.audio_timestamps.graph_chars, times);
    } catch (cause) {
      if (cause instanceof ProviderError) throw cause;
      throw new ProviderError(
        'xAI speech synthesis failed',
        {provider: 'xai', kind: 'validation'},
        {cause},
      );
    }

    return {
      audio,
      durationSeconds: parsed.data.duration,
      words,
    };
  };
}
