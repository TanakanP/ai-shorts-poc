import OpenAI from 'openai';
import {zodTextFormat} from 'openai/helpers/zod';
import {Agent, fetch as undiciFetch} from 'undici';
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
import {transportFailureDiagnostic} from '../domain/transport-diagnostic';
import {generateHooks} from './generate-hooks';
import {generateStory, type GenerateStoryInput} from './generate-story';
import {selectHook} from './select-hook';
import {DEFAULT_OPENAI_SCRIPT_MODEL} from '../config';

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
  model = DEFAULT_OPENAI_SCRIPT_MODEL,
): StructuredPlanGenerator {
  return createStructuredPlanGenerator(apiKey, schema, schemaName, 'openai', model);
}

export const XAI_PLAN_TIMEOUT_MS = 15 * 60 * 1000;

const defaultFetch = globalThis.fetch;

function xaiFetch(dispatcher: Agent) {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (globalThis.fetch !== defaultFetch) {
      return globalThis.fetch(input, init);
    }
    const url = input instanceof Request ? input.url : String(input);
    return undiciFetch(url, {...init, dispatcher} as Parameters<typeof undiciFetch>[1]) as unknown as Promise<Response>;
  };
}

export function xaiPlanClientOptions(apiKey: string, timeoutMs = XAI_PLAN_TIMEOUT_MS) {
  const dispatcher = new Agent({
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
    keepAliveTimeout: 1,
    keepAliveMaxTimeout: 1,
  });
  return {
    apiKey,
    baseURL: 'https://api.x.ai/v1',
    timeout: timeoutMs,
    maxRetries: 0,
    fetch: xaiFetch(dispatcher),
    fetchOptions: {dispatcher},
  };
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
  const xaiOptions = provider === 'xai' ? xaiPlanClientOptions(apiKey) : undefined;
  const client = new OpenAI(xaiOptions ?? {apiKey});

  return async ({system, input}) => {
    const started = Date.now();
    let transportCause: unknown;
    // Capture fetch failures per request: the SDK discards their cause when it
    // converts them into APIConnectionTimeoutError. Do not share mutable state
    // between concurrent calls using the same generator.
    const requestClient = xaiOptions ? client.withOptions({
      fetch: async (url, init) => {
        try {return await xaiOptions.fetch(url, init);}
        catch (error) {transportCause = error; throw error;}
      },
    }) : client;
    try {
      const response = await requestClient.responses.parse({
        model,
        instructions: system,
        input,
        text: {format: zodTextFormat(schema, schemaName)},
        ...(provider === 'xai' ? {reasoning: {effort: 'low'}} : {}),
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
      const isTimeout = name === 'APIConnectionTimeoutError' || /timed? ?out/i.test(message);
      const transport = status === undefined && !isSchemaError
        ? transportFailureDiagnostic(cause, transportCause) : undefined;
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
          ...(transport ?? {}),
          ...(isTimeout ? {code: 'timeout'} : transport?.code ? {} : code ? {code} : {}),
          ...(isSchemaError && message ? {detail: message}
            : isTimeout && !transport?.code ? {detail: 'Request timed out.'}
              : status ? {detail: `Provider returned HTTP ${status}.`} : {}),
          ...(provider === 'xai' ? {
            operation: 'plan-generation', endpoint: 'https://api.x.ai/v1/responses',
            model, schema: schemaName, elapsedMs: Date.now() - started, timeoutMs: XAI_PLAN_TIMEOUT_MS,
          } : {}),
        },
        {cause},
      );
    }
  };
}
