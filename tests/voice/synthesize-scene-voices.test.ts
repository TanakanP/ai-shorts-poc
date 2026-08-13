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
