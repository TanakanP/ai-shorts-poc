import {describe, expect, it} from 'vitest';
import type {ResolvedScene} from '../src/domain/resolved-video';
import type {VideoPlan} from '../src/domain/video-plan';
import type {CreateShortDeps} from '../src/pipeline/create-short';
import {runCli} from '../src/cli';
import {ProviderError} from '../src/domain/provider-error';
import {PexelsApiError} from '../src/stock/pexels-client';
import {VideoDownloadError} from '../src/stock/download-file';

const runId = '20260813-120000-deadbeef';
const runDir = `runs/${runId}`;
const plan: VideoPlan = {
  topic: 'Why supermarkets put milk at the back',
  title: 'Why Milk Is Always at the Back',
  scenes: Array.from({length: 5}, (_, index) => ({
    id: `scene-${index + 1}`,
    durationSeconds: 6,
    text: `Scene ${index + 1} explains the idea.`,
    searchQuery: `supermarket scene ${index + 1}`,
  })),
};
const resolvedScenes: ResolvedScene[] = plan.scenes.map((scene, index) => ({
  ...scene,
  sourcePageUrl: `https://example.test/videos/${index + 1}`,
  creatorName: `Creator ${index + 1}`,
  creatorUrl: `https://example.test/creators/${index + 1}`,
  localVideoPath: `${runDir}/scene-${String(index + 1).padStart(2, '0')}.mp4`,
  localAudioPath: '/tmp/voice-01.mp3',
  audioDurationSeconds: 5,
}));

function createHarness(
  failAt?: 'generation' | 'voice' | 'stock-resolution' | 'render',
  failure: Error = new Error('oa-secret-key px-secret-key https://vendor.example/raw'),
) {
  const output: string[] = [];
  const errors: string[] = [];
  const persisted: unknown[] = [];
  let receivedTopic: string | undefined;

  const deps: CreateShortDeps = {
    createRunDirectory: async (topic) => {
      receivedTopic = topic;
      return {runId, runDir};
    },
    generateVideoPlan: async () => {
      if (failAt === 'generation') throw failure;
      return plan;
    },
    persistJson: async (_path, value) => {
      persisted.push(value);
    },
    synthesizeSceneVoices: async (receivedPlan) => {
      if (failAt === 'voice') throw failure;
      return {
        timedPlan: {
          ...receivedPlan,
          scenes: receivedPlan.scenes.map((scene) => ({...scene, durationSeconds: 6.3})),
        },
        manifest: {
          voiceId: 'eve',
          language: 'en',
          scenes: receivedPlan.scenes.map((scene, index) => ({
            sceneId: scene.id,
            localAudioPath: `${runDir}/voice-${String(index + 1).padStart(2, '0')}.mp3`,
            voiceId: 'eve',
            audioDurationSeconds: 6,
            durationSeconds: 6.3,
            words: [],
          })),
        },
      };
    },
    resolveSceneAssets: async () => {
      if (failAt === 'stock-resolution') throw failure;
      return resolvedScenes;
    },
    renderShort: async () => {
      if (failAt === 'render') throw failure;
    },
  };

  return {
    get receivedTopic() {
      return receivedTopic;
    },
    output,
    errors,
    persisted,
    run: (args: string[]) =>
      runCli(args, () => deps, {
        log: (message) => output.push(message),
        error: (message) => errors.push(message),
      }),
  };
}

describe('runCli', () => {
  it('joins all positional arguments into one topic', async () => {
    const harness = createHarness();

    await expect(harness.run(['Why', 'supermarkets', 'put', 'milk', 'at', 'the', 'back'])).resolves.toBe(0);

    expect(harness.receivedTopic).toBe('Why supermarkets put milk at the back');
  });

  it('rejects a missing topic with usage text', async () => {
    const harness = createHarness();

    await expect(harness.run([])).resolves.toBe(1);

    expect(harness.errors).toEqual(['Usage: npm run generate -- "<topic>"']);
    expect(harness.receivedTopic).toBeUndefined();
  });

  it('prints compact progress, the run id, and output path on success', async () => {
    const harness = createHarness();

    await expect(harness.run([plan.topic])).resolves.toBe(0);

    expect(harness.output).toEqual([
      `Creating short: ${plan.topic}`,
      '[1/4] Generated 5-scene plan',
      '[2/4] Synthesized voice (31.5s)',
      '[3/4] Resolved 5 stock clips',
      '[4/4] Rendered video',
      `Done: ${runDir}/output.mp4`,
    ]);
    expect(harness.output.join('\n')).toContain(runId);
    expect(harness.errors).toEqual([]);
  });

  it.each([
    ['generation', 'Video plan generation failed'],
    ['voice', 'Voice synthesis failed'],
    ['stock-resolution', 'Stock clip resolution failed'],
    ['render', 'Video rendering failed'],
  ] as const)('safely reports and persists a failed %s stage', async (stage, safeMessage) => {
    const harness = createHarness(stage);

    await expect(harness.run([plan.topic])).resolves.toBe(1);

    expect(harness.errors).toEqual([`Failed during ${stage}. Run directory: ${runDir}`]);
    expect(harness.persisted.at(-1)).toMatchObject({
      status: 'failed',
      error: {stage, message: safeMessage},
    });
    expect([...harness.output, ...harness.errors, JSON.stringify(harness.persisted)].join('\n')).not.toMatch(
      /oa-secret-key|px-secret-key|vendor\.example/,
    );
  });

  it.each([
    ['generation', new ProviderError('secret auth payload', {provider: 'openai', kind: 'auth', status: 401}), 'openai', 'auth', 401, undefined],
    [
      'generation',
      new ProviderError('secret quota payload', {provider: 'openai', kind: 'quota', status: 429, code: 'insufficient_quota'}),
      'openai',
      'quota',
      429,
      'insufficient_quota',
    ],
    ['generation', new ProviderError('secret transport payload', {provider: 'openai', kind: 'transport', code: 'econnreset'}), 'openai', 'transport', undefined, 'econnreset'],
    ['stock-resolution', new ProviderError('secret validation payload', {provider: 'pexels', kind: 'validation'}), 'pexels', 'validation', undefined, undefined],
    ['voice', new ProviderError('secret tts payload', {provider: 'xai', kind: 'quota', status: 429}), 'xai', 'quota', 429, undefined],
  ] as const)(
    'persists sanitized %s provider diagnostics without raw error content',
    async (stage, failure, provider, kind, status, code) => {
      const harness = createHarness(stage, failure);

      await expect(harness.run([plan.topic])).resolves.toBe(1);

      const safeMessage =
        stage === 'generation'
          ? 'Video plan generation failed'
          : stage === 'voice'
            ? 'Voice synthesis failed'
            : 'Stock clip resolution failed';

      expect(harness.persisted.at(-1)).toMatchObject({
        status: 'failed',
        error: {
          stage,
          message: safeMessage,
          provider,
          kind,
          ...(status ? {status} : {}),
          ...(code ? {code} : {}),
        },
      });
      expect(JSON.stringify(harness.persisted)).not.toMatch(/secret|payload/i);
    },
  );

  it('keeps typed Pexels status diagnostics while leaving local filesystem errors unattributed', async () => {
    const providerHarness = createHarness('stock-resolution', new PexelsApiError(503));
    await providerHarness.run([plan.topic]);
    expect(providerHarness.persisted.at(-1)).toMatchObject({
      error: {provider: 'pexels', kind: 'transport', status: 503},
    });

    const downloadHarness = createHarness(
      'stock-resolution',
      new VideoDownloadError('transport', {status: 403, code: 'timeout'}),
    );
    await downloadHarness.run([plan.topic]);
    expect(downloadHarness.persisted.at(-1)).toMatchObject({
      error: {provider: 'pexels', kind: 'transport', status: 403, code: 'timeout'},
    });

    const localHarness = createHarness(
      'stock-resolution',
      Object.assign(new Error('secret local path'), {code: 'ENOSPC'}),
    );
    await localHarness.run([plan.topic]);
    expect((localHarness.persisted.at(-1) as {error: object}).error).toEqual({
      stage: 'stock-resolution',
      message: 'Stock clip resolution failed',
    });
  });
});
