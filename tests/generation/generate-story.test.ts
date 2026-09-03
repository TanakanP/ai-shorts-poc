import {describe, expect, it, vi} from 'vitest';
import {parseStoryBeats} from '../../src/domain/video-plan';
import type {ContentPattern, HookConcept, StoryBeat} from '../../src/domain/video-plan';
import {generateStory} from '../../src/generation/generate-story';
import {STORY_SYSTEM_PROMPT} from '../../src/generation/prompt';

const hookScores = {
  stopScroll: 5,
  clarity: 5,
  contradiction: 5,
  personalRelevance: 4,
  visualizability: 5,
};

const hookA: HookConcept = {
  id: 'hook-a',
  spokenHook: 'A runway can change its number without moving.',
  displayText: 'SAME RUNWAY. NEW NUMBER.',
  curiosityTarget: 'How can a fixed runway need a different number?',
  visualIntent: 'Airport runway threshold with large runway numbers visible',
  requiredVisualObjects: ['runway number marking'],
  searchQueries: ['airport runway number', 'runway threshold marking'],
  scores: hookScores,
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
    stopScroll: 4,
    clarity: 5,
    contradiction: 4,
    personalRelevance: 3,
    visualizability: 5,
  },
};

const hookBeat: StoryBeat = {
  id: 'hook',
  role: 'hook',
  durationSeconds: 3,
  spokenText: hookA.spokenHook,
  displayText: hookA.displayText,
  emphasisWords: ['NUMBER'],
  beatPurpose: 'Create an impossible-sounding contradiction.',
  newInformation: 'Runway numbers can change while the runway stays fixed.',
  curiosityTarget: hookA.curiosityTarget,
  visualIntent: hookA.visualIntent,
  requiredVisualObjects: hookA.requiredVisualObjects,
  searchQueries: hookA.searchQueries,
};

const contextBeat: StoryBeat = {
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
};

const curiosityResetBeat: StoryBeat = {
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
};

const mechanismBeat: StoryBeat = {
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
};

const payoffBeat: StoryBeat = {
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
};

const validBeats = (): StoryBeat[] =>
  structuredClone([hookBeat, contextBeat, curiosityResetBeat, mechanismBeat, payoffBeat]);

const topic = 'Why runway numbers change';
const creativeBrief = 'Punchy BALANCED_REVEAL about magnetic heading. Ban jargon.';
const contentPattern: ContentPattern = 'BALANCED_REVEAL';

const expectedProviderInput = (
  nextTopic: string,
  nextBrief: string,
  nextPattern: ContentPattern,
  selectedHook: HookConcept,
): string =>
  [
    `TOPIC: ${nextTopic.trim()}`,
    `CREATIVE BRIEF: ${nextBrief.trim()}`,
    `CONTENT PATTERN: ${nextPattern}`,
    'SELECTED HOOK:',
    JSON.stringify(selectedHook),
  ].join('\n');

describe('generateStory', () => {
  it('passes the selected hook explicitly into story generation', async () => {
    const generateStructured = vi.fn().mockResolvedValue(validBeats());

    const result = await generateStory(
      {
        topic: `  ${topic}  `,
        creativeBrief: `  ${creativeBrief}  `,
        contentPattern,
        selectedHook: hookA,
      },
      {generateStructured},
    );

    expect(generateStructured).toHaveBeenCalledWith({
      system: STORY_SYSTEM_PROMPT,
      input: expectedProviderInput(topic, creativeBrief, contentPattern, hookA),
    });
    expect(String(generateStructured.mock.calls[0]?.[0]?.input)).toContain('SELECTED HOOK:');
    expect(String(generateStructured.mock.calls[0]?.[0]?.input)).toContain(JSON.stringify(hookA));
    expect(result).toEqual(parseStoryBeats(validBeats()));
    expect(result[0]?.spokenText).toBe(hookA.spokenHook);
    expect(result[0]?.displayText).toBe(hookA.displayText);
    expect(result[0]?.visualIntent).toBe(hookA.visualIntent);
    expect(result[0]?.requiredVisualObjects).toEqual(hookA.requiredVisualObjects);
    expect(result[0]?.searchQueries).toEqual(hookA.searchQueries);
  });

  it('passes the content pattern explicitly', async () => {
    const generateStructured = vi.fn().mockResolvedValue(validBeats());
    const nextPattern: ContentPattern = 'PERSONAL_STAKES';

    await generateStory(
      {topic, creativeBrief, contentPattern: nextPattern, selectedHook: hookA},
      {generateStructured},
    );

    const input = String(generateStructured.mock.calls[0]?.[0]?.input);
    expect(input).toContain(`CONTENT PATTERN: ${nextPattern}`);
    expect(input).toBe(expectedProviderInput(topic, creativeBrief, nextPattern, hookA));
  });

  it('requests exactly five V3 roles in order', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/exactly five/i);
    expect(STORY_SYSTEM_PROMPT).toMatch(/1\.\s*hook/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/2\.\s*context/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/3\.\s*curiosity-reset/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/4\.\s*mechanism/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/5\.\s*payoff/);
  });

  it('requires hook-context-curiosity-reset-mechanism-payoff', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/hook/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/context/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/curiosity-reset/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/mechanism/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/payoff/);
  });

  it('requires a second curiosity gap at curiosity-reset', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/curiosity-reset/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/curiosity gap #2|second curiosity gap/i);
  });

  it('instructs the model not to reveal the complete mechanism in the first five seconds', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/complete mechanism/i);
    expect(STORY_SYSTEM_PROMPT).toMatch(/first five seconds/i);
  });

  it('requires every beat to add new information', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/every beat adds new information/i);
  });

  it('requires spokenText and displayText separately', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/spokenText/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/displayText/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/separate/i);
  });

  it('requires natural narration rather than five headline fragments', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/natural narration/i);
    expect(STORY_SYSTEM_PROMPT).toMatch(/headline fragments/i);
  });

  it('requires beatPurpose and newInformation metadata', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/beatPurpose/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/newInformation/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/metadata/i);
  });

  it('requires curiosityTarget on hook and curiosity-reset', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/curiosityTarget/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/hook and curiosity-reset/i);
  });

  it('requires visualIntent, requiredVisualObjects, and 2–3 ordered search queries', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/visualIntent/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/requiredVisualObject/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/2–3|2-3/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/ordered/i);
    expect(STORY_SYSTEM_PROMPT).toMatch(/search quer|stock quer/i);
  });

  it('requires story duration 20–26 seconds and prefers 22–26', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/20–26|20-26/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/22–26|22-26/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/prefer/i);
    expect(STORY_SYSTEM_PROMPT).not.toMatch(/20–28|20-28/);
  });

  it('instructs the model to copy the selected hook fields exactly', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/exactly/i);
    expect(STORY_SYSTEM_PROMPT).toMatch(/spokenHook/);
    expect(STORY_SYSTEM_PROMPT).toMatch(/displayText/);
  });

  it('forbids subscribe/follow CTA in payoff', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/subscribe\/follow/i);
    expect(STORY_SYSTEM_PROMPT).toMatch(/CTA/i);
    expect(STORY_SYSTEM_PROMPT).toMatch(/payoff/i);
  });

  it('forbids the channel outro in generated story', () => {
    expect(STORY_SYSTEM_PROMPT).toMatch(/channel outro/i);
    expect(STORY_SYSTEM_PROMPT).toMatch(/do not write the channel outro/i);
  });

  it('rewrites the hook beat to match selectedHook', async () => {
    const mismatched = validBeats();
    mismatched[0] = {
      ...mismatched[0],
      spokenText: hookB.spokenHook,
      displayText: hookB.displayText,
      visualIntent: hookB.visualIntent,
      requiredVisualObjects: [...hookB.requiredVisualObjects],
      searchQueries: [...hookB.searchQueries],
    };
    expect(parseStoryBeats(mismatched)).toHaveLength(5);

    const generateStructured = vi.fn().mockResolvedValue(mismatched);
    const beats = await generateStory(
      {topic, creativeBrief, contentPattern, selectedHook: hookA},
      {generateStructured},
    );

    expect(beats[0]?.spokenText).toBe(hookA.spokenHook);
    expect(beats[0]?.displayText).toBe(hookA.displayText);
    expect(beats[0]?.visualIntent).toBe(hookA.visualIntent);
    expect(beats[0]?.requiredVisualObjects).toEqual(hookA.requiredVisualObjects);
    expect(beats[0]?.searchQueries).toEqual(hookA.searchQueries);
  });

  it('rejects invalid role order', async () => {
    const invalidOrder = validBeats();
    invalidOrder[0] = {...invalidOrder[0], role: 'context'};
    invalidOrder[1] = {...invalidOrder[1], role: 'hook'};
    expect(() => parseStoryBeats(invalidOrder)).toThrow();

    const generateStructured = vi.fn().mockResolvedValue(invalidOrder);

    await expect(
      generateStory(
        {topic, creativeBrief, contentPattern, selectedHook: hookA},
        {generateStructured},
      ),
    ).rejects.toThrow();
  });
});
