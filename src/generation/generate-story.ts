import {parseStoryBeats, sanitizeEmphasisWords} from '../domain/video-plan';
import type {ContentPattern, HookConcept, StoryBeat} from '../domain/video-plan';
import {publicFailureDetail} from '../domain/provider-error';
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

function applySelectedHook(raw: unknown, selectedHook: HookConcept): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((beat) => {
    if (!beat || typeof beat !== 'object' || (beat as {role?: string}).role !== 'hook') return beat;
    const next = {
      ...beat,
      spokenText: selectedHook.spokenHook,
      displayText: selectedHook.displayText,
      visualIntent: selectedHook.visualIntent,
      requiredVisualObjects: selectedHook.requiredVisualObjects,
      searchQueries: selectedHook.searchQueries,
      curiosityTarget: selectedHook.curiosityTarget,
    };
    return {
      ...next,
      emphasisWords: sanitizeEmphasisWords(
        selectedHook.displayText,
        Array.isArray((beat as {emphasisWords?: unknown}).emphasisWords)
          ? (beat as {emphasisWords: unknown[]}).emphasisWords
          : [],
      ),
    };
  });
}

function sanitizeStoryBeats(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((beat) => {
    if (!beat || typeof beat !== 'object') return beat;
    const record = beat as {displayText?: unknown; emphasisWords?: unknown};
    const displayText = typeof record.displayText === 'string' ? record.displayText : '';
    return {
      ...record,
      emphasisWords: sanitizeEmphasisWords(
        displayText,
        Array.isArray(record.emphasisWords) ? record.emphasisWords : [],
      ),
    };
  });
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
  try {
    const beats = parseStoryBeats(sanitizeStoryBeats(applySelectedHook(raw, input.selectedHook)));
    assertSelectedHookContract(beats, input.selectedHook);
    return beats;
  } catch (cause) {
    const detail = publicFailureDetail(cause) ?? (cause instanceof Error ? cause.message : 'invalid story');
    throw new Error(`Story validation failed: ${detail}`, {cause});
  }
}
