import {parseHookCandidates} from '../domain/video-plan';
import type {HookConcept} from '../domain/video-plan';
import {HOOK_SYSTEM_PROMPT} from './prompt';

export type GenerateHooksDeps = {
  generateStructured: (args: {system: string; input: string}) => Promise<unknown>;
};

export async function generateHooks(
  topic: string,
  creativeBrief: string,
  deps: GenerateHooksDeps,
): Promise<HookConcept[]> {
  const normalizedTopic = topic.trim();
  const normalizedBrief = creativeBrief.trim();

  if (normalizedTopic.length < 3) {
    throw new Error('Topic must be at least 3 characters');
  }

  if (normalizedBrief.length < 5) {
    throw new Error('Creative brief must be at least 5 characters');
  }

  const input = [`TOPIC: ${normalizedTopic}`, `CREATIVE BRIEF: ${normalizedBrief}`].join('\n');
  const raw = await deps.generateStructured({system: HOOK_SYSTEM_PROMPT, input});
  return parseHookCandidates(raw);
}
