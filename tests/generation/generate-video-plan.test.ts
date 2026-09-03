import {readFileSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {zodTextFormat} from 'openai/helpers/zod';
import {
  hookCandidatesEnvelopeSchema,
  isGenericQuestionHook,
  parseVideoPlan,
  storyBeatsEnvelopeSchema,
  videoPlanSchema,
} from '../../src/domain/video-plan';
import type {
  HookConcept,
  StoryBeat,
  VideoPlan,
} from '../../src/domain/video-plan';
import {
  createOpenAIStructuredPlanGenerator,
  formatPlanInput,
  generateVideoPlan,
} from '../../src/generation/generate-video-plan';
import type {GenerateStoryInput} from '../../src/generation/generate-story';
import {VIDEO_PLAN_SYSTEM_PROMPT} from '../../src/generation/prompt';
import {selectHook} from '../../src/generation/select-hook';

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/video-plan.json', import.meta.url), 'utf8'),
) as VideoPlan;

const copyFixture = (): VideoPlan => structuredClone(fixture);

describe('videoPlanSchema', () => {
  it('accepts a 5-scene 30-second plan', () => {
    expect(parseVideoPlan(copyFixture())).toEqual(fixture);
  });

  it('rejects fewer than 5 scenes', () => {
    const plan = copyFixture();
    plan.scenes = plan.scenes.slice(0, 4).map((scene) => ({...scene, durationSeconds: 8}));

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects more than 5 scenes', () => {
    const plan = copyFixture();
    plan.scenes.push({...plan.scenes[0], id: 'extra-scene'});

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('accepts a 20-second five-scene plan', () => {
    const plan = copyFixture();
    plan.scenes = plan.scenes.map((scene) => ({...scene, durationSeconds: 4}));

    expect(parseVideoPlan(plan).scenes).toHaveLength(5);
  });

  it('accepts a 40-second five-scene plan', () => {
    const plan = copyFixture();
    plan.scenes = plan.scenes.map((scene) => ({...scene, durationSeconds: 8}));

    expect(parseVideoPlan(plan).scenes).toHaveLength(5);
  });

  it('accepts caption bars in scene text', () => {
    const plan = copyFixture();
    plan.scenes[0].text = 'Milk is at the back of the store | because your walk is valuable.';

    expect(parseVideoPlan(plan).scenes[0]?.text).toContain('|');
  });

  it('rejects empty caption-bar segments', () => {
    const plan = copyFixture();
    plan.scenes[0].text = 'Milk is at the back | | because your walk is valuable.';

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects more than two caption bars', () => {
    const plan = copyFixture();
    plan.scenes[0].text = 'Milk | is | at | the back.';

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects blank text', () => {
    const plan = copyFixture();
    plan.scenes[0].text = ' ';

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects a generic question hook', () => {
    const plan = copyFixture();
    plan.scenes[0].text = 'Why is milk always at the back?';
    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects educational roles in the wrong order', () => {
    const plan = copyFixture();
    plan.scenes[0].role = 'payoff';
    plan.scenes[4].role = 'hook';
    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects fewer than two search queries', () => {
    const plan = copyFixture();
    plan.scenes[0].searchQueries = ['supermarket milk fridge'];
    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects a blank search query array', () => {
    const plan = copyFixture();
    plan.scenes[0].searchQueries = [];
    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects more than three search queries', () => {
    const plan = copyFixture();
    plan.scenes[0].searchQueries = [
      'supermarket milk fridge',
      'grocery dairy aisle',
      'milk refrigerator closeup',
      'store dairy wall',
    ];
    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects a too-short search query', () => {
    const plan = copyFixture();
    plan.scenes[0].searchQueries = ['ab', 'grocery dairy aisle'];
    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects duplicate search queries in a scene', () => {
    const plan = copyFixture();
    plan.scenes[0].searchQueries = ['supermarket milk fridge', 'supermarket milk fridge'];
    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects blank visual intent', () => {
    const plan = copyFixture();
    plan.scenes[0].visualIntent = '  ';
    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects a missing viralAngle', () => {
    const plan = copyFixture();
    delete (plan as {viralAngle?: string}).viralAngle;
    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('treats Why/How/What/Ever wonder openings as generic hooks', () => {
    expect(isGenericQuestionHook('Why is milk at the back?')).toBe(true);
    expect(isGenericQuestionHook('Ever wonder why milk hides?')).toBe(true);
    expect(isGenericQuestionHook('Stores hide the milk on purpose.')).toBe(false);
  });

  it('rejects duplicate scene ids', () => {
    const plan = copyFixture();
    plan.scenes[1].id = plan.scenes[0].id;

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('enforces title and topic length limits', () => {
    expect(() => videoPlanSchema.parse({...copyFixture(), title: 'tiny'})).toThrow();
    expect(() => videoPlanSchema.parse({...copyFixture(), title: 'x'.repeat(91)})).toThrow();
    expect(() => videoPlanSchema.parse({...copyFixture(), topic: 'no'})).toThrow();
    expect(() => videoPlanSchema.parse({...copyFixture(), topic: 'x'.repeat(201)})).toThrow();
  });

  it('enforces scene field formats and length limits', () => {
    const invalidScenes = [
      {...fixture.scenes[0], id: 'Not Valid'},
      {...fixture.scenes[0], durationSeconds: 3},
      {...fixture.scenes[0], durationSeconds: 9},
      {...fixture.scenes[0], durationSeconds: 6.5},
      {...fixture.scenes[0], text: 'abc'},
      {...fixture.scenes[0], text: 'x'.repeat(161)},
      {...fixture.scenes[0], searchQueries: ['x', 'grocery dairy aisle']},
      {...fixture.scenes[0], searchQueries: ['x'.repeat(81), 'grocery dairy aisle']},
    ];

    for (const scene of invalidScenes) {
      const plan = copyFixture();
      plan.scenes[0] = scene;
      expect(() => videoPlanSchema.parse(plan)).toThrow();
    }
  });
});

const hookA: HookConcept = {
  id: 'hook-a',
  spokenHook: 'A runway can change its number without moving.',
  displayText: 'SAME RUNWAY. NEW NUMBER.',
  curiosityTarget: 'How can a fixed runway need a different number?',
  visualIntent: 'Airport runway threshold with large runway numbers visible',
  requiredVisualObjects: ['runway number marking'],
  searchQueries: ['airport runway number', 'runway threshold marking'],
  scores: {
    stopScroll: 3,
    clarity: 3,
    contradiction: 3,
    personalRelevance: 3,
    visualizability: 3,
  },
};

const hookB: HookConcept = {
  id: 'hook-b',
  spokenHook: 'The painted number on a runway is not a permanent name.',
  displayText: 'NUMBERS ARE NOT NAMES',
  curiosityTarget: 'Why would a runway keep the same strip and lose its number?',
  visualIntent: 'Close-up of large painted runway numbers on asphalt',
  requiredVisualObjects: ['painted runway digits'],
  searchQueries: ['painted runway numbers', 'asphalt runway marking'],
  scores: {
    stopScroll: 5,
    clarity: 5,
    contradiction: 5,
    personalRelevance: 5,
    visualizability: 5,
  },
};

const hookC: HookConcept = {
  id: 'hook-c',
  spokenHook: 'A runway can keep the same asphalt and still get a new identity.',
  displayText: 'NEW IDENTITY. SAME STRIP.',
  curiosityTarget: 'What identity can change if the pavement never moves?',
  visualIntent: 'Aerial view of a single runway with visible threshold numbers',
  requiredVisualObjects: ['aerial runway threshold'],
  searchQueries: ['aerial airport runway', 'runway threshold aerial'],
  scores: {
    stopScroll: 4,
    clarity: 4,
    contradiction: 4,
    personalRelevance: 4,
    visualizability: 4,
  },
};

const topic = 'Why runway numbers change';
const creativeBrief =
  'Punchy BALANCED_REVEAL about magnetic heading. Ban jargon. Close on the field moving.';

const validHookCandidates = (): HookConcept[] => structuredClone([hookA, hookB, hookC]);

const beatsForHook = (hook: HookConcept): StoryBeat[] => [
  {
    id: 'hook',
    role: 'hook',
    durationSeconds: 3,
    spokenText: hook.spokenHook,
    displayText: hook.displayText,
    emphasisWords: [],
    beatPurpose: 'Create an impossible-sounding contradiction.',
    newInformation: 'Runway numbers can change while the runway stays fixed.',
    curiosityTarget: hook.curiosityTarget,
    visualIntent: hook.visualIntent,
    requiredVisualObjects: [...hook.requiredVisualObjects],
    searchQueries: [...hook.searchQueries],
  },
  {
    id: 'context',
    role: 'context',
    durationSeconds: 5,
    spokenText: 'That number is a magnetic heading, not a permanent name.',
    displayText: 'HEADING, NOT A NAME',
    emphasisWords: ['HEADING'],
    beatPurpose: 'Orient the viewer to what runway numbers actually mean.',
    newInformation: 'Runway numbers come from magnetic heading rather than a fixed label.',
    visualIntent: 'Compass heading overlay on an airport runway',
    requiredVisualObjects: ['runway heading sign'],
    searchQueries: ['airport runway heading sign', 'runway compass marking'],
  },
  {
    id: 'curiosity-reset',
    role: 'curiosity-reset',
    durationSeconds: 5,
    spokenText: 'Magnetic north itself keeps drifting, so the heading can go stale.',
    displayText: 'NORTH KEEPS DRIFTING',
    emphasisWords: ['DRIFTING'],
    beatPurpose: 'Open a second gap by showing the heading can become wrong.',
    newInformation: 'Magnetic north drift can make a correct runway number outdated.',
    curiosityTarget: 'What happens when the painted heading no longer matches magnetic north?',
    visualIntent: 'Airport workers painting a new runway number on asphalt',
    requiredVisualObjects: ['runway painting crew'],
    searchQueries: ['runway number painting', 'airport runway repaint'],
  },
  {
    id: 'mechanism',
    role: 'mechanism',
    durationSeconds: 6,
    spokenText: 'Airports then repaint the digits after a heading shift of about ten degrees.',
    displayText: 'REPAINT AFTER TEN DEGREES',
    emphasisWords: ['REPAINT'],
    beatPurpose: 'Explain the threshold that forces a new runway number.',
    newInformation: 'A roughly ten-degree magnetic shift triggers a runway number change.',
    visualIntent: 'Close-up of freshly painted runway digits on asphalt',
    requiredVisualObjects: ['fresh runway digits'],
    searchQueries: ['fresh runway numbers', 'painted runway threshold'],
  },
  {
    id: 'payoff',
    role: 'payoff',
    durationSeconds: 5,
    spokenText: 'The concrete never moved. The planet magnetic field did.',
    displayText: 'THE FIELD MOVED',
    emphasisWords: ['FIELD'],
    beatPurpose: 'Reframe the contradiction as a planetary change, not a construction trick.',
    newInformation: 'The runway stays put while Earth magnetic field shifts the heading.',
    visualIntent: 'Long still shot of an unchanged runway under open sky',
    requiredVisualObjects: ['unchanged runway'],
    searchQueries: ['empty airport runway', 'runway vanishing point'],
  },
];

function stubPlanProviders(options?: {
  hooks?: HookConcept[] | (() => Promise<HookConcept[]>);
  story?: StoryBeat[] | ((input: GenerateStoryInput) => Promise<StoryBeat[]>);
}) {
  const calls: string[] = [];
  const generateHooks = vi.fn(async (_topic: string, _creativeBrief: string) => {
    calls.push('hooks');
    if (typeof options?.hooks === 'function') return options.hooks();
    return options?.hooks ?? validHookCandidates();
  });
  const generateStory = vi.fn(async (input: GenerateStoryInput) => {
    calls.push('story');
    if (typeof options?.story === 'function') return options.story(input);
    if (options?.story) return options.story;
    return beatsForHook(input.selectedHook);
  });
  return {calls, generateHooks, generateStory};
}

describe('generateVideoPlan', () => {
  it('preserves topic + second CLI argument generation contract', async () => {
    const {generateHooks, generateStory} = stubPlanProviders();

    await generateVideoPlan(`  ${topic}  `, {
      research: `  ${creativeBrief}  `,
      generateHooks,
      generateStory,
    });

    expect(generateHooks).toHaveBeenCalledWith(topic, creativeBrief);
    expect(generateStory.mock.calls[0]?.[0]).toMatchObject({
      topic,
      creativeBrief,
    });
  });

  it('treats the second argument as the creative brief', async () => {
    const brief =
      'Punchy PERSONAL_STAKES about magnetic heading. Ban jargon. Close on the field moving.';
    const {generateHooks, generateStory} = stubPlanProviders();

    const plan = await generateVideoPlan(topic, {
      research: `  ${brief}  `,
      generateHooks,
      generateStory,
    });

    expect(generateHooks).toHaveBeenCalledWith(topic, brief);
    expect(generateStory.mock.calls[0]?.[0]?.creativeBrief).toBe(brief);
    expect(generateStory.mock.calls[0]?.[0]?.contentPattern).toBe('PERSONAL_STAKES');
    expect(plan.creativeBrief).toBe(brief);
    expect(plan.contentPattern).toBe('PERSONAL_STAKES');
  });

  it('generates hooks before generating the story', async () => {
    const {calls, generateHooks, generateStory} = stubPlanProviders();

    await generateVideoPlan(topic, {
      research: creativeBrief,
      generateHooks,
      generateStory,
    });

    expect(calls).toEqual(['hooks', 'story']);
    expect(generateHooks).toHaveBeenCalledTimes(1);
    expect(generateStory).toHaveBeenCalledTimes(1);
  });

  it('selects the hook in code using selectHook', async () => {
    const candidates = validHookCandidates();
    const {generateHooks, generateStory} = stubPlanProviders({hooks: candidates});

    const plan = await generateVideoPlan(topic, {
      research: creativeBrief,
      generateHooks,
      generateStory,
    });

    expect(selectHook(candidates).id).toBe('hook-b');
    expect(generateStory.mock.calls[0]?.[0]?.selectedHook).toEqual(selectHook(candidates));
    expect(plan.selectedHookId).toBe('hook-b');
  });

  it('passes only the selected hook into story generation', async () => {
    const candidates = validHookCandidates();
    const {generateHooks, generateStory} = stubPlanProviders({hooks: candidates});

    await generateVideoPlan(topic, {
      research: creativeBrief,
      generateHooks,
      generateStory,
    });

    expect(generateStory).toHaveBeenCalledWith({
      topic,
      creativeBrief,
      contentPattern: 'BALANCED_REVEAL',
      selectedHook: selectHook(candidates),
    });
    expect(generateStory.mock.calls[0]?.[0]).not.toHaveProperty('hookCandidates');
  });

  it('persists all three hook candidates in the returned plan', async () => {
    const candidates = validHookCandidates();
    const {generateHooks, generateStory} = stubPlanProviders({hooks: candidates});

    const plan = await generateVideoPlan(topic, {
      research: creativeBrief,
      generateHooks,
      generateStory,
    });

    expect(plan.hookCandidates).toEqual(candidates);
    expect(plan.hookCandidates).toHaveLength(3);
    expect(plan.hookCandidates.map((hook) => hook.id)).toEqual(['hook-a', 'hook-b', 'hook-c']);
  });

  it('persists selectedHookId computed by code', async () => {
    const candidates = validHookCandidates();
    const {generateHooks, generateStory} = stubPlanProviders({hooks: candidates});

    const plan = await generateVideoPlan(topic, {
      research: creativeBrief,
      generateHooks,
      generateStory,
    });

    expect(plan.selectedHookId).toBe(selectHook(candidates).id);
    expect(plan.selectedHookId).toBe('hook-b');
    expect(plan.selectedHookId).not.toBe('hook-a');
  });

  it('returns formatVersion retention-v3', async () => {
    const {generateHooks, generateStory} = stubPlanProviders();

    const plan = await generateVideoPlan(topic, {
      research: creativeBrief,
      generateHooks,
      generateStory,
    });

    expect(plan.formatVersion).toBe('retention-v3');
  });

  it('returns exactly five V3 beats', async () => {
    const {generateHooks, generateStory} = stubPlanProviders();

    const plan = await generateVideoPlan(topic, {
      research: creativeBrief,
      generateHooks,
      generateStory,
    });

    expect(plan.beats).toHaveLength(5);
    expect(plan.beats.map((beat) => beat.role)).toEqual([
      'hook',
      'context',
      'curiosity-reset',
      'mechanism',
      'payoff',
    ]);
    expect(plan).not.toHaveProperty('scenes');
  });

  it('does not ask the hook provider to choose a winner', async () => {
    const {generateHooks, generateStory} = stubPlanProviders();

    await generateVideoPlan(topic, {
      research: creativeBrief,
      generateHooks,
      generateStory,
    });

    expect(generateHooks.mock.calls[0]).toEqual([topic, creativeBrief]);
    expect(generateHooks.mock.calls[0]).toHaveLength(2);
    expect(JSON.stringify(generateHooks.mock.calls[0])).not.toMatch(/winner|selectedHookId/i);
  });

  it('does not generate a story when hook generation fails', async () => {
    const failure = new Error('hook generation failed');
    const {generateHooks, generateStory} = stubPlanProviders({
      hooks: async () => {
        throw failure;
      },
    });

    await expect(
      generateVideoPlan(topic, {
        research: creativeBrief,
        generateHooks,
        generateStory,
      }),
    ).rejects.toBe(failure);
    expect(generateStory).not.toHaveBeenCalled();
  });

  it('does not generate a story when hook selection input is invalid', async () => {
    const {generateHooks, generateStory} = stubPlanProviders({
      hooks: validHookCandidates().slice(0, 2),
    });

    await expect(
      generateVideoPlan(topic, {
        research: creativeBrief,
        generateHooks,
        generateStory,
      }),
    ).rejects.toThrow('Expected exactly 3 hook candidates; received 2');
    expect(generateStory).not.toHaveBeenCalled();
  });

  it('propagates story validation failure without rendering concerns', async () => {
    const failure = new Error('Hook beat copy and first-frame contract must match the selected hook');
    const {generateHooks, generateStory} = stubPlanProviders({
      story: async () => {
        throw failure;
      },
    });

    await expect(
      generateVideoPlan(topic, {
        research: creativeBrief,
        generateHooks,
        generateStory,
      }),
    ).rejects.toBe(failure);
    expect(generateStory).toHaveBeenCalled();
  });
});

describe('VIDEO_PLAN_SYSTEM_PROMPT', () => {
  it('asks for spoken narration instead of a silent card story', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/spoken narration/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).not.toMatch(/without narration/i);
  });

  it('asks the model to mark on-screen clauses with a bar', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/\|/);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/do not speak the bar/i);
  });

  it('tells the model not to write a channel sign-off', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/do not end with a brand name/i);
  });

  it('treats the second argument as an optional creative brief', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/creative brief/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/tone/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/optional/i);
  });

  it('allows a few xAI speech tags for delivery', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/\[pause\]/);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/<emphasis>/);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).not.toMatch(/do not include speech tags/i);
  });

  it('asks for claim hooks and escalating five beats', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/exactly 5 educational scenes/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/do not start the hook with why/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/stake/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/twist/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/viralAngle|viral angle/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/searchQueries|search queries/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/visualIntent|visual intent/i);
  });
});

describe('formatPlanInput', () => {
  it('sends topic and creative brief as labeled blocks', () => {
    expect(formatPlanInput('Why milk is at the back', 'Tone: sly. Angle: your walk is the product.')).toContain(
      'TOPIC:\nWhy milk is at the back',
    );
    expect(formatPlanInput('Why milk is at the back', 'Tone: sly. Angle: your walk is the product.')).toContain(
      'CREATIVE BRIEF:\nTone: sly. Angle: your walk is the product.',
    );
  });

  it('sends only the topic when the brief is omitted', () => {
    expect(formatPlanInput('Why milk is at the back')).toBe('TOPIC:\nWhy milk is at the back');
    expect(formatPlanInput('Why milk is at the back', '   ')).toBe('TOPIC:\nWhy milk is at the back');
  });
});

describe('OpenAI structured envelopes', () => {
  it('converts hook and story envelopes to strict json schema', () => {
    expect(() => zodTextFormat(hookCandidatesEnvelopeSchema, 'hook_candidates')).not.toThrow();
    expect(() => zodTextFormat(storyBeatsEnvelopeSchema, 'story_beats')).not.toThrow();
  });
});

describe('createOpenAIStructuredPlanGenerator', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses Responses structured output and returns the parsed plan', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'resp_test',
          object: 'response',
          created_at: 0,
          status: 'completed',
          output: [
            {
              id: 'msg_test',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify(fixture),
                  annotations: [],
                  logprobs: [],
                },
              ],
            },
          ],
        }),
        {headers: {'content-type': 'application/json'}},
      ),
    );
    vi.stubGlobal('fetch', fetch);

    const generateStructured = createOpenAIStructuredPlanGenerator('test-key');
    await expect(
      generateStructured({system: 'system instructions', input: fixture.topic}),
    ).resolves.toEqual(fixture);

    const request = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(request).toMatchObject({
      instructions: 'system instructions',
      input: fixture.topic,
      text: {format: {type: 'json_schema', name: 'video_plan', strict: true}},
    });
  });
});
