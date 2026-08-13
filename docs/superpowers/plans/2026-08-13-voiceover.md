# Voiced Shorts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-scene Grok TTS voiceover so a topic still produces one local 1080×1920 H.264 MP4, but scene length follows the spoken audio instead of the AI's 4–8s estimate.

**Architecture:** Keep the existing injected-deps pipeline. The AI still writes 5–7 short spoken lines (and still emits `durationSeconds` as a writing target). A new `voice` stage runs after `plan.json` and before Pexels: synthesize one MP3 per scene with character timestamps, derive `durationSeconds = audioDuration + 0.3s` pad, persist `voice.json`, then resolve stock against the voiced durations and mix those MP3s on a non-overlapping Remotion audio timeline. Visual scene fades may overlap; voices must not. Tests never call xAI.

**Tech Stack:** Existing Node 22 / TypeScript / Zod / Remotion / Vitest stack, plus `POST https://api.x.ai/v1/tts` via native `fetch`. No new npm dependency.

---

## Locked decisions

- Speak-then-time. AI `durationSeconds` is a writing hint only. Render and Pexels use the measured voice duration.
- `scene.text` is the spoken script. Keep today's centered title cards. Word-level captions are a later plan.
- Persist word timestamps in `voice.json` now so captions can consume them later. Do not render karaoke captions in this plan.
- One xAI voice (`eve` default). No speech tags, no custom voice clone, no WebSocket TTS, no Whisper, no ElevenLabs, no music, no YouTube.
- Per-scene sequential TTS. Fail the run on first unusable clip. Do not synthesize later scenes after a failure.
- Voiced per-scene audio must be 2.5–12s. Voiced total (sum of scene durations after pad) must be 20–60s.
- Composition id stays `SilentShort`.
- Secrets never logged. Provider diagnostics use `provider: 'xai'`.

## Out of scope

Word-level caption UI, background music, YouTube auth/upload, scheduler, database, analytics, parallel TTS, speed-stretching speech to force 4–8s.

## File structure

```text
src/config.ts                         # add XAI_API_KEY, optional XAI_VOICE_ID
src/domain/provider-error.ts          # provider: 'xai'
src/domain/resolved-video.ts          # localAudioPath + audioDurationSeconds
src/domain/voice.ts                   # VoiceWord, SceneVoice, VoiceManifest, pad constants
src/generation/prompt.ts              # spoken-short system prompt
src/voice/characters-to-words.ts      # pure timestamp grouping
src/voice/scene-duration.ts           # pad + per-scene / total validation
src/voice/xai-tts-client.ts           # fetch adapter
src/voice/synthesize-scene-voices.ts  # per-scene files + overwritten plan
src/pipeline/create-short.ts          # insert voice stage
src/cli.ts                            # 4 stages + xAI wiring
src/stock/resolve-scene-assets.ts     # unchanged algorithm; receives voiced durations
src/remotion/ShortComposition.tsx     # non-overlapping Html5Audio timeline
src/remotion/Root.tsx                 # fixture audio path
src/remotion/render-short.ts          # serve mp3 + mp4, reject remote audio
scripts/smoke-render.ts               # include fixture audio
tests/fixtures/tiny-audio.mp3
tests/fixtures/video-plan.json        # prompt still valid; durations stay
AGENTS.md / README.md / .env.example
```

## Domain contracts

```ts
export type VoiceWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export type SceneVoice = {
  sceneId: string;
  localAudioPath: string;
  voiceId: string;
  audioDurationSeconds: number;
  durationSeconds: number;
  words: VoiceWord[];
};

export type VoiceManifest = {
  voiceId: string;
  language: 'en';
  scenes: SceneVoice[];
};

export type ResolvedScene = VideoScene & {
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
  localVideoPath: string;
  localAudioPath: string;
  audioDurationSeconds: number;
};

export type StockScene = Omit<ResolvedScene, 'localAudioPath' | 'audioDurationSeconds'>;
```

`VideoPlan` / `videoPlanSchema` stay as they are (integer 4–8s, total 30–45s). After TTS, `create-short` overwrites each scene's `durationSeconds` with `audioDurationSeconds + 0.3` and does **not** re-parse that object with `videoPlanSchema`.

Run directory after this plan:

```text
runs/<run-id>/
├── plan.json
├── voice.json
├── voice-01.mp3
├── voice-02.mp3
├── resolved.json
├── scene-01.mp4
├── output.mp4
└── run.json
```

Pipeline:

```text
create run dir
-> generate plan
-> persist plan.json
-> synthesize voices
-> persist voice.json
-> resolve assets using voiced durations
-> persist resolved.json
-> render video + voice
-> persist run.json status=rendered
```

---

### Task 1: Allow voiceover in project contract and require the xAI key

**Files:**
- Modify: `AGENTS.md`
- Modify: `src/config.ts`
- Modify: `src/domain/provider-error.ts`
- Modify: `.env.example`
- Modify: `tests/config.test.ts`

- [ ] **Step 1: Write the failing config tests**

Replace `tests/config.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
npm test -- tests/config.test.ts
```

Expected: FAIL because `XAI_API_KEY` is not required and `xaiVoiceId` does not exist.

- [ ] **Step 3: Implement config, provider union, env example, and AGENTS.md**

`src/config.ts`:

```ts
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
```

In `src/domain/provider-error.ts` change the provider union to `'openai' | 'pexels' | 'xai'`.

`.env.example`:

```dotenv
OPENAI_API_KEY=
PEXELS_API_KEY=
XAI_API_KEY=
XAI_VOICE_ID=eve
```

Replace `AGENTS.md` with:

```md
# Project Instructions

This project implements voiced AI Shorts on top of the finished silent POC.

Primary implementation plan:
docs/superpowers/plans/2026-08-13-voiceover.md

Rules:
- Follow the implementation plan task-by-task and in order.
- Use test-driven development.
- Do not add features outside the voiceover plan.
- Output is still a locally rendered MP4.
- No YouTube upload.
- No background music.
- No word-level caption rendering.
- No scheduler.
- No database.
- No analytics.
- Keep modules small and independently testable.
- Run tests after every task.
- Commit after each completed task.
- Never put API keys in source control.
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/config.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md src/config.ts src/domain/provider-error.ts .env.example tests/config.test.ts
git commit -m "feat: require xAI key for voiced shorts"
```

---

### Task 2: Add voice domain math as pure functions

**Files:**
- Create: `src/domain/voice.ts`
- Create: `src/voice/characters-to-words.ts`
- Create: `src/voice/scene-duration.ts`
- Test: `tests/voice/characters-to-words.test.ts`
- Test: `tests/voice/scene-duration.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/voice/characters-to-words.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {charactersToWords} from '../../src/voice/characters-to-words';

describe('charactersToWords', () => {
  it('groups characters into words using first-start and last-end', () => {
    expect(
      charactersToWords(
        ['H', 'i', ' ', 'm', 'i', 'l', 'k', '.'],
        [
          [0, 0.06],
          [0.06, 0.12],
          [0.12, 0.16],
          [0.16, 0.22],
          [0.22, 0.28],
          [0.28, 0.34],
          [0.34, 0.42],
          [0.42, 0.5],
        ],
      ),
    ).toEqual([
      {text: 'Hi', startMs: 0, endMs: 120},
      {text: 'milk.', startMs: 160, endMs: 500},
    ]);
  });

  it('drops whitespace-only tokens', () => {
    expect(charactersToWords([' ', '\n'], [[0, 0.1], [0.1, 0.2]])).toEqual([]);
  });

  it('rejects mismatched timestamp arrays', () => {
    expect(() => charactersToWords(['A'], [])).toThrow(/length/i);
  });
});
```

`tests/voice/scene-duration.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {
  sceneDurationFromAudio,
  assertVoicedTimeline,
  VOICE_TAIL_PAD_SECONDS,
} from '../../src/voice/scene-duration';

describe('sceneDurationFromAudio', () => {
  it('adds the tail pad', () => {
    expect(sceneDurationFromAudio(6)).toBe(6 + VOICE_TAIL_PAD_SECONDS);
  });

  it('rejects audio shorter than 2.5s', () => {
    expect(() => sceneDurationFromAudio(2.49)).toThrow(/2\.5/);
  });

  it('rejects audio longer than 12s', () => {
    expect(() => sceneDurationFromAudio(12.01)).toThrow(/12/);
  });
});

describe('assertVoicedTimeline', () => {
  it('accepts a 5-scene 32s voiced timeline', () => {
    expect(() => assertVoicedTimeline([6.3, 6.3, 6.3, 6.3, 6.3])).not.toThrow();
  });

  it('rejects a total below 20s', () => {
    expect(() => assertVoicedTimeline([2.8, 2.8, 2.8, 2.8, 2.8])).toThrow(/20/);
  });

  it('rejects a total above 60s', () => {
    expect(() => assertVoicedTimeline([12.3, 12.3, 12.3, 12.3, 12.3])).toThrow(/60/);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
npm test -- tests/voice
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the domain and helpers**

`src/domain/voice.ts`:

```ts
export type VoiceWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export type SceneVoice = {
  sceneId: string;
  localAudioPath: string;
  voiceId: string;
  audioDurationSeconds: number;
  durationSeconds: number;
  words: VoiceWord[];
};

export type VoiceManifest = {
  voiceId: string;
  language: 'en';
  scenes: SceneVoice[];
};
```

`src/voice/characters-to-words.ts`:

```ts
import type {VoiceWord} from '../domain/voice';

export function charactersToWords(
  chars: string[],
  times: Array<readonly [number, number]>,
): VoiceWord[] {
  if (chars.length !== times.length) {
    throw new Error('Timestamp length mismatch');
  }

  const words: VoiceWord[] = [];
  let current = '';
  let startMs = 0;
  let endMs = 0;

  const flush = () => {
    if (current.length > 0) {
      words.push({text: current, startMs, endMs});
    }
    current = '';
  };

  for (const [index, char] of chars.entries()) {
    const pair = times[index];
    if (!pair) throw new Error('Timestamp length mismatch');
    if (!char || /\s/u.test(char)) {
      flush();
      continue;
    }
    if (current.length === 0) startMs = Math.round(pair[0] * 1000);
    current += char;
    endMs = Math.round(pair[1] * 1000);
  }
  flush();
  return words;
}
```

`src/voice/scene-duration.ts`:

```ts
export const VOICE_TAIL_PAD_SECONDS = 0.3;
export const MIN_AUDIO_SECONDS = 2.5;
export const MAX_AUDIO_SECONDS = 12;
export const MIN_TOTAL_SECONDS = 20;
export const MAX_TOTAL_SECONDS = 60;

export function sceneDurationFromAudio(audioDurationSeconds: number): number {
  if (audioDurationSeconds < MIN_AUDIO_SECONDS || audioDurationSeconds > MAX_AUDIO_SECONDS) {
    throw new Error(
      `Audio duration ${audioDurationSeconds}s is outside ${MIN_AUDIO_SECONDS}-${MAX_AUDIO_SECONDS}s`,
    );
  }
  return audioDurationSeconds + VOICE_TAIL_PAD_SECONDS;
}

export function assertVoicedTimeline(sceneDurations: number[]): void {
  const total = sceneDurations.reduce((sum, value) => sum + value, 0);
  if (total < MIN_TOTAL_SECONDS || total > MAX_TOTAL_SECONDS) {
    throw new Error(
      `Voiced timeline ${total}s is outside ${MIN_TOTAL_SECONDS}-${MAX_TOTAL_SECONDS}s`,
    );
  }
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/voice
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/voice.ts src/voice tests/voice
git commit -m "feat: add voiced duration and word timestamp helpers"
```

---

### Task 3: Implement the xAI TTS adapter

**Files:**
- Create: `src/voice/xai-tts-client.ts`
- Test: `tests/voice/xai-tts-client.test.ts`

**Interfaces:**

```ts
export type SpeechSynthesizer = (args: {
  text: string;
  voiceId: string;
}) => Promise<SynthesizeSpeechResult>;

export type SynthesizeSpeechResult = {
  audio: Buffer;
  durationSeconds: number;
  words: VoiceWord[];
};
```

- [ ] **Step 1: Write failing adapter tests**

`tests/voice/xai-tts-client.test.ts`:

```ts
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createXaiSpeechSynthesizer} from '../../src/voice/xai-tts-client';

const payload = {
  audio: Buffer.from('fake-mp3').toString('base64'),
  content_type: 'audio/mpeg',
  duration: 3.2,
  audio_timestamps: {
    graph_chars: ['H', 'i'],
    graph_times: [[0, 0.12], [0.12, 0.24]],
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
      vi.fn().mockResolvedValue(new Response('{"audio":true}', {headers: {'content-type': 'application/json'}})),
    );
    await expect(invalid({text: 'Hi', voiceId: 'eve'})).rejects.toMatchObject({
      diagnostic: {provider: 'xai', kind: 'validation'},
    });
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

```bash
npm test -- tests/voice/xai-tts-client.test.ts
```

Expected: FAIL because `createXaiSpeechSynthesizer` does not exist.

- [ ] **Step 3: Implement the adapter**

`src/voice/xai-tts-client.ts`:

```ts
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
      const kind = response.status === 401 || response.status === 403
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
      throw new ProviderError('xAI speech synthesis failed', {provider: 'xai', kind: 'validation'});
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
      throw new ProviderError('xAI speech synthesis failed', {provider: 'xai', kind: 'validation'});
    }

    return {
      audio,
      durationSeconds: parsed.data.duration,
      words: charactersToWords(
        parsed.data.audio_timestamps.graph_chars,
        parsed.data.audio_timestamps.graph_times.map((pair) => [pair[0], pair[1]] as const),
      ),
    };
  };
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/voice
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/voice/xai-tts-client.ts tests/voice/xai-tts-client.test.ts
git commit -m "feat: add xAI text-to-speech adapter"
```

---

### Task 4: Synthesize every scene to a local MP3 and overwrite durations

**Files:**
- Create: `src/voice/synthesize-scene-voices.ts`
- Test: `tests/voice/synthesize-scene-voices.test.ts`

**Interfaces:**

```ts
export type SynthesizeSceneVoicesDeps = {
  synthesize: SpeechSynthesizer;
  writeAudioFile: (path: string, bytes: Buffer) => Promise<void>;
};

export type SynthesizeSceneVoicesResult = {
  timedPlan: VideoPlan;
  manifest: VoiceManifest;
};

export async function synthesizeSceneVoices(
  plan: VideoPlan,
  runDir: string,
  voiceId: string,
  deps: SynthesizeSceneVoicesDeps,
): Promise<SynthesizeSceneVoicesResult>;
```

- [ ] **Step 1: Write failing orchestrator tests**

`tests/voice/synthesize-scene-voices.test.ts`:

```ts
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import type {VideoPlan} from '../../src/domain/video-plan';
import {VOICE_TAIL_PAD_SECONDS} from '../../src/voice/scene-duration';
import {synthesizeSceneVoices} from '../../src/voice/synthesize-scene-voices';

const plan: VideoPlan = {
  topic: 'Why supermarkets put milk at the back',
  title: 'Why Milk Is Always at the Back',
  scenes: [
    {id: 'hook', durationSeconds: 6, text: 'Ever notice milk is far away?', searchQuery: 'supermarket entrance'},
    {id: 'walk', durationSeconds: 6, text: 'The back forces a longer walk.', searchQuery: 'supermarket aisle'},
    {id: 'see', durationSeconds: 6, text: 'That walk shows more products.', searchQuery: 'grocery shelves'},
    {id: 'buy', durationSeconds: 6, text: 'More products invite extra buys.', searchQuery: 'shopping cart'},
    {id: 'payoff', durationSeconds: 6, text: 'Placement is convenience and strategy.', searchQuery: 'dairy cooler'},
  ],
};

describe('synthesizeSceneVoices', () => {
  it('writes deterministic mp3s, overwrites durations, and keeps plan order', async () => {
    const synthesize = vi.fn(async ({text}: {text: string}) => ({
      audio: Buffer.from(text),
      durationSeconds: 5.7,
      words: [{text: text.split(' ')[0] ?? text, startMs: 0, endMs: 400}],
    }));
    const writeAudioFile = vi.fn(async () => undefined);

    const result = await synthesizeSceneVoices(plan, '/tmp/run', 'eve', {
      synthesize,
      writeAudioFile,
    });

    expect(synthesize.mock.calls.map((call) => call[0])).toEqual(
      plan.scenes.map((scene) => ({text: scene.text, voiceId: 'eve'})),
    );
    expect(writeAudioFile.mock.calls.map((call) => call[0])).toEqual([
      '/tmp/run/voice-01.mp3',
      '/tmp/run/voice-02.mp3',
      '/tmp/run/voice-03.mp3',
      '/tmp/run/voice-04.mp3',
      '/tmp/run/voice-05.mp3',
    ]);
    expect(result.timedPlan.scenes.map((scene) => scene.durationSeconds)).toEqual(
      Array(5).fill(5.7 + VOICE_TAIL_PAD_SECONDS),
    );
    expect(result.timedPlan.scenes[0]?.text).toBe(plan.scenes[0]?.text);
    expect(result.manifest).toEqual({
      voiceId: 'eve',
      language: 'en',
      scenes: plan.scenes.map((scene, index) => ({
        sceneId: scene.id,
        localAudioPath: join('/tmp/run', `voice-${String(index + 1).padStart(2, '0')}.mp3`),
        voiceId: 'eve',
        audioDurationSeconds: 5.7,
        durationSeconds: 5.7 + VOICE_TAIL_PAD_SECONDS,
        words: [{text: scene.text.split(' ')[0] ?? scene.text, startMs: 0, endMs: 400}],
      })),
    });
  });

  it('does not synthesize later scenes after a failure', async () => {
    const synthesize = vi
      .fn()
      .mockResolvedValueOnce({
        audio: Buffer.from('ok'),
        durationSeconds: 5.7,
        words: [{text: 'Ever', startMs: 0, endMs: 400}],
      })
      .mockRejectedValueOnce(new Error('xAI down'));
    const writeAudioFile = vi.fn(async () => undefined);

    await expect(
      synthesizeSceneVoices(plan, '/tmp/run', 'eve', {synthesize, writeAudioFile}),
    ).rejects.toThrow('xAI down');
    expect(synthesize).toHaveBeenCalledTimes(2);
    expect(writeAudioFile).toHaveBeenCalledTimes(1);
  });

  it('rejects a voiced timeline outside 20-60 seconds', async () => {
    await expect(
      synthesizeSceneVoices(plan, '/tmp/run', 'eve', {
        synthesize: async () => ({
          audio: Buffer.from('x'),
          durationSeconds: 2.6,
          words: [{text: 'Hi', startMs: 0, endMs: 200}],
        }),
        writeAudioFile: async () => undefined,
      }),
    ).rejects.toThrow(/20/);
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

```bash
npm test -- tests/voice/synthesize-scene-voices.test.ts
```

Expected: FAIL because the orchestrator does not exist.

- [ ] **Step 3: Implement the orchestrator**

`src/voice/synthesize-scene-voices.ts`:

```ts
import {join} from 'node:path';
import type {VideoPlan} from '../domain/video-plan';
import type {SceneVoice, VoiceManifest} from '../domain/voice';
import {assertVoicedTimeline, sceneDurationFromAudio} from './scene-duration';
import type {SpeechSynthesizer} from './xai-tts-client';

export type SynthesizeSceneVoicesDeps = {
  synthesize: SpeechSynthesizer;
  writeAudioFile: (path: string, bytes: Buffer) => Promise<void>;
};

export type SynthesizeSceneVoicesResult = {
  timedPlan: VideoPlan;
  manifest: VoiceManifest;
};

export async function synthesizeSceneVoices(
  plan: VideoPlan,
  runDir: string,
  voiceId: string,
  deps: SynthesizeSceneVoicesDeps,
): Promise<SynthesizeSceneVoicesResult> {
  const scenes: SceneVoice[] = [];
  const timedScenes = [];

  for (const [index, scene] of plan.scenes.entries()) {
    const spoken = await deps.synthesize({text: scene.text, voiceId});
    const durationSeconds = sceneDurationFromAudio(spoken.durationSeconds);
    const localAudioPath = join(runDir, `voice-${String(index + 1).padStart(2, '0')}.mp3`);
    await deps.writeAudioFile(localAudioPath, spoken.audio);
    scenes.push({
      sceneId: scene.id,
      localAudioPath,
      voiceId,
      audioDurationSeconds: spoken.durationSeconds,
      durationSeconds,
      words: spoken.words,
    });
    timedScenes.push({...scene, durationSeconds});
  }

  assertVoicedTimeline(timedScenes.map((scene) => scene.durationSeconds));

  return {
    timedPlan: {...plan, scenes: timedScenes},
    manifest: {voiceId, language: 'en', scenes},
  };
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/voice
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/voice/synthesize-scene-voices.ts tests/voice/synthesize-scene-voices.test.ts
git commit -m "feat: synthesize per-scene voiceover files"
```

---

### Task 5: Change the plan prompt to spoken lines

**Files:**
- Modify: `src/generation/prompt.ts`
- Modify: `tests/generation/generate-video-plan.test.ts` only if a test asserts the old prompt string (it already imports `VIDEO_PLAN_SYSTEM_PROMPT`, so existing generate tests stay green)

- [ ] **Step 1: Write a failing prompt assertion**

Add this test to `tests/generation/generate-video-plan.test.ts`:

```ts
describe('VIDEO_PLAN_SYSTEM_PROMPT', () => {
  it('asks for spoken narration instead of a silent card story', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/spoken narration/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).not.toMatch(/without narration/i);
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

```bash
npm test -- tests/generation/generate-video-plan.test.ts
```

Expected: FAIL because the prompt still says the on-screen text must tell the story without narration.

- [ ] **Step 3: Replace the system prompt**

`src/generation/prompt.ts`:

```ts
export const VIDEO_PLAN_SYSTEM_PROMPT = `You create concise vertical educational videos with spoken narration.
Each scene.text is the exact line a narrator will speak, and the same line appears on screen.
Create 5–7 scenes totaling 30–45 seconds as a writing target.
Each scene lasts 4–8 seconds as a writing target; keep each line speakable in that window.
Each scene text is one short thought readable on a phone and natural when spoken aloud.
Do not include speech tags, stage directions, or SSML.
Use concrete visual nouns for Pexels search queries, not abstract concepts.
Search queries should describe footage, e.g. "shopping cart supermarket aisle", not "consumer psychology".
The first scene is a strong curiosity hook spoken in the first sentence.
The final scene gives the payoff; do not add subscribe/follow CTAs.
Avoid unverifiable statistics and sensational claims.
Return only data matching the required schema.`;
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/generation/generate-video-plan.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/generation/prompt.ts tests/generation/generate-video-plan.test.ts
git commit -m "feat: write video plans as spoken narration"
```

---

### Task 6: Insert the voice stage into createShort

**Files:**
- Modify: `src/domain/resolved-video.ts`
- Modify: `src/stock/resolve-scene-assets.ts`
- Modify: `src/pipeline/create-short.ts`
- Modify: `tests/pipeline/create-short.test.ts`
- Modify: `tests/cli.test.ts` (compile-only audio fields)
- Modify: `tests/remotion/composition.test.ts` (compile-only audio fields)
- Modify: `tests/remotion/render-short.test.ts` (compile-only audio fields)
- Modify: `src/remotion/Root.tsx` (compile-only audio fields)
- Modify: `scripts/smoke-render.ts` (compile-only audio fields)

Stock tests stay unchanged: they never see audio fields.

**Interfaces:**

```ts
export type StockScene = Omit<ResolvedScene, 'localAudioPath' | 'audioDurationSeconds'>;

export type CreateShortDeps = {
  createRunDirectory: (topic: string) => Promise<RunDirectory>;
  generateVideoPlan: (topic: string) => Promise<VideoPlan>;
  persistJson: (path: string, value: unknown) => Promise<void>;
  synthesizeSceneVoices: (plan: VideoPlan, runDir: string) => Promise<SynthesizeSceneVoicesResult>;
  resolveSceneAssets: (plan: VideoPlan, runDir: string) => Promise<StockScene[]>;
  renderShort: (video: ResolvedVideo, outputPath: string) => Promise<void>;
};

export type CreateShortResult = {
  runId: string;
  outputPath: string;
  planPath: string;
  voicePath: string;
  resolvedPath: string;
};
```

`resolveSceneAssets` receives the **timed** plan so Pexels `requiredSeconds` uses voiced duration. It returns stock scenes only. `create-short` attaches `localAudioPath` and `audioDurationSeconds` from `voice.json` by index and `scene.id`.

- [ ] **Step 1: Write the failing orchestration test**

Replace `tests/pipeline/create-short.test.ts` with:

```ts
import {describe, expect, it} from 'vitest';
import type {ResolvedScene, ResolvedVideo, StockScene} from '../../src/domain/resolved-video';
import type {VideoPlan} from '../../src/domain/video-plan';
import {createShort, type CreateShortDeps} from '../../src/pipeline/create-short';
import type {SynthesizeSceneVoicesResult} from '../../src/voice/synthesize-scene-voices';

const topic = 'Why supermarkets put milk at the back';
const runId = '20260813-120000-deadbeef';
const runDir = `/tmp/runs/${runId}`;

const plan: VideoPlan = {
  topic,
  title: 'Why Milk Is Always at the Back',
  scenes: [
    {id: 'hook', durationSeconds: 6, text: 'The milk is hiding.', searchQuery: 'milk supermarket'},
    {id: 'walk', durationSeconds: 6, text: 'You cross the whole store.', searchQuery: 'supermarket aisle'},
    {id: 'see', durationSeconds: 6, text: 'That exposes more products.', searchQuery: 'grocery shelves'},
    {id: 'buy', durationSeconds: 6, text: 'Some become impulse buys.', searchQuery: 'shopping cart'},
    {id: 'fresh', durationSeconds: 6, text: 'Deliveries also stay efficient.', searchQuery: 'grocery delivery'},
  ],
};

const voiceResult: SynthesizeSceneVoicesResult = {
  timedPlan: {
    ...plan,
    scenes: plan.scenes.map((scene) => ({...scene, durationSeconds: 6.3})),
  },
  manifest: {
    voiceId: 'eve',
    language: 'en',
    scenes: plan.scenes.map((scene, index) => ({
      sceneId: scene.id,
      localAudioPath: `${runDir}/voice-${String(index + 1).padStart(2, '0')}.mp3`,
      voiceId: 'eve',
      audioDurationSeconds: 6,
      durationSeconds: 6.3,
      words: [{text: scene.text.split(' ')[0] ?? scene.text, startMs: 0, endMs: 400}],
    })),
  },
};

const stockScenes: StockScene[] = voiceResult.timedPlan.scenes.map((scene, index) => ({
  ...scene,
  sourcePageUrl: `https://example.com/videos/${index + 1}`,
  creatorName: `Creator ${index + 1}`,
  creatorUrl: `https://example.com/creators/${index + 1}`,
  localVideoPath: `${runDir}/scene-${String(index + 1).padStart(2, '0')}.mp4`,
}));

const resolvedScenes: ResolvedScene[] = stockScenes.map((scene, index) => ({
  ...scene,
  localAudioPath: `${runDir}/voice-${String(index + 1).padStart(2, '0')}.mp3`,
  audioDurationSeconds: 6,
}));

function fakeDeps(events: string[], failAt?: 'generation' | 'voice' | 'stock-resolution' | 'render') {
  const persisted: Array<{path: string; value: unknown}> = [];
  const failure = failAt ? new Error(`${failAt} failed`) : undefined;

  const deps: CreateShortDeps = {
    createRunDirectory: async () => {
      events.push('create run dir');
      return {runId, runDir};
    },
    generateVideoPlan: async () => {
      events.push('generate plan');
      if (failAt === 'generation') throw failure;
      return plan;
    },
    persistJson: async (path, value) => {
      const name = path.slice(path.lastIndexOf('/') + 1);
      const status = name === 'run.json' ? `:${(value as {status: string}).status}` : '';
      events.push(`persist ${name}${status}`);
      persisted.push({path, value});
    },
    synthesizeSceneVoices: async (receivedPlan, receivedRunDir) => {
      events.push('synthesize voice');
      expect(receivedPlan).toBe(plan);
      expect(receivedRunDir).toBe(runDir);
      if (failAt === 'voice') throw failure;
      return voiceResult;
    },
    resolveSceneAssets: async (receivedPlan, receivedRunDir) => {
      events.push('resolve assets');
      expect(receivedPlan).toBe(voiceResult.timedPlan);
      expect(receivedRunDir).toBe(runDir);
      if (failAt === 'stock-resolution') throw failure;
      return stockScenes;
    },
    renderShort: async (video, outputPath) => {
      events.push('render');
      expect(video).toEqual<ResolvedVideo>({
        runId,
        title: plan.title,
        fps: 30,
        width: 1080,
        height: 1920,
        scenes: resolvedScenes,
      });
      expect(outputPath).toBe(`${runDir}/output.mp4`);
      if (failAt === 'render') throw failure;
    },
  };

  return {deps, failure, persisted};
}

describe('createShort', () => {
  it('runs each stage in order and persists the completed artifacts', async () => {
    const events: string[] = [];
    const {deps, persisted} = fakeDeps(events);

    await expect(createShort(topic, deps)).resolves.toEqual({
      runId,
      outputPath: `${runDir}/output.mp4`,
      planPath: `${runDir}/plan.json`,
      voicePath: `${runDir}/voice.json`,
      resolvedPath: `${runDir}/resolved.json`,
    });

    expect(events).toEqual([
      'create run dir',
      'generate plan',
      'persist plan.json',
      'synthesize voice',
      'persist voice.json',
      'resolve assets',
      'persist resolved.json',
      'render',
      'persist run.json:rendered',
    ]);
    expect(persisted[0]).toEqual({path: `${runDir}/plan.json`, value: plan});
    expect(persisted[1]).toEqual({path: `${runDir}/voice.json`, value: voiceResult.manifest});
    expect(persisted[2]).toEqual({
      path: `${runDir}/resolved.json`,
      value: {
        runId,
        title: plan.title,
        fps: 30,
        width: 1080,
        height: 1920,
        scenes: resolvedScenes,
      },
    });
    expect(persisted[3]).toEqual({
      path: `${runDir}/run.json`,
      value: {
        runId,
        topic,
        status: 'rendered',
        startedAt: expect.any(String),
        finishedAt: expect.any(String),
        attribution: resolvedScenes.map(({sourcePageUrl, creatorName, creatorUrl}) => ({
          sourcePageUrl,
          creatorName,
          creatorUrl,
        })),
      },
    });
  });

  it.each(['generation', 'voice', 'stock-resolution', 'render'] as const)(
    'persists a failed %s run and rethrows the original error',
    async (stage) => {
      const events: string[] = [];
      const {deps, failure, persisted} = fakeDeps(events, stage);

      await expect(createShort(topic, deps)).rejects.toBe(failure);

      const expectedEvents = {
        generation: ['create run dir', 'generate plan', 'persist run.json:failed'],
        voice: [
          'create run dir',
          'generate plan',
          'persist plan.json',
          'synthesize voice',
          'persist run.json:failed',
        ],
        'stock-resolution': [
          'create run dir',
          'generate plan',
          'persist plan.json',
          'synthesize voice',
          'persist voice.json',
          'resolve assets',
          'persist run.json:failed',
        ],
        render: [
          'create run dir',
          'generate plan',
          'persist plan.json',
          'synthesize voice',
          'persist voice.json',
          'resolve assets',
          'persist resolved.json',
          'render',
          'persist run.json:failed',
        ],
      };
      expect(events).toEqual(expectedEvents[stage]);
      expect(persisted.at(-1)).toEqual({
        path: `${runDir}/run.json`,
        value: {
          runId,
          topic,
          status: 'failed',
          startedAt: expect.any(String),
          finishedAt: expect.any(String),
          error: {stage, message: `${stage} failed`},
          ...(stage === 'render'
            ? {
                attribution: resolvedScenes.map(({sourcePageUrl, creatorName, creatorUrl}) => ({
                  sourcePageUrl,
                  creatorName,
                  creatorUrl,
                })),
              }
            : {}),
        },
      });
    },
  );
});
```

- [ ] **Step 2: Run the test and verify failure**

```bash
npm test -- tests/pipeline/create-short.test.ts
```

Expected: FAIL because `synthesizeSceneVoices` is not a dep and `voicePath` / `StockScene` are missing.

- [ ] **Step 3: Implement domain + pipeline merge**

`src/domain/resolved-video.ts`:

```ts
import type {VideoScene} from './video-plan.js';

export type ResolvedScene = VideoScene & {
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
  localVideoPath: string;
  localAudioPath: string;
  audioDurationSeconds: number;
};

export type StockScene = Omit<ResolvedScene, 'localAudioPath' | 'audioDurationSeconds'>;

export type ResolvedVideo = {
  runId: string;
  title: string;
  fps: 30;
  width: 1080;
  height: 1920;
  scenes: ResolvedScene[];
};
```

Change `resolveSceneAssets` to return `Promise<StockScene[]>` and keep spreading the timed scene plus Pexels fields. Do not add audio paths there.

Export `StockScene` from `src/stock/resolve-scene-assets.ts` only if you re-export it; the canonical type lives in `resolved-video.ts`.

Add compile-only audio fields to every remaining `ResolvedScene` / `ResolvedVideo` literal:

```ts
localAudioPath: '/tmp/voice-01.mp3',
audioDurationSeconds: 5,
```

Use the real fixture path in `Root.tsx` and `scripts/smoke-render.ts` once `tests/fixtures/tiny-audio.mp3` exists in Task 7. Until then `/tmp/voice-01.mp3` is enough for `tsc`.

Replace the body of `src/pipeline/create-short.ts` `try` with:

```ts
const plan = await deps.generateVideoPlan(topic);
await deps.persistJson(planPath, plan);

stage = 'voice';
const {timedPlan, manifest} = await deps.synthesizeSceneVoices(plan, runDir);
await deps.persistJson(voicePath, manifest);

stage = 'stock-resolution';
const stockScenes = await deps.resolveSceneAssets(timedPlan, runDir);
const resolvedScenes = stockScenes.map((scene, index) => {
  const voice = manifest.scenes[index];
  if (!voice || voice.sceneId !== scene.id) {
    throw new Error(`Voice manifest missing scene ${scene.id}`);
  }
  return {
    ...scene,
    localAudioPath: voice.localAudioPath,
    audioDurationSeconds: voice.audioDurationSeconds,
  };
});
```

`RunStage` becomes `'generation' | 'voice' | 'stock-resolution' | 'render'`. `voicePath` is `join(runDir, 'voice.json')`. Return `{runId, outputPath, planPath, voicePath, resolvedPath}`.

The rest of `create-short.ts` (run.json success/failure, attribution) stays the same, except `CreateShortDeps` and `CreateShortResult` match the interfaces above.

`src/pipeline/create-short.ts` — add `'voice'` to `RunStage`, add `synthesizeSceneVoices` to deps, persist `voice.json` at `join(runDir, 'voice.json')`, call stock with `timedPlan`, merge audio onto resolved scenes, return `voicePath`.

Stage order inside the try:

```ts
const plan = await deps.generateVideoPlan(topic);
await deps.persistJson(planPath, plan);

stage = 'voice';
const {timedPlan, manifest} = await deps.synthesizeSceneVoices(plan, runDir);
await deps.persistJson(voicePath, manifest);

stage = 'stock-resolution';
const stockScenes = await deps.resolveSceneAssets(timedPlan, runDir);
const resolvedScenes = stockScenes.map((scene, index) => {
  const voice = manifest.scenes[index];
  if (!voice || voice.sceneId !== scene.id) {
    throw new Error(`Voice manifest missing scene ${scene.id}`);
  }
  return {
    ...scene,
    localAudioPath: voice.localAudioPath,
    audioDurationSeconds: voice.audioDurationSeconds,
  };
});
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/pipeline/create-short.test.ts tests/stock
npm run typecheck
```

Expected: stock and create-short PASS. `npm run typecheck` may still fail on CLI / remotion fixtures until Task 7–8 add audio fields; if typecheck fails only on those fixtures, add the two required fields there in this task without changing behavior yet (`localAudioPath: '/tmp/missing.mp3'`, `audioDurationSeconds: 5` is fine for compile-only fixtures). Do not leave the suite untypeable.

- [ ] **Step 5: Commit**

```bash
git add src/domain/resolved-video.ts src/pipeline/create-short.ts src/stock tests/pipeline/create-short.test.ts tests/stock tests/cli.test.ts tests/remotion scripts/smoke-render.ts src/remotion/Root.tsx
git commit -m "feat: orchestrate voice synthesis before stock"
```

Only stage files that actually changed.

---

### Task 7: Mix voice audio in Remotion without overlapping speech

**Files:**
- Modify: `src/remotion/ShortComposition.tsx`
- Modify: `src/remotion/render-short.ts`
- Modify: `src/remotion/Root.tsx`
- Modify: `tests/remotion/composition.test.ts`
- Modify: `tests/remotion/render-short.test.ts`
- Create: `tests/fixtures/tiny-audio.mp3`

- [ ] **Step 1: Create the audio fixture**

```bash
ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -q:a 9 -acodec libmp3lame tests/fixtures/tiny-audio.mp3
```

Expected: `tests/fixtures/tiny-audio.mp3` exists and is non-zero. The file must be git-tracked. If `ffmpeg` is missing, install it before this task.

Point `Root.tsx` fixture scenes at that file via `localAudioPath` and `audioDurationSeconds: 1` (or the scene's existing duration for preview). Studio preview may be shorter than spoken text; that is acceptable.

- [ ] **Step 2: Write failing timeline + renderer tests**

Add to `tests/remotion/composition.test.ts`:

```ts
import {createVoiceTimeline} from '../../src/remotion/ShortComposition';

it('places voice clips sequentially with no fade overlap', () => {
  expect(createVoiceTimeline(video)).toEqual([
    {scene: video.scenes[0], from: 0, durationInFrames: 120},
    {scene: video.scenes[1], from: 120, durationInFrames: 210},
  ]);
});
```

Use the same `video` fixture already in that file, after adding `localAudioPath` / `audioDurationSeconds` to those scenes. First scene is 4s → 120 frames; second is 7s → 210 frames. Visual `createSceneTimeline` stays overlapped (existing test must still pass).

In `tests/remotion/render-short.test.ts`:

- Add `localAudioPath: '/tmp/test-voice.mp3'` and `audioDurationSeconds: 5` to the base `video` fixture.
- Change the first test so `startAssetServer` is called with both files, order `[videoPath, audioPath]` if you `flatMap` `[localVideoPath, localAudioPath]`.
- `localAssetPaths` must include both keys.
- Add a case that rejects a remote `localAudioPath` (`http://example.com/voice.mp3`) with `/local files/i` before starting the server.
- Add an asset-server test that `tiny-audio.mp3` is served as `audio/mpeg`.

- [ ] **Step 3: Run tests and verify failure**

```bash
npm test -- tests/remotion/composition.test.ts tests/remotion/render-short.test.ts
```

Expected: FAIL because `createVoiceTimeline` is missing and the asset server always returns `video/mp4`.

- [ ] **Step 4: Implement audio timeline, content types, and allowlisting**

Add `createVoiceTimeline` to `src/remotion/ShortComposition.tsx`. It must **not** subtract `SCENE_FADE_FRAMES`. Render:

```tsx
import {AbsoluteFill, Html5Audio, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {getVideoSource, Scene, SCENE_FADE_FRAMES} from './Scene';
```

After the visual scene `Sequence`s, add:

```tsx
{createVoiceTimeline(video).map(({scene, from, durationInFrames: voiceDuration}) => (
  <Sequence key={`${scene.id}-voice`} from={from} durationInFrames={voiceDuration} name={`${scene.id}-voice`}>
    <Html5Audio src={getVideoSource(scene.localAudioPath, assetBaseUrl, localAssetPaths)} />
  </Sequence>
))}
```

Keep `OffthreadVideo` muted in `Scene.tsx`.

In `src/remotion/render-short.ts`:

1. Treat both `localVideoPath` and `localAudioPath` as scene assets. Reject either if `isRemoteHttpUrl`.
2. Build `localAssetPaths` from both paths.
3. Set `Content-Type` from extension: `.mp3` → `audio/mpeg`, `.mp4` → `video/mp4`, else `application/octet-stream`.

- [ ] **Step 5: Verify**

```bash
npm test -- tests/remotion
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/remotion tests/remotion tests/fixtures/tiny-audio.mp3
git commit -m "feat: mix scene voiceover into Remotion renders"
```

---

### Task 8: Wire production CLI deps and four-step progress

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Update `tests/cli.test.ts`:

- `CreateShortDeps` now requires `synthesizeSceneVoices`.
- Add audio fields to `resolvedScenes`.
- Extend `createHarness(failAt?: 'generation' | 'voice' | 'stock-resolution' | 'render')`.
- `synthesizeSceneVoices` should return a timed plan whose scene durations sum to 31.5 (5 × 6.3) when you want a known log, **or** have the CLI log voiced duration from the synthesize result rather than the raw plan.

Success output must be:

```ts
[
  `Creating short: ${plan.topic}`,
  '[1/4] Generated 5-scene plan',
  '[2/4] Synthesized voice (31.5s)',
  '[3/4] Resolved 5 stock clips',
  '[4/4] Rendered video',
  `Done: ${runDir}/output.mp4`,
]
```

Log voiced duration with one decimal when needed (`31.5s`), using the timed plan.

Add a `voice` row to the safe-failure table: message `Voice synthesis failed`. Persist `error.stage === 'voice'`. Provider cases may include:

```ts
['voice', new ProviderError('secret tts payload', {provider: 'xai', kind: 'quota', status: 429}), 'xai', 'quota', 429, undefined]
```

and assert the persisted diagnostic has `provider: 'xai'` with no `secret` text.

Do not print API keys, raw base64, or download URLs.

- [ ] **Step 2: Run the test and verify failure**

```bash
npm test -- tests/cli.test.ts
```

Expected: FAIL on step counts and missing voice wrapping.

- [ ] **Step 3: Implement CLI wiring**

In `src/cli.ts`:

- `CliStage` includes `'voice'`.
- Wrap `synthesizeSceneVoices` with `withSafeFailure('Voice synthesis failed', ...)`.
- After success, log `[2/4] Synthesized voice (${Number(total.toFixed(1))}s)` where `total` is the timed-plan duration sum. For `31.5` this prints `31.5s`.
- Generation log becomes `[1/4] Generated ${plan.scenes.length}-scene plan` (no AI duration).
- Stock log becomes `[3/4]`.
- Render log becomes `[4/4] Rendered video`.

`createProductionDeps`:

```ts
import {writeFile} from 'node:fs/promises';
import {createXaiSpeechSynthesizer} from './voice/xai-tts-client';
import {synthesizeSceneVoices} from './voice/synthesize-scene-voices';

const config = loadConfig();
const synthesize = createXaiSpeechSynthesizer(config.xaiApiKey);

return {
  createRunDirectory,
  generateVideoPlan: (topic) => generateVideoPlan(topic, {generateStructured}),
  persistJson,
  synthesizeSceneVoices: (plan, runDir) =>
    synthesizeSceneVoices(plan, runDir, config.xaiVoiceId, {
      synthesize,
      writeAudioFile: async (path, bytes) => {
        await writeFile(path, bytes);
      },
    }),
  resolveSceneAssets: (plan, runDir) =>
    resolveSceneAssets(plan, runDir, {
      searchVideos: (query, options) => pexels.searchVideos(query, options),
      download: downloadFile,
    }),
  renderShort,
};
```

No other module reads `process.env` or constructs the xAI client.

- [ ] **Step 4: Verify**

```bash
npm test -- tests/cli.test.ts tests/pipeline/create-short.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts tests/cli.test.ts
git commit -m "feat: generate voiced shorts from the CLI"
```

---

### Task 9: Smoke render, README, and full verification

**Files:**
- Modify: `scripts/smoke-render.ts`
- Modify: `README.md`

- [ ] **Step 1: Update the smoke render to include fixture audio**

`scripts/smoke-render.ts` scene must set:

```ts
localVideoPath: fixturePath,
localAudioPath: fileURLToPath(new URL('../tests/fixtures/tiny-audio.mp3', import.meta.url)),
audioDurationSeconds: 1,
durationSeconds: 5,
```

- [ ] **Step 2: Document the new key**

README Requirements add `xAI API key`. Setup step 3: add `XAI_API_KEY` (and optional `XAI_VOICE_ID`) to `.env`. Mention that the MP4 now includes spoken narration and must still be reviewed before any public upload.

- [ ] **Step 3: Run offline quality gates**

```bash
npm test
npm run typecheck
npm run smoke:render
```

Expected: all tests PASS, typecheck PASS, `runs/smoke/output.mp4` exists and is non-zero. Play the smoke MP4 and confirm a (silent fixture) audio track is muxed — `ffprobe runs/smoke/output.mp4` should show an audio stream.

- [ ] **Step 4: Optional real acceptance run**

Only if `OPENAI_API_KEY`, `PEXELS_API_KEY`, and `XAI_API_KEY` are in local `.env`:

```bash
npm run generate -- "Why supermarkets put milk at the back"
```

Confirm:

- `voice.json` exists with 5–7 scenes of words
- `voice-01.mp3` … exist and are non-zero
- `resolved.json` scene durations equal manifest `durationSeconds`
- `output.mp4` has an audio stream
- spoken first line is the hook
- last word of each scene is not clipped by the visual fade

If acceptance fails, classify as `PLAN_QUALITY`, `TTS_TIMING`, `STOCK_DURATION`, `AUDIO_MIX`, or `RENDERING`. Fix the smallest module, add a regression test, rerun gates.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-render.ts README.md
git commit -m "docs: document voiced short generation"
```

If the acceptance run required a code fix, commit that fix separately with a specific message.

---

## POC exit criteria for this plan

- `npm test` passes with no network access.
- `npm run typecheck` passes.
- `npm run smoke:render` produces an MP4 that contains an audio stream.
- CLI progress is `[1/4]…[4/4]` and never prints secrets.
- `runs/<id>/voice.json` plus `voice-NN.mp3` exist after a real run.
- Scene lengths in `resolved.json` come from TTS + 0.3s pad, not the AI estimate.
- Voices do not overlap across scene fades.
- No caption renderer, music mixer, or YouTube client exists.

## Follow-up plans (do not implement here)

1. Word-level captions from `voice.json` words.
2. Background music ducked under voice.
3. YouTube OAuth + unlisted `videos.insert`.
