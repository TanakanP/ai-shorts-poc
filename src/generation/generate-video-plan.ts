import OpenAI from 'openai';
import {zodTextFormat} from 'openai/helpers/zod';
import {parseVideoPlan, videoPlanSchema} from '../domain/video-plan';
import type {VideoPlan} from '../domain/video-plan';
import {ProviderError} from '../domain/provider-error';
import {VIDEO_PLAN_SYSTEM_PROMPT} from './prompt';

export type StructuredPlanGenerator = (args: {
  system: string;
  input: string;
}) => Promise<unknown>;

export type GenerateVideoPlanDeps = {
  generateStructured: StructuredPlanGenerator;
  research?: string;
};

export const MIN_RESEARCH_CHARS = 20;

export function formatPlanInput(topic: string, research?: string): string {
  const trimmedResearch = research?.trim() ?? '';
  if (!trimmedResearch) return `TOPIC:\n${topic}`;
  return `TOPIC:\n${topic}\n\nCREATIVE BRIEF:\n${trimmedResearch}`;
}

export async function generateVideoPlan(
  topic: string,
  deps: GenerateVideoPlanDeps,
): Promise<VideoPlan> {
  const trimmedTopic = topic.trim();
  if (trimmedTopic.length < 3) throw new Error('Topic must be at least 3 characters');
  const trimmedResearch = deps.research?.trim() ?? '';
  if (trimmedResearch.length > 0 && trimmedResearch.length < MIN_RESEARCH_CHARS) {
    throw new Error(`Research brief must be at least ${MIN_RESEARCH_CHARS} characters`);
  }

  const raw = await deps.generateStructured({
    system: VIDEO_PLAN_SYSTEM_PROMPT,
    input: formatPlanInput(trimmedTopic, trimmedResearch),
  });
  return parseVideoPlan(raw);
}

export function createOpenAIStructuredPlanGenerator(apiKey: string): StructuredPlanGenerator {
  const client = new OpenAI({apiKey});

  return async ({system, input}) => {
    try {
      const response = await client.responses.parse({
        model: 'gpt-5.5',
        instructions: system,
        input,
        text: {format: zodTextFormat(videoPlanSchema, 'video_plan')},
      });

      return parseVideoPlan(response.output_parsed);
    } catch (cause) {
      if (cause instanceof ProviderError) throw cause;
      const value = cause as {name?: unknown; status?: unknown; code?: unknown};
      const status = typeof value?.status === 'number' ? value.status : undefined;
      const rawCode = typeof value?.code === 'string' ? value.code.toLowerCase() : undefined;
      const code = rawCode && /^[a-z0-9_-]{1,64}$/.test(rawCode) ? rawCode : undefined;
      const name = typeof value?.name === 'string' ? value.name : '';
      const kind = status === 401 || status === 403
        ? 'auth'
        : status === 429
          ? 'quota'
          : name === 'ZodError'
            ? 'validation'
            : 'transport';
      throw new ProviderError(
        'OpenAI plan generation failed',
        {provider: 'openai', kind, ...(status ? {status} : {}), ...(code ? {code} : {})},
        {cause},
      );
    }
  };
}
