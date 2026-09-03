import {describe, expect, it} from 'vitest';
import {
  isBannedHookOpening,
  parseHookCandidates,
  parseStoryBeats,
  parseVideoPlanV3,
  type HookConcept,
  type StoryBeat,
  type VideoPlanV3,
} from '../../src/domain/video-plan';

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

const hookC: HookConcept = {
  id: 'hook-c',
  spokenHook: 'A runway can keep the same asphalt and still get a new identity.',
  displayText: 'NEW IDENTITY. SAME STRIP.',
  curiosityTarget: 'What identity can change if the pavement never moves?',
  visualIntent: 'Aerial view of a single runway with visible threshold numbers',
  requiredVisualObjects: ['aerial runway threshold'],
  searchQueries: ['aerial airport runway', 'runway threshold aerial'],
  scores: {
    stopScroll: 5,
    clarity: 4,
    contradiction: 5,
    personalRelevance: 4,
    visualizability: 4,
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

const validHookCandidates = (): HookConcept[] => structuredClone([hookA, hookB, hookC]);
const validBeats = (): StoryBeat[] =>
  structuredClone([hookBeat, contextBeat, curiosityResetBeat, mechanismBeat, payoffBeat]);

const validPlan = (): VideoPlanV3 =>
  structuredClone({
    formatVersion: 'retention-v3',
    topic: 'Why runway numbers change',
    creativeBrief:
      'Punchy BALANCED_REVEAL about magnetic heading. Ban jargon. Close on the field moving.',
    title: 'Runways Can Change Numbers',
    viralAngle: 'The number is a heading that can go stale when magnetic north drifts.',
    contentPattern: 'BALANCED_REVEAL',
    hookCandidates: [hookA, hookB, hookC],
    selectedHookId: 'hook-a',
    beats: [hookBeat, contextBeat, curiosityResetBeat, mechanismBeat, payoffBeat],
  });

const twentyThreeWords = Array.from({length: 23}, (_, index) => `word${index + 1}`).join(' ');
const tenWords = Array.from({length: 10}, (_, index) => `word${index + 1}`).join(' ');

describe('V3 hook validation', () => {
  it.each([
    'Why can runway numbers change?',
    'How does this work?',
    'What makes this happen?',
    'Did you know runway numbers change?',
    'Have you ever wondered why?',
    'Ever wonder why?',
    'Ever notice this?',
    'Hey, runway numbers are weird.',
    'Welcome to Tell Me Whyyyyyy.',
    "Today we're explaining runway numbers.",
    'In this video we explain runways.',
  ])('rejects banned hook opening: %s', (text) => {
    expect(isBannedHookOpening(text)).toBe(true);
  });

  it('rejects a hook that ends in a question mark', () => {
    expect(isBannedHookOpening('A runway can change its number without moving?')).toBe(true);

    const candidates = validHookCandidates();
    candidates[0].spokenHook = 'A runway can change its number without moving?';
    expect(() => parseHookCandidates(candidates)).toThrow();
  });

  it('accepts a declarative contradiction', () => {
    expect(isBannedHookOpening(hookA.spokenHook)).toBe(false);
    expect(parseHookCandidates(validHookCandidates())).toEqual(validHookCandidates());
  });

  it('rejects any candidate count other than exactly three', () => {
    expect(() => parseHookCandidates([])).toThrow();
    expect(() => parseHookCandidates(validHookCandidates().slice(0, 2))).toThrow();

    const extra = validHookCandidates();
    extra.push({...hookA, id: 'hook-a'});
    expect(() => parseHookCandidates(extra)).toThrow();
  });

  it('requires ids hook-a, hook-b, and hook-c exactly once', () => {
    const duplicateA = validHookCandidates();
    duplicateA[2].id = 'hook-a';
    expect(() => parseHookCandidates(duplicateA)).toThrow();

    const duplicateB = validHookCandidates();
    duplicateB[2].id = 'hook-b';
    expect(() => parseHookCandidates(duplicateB)).toThrow();
  });

  it('rejects a score below 1 or above 5', () => {
    const tooLow = validHookCandidates();
    tooLow[0].scores.stopScroll = 0;
    expect(() => parseHookCandidates(tooLow)).toThrow();

    const tooHigh = validHookCandidates();
    tooHigh[1].scores.visualizability = 6;
    expect(() => parseHookCandidates(tooHigh)).toThrow();
  });

  it('rejects a non-integer score', () => {
    const candidates = validHookCandidates();
    candidates[0].scores.clarity = 4.5;
    expect(() => parseHookCandidates(candidates)).toThrow();
  });

  it('rejects duplicate normalized spoken hooks', () => {
    const candidates = validHookCandidates();
    candidates[1].spokenHook = 'A RUNWAY CAN CHANGE ITS NUMBER WITHOUT MOVING!';
    expect(() => parseHookCandidates(candidates)).toThrow();
  });

  it('rejects spokenHook over 22 words', () => {
    const candidates = validHookCandidates();
    candidates[0].spokenHook = twentyThreeWords;
    expect(() => parseHookCandidates(candidates)).toThrow();
  });

  it('rejects displayText over 9 words', () => {
    const candidates = validHookCandidates();
    candidates[0].displayText = tenWords;
    expect(() => parseHookCandidates(candidates)).toThrow();
  });

  it('rejects empty requiredVisualObjects', () => {
    const candidates = validHookCandidates();
    candidates[0].requiredVisualObjects = [];
    expect(() => parseHookCandidates(candidates)).toThrow();
  });

  it('rejects fewer than two or more than three search queries', () => {
    const tooFew = validHookCandidates();
    tooFew[0].searchQueries = ['airport runway number'];
    expect(() => parseHookCandidates(tooFew)).toThrow();

    const tooMany = validHookCandidates();
    tooMany[0].searchQueries = [
      'airport runway number',
      'runway threshold marking',
      'runway digits closeup',
      'airport tarmac aerial',
    ];
    expect(() => parseHookCandidates(tooMany)).toThrow();
  });

  it('rejects duplicate search queries in one hook', () => {
    const sameText = validHookCandidates();
    sameText[0].searchQueries = ['airport runway number', 'airport runway number'];
    expect(() => parseHookCandidates(sameText)).toThrow();

    const sameNormalized = validHookCandidates();
    sameNormalized[0].searchQueries = ['Airport Runway Number', 'airport runway number'];
    expect(() => parseHookCandidates(sameNormalized)).toThrow();
  });

  it('accepts visualIntent shorter than 10 characters', () => {
    const candidates = validHookCandidates();
    candidates[0].visualIntent = 'runway';
    expect(parseHookCandidates(candidates)[0]?.visualIntent).toBe('runway');
  });

  it('accepts a 2-character search query if it is unique and the array has 2–3 items', () => {
    const candidates = validHookCandidates();
    candidates[0].searchQueries = ['rn', 'threshold'];
    expect(parseHookCandidates(candidates)[0]?.searchQueries).toEqual(['rn', 'threshold']);
  });
});

describe('V3 story validation', () => {
  it('accepts exactly five ordered V3 roles', () => {
    const beats = parseStoryBeats(validBeats());
    expect(beats.map((beat) => beat.role)).toEqual([
      'hook',
      'context',
      'curiosity-reset',
      'mechanism',
      'payoff',
    ]);
  });

  it('rejects any role order other than hook-context-curiosity-reset-mechanism-payoff', () => {
    const beats = validBeats();
    beats[0].role = 'payoff';
    beats[4].role = 'hook';
    expect(() => parseStoryBeats(beats)).toThrow();
  });

  it('rejects total story duration below 20 seconds', () => {
    const beats = validBeats();
    for (const beat of beats) {
      beat.durationSeconds = 3;
    }
    expect(() => parseStoryBeats(beats)).toThrow();
  });

  it('rejects total story duration above 28 seconds', () => {
    const beats = validBeats();
    for (const beat of beats) {
      beat.durationSeconds = 6;
    }
    expect(() => parseStoryBeats(beats)).toThrow();
  });

  it('requires curiosityTarget on hook', () => {
    const missing = validBeats();
    delete (missing[0] as {curiosityTarget?: string}).curiosityTarget;
    expect(() => parseStoryBeats(missing)).toThrow();

    const blank = validBeats();
    blank[0].curiosityTarget = '   ';
    expect(() => parseStoryBeats(blank)).toThrow();
  });

  it('requires curiosityTarget on curiosity-reset', () => {
    const missing = validBeats();
    delete (missing[2] as {curiosityTarget?: string}).curiosityTarget;
    expect(() => parseStoryBeats(missing)).toThrow();

    const blank = validBeats();
    blank[2].curiosityTarget = '';
    expect(() => parseStoryBeats(blank)).toThrow();
  });

  it('rejects displayText over 9 words', () => {
    const beats = validBeats();
    beats[1].displayText = tenWords;
    beats[1].emphasisWords = [];
    expect(() => parseStoryBeats(beats)).toThrow();
  });

  it('rejects empty beatPurpose or newInformation', () => {
    const blankPurpose = validBeats();
    blankPurpose[1].beatPurpose = '  ';
    expect(() => parseStoryBeats(blankPurpose)).toThrow();

    const blankInformation = validBeats();
    blankInformation[3].newInformation = '';
    expect(() => parseStoryBeats(blankInformation)).toThrow();
  });

  it('rejects empty requiredVisualObjects', () => {
    const beats = validBeats();
    beats[3].requiredVisualObjects = [];
    expect(() => parseStoryBeats(beats)).toThrow();
  });

  it('rejects exact duplicate normalized spokenText across beats', () => {
    const beats = validBeats();
    beats[1].spokenText = 'A RUNWAY CAN CHANGE ITS NUMBER WITHOUT MOVING.';
    expect(() => parseStoryBeats(beats)).toThrow();
  });

  it('rejects exact duplicate normalized displayText across beats', () => {
    const beats = validBeats();
    beats[4].displayText = 'same runway new number';
    beats[4].emphasisWords = ['RUNWAY'];
    expect(() => parseStoryBeats(beats)).toThrow();
  });

  it('rejects an emphasis word absent from displayText', () => {
    const beats = validBeats();
    beats[0].emphasisWords = ['MISSING'];
    expect(() => parseStoryBeats(beats)).toThrow();
  });

  it('rejects subscribe or follow CTA in payoff', () => {
    const subscribe = validBeats();
    subscribe[4].spokenText = 'Subscribe for more runway facts tonight.';
    expect(() => parseStoryBeats(subscribe)).toThrow();

    const follow = validBeats();
    follow[4].displayText = 'FOLLOW FOR MORE';
    follow[4].emphasisWords = ['FOLLOW'];
    expect(() => parseStoryBeats(follow)).toThrow();

    const followUs = validBeats();
    followUs[4].spokenText = 'Follow us for more runway facts tonight.';
    expect(() => parseStoryBeats(followUs)).toThrow();
  });

  it('accepts visualIntent shorter than 10 characters', () => {
    const beats = validBeats();
    beats[1].visualIntent = 'heading';
    expect(parseStoryBeats(beats)[1]?.visualIntent).toBe('heading');
  });

  it('accepts beat id that is not kebab-case', () => {
    const beats = validBeats();
    beats[1].id = 'Context Beat #2';
    beats[2].id = 'Context Beat #2';
    const parsed = parseStoryBeats(beats);
    expect(parsed[1]?.id).toBe('Context Beat #2');
    expect(parsed[2]?.id).toBe('Context Beat #2');
  });

  it('accepts non-integer beat durations that still sum to 20–28', () => {
    const beats = validBeats();
    const durations = [3.5, 4.5, 5, 6, 5];
    for (const [index, duration] of durations.entries()) {
      beats[index].durationSeconds = duration;
    }

    expect(parseStoryBeats(beats).map((beat) => beat.durationSeconds)).toEqual(durations);
  });

  it('accepts payoff text containing "follow-up" but not a follow CTA', () => {
    const spoken = validBeats();
    spoken[4].spokenText = 'A follow-up survey proved the field moved.';
    expect(parseStoryBeats(spoken)[4]?.spokenText).toBe(
      'A follow-up survey proved the field moved.',
    );

    const display = validBeats();
    display[4].displayText = 'FOLLOW-UP PROVED IT';
    display[4].emphasisWords = ['PROVED'];
    expect(parseStoryBeats(display)[4]?.displayText).toBe('FOLLOW-UP PROVED IT');
  });

  it('accepts an emphasis word that is a case-insensitive substring of displayText', () => {
    const beats = validBeats();
    beats[0].emphasisWords = ['RUN'];
    expect(parseStoryBeats(beats)[0]?.emphasisWords).toEqual(['RUN']);
  });

  it('accepts a 2-character search query if it is unique and the array has 2–3 items', () => {
    const beats = validBeats();
    beats[1].searchQueries = ['ab', 'cd'];
    expect(parseStoryBeats(beats)[1]?.searchQueries).toEqual(['ab', 'cd']);
  });
});

describe('V3 full plan validation', () => {
  it('requires formatVersion retention-v3', () => {
    expect(parseVideoPlanV3(validPlan()).formatVersion).toBe('retention-v3');

    const plan = validPlan();
    (plan as {formatVersion: string}).formatVersion = 'retention-v2';
    expect(() => parseVideoPlanV3(plan)).toThrow();
  });

  it('requires exactly three hooks and exactly five beats', () => {
    const parsed = parseVideoPlanV3(validPlan());
    expect(parsed.hookCandidates).toHaveLength(3);
    expect(parsed.beats).toHaveLength(5);

    const tooFewHooks = validPlan();
    tooFewHooks.hookCandidates = tooFewHooks.hookCandidates.slice(0, 2);
    expect(() => parseVideoPlanV3(tooFewHooks)).toThrow();

    const tooFewBeats = validPlan();
    tooFewBeats.beats = tooFewBeats.beats.slice(0, 4);
    expect(() => parseVideoPlanV3(tooFewBeats)).toThrow();
  });

  it('requires selectedHookId to reference an existing candidate', () => {
    const plan = validPlan();
    (plan as {selectedHookId: string}).selectedHookId = 'hook-z';
    expect(() => parseVideoPlanV3(plan)).toThrow();
  });

  it('requires the hook beat copy and first-frame contract to match the selected hook', () => {
    const spokenMismatch = validPlan();
    spokenMismatch.beats[0].spokenText = 'This runway keeps its asphalt and changes identity.';
    expect(() => parseVideoPlanV3(spokenMismatch)).toThrow();

    const visualMismatch = validPlan();
    visualMismatch.beats[0].visualIntent = 'Generic airplane window view of clouds below';
    expect(() => parseVideoPlanV3(visualMismatch)).toThrow();

    const selectedOtherHook = validPlan();
    selectedOtherHook.selectedHookId = 'hook-b';
    expect(() => parseVideoPlanV3(selectedOtherHook)).toThrow();
  });

  it('accepts a short creativeBrief / topic / title / viralAngle that is non-empty', () => {
    const plan = validPlan();
    plan.topic = 'Go';
    plan.title = 'Hi';
    plan.creativeBrief = 'Punch';
    plan.viralAngle = 'Angle';

    const parsed = parseVideoPlanV3(plan);
    expect(parsed.topic).toBe('Go');
    expect(parsed.title).toBe('Hi');
    expect(parsed.creativeBrief).toBe('Punch');
    expect(parsed.viralAngle).toBe('Angle');
  });
});
