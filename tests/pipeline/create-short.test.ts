import {describe, expect, it} from 'vitest';
import type {ResolvedScene, ResolvedVideo, StockScene} from '../../src/domain/resolved-video';
import {
  videoPlanFromV3,
  type HookConcept,
  type StoryBeat,
  type VideoPlanV3,
} from '../../src/domain/video-plan';
import {attachChannelOutro} from '../../src/pipeline/attach-channel-outro';
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

const hookA: HookConcept = {
  id: 'hook-a',
  spokenHook: 'The milk is hiding at the back on purpose.',
  displayText: 'MILK IS HIDING',
  curiosityTarget: 'Why is the milk so far from the door?',
  visualIntent: 'Shopper walking toward supermarket dairy refrigerators',
  requiredVisualObjects: ['dairy refrigerators'],
  searchQueries: ['milk supermarket', 'grocery dairy aisle'],
  scores: {
    stopScroll: 5,
    clarity: 5,
    contradiction: 5,
    personalRelevance: 5,
    visualizability: 5,
  },
};

const hookB: HookConcept = {
  id: 'hook-b',
  spokenHook: 'Your grocery walk is the product being sold.',
  displayText: 'THE WALK IS THE PRODUCT',
  curiosityTarget: 'What is the store actually selling besides milk?',
  visualIntent: 'Shopper pushing a cart down a long grocery aisle',
  requiredVisualObjects: ['grocery cart'],
  searchQueries: ['supermarket aisle', 'grocery store walk'],
  scores: {
    stopScroll: 3,
    clarity: 3,
    contradiction: 3,
    personalRelevance: 3,
    visualizability: 3,
  },
};

const hookC: HookConcept = {
  id: 'hook-c',
  spokenHook: 'Staples sit far away so you see everything else first.',
  displayText: 'STAPLES SIT FAR AWAY',
  curiosityTarget: 'Why would a store hide its most needed items?',
  visualIntent: 'Grocery shelves of snacks and fruit along an aisle',
  requiredVisualObjects: ['grocery shelves'],
  searchQueries: ['grocery shelves', 'supermarket snacks fruit'],
  scores: {
    stopScroll: 4,
    clarity: 4,
    contradiction: 4,
    personalRelevance: 4,
    visualizability: 4,
  },
};

const beats: StoryBeat[] = [
  {
    id: 'hook',
    role: 'hook',
    durationSeconds: 6,
    spokenText: hookA.spokenHook,
    displayText: hookA.displayText,
    emphasisWords: [],
    beatPurpose: 'Open the contradiction.',
    newInformation: 'Milk is placed far from the entrance on purpose.',
    curiosityTarget: hookA.curiosityTarget,
    visualIntent: hookA.visualIntent,
    requiredVisualObjects: hookA.requiredVisualObjects,
    searchQueries: hookA.searchQueries,
  },
  {
    id: 'context',
    role: 'context',
    durationSeconds: 6,
    spokenText: 'You cross the whole store.',
    displayText: 'YOU CROSS THE STORE',
    emphasisWords: [],
    beatPurpose: 'Show the cost of the layout.',
    newInformation: 'Reaching milk requires walking the full store.',
    visualIntent: 'Shopper pushing a cart down a long grocery aisle',
    requiredVisualObjects: ['grocery aisle'],
    searchQueries: ['supermarket aisle', 'grocery store walk'],
  },
  {
    id: 'curiosity-reset',
    role: 'curiosity-reset',
    durationSeconds: 6,
    spokenText: 'That exposes more products.',
    displayText: 'MORE PRODUCTS APPEAR',
    emphasisWords: [],
    beatPurpose: 'Open a second gap about extra exposure.',
    newInformation: 'The walk is designed to show more goods.',
    curiosityTarget: 'What does that extra exposure do to a shopper?',
    visualIntent: 'Grocery shelves of snacks and fruit along an aisle',
    requiredVisualObjects: ['snack shelves'],
    searchQueries: ['grocery shelves', 'supermarket snacks fruit'],
  },
  {
    id: 'mechanism',
    role: 'mechanism',
    durationSeconds: 6,
    spokenText: 'Some become impulse buys.',
    displayText: 'IMPULSE BUYS APPEAR',
    emphasisWords: [],
    beatPurpose: 'Explain the hidden system.',
    newInformation: 'Extra exposure converts into unplanned purchases.',
    visualIntent: 'Shopper adding items from an end cap into a cart',
    requiredVisualObjects: ['end cap'],
    searchQueries: ['shopping cart', 'impulse buy grocery'],
  },
  {
    id: 'payoff',
    role: 'payoff',
    durationSeconds: 6,
    spokenText: 'Deliveries also stay efficient.',
    displayText: 'DELIVERIES STAY EFFICIENT',
    emphasisWords: [],
    beatPurpose: 'Reframe the layout as more than a trick.',
    newInformation: 'Back-wall staples also keep restocking efficient.',
    visualIntent: 'Grocery delivery crates stacked at a loading dock',
    requiredVisualObjects: ['loading dock'],
    searchQueries: ['grocery delivery', 'supermarket loading dock'],
  },
];

const plan: VideoPlanV3 = {
  formatVersion: 'retention-v3',
  topic,
  creativeBrief: research,
  title: 'Why Milk Is Always at the Back',
  viralAngle: 'The store is using your walk, not hiding the milk.',
  contentPattern: 'BALANCED_REVEAL',
  hookCandidates: [hookA, hookB, hookC],
  selectedHookId: 'hook-a',
  beats,
};

const planWithOutro = attachChannelOutro(
  videoPlanFromV3(plan),
  channel.brand,
  channel.signoff,
);

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
    expect(planWithOutro.scenes).toHaveLength(6);
    expect(planWithOutro.scenes.at(-1)?.id).toBe('channel-outro');
    expect(planWithOutro.scenes.at(-1)?.durationSeconds).toBe(4);
    expect(persisted[0]?.path).toBe(`${runDir}/plan.json`);
    expect(persisted[0]?.value).toMatchObject({
      ...plan,
      hookCandidates: expect.any(Array),
      selection: {
        selectedHookId: 'hook-a',
        rule: 'total>clarity>visualizability>stopScroll>id',
      },
    });
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
    expect(persisted[3]?.path).toBe(`${runDir}/run.json`);
    expect(persisted[3]?.value).toMatchObject({
      runId,
      formatVersion: 'retention-v3',
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

  it('writes formatVersion retention-v3 to plan.json', async () => {
    const {deps, persisted} = fakeDeps([]);
    await createShort(topic, deps);
    const persistedPlan = persisted.find((entry) => entry.path.endsWith('plan.json'))?.value as VideoPlanV3;
    expect(persistedPlan.formatVersion).toBe('retention-v3');
  });

  it('persists all three hook candidates', async () => {
    const {deps, persisted} = fakeDeps([]);
    await createShort(topic, deps);
    const persistedPlan = persisted.find((entry) => entry.path.endsWith('plan.json'))?.value as {
      hookCandidates: Array<{id: string}>;
    };
    expect(persistedPlan.hookCandidates.map((candidate) => candidate.id)).toEqual([
      'hook-a',
      'hook-b',
      'hook-c',
    ]);
  });

  it('persists every hook sub-score', async () => {
    const {deps, persisted} = fakeDeps([]);
    await createShort(topic, deps);
    const persistedPlan = persisted.find((entry) => entry.path.endsWith('plan.json'))?.value as {
      hookCandidates: Array<{id: string; scores: HookConcept['scores']}>;
    };
    expect(persistedPlan.hookCandidates.find((candidate) => candidate.id === 'hook-a')?.scores).toEqual(
      hookA.scores,
    );
    expect(persistedPlan.hookCandidates.find((candidate) => candidate.id === 'hook-b')?.scores).toEqual(
      hookB.scores,
    );
    expect(persistedPlan.hookCandidates.find((candidate) => candidate.id === 'hook-c')?.scores).toEqual(
      hookC.scores,
    );
  });

  it('persists computed total score for every hook', async () => {
    const {deps, persisted} = fakeDeps([]);
    await createShort(topic, deps);
    const persistedPlan = persisted.find((entry) => entry.path.endsWith('plan.json'))?.value as {
      hookCandidates: Array<{id: string; totalScore: number}>;
    };
    expect(persistedPlan.hookCandidates.find((candidate) => candidate.id === 'hook-a')?.totalScore).toBe(25);
    expect(persistedPlan.hookCandidates.find((candidate) => candidate.id === 'hook-b')?.totalScore).toBe(15);
    expect(persistedPlan.hookCandidates.find((candidate) => candidate.id === 'hook-c')?.totalScore).toBe(20);
  });

  it('persists selectedHookId', async () => {
    const {deps, persisted} = fakeDeps([]);
    await createShort(topic, deps);
    const persistedPlan = persisted.find((entry) => entry.path.endsWith('plan.json'))?.value as {
      selectedHookId: string;
    };
    expect(persistedPlan.selectedHookId).toBe('hook-a');
  });

  it('persists selected hook tie-break metadata when a tie occurs', async () => {
    const {deps, persisted} = fakeDeps([]);
    await createShort(topic, deps);
    const persistedPlan = persisted.find((entry) => entry.path.endsWith('plan.json'))?.value as {
      selection: {selectedHookId: string; rule: string};
    };
    expect(persistedPlan.selection).toEqual({
      selectedHookId: 'hook-a',
      rule: 'total>clarity>visualizability>stopScroll>id',
    });
  });

  it('persists five story beats with beatPurpose/newInformation/curiosityTarget', async () => {
    const {deps, persisted} = fakeDeps([]);
    await createShort(topic, deps);
    const persistedPlan = persisted.find((entry) => entry.path.endsWith('plan.json'))?.value as VideoPlanV3;
    expect(persistedPlan.beats).toHaveLength(5);
    expect(persistedPlan.beats.map((beat) => beat.role)).toEqual([
      'hook',
      'context',
      'curiosity-reset',
      'mechanism',
      'payoff',
    ]);
    expect(persistedPlan.beats.every((beat) => beat.beatPurpose.length > 0)).toBe(true);
    expect(persistedPlan.beats.every((beat) => beat.newInformation.length > 0)).toBe(true);
    expect(persistedPlan.beats[0]?.curiosityTarget).toBe(hookA.curiosityTarget);
    expect(persistedPlan.beats[2]?.curiosityTarget).toBeTruthy();
  });

  it('persists spokenText and displayText', async () => {
    const {deps, persisted} = fakeDeps([]);
    await createShort(topic, deps);
    const persistedPlan = persisted.find((entry) => entry.path.endsWith('plan.json'))?.value as VideoPlanV3;
    expect(persistedPlan.beats[0]?.spokenText).toBe(hookA.spokenHook);
    expect(persistedPlan.beats[0]?.displayText).toBe(hookA.displayText);
  });

  it('persists requiredVisualObjects and all search queries', async () => {
    const {deps, persisted} = fakeDeps([]);
    await createShort(topic, deps);
    const persistedPlan = persisted.find((entry) => entry.path.endsWith('plan.json'))?.value as VideoPlanV3;
    expect(persistedPlan.beats[0]?.requiredVisualObjects).toEqual(hookA.requiredVisualObjects);
    expect(persistedPlan.beats.map((beat) => beat.searchQueries)).toEqual(beats.map((beat) => beat.searchQueries));
  });

  it('keeps selectedSearchQuery in resolved.json', async () => {
    const {deps, persisted} = fakeDeps([]);
    await createShort(topic, deps);
    const persistedResolved = persisted.find((entry) => entry.path.endsWith('resolved.json'))?.value as ResolvedVideo;
    expect(persistedResolved.scenes.every((scene) => scene.selectedSearchQuery.length > 0)).toBe(true);
    expect(persistedResolved.scenes[0]?.selectedSearchQuery).toBe(hookA.searchQueries[0]);
  });

  it('writes V3 run summary fields to run.json', async () => {
    const {deps, persisted} = fakeDeps([]);
    await createShort(topic, deps);
    const persistedRun = persisted.find((entry) => entry.path.endsWith('run.json'))?.value as Record<string, unknown>;
    expect(persistedRun).toMatchObject({
      formatVersion: 'retention-v3',
      topic,
      contentPattern: 'BALANCED_REVEAL',
      selectedHookId: 'hook-a',
      selectedHookTotalScore: 25,
      storyDurationSeconds: 30,
      finalDurationSeconds: 37.8,
      beatCount: 5,
      spokenWordCounts: [9, 5, 4, 4, 4],
      displayWordCounts: [3, 4, 3, 3, 3],
      selectedSearchQueries: [
        'milk supermarket',
        'supermarket aisle',
        'grocery shelves',
        'shopping cart',
        'grocery delivery',
      ],
    });
  });

  it('never writes API keys or provider Authorization headers', async () => {
    const {deps, persisted} = fakeDeps([]);
    await createShort(topic, deps);
    const serialized = JSON.stringify(persisted);
    expect(serialized).not.toMatch(/sk-|Authorization|OPENAI_API_KEY|PEXELS_API_KEY|XAI_API_KEY/i);
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
