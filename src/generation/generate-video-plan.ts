import OpenAI from 'openai';
import {zodTextFormat} from 'openai/helpers/zod';
import type {ZodType} from 'zod';
import {
  CONTENT_PATTERNS,
  parseVideoPlanV3,
  videoPlanSchema,
  type ContentPattern,
  type HookConcept,
  type StoryBeat,
  type VideoPlanV3,
} from '../domain/video-plan';
import {ProviderError} from '../domain/provider-error';
import {generateHooks} from './generate-hooks';
import {generateStory, type GenerateStoryInput} from './generate-story';
import {selectHook} from './select-hook';

export type StructuredPlanGenerator = (args: {
  system: string;
  input: string;
}) => Promise<unknown>;

export type GenerateVideoPlanDeps = {
  generateStructured?: StructuredPlanGenerator;
  generateHooks?: (topic: string, creativeBrief: string) => Promise<HookConcept[]>;
  generateStory?: (input: GenerateStoryInput) => Promise<StoryBeat[]>;
  research?: string;
};

export function formatPlanInput(topic: string, research?: string): string {
  const trimmedResearch = research?.trim() ?? '';
  if (!trimmedResearch) return `TOPIC:\n${topic}`;
  return `TOPIC:\n${topic}\n\nCREATIVE BRIEF:\n${trimmedResearch}`;
}

export function readContentPattern(creativeBrief: string): ContentPattern | null {
  for (const pattern of CONTENT_PATTERNS) {
    if (creativeBrief.includes(pattern)) return pattern;
  }
  return null;
}

function inferOrReadContentPattern(creativeBrief: string): ContentPattern {
  return readContentPattern(creativeBrief) ?? 'BALANCED_REVEAL';
}

function resolveGenerateHooks(
  deps: GenerateVideoPlanDeps,
): (topic: string, creativeBrief: string) => Promise<HookConcept[]> {
  if (deps.generateHooks) return deps.generateHooks;
  if (!deps.generateStructured) {
    throw new Error('generateHooks or generateStructured is required');
  }
  const generateStructured = deps.generateStructured;
  return (topic, creativeBrief) => generateHooks(topic, creativeBrief, {generateStructured});
}

function resolveGenerateStory(
  deps: GenerateVideoPlanDeps,
): (input: GenerateStoryInput) => Promise<StoryBeat[]> {
  if (deps.generateStory) return deps.generateStory;
  if (!deps.generateStructured) {
    throw new Error('generateStory or generateStructured is required');
  }
  const generateStructured = deps.generateStructured;
  return (input) => generateStory(input, {generateStructured});
}

export async function generateVideoPlan(
  topic: string,
  deps: GenerateVideoPlanDeps,
): Promise<VideoPlanV3> {
  const normalizedTopic = topic.trim();
  if (normalizedTopic.length < 3) throw new Error('Topic must be at least 3 characters');
  const creativeBrief = (deps.research ?? '').trim();

  const generateHooksFn = resolveGenerateHooks(deps);
  const generateStoryFn = resolveGenerateStory(deps);

  const hookCandidates = await generateHooksFn(normalizedTopic, creativeBrief);
  const selectedHook = selectHook(hookCandidates);
  const contentPattern = inferOrReadContentPattern(creativeBrief);
  const beats = await generateStoryFn({
    topic: normalizedTopic,
    creativeBrief,
    contentPattern,
    selectedHook,
  });

  return parseVideoPlanV3({
    formatVersion: 'retention-v3',
    topic: normalizedTopic,
    creativeBrief,
    title: normalizedTopic,
    viralAngle: selectedHook.curiosityTarget,
    contentPattern,
    hookCandidates,
    selectedHookId: selectedHook.id,
    beats,
  });
}

export function createOpenAIStructuredPlanGenerator(
  apiKey: string,
  schema: ZodType = videoPlanSchema,
  schemaName = 'video_plan',
): StructuredPlanGenerator {
  return createStructuredPlanGenerator(apiKey, schema, schemaName, 'openai', 'gpt-5.6');
}

export function createXaiStructuredPlanGenerator(
  apiKey: string,
  schema: ZodType = videoPlanSchema,
  schemaName = 'video_plan',
  model = 'grok-4.3',
): StructuredPlanGenerator {
  return createStructuredPlanGenerator(apiKey, schema, schemaName, 'xai', model);
}

function createStructuredPlanGenerator(
  apiKey: string, schema: ZodType, schemaName: string, provider: 'openai' | 'xai', model: string,
): StructuredPlanGenerator {
  const client = new OpenAI({apiKey, ...(provider === 'xai' ? {baseURL: 'https://api.x.ai/v1'} : {})});

  return async ({system, input}) => {
    try {
      const response = await client.responses.parse({
        model,
        instructions: system,
        input,
        text: {format: zodTextFormat(schema, schemaName)},
      });

      return schema.parse(response.output_parsed);
    } catch (cause) {
      if (cause instanceof ProviderError) throw cause;
      const value = cause as {name?: unknown; status?: unknown; code?: unknown};
      const status = typeof value?.status === 'number' ? value.status : undefined;
      const rawCode = typeof value?.code === 'string' ? value.code.toLowerCase() : undefined;
      const code = rawCode && /^[a-z0-9_-]{1,64}$/.test(rawCode) ? rawCode : undefined;
      const name = typeof value?.name === 'string' ? value.name : '';
      const message = cause instanceof Error ? cause.message : '';
      const isSchemaError = name === 'ZodError' || message.includes('not supported by the API');
      const kind = status === 401 || status === 403
        ? 'auth'
        : status === 429
          ? 'quota'
          : isSchemaError
            ? 'validation'
            : 'transport';
      throw new ProviderError(
        `${provider === 'xai' ? 'xAI' : 'OpenAI'} plan generation failed`,
        {
          provider,
          kind,
          ...(status ? {status} : {}),
          ...(code ? {code} : {}),
          ...(isSchemaError && message ? {detail: message} : {}),
        },
        {cause},
      );
    }
  };
}
