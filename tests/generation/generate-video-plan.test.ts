import {readFileSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {parseVideoPlan, videoPlanSchema} from '../../src/domain/video-plan';
import {
  createOpenAIStructuredPlanGenerator,
  formatPlanInput,
  generateVideoPlan,
} from '../../src/generation/generate-video-plan';
import {VIDEO_PLAN_SYSTEM_PROMPT} from '../../src/generation/prompt';
import type {VideoPlan} from '../../src/domain/video-plan';

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/video-plan.json', import.meta.url), 'utf8'),
) as VideoPlan;

const copyFixture = (): VideoPlan => structuredClone(fixture);

describe('videoPlanSchema', () => {
  it('accepts a 4-scene 24-second plan', () => {
    expect(parseVideoPlan(copyFixture())).toEqual(fixture);
  });

  it('rejects fewer than 4 scenes', () => {
    const plan = copyFixture();
    plan.scenes = plan.scenes.slice(0, 3).map((scene) => ({...scene, durationSeconds: 8}));

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects more than 4 scenes', () => {
    const plan = copyFixture();
    plan.scenes.push({...plan.scenes[0], id: 'extra-scene'});

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('accepts a 16-second four-scene plan', () => {
    const plan = copyFixture();
    plan.scenes = plan.scenes.map((scene) => ({...scene, durationSeconds: 4}));

    expect(parseVideoPlan(plan).scenes).toHaveLength(4);
  });

  it('accepts a 32-second four-scene plan', () => {
    const plan = copyFixture();
    plan.scenes = plan.scenes.map((scene) => ({...scene, durationSeconds: 8}));

    expect(parseVideoPlan(plan).scenes).toHaveLength(4);
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

  it('rejects blank text or searchQuery', () => {
    for (const field of ['text', 'searchQuery'] as const) {
      const plan = copyFixture();
      plan.scenes[0][field] = ' ';

      expect(() => videoPlanSchema.parse(plan)).toThrow();
    }
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
      {...fixture.scenes[0], text: 'x'.repeat(101)},
      {...fixture.scenes[0], searchQuery: 'x'},
      {...fixture.scenes[0], searchQuery: 'x'.repeat(81)},
    ];

    for (const scene of invalidScenes) {
      const plan = copyFixture();
      plan.scenes[0] = scene;
      expect(() => videoPlanSchema.parse(plan)).toThrow();
    }
  });
});

describe('generateVideoPlan', () => {
  it('trims the topic before generation', async () => {
    const generateStructured = vi.fn().mockResolvedValue(copyFixture());

    await generateVideoPlan(`  ${fixture.topic}  `, {
      generateStructured,
      research: '  Explain supermarket staple placement.  ',
    });

    expect(generateStructured).toHaveBeenCalledWith({
      system: VIDEO_PLAN_SYSTEM_PROMPT,
      input: formatPlanInput(fixture.topic, 'Explain supermarket staple placement.'),
    });
  });

  it('rejects a research brief that is too short', async () => {
    const generateStructured = vi.fn();

    await expect(
      generateVideoPlan(fixture.topic, {generateStructured, research: 'too short'}),
    ).rejects.toThrow(/research/i);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it('omits the research block when no brief is provided', async () => {
    const generateStructured = vi.fn().mockResolvedValue(copyFixture());

    await generateVideoPlan(fixture.topic, {generateStructured, research: '  '});

    expect(generateStructured).toHaveBeenCalledWith({
      system: VIDEO_PLAN_SYSTEM_PROMPT,
      input: formatPlanInput(fixture.topic),
    });
    expect(generateStructured.mock.calls[0]?.[0]?.input).not.toMatch(/RESEARCH BRIEF/);
  });

  it('rejects topics shorter than 3 characters', async () => {
    const generateStructured = vi.fn();

    await expect(
      generateVideoPlan('  no  ', {
        generateStructured,
        research: 'Explain supermarket staple placement in enough detail.',
      }),
    ).rejects.toThrow('Topic must be at least 3 characters');
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it('returns valid generated data', async () => {
    await expect(
      generateVideoPlan(fixture.topic, {
        generateStructured: async () => copyFixture(),
        research: 'Explain supermarket staple placement in enough detail.',
      }),
    ).resolves.toEqual(fixture);
  });

  it('rejects invalid AI data', async () => {
    const invalidPlan = {...copyFixture(), scenes: fixture.scenes.slice(0, 3)};

    await expect(
      generateVideoPlan(fixture.topic, {
        generateStructured: async () => invalidPlan,
        research: 'Explain supermarket staple placement in enough detail.',
      }),
    ).rejects.toThrow();
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

  it('tells the model to follow a research brief when one is present', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/research brief/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/well-supported/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/optional/i);
  });

  it('asks for exactly 4 educational scenes and a delayed answer', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/exactly 4 educational scenes/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/do not give the answer in scene 1/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/you/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/logistics/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/visible objects/i);
  });
});

describe('formatPlanInput', () => {
  it('sends topic and research brief as labeled blocks', () => {
    expect(formatPlanInput('Why milk is at the back', 'Explain retail layout strategy.')).toContain(
      'TOPIC:\nWhy milk is at the back',
    );
    expect(formatPlanInput('Why milk is at the back', 'Explain retail layout strategy.')).toContain(
      'RESEARCH BRIEF:\nExplain retail layout strategy.',
    );
  });

  it('sends only the topic when research is omitted', () => {
    expect(formatPlanInput('Why milk is at the back')).toBe('TOPIC:\nWhy milk is at the back');
    expect(formatPlanInput('Why milk is at the back', '   ')).toBe('TOPIC:\nWhy milk is at the back');
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
