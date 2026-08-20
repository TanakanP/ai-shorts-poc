import {describe, expect, it} from 'vitest';
import type {ResolvedScene, ResolvedVideo, StockScene} from '../../src/domain/resolved-video';
import type {VideoPlan} from '../../src/domain/video-plan';
import {createShort, type CreateShortDeps} from '../../src/pipeline/create-short';
import type {SynthesizeSceneVoicesResult} from '../../src/voice/synthesize-scene-voices';

const topic = 'Why supermarkets put milk at the back';
const runId = '20260813-120000-deadbeef';
const runDir = `/tmp/runs/${runId}`;
const channel = {
  brand: 'Curious Cart',
  signoff: 'If that made you look twice, follow along.',
};
const research = 'Explain supermarket layout and staple placement.';

const plan: VideoPlan = {
  topic,
  title: 'Why Milk Is Always at the Back',
  viralAngle: 'The store is using your walk, not hiding the milk.',
  scenes: [
    {
      id: 'hook',
      role: 'hook',
      durationSeconds: 6,
      text: 'The milk is hiding.',
      visualIntent: 'Shopper walking toward supermarket dairy refrigerators',
      searchQueries: ['milk supermarket', 'grocery dairy aisle'],
    },
    {
      id: 'walk',
      role: 'stake',
      durationSeconds: 6,
      text: 'You cross the whole store.',
      visualIntent: 'Shopper pushing a cart down a long grocery aisle',
      searchQueries: ['supermarket aisle', 'grocery store walk'],
    },
    {
      id: 'see',
      role: 'proof',
      durationSeconds: 6,
      text: 'That exposes more products.',
      visualIntent: 'Grocery shelves of snacks and fruit along an aisle',
      searchQueries: ['grocery shelves', 'supermarket snacks fruit'],
    },
    {
      id: 'buy',
      role: 'payoff',
      durationSeconds: 6,
      text: 'Some become impulse buys.',
      visualIntent: 'Shopper adding items from an end cap into a cart',
      searchQueries: ['shopping cart', 'impulse buy grocery'],
    },
    {
      id: 'fresh',
      role: 'payoff',
      durationSeconds: 6,
      text: 'Deliveries also stay efficient.',
      visualIntent: 'Grocery delivery crates stacked at a loading dock',
      searchQueries: ['grocery delivery', 'supermarket loading dock'],
    },
  ],
};

const planWithOutro: VideoPlan = {
  ...plan,
  scenes: [
    ...plan.scenes,
    {
      id: 'channel-outro',
      role: 'outro',
      durationSeconds: 4,
      text: 'Curious Cart. | If that made you look twice, follow along.',
      visualIntent: 'Shopper walking toward supermarket dairy refrigerators',
      searchQueries: ['milk supermarket', 'grocery dairy aisle'],
    },
  ],
};

const voiceResult: SynthesizeSceneVoicesResult = {
  timedPlan: {
    ...planWithOutro,
    scenes: planWithOutro.scenes.map((scene) => ({...scene, durationSeconds: 6.3})),
  },
  manifest: {
    voiceId: 'eve',
    language: 'en',
    scenes: planWithOutro.scenes.map((scene, index) => ({
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
  selectedSearchQuery: scene.searchQueries[0] ?? '',
  sourcePageUrl: `https://example.com/videos/${index + 1}`,
  creatorName: `Creator ${index + 1}`,
  creatorUrl: `https://example.com/creators/${index + 1}`,
  localVideoPath: `${runDir}/scene-${String(index + 1).padStart(2, '0')}.mp4`,
}));

const resolvedScenes: ResolvedScene[] = stockScenes.map((scene, index) => ({
  ...scene,
  localAudioPath: `${runDir}/voice-${String(index + 1).padStart(2, '0')}.mp3`,
  audioDurationSeconds: 6,
  words: voiceResult.manifest.scenes[index].words,
}));

const firstResolved = resolvedScenes[0];
const lastResolved = resolvedScenes.at(-1);
const loopedScenes: ResolvedScene[] = [
  ...resolvedScenes.slice(0, -1),
  {
    ...lastResolved!,
    localVideoPath: firstResolved.localVideoPath,
    sourcePageUrl: firstResolved.sourcePageUrl,
    creatorName: firstResolved.creatorName,
    creatorUrl: firstResolved.creatorUrl,
  },
];

function fakeDeps(events: string[], failAt?: 'generation' | 'voice' | 'stock-resolution' | 'render') {
  const persisted: Array<{path: string; value: unknown}> = [];
  const failure = failAt ? new Error(`${failAt} failed`) : undefined;

  const deps: CreateShortDeps = {
    createRunDirectory: async () => {
      events.push('create run dir');
      return {runId, runDir};
    },
    channel,
    research,
    backgroundMusicPath: 'assets/music/SOUNDTRACK.mp3',
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
      expect(receivedPlan).toEqual(planWithOutro);
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
        backgroundMusicPath: 'assets/music/SOUNDTRACK.mp3',
        scenes: loopedScenes,
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
    expect(persisted[0]).toEqual({path: `${runDir}/plan.json`, value: planWithOutro});
    expect(persisted[1]).toEqual({path: `${runDir}/voice.json`, value: voiceResult.manifest});
    expect(persisted[2]).toEqual({
      path: `${runDir}/resolved.json`,
      value: {
        runId,
        title: plan.title,
        fps: 30,
        width: 1080,
        height: 1920,
        backgroundMusicPath: 'assets/music/SOUNDTRACK.mp3',
        scenes: loopedScenes,
      },
    });
    const persistedResolved = persisted[2]?.value as ResolvedVideo;
    const lastPersistedScene = persistedResolved.scenes.at(-1);
    expect(lastPersistedScene?.localVideoPath).toBe(`${runDir}/scene-01.mp4`);
    expect(lastPersistedScene?.creatorName).toBe('Creator 1');
    expect(persisted[3]).toEqual({
      path: `${runDir}/run.json`,
      value: {
        runId,
        topic,
        research,
        channel,
        status: 'rendered',
        startedAt: expect.any(String),
        finishedAt: expect.any(String),
        attribution: loopedScenes.map(({sourcePageUrl, creatorName, creatorUrl}) => ({
          sourcePageUrl,
          creatorName,
          creatorUrl,
        })),
      },
    });
    const persistedAttribution = (
      persisted[3]?.value as {
        attribution: Array<{sourcePageUrl: string; creatorName: string; creatorUrl: string}>;
      }
    ).attribution;
    expect(persistedAttribution.at(-1)).toEqual({
      sourcePageUrl: firstResolved.sourcePageUrl,
      creatorName: firstResolved.creatorName,
      creatorUrl: firstResolved.creatorUrl,
    });
  });

  it('fails stock-resolution when a voice scene has no words', async () => {
    const events: string[] = [];
    const {deps} = fakeDeps(events);
    const empty = {
      ...voiceResult,
      manifest: {
        ...voiceResult.manifest,
        scenes: voiceResult.manifest.scenes.map((scene, index) =>
          index === 0 ? {...scene, words: []} : scene,
        ),
      },
    };
    deps.synthesizeSceneVoices = async () => empty;

    await expect(createShort(topic, deps)).rejects.toThrow(/words/i);
    expect(events).toContain('persist run.json:failed');
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
          research,
          channel,
          status: 'failed',
          startedAt: expect.any(String),
          finishedAt: expect.any(String),
          error: {stage, message: `${stage} failed`},
          ...(stage === 'render'
            ? {
                attribution: loopedScenes.map(({sourcePageUrl, creatorName, creatorUrl}) => ({
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
