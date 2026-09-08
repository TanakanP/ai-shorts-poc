import {describe, expect, it} from 'vitest';
import {selectHook, totalHookScore} from '../../src/generation/select-hook';
import type {HookConcept, HookScores} from '../../src/domain/video-plan';

const scores = (overrides: Partial<HookScores> = {}): HookScores => ({
  stopScroll: 3,
  clarity: 3,
  contradiction: 3,
  personalRelevance: 3,
  visualizability: 3,
  ...overrides,
});

const hookA: HookConcept = {
  id: 'hook-a',
  spokenHook: 'A runway can change its number without moving.',
  displayText: 'SAME RUNWAY. NEW NUMBER.',
  curiosityTarget: 'How can a fixed runway need a different number?',
  visualIntent: 'Airport runway threshold with large runway numbers visible',
  requiredVisualObjects: ['runway number marking'],
  searchQueries: ['airport runway number', 'runway threshold marking'],
  scores: scores(),
};

const hookB: HookConcept = {
  id: 'hook-b',
  spokenHook: 'The painted number on a runway is not a permanent name.',
  displayText: 'NUMBERS ARE NOT NAMES',
  curiosityTarget: 'Why would a runway keep the same strip and lose its number?',
  visualIntent: 'Close-up of large painted runway numbers on asphalt',
  requiredVisualObjects: ['painted runway digits'],
  searchQueries: ['painted runway numbers', 'asphalt runway marking'],
  scores: scores(),
};

const hookC: HookConcept = {
  id: 'hook-c',
  spokenHook: 'A runway can keep its asphalt and still get a new identity.',
  displayText: 'NEW IDENTITY. SAME STRIP.',
  curiosityTarget: 'What identity can change if the pavement never moves?',
  visualIntent: 'Aerial view of a single runway with visible threshold numbers',
  requiredVisualObjects: ['aerial runway threshold'],
  searchQueries: ['aerial airport runway', 'runway threshold aerial'],
  scores: scores(),
};

const withScores = (hook: HookConcept, next: HookScores): HookConcept => ({
  ...hook,
  scores: next,
});

describe('totalHookScore', () => {
  it('sums all five hook dimensions', () => {
    expect(
      totalHookScore({
        stopScroll: 5,
        clarity: 4,
        contradiction: 3,
        personalRelevance: 2,
        visualizability: 1,
      }),
    ).toBe(15);
  });
});

describe('selectHook', () => {
  it('selects the highest total score', () => {
    const candidates = [
      withScores(hookA, scores({stopScroll: 4, clarity: 4, contradiction: 4, personalRelevance: 4, visualizability: 4})),
      withScores(hookB, scores({stopScroll: 5, clarity: 5, contradiction: 5, personalRelevance: 5, visualizability: 5})),
      withScores(hookC, scores({stopScroll: 2, clarity: 5, contradiction: 5, personalRelevance: 5, visualizability: 5})),
    ];

    expect(selectHook(candidates).id).toBe('hook-b');
  });

  it('breaks equal totals by higher clarity', () => {
    const candidates = [
      withScores(hookA, scores({stopScroll: 5, clarity: 3, contradiction: 5, personalRelevance: 4, visualizability: 5})),
      withScores(hookC, scores({stopScroll: 4, clarity: 4, contradiction: 5, personalRelevance: 5, visualizability: 4})),
      withScores(hookB, scores({stopScroll: 5, clarity: 5, contradiction: 4, personalRelevance: 4, visualizability: 4})),
    ];

    expect(selectHook(candidates).id).toBe('hook-b');
  });

  it('then breaks ties by higher visualizability', () => {
    const candidates = [
      withScores(hookA, scores({stopScroll: 5, clarity: 4, contradiction: 4, personalRelevance: 5, visualizability: 3})),
      withScores(hookB, scores({stopScroll: 4, clarity: 4, contradiction: 5, personalRelevance: 5, visualizability: 3})),
      withScores(hookC, scores({stopScroll: 4, clarity: 4, contradiction: 4, personalRelevance: 4, visualizability: 5})),
    ];

    expect(selectHook(candidates).id).toBe('hook-c');
  });

  it('then breaks ties by higher stopScroll', () => {
    const candidates = [
      withScores(hookA, scores({stopScroll: 3, clarity: 4, contradiction: 5, personalRelevance: 5, visualizability: 4})),
      withScores(hookB, scores({stopScroll: 5, clarity: 4, contradiction: 4, personalRelevance: 4, visualizability: 4})),
      withScores(hookC, scores({stopScroll: 4, clarity: 4, contradiction: 5, personalRelevance: 4, visualizability: 4})),
    ];

    expect(selectHook(candidates).id).toBe('hook-b');
  });

  it('finally breaks exact score ties by hook id lexical order', () => {
    const tied = scores({
      stopScroll: 4,
      clarity: 4,
      contradiction: 4,
      personalRelevance: 4,
      visualizability: 4,
    });
    const candidates = [withScores(hookC, tied), withScores(hookB, tied), withScores(hookA, tied)];

    expect(selectHook(candidates).id).toBe('hook-a');
  });

  it('does not mutate the input array', () => {
    const candidates = [
      withScores(hookC, scores({stopScroll: 1})),
      withScores(hookB, scores({stopScroll: 5})),
      withScores(hookA, scores({stopScroll: 3})),
    ];
    const snapshot = [...candidates];

    const selected = selectHook(candidates);

    expect(candidates).toEqual(snapshot);
    expect(candidates[0]).toBe(snapshot[0]);
    expect(candidates[1]).toBe(snapshot[1]);
    expect(candidates[2]).toBe(snapshot[2]);
    expect(selected).toBe(candidates[1]);
  });

  it('throws when candidate count is not 3', () => {
    expect(() => selectHook([])).toThrow('Expected exactly 3 hook candidates; received 0');
    expect(() => selectHook([hookA])).toThrow('Expected exactly 3 hook candidates; received 1');
    expect(() => selectHook([hookA, hookB])).toThrow(
      'Expected exactly 3 hook candidates; received 2',
    );
    expect(() => selectHook([hookA, hookB, hookC, hookA])).toThrow(
      'Expected exactly 3 hook candidates; received 4',
    );
  });
});
