import {describe, expect, it, vi} from 'vitest';
import {generateHooks} from '../../src/generation/generate-hooks';
import {HOOK_SYSTEM_PROMPT} from '../../src/generation/prompt';
import type {HookConcept} from '../../src/domain/video-plan';

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

const validHookCandidates = (): HookConcept[] => structuredClone([hookA, hookB, hookC]);

const topic = 'Why runway numbers change';
const creativeBrief = 'Punchy BALANCED_REVEAL about magnetic heading. Ban jargon.';

describe('generateHooks', () => {
  it('passes normalized topic and creative brief to the provider', async () => {
    const generateStructured = vi.fn().mockResolvedValue(validHookCandidates());

    const result = await generateHooks(
      `  ${topic}  `,
      `  ${creativeBrief}  `,
      {generateStructured},
    );

    expect(generateStructured).toHaveBeenCalledWith({
      system: HOOK_SYSTEM_PROMPT,
      input: `TOPIC: ${topic}\nCREATIVE BRIEF: ${creativeBrief}`,
    });
    expect(result).toEqual(validHookCandidates());
  });

  it('labels TOPIC and CREATIVE BRIEF explicitly', async () => {
    const generateStructured = vi.fn().mockResolvedValue(validHookCandidates());

    await generateHooks(topic, creativeBrief, {generateStructured});

    const input = String(generateStructured.mock.calls[0]?.[0]?.input);
    expect(input).toContain(`TOPIC: ${topic}`);
    expect(input).toContain(`CREATIVE BRIEF: ${creativeBrief}`);
  });

  it('requests exactly three hook candidates', () => {
    expect(HOOK_SYSTEM_PROMPT).toMatch(/exactly 3/i);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/hook candidates/i);
  });

  it('mentions Tell Me Whyyyyyy rather than Plainly Curious', () => {
    expect(HOOK_SYSTEM_PROMPT).toMatch(/Tell Me Whyyyyyy/);
    expect(HOOK_SYSTEM_PROMPT).not.toMatch(/Plainly Curious/);
  });

  it('instructs the model to create declarative claim hooks', () => {
    expect(HOOK_SYSTEM_PROMPT).toMatch(/declarative claim/i);
  });

  it('bans Why/How/What/Did you know/Have you ever wondered/Ever wonder/Ever notice intros', () => {
    expect(HOOK_SYSTEM_PROMPT).toMatch(/Why/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/How/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/What/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/Did you know/i);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/Have you ever wondered/i);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/Ever wonder/i);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/Ever notice/i);
  });

  it('requires spokenHook and shorter displayText separately', () => {
    expect(HOOK_SYSTEM_PROMPT).toMatch(/spokenHook/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/displayText/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/shorter/i);
  });

  it('asks for karaoke clause bars in the spoken hook', () => {
    expect(HOOK_SYSTEM_PROMPT).toMatch(/\|/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/karaoke clauses/i);
  });

  it('requires curiosityTarget and first-frame visual contract', () => {
    expect(HOOK_SYSTEM_PROMPT).toMatch(/curiosityTarget/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/first-frame/i);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/visual/i);
  });

  it('requires requiredVisualObjects and 2–3 ordered search queries', () => {
    expect(HOOK_SYSTEM_PROMPT).toMatch(/requiredVisualObjects/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/2–3|2-3/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/ordered/i);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/search quer/i);
  });

  it('requires five 1–5 heuristic scores', () => {
    expect(HOOK_SYSTEM_PROMPT).toMatch(/1 through 5|1–5|1-5/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/heuristic/i);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/stopScroll/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/clarity/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/contradiction/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/personalRelevance/);
    expect(HOOK_SYSTEM_PROMPT).toMatch(/visualizability/);
  });

  it('does not ask the provider to choose the winning hook', async () => {
    expect(HOOK_SYSTEM_PROMPT).toMatch(/do not choose a winner/i);
    expect(HOOK_SYSTEM_PROMPT).not.toMatch(/winning hook/i);
    expect(HOOK_SYSTEM_PROMPT).not.toMatch(/selectedHook/i);

    const generateStructured = vi.fn().mockResolvedValue(validHookCandidates());
    const result = await generateHooks(topic, creativeBrief, {generateStructured});

    expect(result).toHaveLength(3);
    expect(result.map((hook) => hook.id)).toEqual(['hook-a', 'hook-b', 'hook-c']);
  });

  it('rejects invalid provider output through parseHookCandidates', async () => {
    const generateStructured = vi.fn().mockResolvedValue(validHookCandidates().slice(0, 2));

    await expect(generateHooks(topic, creativeBrief, {generateStructured})).rejects.toThrow();
  });

  it('rejects blank topic before provider call', async () => {
    const generateStructured = vi.fn();

    await expect(generateHooks('   ', creativeBrief, {generateStructured})).rejects.toThrow(
      'Topic must be at least 3 characters',
    );
    await expect(generateHooks('ab', creativeBrief, {generateStructured})).rejects.toThrow(
      'Topic must be at least 3 characters',
    );
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it('rejects blank creative brief before provider call', async () => {
    const generateStructured = vi.fn();

    await expect(generateHooks(topic, '    ', {generateStructured})).rejects.toThrow(
      'Creative brief must be at least 5 characters',
    );
    await expect(generateHooks(topic, 'abcd', {generateStructured})).rejects.toThrow(
      'Creative brief must be at least 5 characters',
    );
    expect(generateStructured).not.toHaveBeenCalled();
  });
});
