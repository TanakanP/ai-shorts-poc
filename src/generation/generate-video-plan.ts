import OpenAI from 'openai';
import {zodTextFormat} from 'openai/helpers/zod';
import {parseVideoPlan, videoPlanSchema} from '../domain/video-plan';
import type {VideoPlan} from '../domain/video-plan';
import {VIDEO_PLAN_SYSTEM_PROMPT} from './prompt';

export type StructuredPlanGenerator = (args: {
  system: string;
  input: string;
}) => Promise<unknown>;

export type GenerateVideoPlanDeps = {
  generateStructured: StructuredPlanGenerator;
};

export async function generateVideoPlan(
  topic: string,
  deps: GenerateVideoPlanDeps,
): Promise<VideoPlan> {
  const trimmedTopic = topic.trim();
  if (trimmedTopic.length < 3) throw new Error('Topic must be at least 3 characters');

  const raw = await deps.generateStructured({
    system: VIDEO_PLAN_SYSTEM_PROMPT,
    input: trimmedTopic,
  });
  return parseVideoPlan(raw);
}

export function createOpenAIStructuredPlanGenerator(apiKey: string): StructuredPlanGenerator {
  const client = new OpenAI({apiKey});

  return async ({system, input}) => {
    const response = await client.responses.parse({
      model: 'gpt-5.5',
      instructions: system,
      input,
      text: {format: zodTextFormat(videoPlanSchema, 'video_plan')},
    });

    return parseVideoPlan(response.output_parsed);
  };
}
