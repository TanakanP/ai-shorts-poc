import {readFileSync, readdirSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {ContentHold, V5StoryRevisionNeeded, v5BriefSchema} from '../../../src/content/v5/contracts';
import {findAnswerWords} from '../../../src/content/v5/answer-words';
import {applyLockedVoiceover, earlyAnswerIssues, planV5Story, validateV5Story} from '../../../src/content/v5/plan';
import {evaluateV5Package} from '../../../src/content/v5/rules';
import {CHANNEL, brief, contentPlan, pack, rawPackage} from './fixtures';

const outro = `${CHANNEL.brand}. ${CHANNEL.signoff}`;
const lockedLines = () => contentPlan().beats.slice(1).map(b => b.spokenText);
const rawStory = () => {
  const plan = contentPlan();
  return {beats: plan.beats.map(b => ({...b, emphasisWords: b.id === 'contradiction' ? ['broken'] : []})), editorial: plan.editorial};
};

describe('findAnswerWords', () => {
  it('matches case-insensitively on word boundaries and handles plurals', () => {
    expect(findAnswerWords('GRAVITY takes over', ['gravity'])).toEqual(['gravity']);
    expect(findAnswerWords('Two counterweights drop', ['counterweight', 'drop'])).toEqual(['counterweight', 'drop']);
    expect(findAnswerWords('the batteries die', ['battery'])).toEqual(['battery']);
    expect(findAnswerWords('one box', ['boxes'])).toEqual(['boxes']);
    expect(findAnswerWords('It keeps the floor level', ['level'])).toEqual(['level']);
    expect(findAnswerWords('the pins line up', ['line up'])).toEqual(['line up']);
    expect(findAnswerWords('A powerful dropdown', ['power', 'drop'])).toEqual([]);
    expect(findAnswerWords('Heathrow airport', ['heat'])).toEqual([]);
    expect(findAnswerWords('anything', [])).toEqual([]);
  });
});

describe('answerWords gate (text step, before any media spend)', () => {
  it('rejects hooks and display copy containing answer words', () => {
    const b = {...brief, answerWords: ['broken']};
    expect(() => evaluateV5Package(rawPackage(), b)).toThrow(ContentHold);
    const raw = rawPackage();
    raw.hooks = raw.hooks.map(h => ({...h, displayText: 'Bent by light'}));
    raw.hooks[2] = {...raw.hooks[2], displayText: 'Straight. Looks snapped.'};
    const selected = evaluateV5Package(raw, {...brief, answerWords: ['light']});
    expect(selected.selectedHookId).toBe('hook-2');
    expect(selected.evaluatedHooks[0].violations).toContain('Opening display copy gives the answer away early (light)');
  });

  it('flags the first two voiced lines but not the later reveal', () => {
    const plan = contentPlan();
    expect(earlyAnswerIssues(plan, {answerWords: ['air']})).toEqual([expect.stringContaining('Voiced line 2 (clue)')]);
    expect(earlyAnswerIssues(plan, {answerWords: ['light']})).toEqual([]);
    expect(() => validateV5Story(plan, {...brief, answerWords: ['air']}, pack(), outro)).toThrow(/gives the answer away/);
    expect(() => validateV5Story(plan, {...brief, answerWords: ['light']}, pack(), outro)).not.toThrow();
  });
});

describe('lockedVoiceover', () => {
  it('is optional in the brief schema and must have five lines', () => {
    expect(v5BriefSchema.parse(brief).lockedVoiceover).toBeUndefined();
    expect(() => v5BriefSchema.parse({...brief, lockedVoiceover: ['one']})).toThrow();
  });

  it('forces the locked hook as the selected hook', () => {
    const locked = lockedLines();
    const raw = rawPackage();
    raw.hooks[0] = {...raw.hooks[0], text: 'A model-written hook nobody approved.', score: 1};
    const selected = evaluateV5Package(raw, {...brief, lockedVoiceover: locked});
    expect(selected.hooks.find(h => h.id === selected.selectedHookId)!.text).toBe(locked[0]);
  });

  it('overwrites generated narration word for word and keeps paradox silent', async () => {
    const locked = lockedLines();
    const b = {...brief, lockedVoiceover: locked};
    const p = evaluateV5Package(rawPackage(), b);
    const story = rawStory();
    story.beats[2].spokenText = 'The model tried to rewrite this line.';
    const plan = await planV5Story(b, p, async () => story, outro);
    expect(plan.beats.map(b => b.spokenText)).toEqual(['', ...locked]);
    expect(applyLockedVoiceover({beats: []}, b)).toEqual({beats: []});
  });

  it('still runs existing rules on locked lines', async () => {
    const locked = lockedLines();
    locked[4] = 'Like and subscribe for more.';
    const b = {...brief, lockedVoiceover: locked};
    await expect(planV5Story(b, evaluateV5Package(rawPackage(), b), async () => rawStory(), outro))
      .rejects.toBeInstanceOf(V5StoryRevisionNeeded);
  });
});

describe('week-1 briefs', () => {
  const files = readdirSync('briefs').filter(f => f.endsWith('.json'));
  it.each(files)('%s parses; non-gate briefs carry answerWords and scene-4 reveal guidance', file => {
    const b = v5BriefSchema.parse(JSON.parse(readFileSync(`briefs/${file}`, 'utf8')));
    if (file === 'railroad-gate-failsafe.json') return;
    expect(b.answerWords?.length).toBeGreaterThan(3);
    expect(b.creativeBrief).toContain('main reveal lands in scene 4');
    expect(b.creativeBrief).not.toContain('Mechanism starts about 5s in');
    expect(b.lockedVoiceover).toHaveLength(5);
    // The locked lines themselves must never trip their own answer-word gate.
    for (const line of b.lockedVoiceover!.slice(0, 2)) expect(findAnswerWords(line, b.answerWords)).toEqual([]);
  });
});
