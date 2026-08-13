import {readFileSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {parseVideoPlan, videoPlanSchema} from '../../src/domain/video-plan';
import {
  createOpenAIStructuredPlanGenerator,
  generateVideoPlan,
} from '../../src/generation/generate-video-plan';
import {VIDEO_PLAN_SYSTEM_PROMPT} from '../../src/generation/prompt';
import type {VideoPlan} from '../../src/domain/video-plan';

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/video-plan.json', import.meta.url), 'utf8'),
) as VideoPlan;

const copyFixture = (): VideoPlan => structuredClone(fixture);

describe('videoPlanSchema', () => {
  it('accepts a 6-scene 36-second plan', () => {
    expect(parseVideoPlan(copyFixture())).toEqual(fixture);
  });

  it('rejects fewer than 5 scenes', () => {
    const plan = copyFixture();
    plan.scenes = plan.scenes
      .slice(0, 4)
      .map((scene) => ({...scene, durationSeconds: 8}));

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects more than 7 scenes', () => {
    const plan = copyFixture();
    plan.scenes.push(
      {...plan.scenes[0], id: 'extra-scene-one'},
      {...plan.scenes[1], id: 'extra-scene-two'},
    );
    plan.scenes = plan.scenes.map((scene) => ({...scene, durationSeconds: 4}));

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects total duration below 30 seconds', () => {
    const plan = copyFixture();
    plan.scenes = plan.scenes.slice(0, 5).map((scene) => ({...scene, durationSeconds: 4}));

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects total duration above 45 seconds', () => {
    const plan = copyFixture();
    plan.scenes = plan.scenes.map((scene) => ({...scene, durationSeconds: 8}));

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

    await generateVideoPlan(`  ${fixture.topic}  `, {generateStructured});

    expect(generateStructured).toHaveBeenCalledWith({
      system: VIDEO_PLAN_SYSTEM_PROMPT,
      input: fixture.topic,
    });
  });

  it('rejects topics shorter than 3 characters', async () => {
    const generateStructured = vi.fn();

    await expect(generateVideoPlan('  no  ', {generateStructured})).rejects.toThrow(
      'Topic must be at least 3 characters',
    );
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it('returns valid generated data', async () => {
    await expect(
      generateVideoPlan(fixture.topic, {generateStructured: async () => copyFixture()}),
    ).resolves.toEqual(fixture);
  });

  it('rejects invalid AI data', async () => {
    const invalidPlan = {...copyFixture(), scenes: fixture.scenes.slice(0, 4)};

    await expect(
      generateVideoPlan(fixture.topic, {generateStructured: async () => invalidPlan}),
    ).rejects.toThrow();
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
