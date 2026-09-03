import {parseStoryBeats} from '../domain/video-plan';
import type {ContentPattern, HookConcept, StoryBeat} from '../domain/video-plan';
import {STORY_SYSTEM_PROMPT} from './prompt';

export type GenerateStoryInput = {
  topic: string;
  creativeBrief: string;
  contentPattern: ContentPattern;
  selectedHook: HookConcept;
};

export type GenerateStoryDeps = {
  generateStructured: (args: {system: string; input: string}) => Promise<unknown>;
};

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertSelectedHookContract(beats: StoryBeat[], selectedHook: HookConcept): void {
  const hookBeat = beats.find((beat) => beat.role === 'hook');
  const matches =
    hookBeat !== undefined &&
    hookBeat.spokenText.trim() === selectedHook.spokenHook.trim() &&
    hookBeat.displayText.trim() === selectedHook.displayText.trim() &&
    hookBeat.visualIntent.trim() === selectedHook.visualIntent.trim() &&
    stringArraysEqual(hookBeat.requiredVisualObjects, selectedHook.requiredVisualObjects) &&
    stringArraysEqual(hookBeat.searchQueries, selectedHook.searchQueries);

  if (!matches) {
    throw new Error('Hook beat copy and first-frame contract must match the selected hook');
  }
}

export async function generateStory(
  input: GenerateStoryInput,
  deps: GenerateStoryDeps,
): Promise<StoryBeat[]> {
  const providerInput = [
    `TOPIC: ${input.topic.trim()}`,
    `CREATIVE BRIEF: ${input.creativeBrief.trim()}`,
    `CONTENT PATTERN: ${input.contentPattern}`,
    'SELECTED HOOK:',
    JSON.stringify(input.selectedHook),
  ].join('\n');

  const raw = await deps.generateStructured({
    system: STORY_SYSTEM_PROMPT,
    input: providerInput,
  });
  const beats = parseStoryBeats(raw);
  assertSelectedHookContract(beats, input.selectedHook);
  return beats;
}
