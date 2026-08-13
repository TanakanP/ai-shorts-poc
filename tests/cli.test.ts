import {describe, expect, it} from 'vitest';
import type {ResolvedScene} from '../src/domain/resolved-video';
import type {VideoPlan} from '../src/domain/video-plan';
import type {CreateShortDeps} from '../src/pipeline/create-short';
import {runCli} from '../src/cli';

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
}));

function createHarness(failAt?: 'generation' | 'stock-resolution' | 'render') {
  const output: string[] = [];
  const errors: string[] = [];
  const persisted: unknown[] = [];
  let receivedTopic: string | undefined;
  const failure = new Error('oa-secret-key px-secret-key https://vendor.example/raw');

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
      '[1/3] Generated 5-scene plan (30s)',
      '[2/3] Resolved 5 stock clips',
      '[3/3] Rendered video',
      `Done: ${runDir}/output.mp4`,
    ]);
    expect(harness.output.join('\n')).toContain(runId);
    expect(harness.errors).toEqual([]);
  });

  it.each([
    ['generation', 'Video plan generation failed'],
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
});
