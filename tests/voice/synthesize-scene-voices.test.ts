import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import type {VideoPlan} from '../../src/domain/video-plan';
import {VOICE_TAIL_PAD_SECONDS} from '../../src/voice/scene-duration';
import {synthesizeSceneVoices} from '../../src/voice/synthesize-scene-voices';
import * as outroAudio from '../../src/voice/lengthen-outro-why';

const plan: VideoPlan = {
  topic: 'Why supermarkets put milk at the back',
  title: 'Why Milk Is Always at the Back',
  viralAngle: 'The store is using your walk, not hiding the milk.',
  scenes: [
    {
      id: 'hook',
      role: 'hook',
      durationSeconds: 6,
      text: 'Ever notice milk is far away?',
      visualIntent: 'Shopper walking toward a supermarket entrance',
      searchQueries: ['supermarket entrance', 'grocery store doors'],
    },
    {
      id: 'walk',
      role: 'stake',
      durationSeconds: 6,
      text: 'The back forces a longer walk.',
      visualIntent: 'Shopper walking down a long supermarket aisle',
      searchQueries: ['supermarket aisle', 'grocery aisle walk'],
    },
    {
      id: 'see',
      role: 'proof',
      durationSeconds: 6,
      text: 'That walk shows more products.',
      visualIntent: 'Grocery shelves of snacks and fruit along an aisle',
      searchQueries: ['grocery shelves', 'supermarket snacks fruit'],
    },
    {
      id: 'buy',
      role: 'payoff',
      durationSeconds: 6,
      text: 'More products invite extra buys.',
      visualIntent: 'Shopper adding items from an end cap into a cart',
      searchQueries: ['shopping cart', 'impulse buy grocery'],
    },
    {
      id: 'payoff',
      role: 'outro',
      durationSeconds: 6,
      text: 'Placement is convenience and strategy.',
      visualIntent: 'Supermarket dairy milk refrigerators at the back wall',
      searchQueries: ['dairy cooler', 'grocery milk refrigerator'],
    },
  ],
};

describe('synthesizeSceneVoices', () => {
  it('lengthens only the branded outro and uses its adjusted audio and timing', async () => {
    const adjusted = {audio: Buffer.from('long why'), durationSeconds: 3.6,
      words: [{text: 'why?', startMs: 300, endMs: 1900}]};
    const stretch = vi.spyOn(outroAudio, 'lengthenOutroWhy').mockResolvedValue(adjusted);
    try {
      const branded = {...plan, scenes: [...plan.scenes.slice(0, 4),
        {...plan.scenes[4], id: 'channel-outro', text: 'Tell Me Whyyyyyy? | Follow along.'}]};
      const writeAudioFile = vi.fn(async () => {});
      const result = await synthesizeSceneVoices(branded, '/tmp/run', 'helix', {
        synthesize: async () => ({audio: Buffer.from('normal'), durationSeconds: 4, words: []}),
        writeAudioFile,
      });
      expect(stretch).toHaveBeenCalledTimes(1);
      expect(result.manifest.scenes.at(-1)?.words).toEqual(adjusted.words);
      expect(result.timedPlan.scenes.at(-1)?.durationSeconds).toBeCloseTo(3.9);
      expect(writeAudioFile).toHaveBeenLastCalledWith('/tmp/run/voice-05.mp3', adjusted.audio);
    } finally { stretch.mockRestore(); }
  });
  it('writes deterministic mp3s, overwrites durations, and keeps plan order', async () => {
    const audioDurationSeconds = 5.2;
    const timedDurationSeconds = audioDurationSeconds + VOICE_TAIL_PAD_SECONDS;
    const synthesize = vi.fn(async ({text}: {text: string}) => ({
      audio: Buffer.from(text),
      durationSeconds: audioDurationSeconds,
      words: [{text: text.split(' ')[0] ?? text, startMs: 0, endMs: 400}],
    }));
    const writeAudioFile = vi.fn(async (_path: string, _bytes: Buffer) => undefined);

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
      Array(5).fill(timedDurationSeconds),
    );
    expect(timedDurationSeconds).toBe(5.5);
    expect(result.timedPlan.scenes.map((scene) => scene.durationSeconds)).not.toEqual(
      plan.scenes.map((scene) => scene.durationSeconds),
    );
    expect(result.timedPlan.scenes[0]?.text).toBe(plan.scenes[0]?.text);
    expect(result.manifest).toEqual({
      voiceId: 'eve',
      language: 'en',
      scenes: plan.scenes.map((scene, index) => ({
        sceneId: scene.id,
        localAudioPath: join('/tmp/run', `voice-${String(index + 1).padStart(2, '0')}.mp3`),
        voiceId: 'eve',
        audioDurationSeconds,
        durationSeconds: timedDurationSeconds,
        words: [{text: scene.text.split(' ')[0] ?? scene.text, startMs: 0, endMs: 400}],
      })),
    });
  });

  it('uses spokenText as the TTS source when it differs from text', async () => {
    const voiced: VideoPlan = {
      ...plan,
      scenes: plan.scenes.map((scene, index) =>
        index === 0
          ? {
              ...scene,
              text: 'FALLBACK TEXT THAT SHOULD NOT BE SPOKEN',
              spokenText: 'A runway can change its number without moving.',
              displayText: 'SAME RUNWAY. NEW NUMBER.',
            }
          : scene,
      ),
    };
    const synthesize = vi.fn(async ({text}: {text: string}) => ({
      audio: Buffer.from(text),
      durationSeconds: 5.2,
      words: [{text: 'A', startMs: 0, endMs: 400}],
    }));

    await synthesizeSceneVoices(voiced, '/tmp/run', 'eve', {
      synthesize,
      writeAudioFile: async () => undefined,
    });

    expect(synthesize.mock.calls[0]?.[0]).toEqual({
      text: 'A runway can change its number without moving.',
      voiceId: 'eve',
    });
  });

  it('sends spoken text without caption bars to TTS', async () => {
    const piped: VideoPlan = {
      ...plan,
      scenes: plan.scenes.map((scene, index) =>
        index === 0
          ? {...scene, text: 'Ever notice milk is far away | from the door?'}
          : scene,
      ),
    };
    const synthesize = vi.fn(async ({text}: {text: string}) => ({
      audio: Buffer.from(text),
      durationSeconds: 5.2,
      words: [{text: 'Ever', startMs: 0, endMs: 400}],
    }));

    await synthesizeSceneVoices(piped, '/tmp/run', 'eve', {
      synthesize,
      writeAudioFile: async () => undefined,
    });

    expect(synthesize.mock.calls[0]?.[0]).toEqual({
      text: 'Ever notice milk is far away from the door?',
      voiceId: 'eve',
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

  it('does not write later scenes when audio duration is unusable', async () => {
    const synthesize = vi
      .fn()
      .mockResolvedValueOnce({
        audio: Buffer.from('ok'),
        durationSeconds: 5.7,
        words: [{text: 'Ever', startMs: 0, endMs: 400}],
      })
      .mockResolvedValueOnce({
        audio: Buffer.from('short'),
        durationSeconds: 1.4,
        words: [{text: 'The', startMs: 0, endMs: 200}],
      });
    const writeAudioFile = vi.fn(async (_path: string, _bytes: Buffer) => undefined);

    await expect(
      synthesizeSceneVoices(plan, '/tmp/run', 'eve', {synthesize, writeAudioFile}),
    ).rejects.toThrow(/1\.5/);
    expect(synthesize).toHaveBeenCalledTimes(2);
    expect(writeAudioFile).toHaveBeenCalledTimes(1);
  });

  it('rejects actual TTS plus padding and outro over 33s with an actionable diagnostic', async () => {
    const withOutro = {...plan, scenes: [...plan.scenes, {...plan.scenes[0], id: 'channel-outro'}]};
    await expect(synthesizeSceneVoices(withOutro, '/tmp/run', 'eve', {
      synthesize: async () => ({audio: Buffer.from('x'), durationSeconds: 5.3, words: []}),
      writeAudioFile: async () => {},
    })).rejects.toMatchObject({
      diagnostic: {detail: expect.stringMatching(/33\.6s.*33s.*Shorten/)},
    });
  });

  it('rejects a voiced timeline outside 15-33 seconds', async () => {
    await expect(
      synthesizeSceneVoices(plan, '/tmp/run', 'eve', {
        synthesize: async () => ({
          audio: Buffer.from('x'),
          durationSeconds: 2.6,
          words: [{text: 'Hi', startMs: 0, endMs: 200}],
        }),
        writeAudioFile: async () => undefined,
      }),
    ).rejects.toThrow(/15/);
  });
});
