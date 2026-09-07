# Tell Me Whyyyyyy Retention V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the working Tell Me Whyyyyyy Shorts pipeline so it generates three hook candidates, deterministically selects the strongest valid hook, builds a voiced five-beat story with a mandatory second curiosity gap, separates narration from display copy, and preserves first-frame/visual-search intent through rendering and debug artifacts.

**Architecture:** Keep the current `topic + creative brief -> OpenAI -> VideoPlan -> Pexels -> Remotion -> MP4` pipeline. Split content planning into two logical structured-generation stages: `generateHooks(...)` produces exactly three inspectable hook concepts; code validates and deterministically selects one; `generateStory(...)` builds exactly five V3 beats around that selected hook. Existing ordered Pexels resolution, TTS/audio behavior, Remotion rendering, and local run artifacts remain in place, with the smallest compatibility changes required to consume the V3 plan.

**Tech Stack:** Existing Node.js 22+, TypeScript 5.x, npm, OpenAI JavaScript SDK/provider adapter, Zod, Pexels REST API, React, Remotion, Vitest, dotenv, fs/promises. Do not add a new runtime dependency unless the current repository already requires it.

**Spec:** `docs/superpowers/specs/2026-09-03-tell-me-whyyyyyy-retention-v3-design.md`

## Global Constraints

- This is a delta on top of the current working repository; do not rebuild the project.
- Preserve the public CLI shape: `npm run generate -- "<topic>" "<creative brief>"`.
- If the second CLI argument is still named `researchQuery` internally, preserve public compatibility; semantic meaning is now `creativeBrief`.
- Preserve current audio/TTS behavior. V3 changes content planning, not the audio provider.
- Preserve 1080×1920 vertical H.264 MP4 output at the repository's current ~30 FPS behavior.
- Generate exactly 3 hook candidates with ids `hook-a`, `hook-b`, `hook-c`.
- Hook candidates are declarative claims, not why/how/what questions or generic intros.
- Hook winner is selected deterministically in code, not by a provider-returned winner field.
- Generate exactly 5 story beats in order: `hook`, `context`, `curiosity-reset`, `mechanism`, `payoff`.
- Story duration must be 20–28 seconds; generation prompt should prefer 22–26 seconds.
- Spoken narration and display copy must be distinct fields or mapped to equivalent existing fields.
- Display text is at most 9 whitespace-delimited words.
- Hook and `curiosity-reset` must each contain a non-empty `curiosityTarget`.
- Every hook/beat has `visualIntent`, at least one `requiredVisualObject`, and 2–3 ordered unique stock search queries.
- Preserve the V2 rule that all portrait queries are tried in order before landscape queries.
- Preserve `selectedSearchQuery` in resolved metadata.
- Never call OpenAI or Pexels from React/Remotion components.
- Unit/integration tests remain offline and deterministic.
- Persist `plan.json`, `resolved.json`, `run.json`, and `output.mp4`.
- `plan.json`/`run.json` must identify `formatVersion: "retention-v3"`.
- Do not add YouTube upload, scheduler, analytics ingestion, automated topic scoring, spreadsheet parsing, A/B publishing, a new stock provider, vision scoring, or a web dashboard.
- Replace generation-facing `Plainly Curious` branding with `Tell Me Whyyyyyy`; do not redesign visual branding in this plan.
- Use the current repository structure when equivalent focused modules already exist. If any expected file path below no longer exists, map it to the current equivalent before editing; do not create a duplicate parallel architecture.

---

## Expected File Structure

The current repository may have equivalent names. Reuse equivalents instead of duplicating responsibility.

```text
src/
├── domain/
│   └── video-plan.ts                  # V3 types, Zod schemas, cross-field validation
├── generation/
│   ├── prompt.ts                      # V3 hook/story system prompts
│   ├── generate-hooks.ts              # structured hook generation
│   ├── select-hook.ts                 # deterministic scoring and tie breaking
│   ├── generate-story.ts              # selected-hook story generation
│   └── generate-video-plan.ts         # public generation orchestration
├── stock/
│   └── resolve-scene-assets.ts        # consume V3 beat visual/search fields
├── pipeline/
│   └── create-short.ts                # persist V3 artifacts / run metadata
└── remotion/
    ├── ShortComposition.tsx           # consume mapped V3 beat props
    ├── Scene.tsx                      # displayText, role-aware treatment
    └── text-layout.ts                 # existing phone-readable text rules

tests/
├── domain/
│   └── video-plan-v3.test.ts
├── generation/
│   ├── select-hook.test.ts
│   ├── generate-hooks.test.ts
│   ├── generate-story.test.ts
│   └── generate-video-plan.test.ts
├── stock/
│   └── resolve-scene-assets.test.ts
├── pipeline/
│   └── create-short.test.ts
└── remotion/
    └── short-composition.test.ts       # use existing render/prop tests if named differently
```

---

### Task 1: Establish the V3 domain contract and validation

**Files:**
- Modify: `src/domain/video-plan.ts`
- Create: `tests/domain/video-plan-v3.test.ts`
- Modify if domain types are colocated elsewhere: the current equivalent only

**Interfaces:**
- Produces: `ContentPattern`
- Produces: `HookScores`
- Produces: `HookConcept`
- Produces: `StoryRole`
- Produces: `StoryBeat`
- Produces: `VideoPlanV3`
- Produces: `parseHookCandidates(value: unknown): HookConcept[]`
- Produces: `parseStoryBeats(value: unknown): StoryBeat[]`
- Produces: `parseVideoPlanV3(value: unknown): VideoPlanV3`
- Produces: `normalizeHookStart(text: string): string`
- Produces: `isBannedHookOpening(text: string): boolean`

- [ ] **Step 1: Write the V3 domain tests first**

Create `tests/domain/video-plan-v3.test.ts` with focused cases equivalent to:

```ts
import {describe, expect, it} from 'vitest';
import {
  isBannedHookOpening,
  parseHookCandidates,
  parseStoryBeats,
  parseVideoPlanV3,
} from '../../src/domain/video-plan';

const hookScores = {
  stopScroll: 5,
  clarity: 5,
  contradiction: 5,
  personalRelevance: 4,
  visualizability: 5,
};

const hook = {
  id: 'hook-a',
  spokenHook: 'A runway can change its number without moving.',
  displayText: 'SAME RUNWAY. NEW NUMBER.',
  curiosityTarget: 'How can a fixed runway need a different number?',
  visualIntent: 'Airport runway threshold with large runway numbers visible',
  requiredVisualObjects: ['runway number marking'],
  searchQueries: ['airport runway number', 'runway threshold marking'],
  scores: hookScores,
};

const beat = {
  id: 'hook',
  role: 'hook',
  durationSeconds: 3,
  spokenText: hook.spokenHook,
  displayText: hook.displayText,
  emphasisWords: ['NUMBER'],
  beatPurpose: 'Create an impossible-sounding contradiction.',
  newInformation: 'Runway numbers can change while the runway stays fixed.',
  curiosityTarget: hook.curiosityTarget,
  visualIntent: hook.visualIntent,
  requiredVisualObjects: hook.requiredVisualObjects,
  searchQueries: hook.searchQueries,
};

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

  it('rejects a hook that ends in a question mark');
  it('accepts a declarative contradiction');
  it('rejects any candidate count other than exactly three');
  it('requires ids hook-a, hook-b, and hook-c exactly once');
  it('rejects a score below 1 or above 5');
  it('rejects a non-integer score');
  it('rejects duplicate normalized spoken hooks');
  it('rejects spokenHook over 22 words');
  it('rejects displayText over 9 words');
  it('rejects empty requiredVisualObjects');
  it('rejects fewer than two or more than three search queries');
  it('rejects duplicate search queries in one hook');
});

describe('V3 story validation', () => {
  it('accepts exactly five ordered V3 roles');
  it('rejects any role order other than hook-context-curiosity-reset-mechanism-payoff');
  it('rejects total story duration below 20 seconds');
  it('rejects total story duration above 28 seconds');
  it('requires curiosityTarget on hook');
  it('requires curiosityTarget on curiosity-reset');
  it('rejects displayText over 9 words');
  it('rejects empty beatPurpose or newInformation');
  it('rejects empty requiredVisualObjects');
  it('rejects exact duplicate normalized spokenText across beats');
  it('rejects exact duplicate normalized displayText across beats');
  it('rejects an emphasis word absent from displayText');
  it('rejects subscribe or follow CTA in payoff');
});

describe('V3 full plan validation', () => {
  it('requires formatVersion retention-v3');
  it('requires exactly three hooks and exactly five beats');
  it('requires selectedHookId to reference an existing candidate');
  it('requires the hook beat copy and first-frame contract to match the selected hook');
});
```

Use complete valid fixtures in the actual test file so each rejected mutation starts from a valid V3 object.

- [ ] **Step 2: Run the narrow tests and confirm they fail**

Run:

```bash
npm test -- tests/domain/video-plan-v3.test.ts
```

Expected: FAIL because V3 types/parsers do not exist yet.

- [ ] **Step 3: Implement the V3 types**

Add, using the repository's existing Zod/type style:

```ts
export const CONTENT_PATTERNS = [
  'BALANCED_REVEAL',
  'FAMILIARITY_TWIST',
  'PERSONAL_STAKES',
] as const;

export type ContentPattern = (typeof CONTENT_PATTERNS)[number];

export type HookScores = {
  stopScroll: number;
  clarity: number;
  contradiction: number;
  personalRelevance: number;
  visualizability: number;
};

export type HookConcept = {
  id: 'hook-a' | 'hook-b' | 'hook-c';
  spokenHook: string;
  displayText: string;
  curiosityTarget: string;
  visualIntent: string;
  requiredVisualObjects: string[];
  searchQueries: string[];
  scores: HookScores;
};

export const STORY_ROLES = [
  'hook',
  'context',
  'curiosity-reset',
  'mechanism',
  'payoff',
] as const;

export type StoryRole = (typeof STORY_ROLES)[number];

export type StoryBeat = {
  id: string;
  role: StoryRole;
  durationSeconds: number;
  spokenText: string;
  displayText: string;
  emphasisWords: string[];
  beatPurpose: string;
  newInformation: string;
  curiosityTarget?: string;
  visualIntent: string;
  requiredVisualObjects: string[];
  searchQueries: string[];
};

export type VideoPlanV3 = {
  formatVersion: 'retention-v3';
  topic: string;
  creativeBrief: string;
  title: string;
  viralAngle: string;
  contentPattern: ContentPattern;
  hookCandidates: HookConcept[];
  selectedHookId: HookConcept['id'];
  beats: StoryBeat[];
};
```

If the codebase must retain `researchQuery` on a persisted/public object for compatibility, use:

```ts
creativeBrief: string;
// or preserve:
researchQuery: string;
```

but do not store two diverging values. If both fields temporarily exist for migration, add a refinement requiring equality and remove the alias before final acceptance unless an existing public test proves it is required.

- [ ] **Step 4: Implement banned-opening normalization**

Use deterministic local validation:

```ts
const BANNED_HOOK_STARTS = [
  'why',
  'how',
  'what',
  'did you know',
  'have you ever wondered',
  'ever wonder',
  'ever notice',
  'hey',
  'welcome',
  "today we're",
  'in this video',
] as const;

export function normalizeHookStart(text: string): string {
  return text
    .trim()
    .replace(/^[\s"'“”‘’()[\]{}.,!:-]+/u, '')
    .toLowerCase();
}

export function isBannedHookOpening(text: string): boolean {
  const normalized = normalizeHookStart(text);
  return (
    normalized.endsWith('?') ||
    BANNED_HOOK_STARTS.some(
      (prefix) =>
        normalized === prefix ||
        normalized.startsWith(`${prefix} `) ||
        normalized.startsWith(`${prefix},`)
    )
  );
}
```

If punctuation normalization needs adjustment to satisfy tests, keep it deterministic and dependency-free.

- [ ] **Step 5: Implement Zod schemas and cross-field refinements**

Enforce all Global Constraints relevant to the domain contract.

Useful helpers:

```ts
function countWords(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function normalizedComparable(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}
```

Validate:

```text
hookCandidates.length === 3
ids exactly hook-a/hook-b/hook-c
all five scores integer 1..5
spokenHook 1..22 words
displayText 1..9 words
curiosityTarget non-empty
requiredVisualObjects >= 1
searchQueries 2..3 and unique after trim/lowercase
all normalized spokenHook values unique
beats.length === 5
roles exactly hook/context/curiosity-reset/mechanism/payoff
sum(durationSeconds) = 20..28
displayText <= 9 words
beatPurpose/newInformation non-empty
hook curiosityTarget non-empty
curiosity-reset curiosityTarget non-empty
emphasisWords <= 2 and present in displayText case-insensitively
no exact normalized spoken/display duplicates across beats
payoff has no explicit subscribe/follow CTA
story hook contract equals selected HookConcept for spokenText/displayText/visualIntent/requiredVisualObjects/searchQueries
```

- [ ] **Step 6: Run domain tests and typecheck**

Run:

```bash
npm test -- tests/domain/video-plan-v3.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/video-plan.ts tests/domain/video-plan-v3.test.ts
git commit -m "feat: define retention v3 content contract"
```

---

### Task 2: Implement deterministic hook scoring and selection

**Files:**
- Create: `src/generation/select-hook.ts`
- Create: `tests/generation/select-hook.test.ts`

**Interfaces:**
- Consumes: `HookConcept[]`
- Produces: `totalHookScore(scores: HookScores): number`
- Produces: `selectHook(candidates: HookConcept[]): HookConcept`
- Tie-break contract: total → clarity → visualizability → stopScroll → id lexical order

- [ ] **Step 1: Write failing deterministic-selection tests**

Create:

```ts
import {describe, expect, it} from 'vitest';
import {selectHook, totalHookScore} from '../../src/generation/select-hook';

describe('totalHookScore', () => {
  it('sums all five hook dimensions', () => {
    expect(totalHookScore({
      stopScroll: 5,
      clarity: 4,
      contradiction: 3,
      personalRelevance: 2,
      visualizability: 1,
    })).toBe(15);
  });
});

describe('selectHook', () => {
  it('selects the highest total score');
  it('breaks equal totals by higher clarity');
  it('then breaks ties by higher visualizability');
  it('then breaks ties by higher stopScroll');
  it('finally breaks exact score ties by hook id lexical order');
  it('does not mutate the input array');
});
```

Use three fully valid HookConcept fixtures.

- [ ] **Step 2: Run and confirm failure**

```bash
npm test -- tests/generation/select-hook.test.ts
```

Expected: FAIL because selection module does not exist.

- [ ] **Step 3: Implement minimal deterministic selection**

```ts
import type {HookConcept, HookScores} from '../domain/video-plan';

export function totalHookScore(scores: HookScores): number {
  return (
    scores.stopScroll +
    scores.clarity +
    scores.contradiction +
    scores.personalRelevance +
    scores.visualizability
  );
}

function compareHooks(a: HookConcept, b: HookConcept): number {
  return (
    totalHookScore(b.scores) - totalHookScore(a.scores) ||
    b.scores.clarity - a.scores.clarity ||
    b.scores.visualizability - a.scores.visualizability ||
    b.scores.stopScroll - a.scores.stopScroll ||
    a.id.localeCompare(b.id)
  );
}

export function selectHook(candidates: HookConcept[]): HookConcept {
  if (candidates.length !== 3) {
    throw new Error(`Expected exactly 3 hook candidates; received ${candidates.length}`);
  }

  return [...candidates].sort(compareHooks)[0];
}
```

Do not add randomness.

- [ ] **Step 4: Run tests and typecheck**

```bash
npm test -- tests/generation/select-hook.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/generation/select-hook.ts tests/generation/select-hook.test.ts
git commit -m "feat: select hook deterministically"
```

---

### Task 3: Generate exactly three V3 hook candidates

**Files:**
- Create: `src/generation/generate-hooks.ts`
- Modify: `src/generation/prompt.ts`
- Create: `tests/generation/generate-hooks.test.ts`

**Interfaces:**
- Consumes: `topic: string`, `creativeBrief: string`
- Consumes existing structured-generation provider through dependency injection
- Produces: `generateHooks(topic, creativeBrief, deps): Promise<HookConcept[]>`
- Produces: `HOOK_SYSTEM_PROMPT`

Use the current provider abstraction rather than calling OpenAI directly from this module if one already exists.

Define the dependency at the focused-module boundary as the current equivalent of:

```ts
export type GenerateHooksDeps = {
  generateStructured: (args: {
    system: string;
    input: string;
    schemaName: string;
  }) => Promise<unknown>;
};
```

If the current provider callback also requires a Zod/JSON schema object, preserve its actual signature; do not create a second provider layer solely to match this pseudo-interface.

- [ ] **Step 1: Write failing hook-generation tests**

Test these exact behaviors:

```ts
it('passes normalized topic and creative brief to the provider');
it('labels TOPIC and CREATIVE BRIEF explicitly');
it('requests exactly three hook candidates');
it('mentions Tell Me Whyyyyyy rather than Plainly Curious');
it('instructs the model to create declarative claim hooks');
it('bans Why/How/What/Did you know/Have you ever wondered/Ever wonder/Ever notice intros');
it('requires spokenHook and shorter displayText separately');
it('requires curiosityTarget and first-frame visual contract');
it('requires requiredVisualObjects and 2–3 ordered search queries');
it('requires five 1–5 heuristic scores');
it('does not ask the provider to choose the winning hook');
it('rejects invalid provider output through parseHookCandidates');
it('rejects blank topic before provider call');
it('rejects blank creative brief before provider call');
```

Use an injected fake provider so tests are offline.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/generation/generate-hooks.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add the V3 hook system prompt**

`HOOK_SYSTEM_PROMPT` must include the following substance:

```text
You create high-retention voiced vertical Shorts for Tell Me Whyyyyyy.

Generate exactly 3 meaningfully different hook candidates for the supplied TOPIC and CREATIVE BRIEF.

The creative brief controls tone, audience, angle, proof, bans, close, facts fence, and optional content pattern.

HOOK RULES
- Every hook is a declarative claim.
- Never open with Why, How, What, Did you know, Have you ever wondered, Ever wonder, Ever notice, Hey, Welcome, Today we're, or In this video.
- Do not end the hook as a question.
- Do not fully explain the mechanism in the hook.
- Prefer a contradiction, personal consequence, unexpected second purpose, surprising number, or impossible-sounding fact when supported by the brief.
- Never invent drama unsupported by the brief.
- spokenHook sounds natural when spoken aloud.
- displayText is shorter visual copy, not a transcript.

FIRST-FRAME RULES
- The subject must be recognizable with sound muted.
- Prefer one dominant object/environment.
- requiredVisualObjects contains the concrete visible noun(s) needed for the hook.
- Give 2–3 ordered stock-footage queries.
- Query 1 is most specific; later queries broaden while remaining visually relevant.
- Never use abstract filler when a concrete subject exists.

SCORING
Score each candidate from 1 through 5 for:
- stopScroll
- clarity
- contradiction
- personalRelevance
- visualizability

Scores are planning heuristics only.
Do not choose a winner.
Return only structured data.
```

- [ ] **Step 4: Implement `generateHooks`**

Normalize and validate input before provider call:

```ts
const normalizedTopic = topic.trim();
const normalizedBrief = creativeBrief.trim();

if (normalizedTopic.length < 3) {
  throw new Error('Topic must be at least 3 characters');
}

if (normalizedBrief.length < 5) {
  throw new Error('Creative brief must be at least 5 characters');
}

const input = [
  `TOPIC: ${normalizedTopic}`,
  `CREATIVE BRIEF: ${normalizedBrief}`,
].join('\n');
```

Then call the current structured provider and parse locally:

```ts
const raw = await deps.generateStructured(/* current provider args */);
return parseHookCandidates(raw);
```

Do not persist or accept a provider-supplied winner.

- [ ] **Step 5: Run tests and typecheck**

```bash
npm test -- tests/generation/generate-hooks.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/generation/generate-hooks.ts src/generation/prompt.ts tests/generation/generate-hooks.test.ts
git commit -m "feat: generate retention v3 hook candidates"
```

---

### Task 4: Generate a five-beat story around the selected hook

**Files:**
- Create: `src/generation/generate-story.ts`
- Modify: `src/generation/prompt.ts`
- Create: `tests/generation/generate-story.test.ts`

**Interfaces:**
- Consumes: `topic: string`
- Consumes: `creativeBrief: string`
- Consumes: `selectedHook: HookConcept`
- Consumes: `contentPattern: ContentPattern`
- Produces: `generateStory(args, deps): Promise<StoryBeat[]>`
- Produces: `STORY_SYSTEM_PROMPT`

Suggested focused signature:

```ts
export type GenerateStoryInput = {
  topic: string;
  creativeBrief: string;
  contentPattern: ContentPattern;
  selectedHook: HookConcept;
};

export async function generateStory(
  input: GenerateStoryInput,
  deps: GenerateStoryDeps,
): Promise<StoryBeat[]>;
```

- [ ] **Step 1: Write failing story-generation tests**

Add exact cases:

```ts
it('passes the selected hook explicitly into story generation');
it('passes the content pattern explicitly');
it('requests exactly five V3 roles in order');
it('requires hook-context-curiosity-reset-mechanism-payoff');
it('requires a second curiosity gap at curiosity-reset');
it('instructs the model not to reveal the complete mechanism in the first five seconds');
it('requires every beat to add new information');
it('requires spokenText and displayText separately');
it('requires natural narration rather than five headline fragments');
it('requires beatPurpose and newInformation metadata');
it('requires curiosityTarget on hook and curiosity-reset');
it('requires visualIntent, requiredVisualObjects, and 2–3 ordered search queries');
it('requires story duration 20–28 seconds and prefers 22–26');
it('forbids subscribe/follow CTA in payoff');
it('forbids the channel outro in generated story');
it('rejects provider output when the hook beat does not match selectedHook');
it('rejects invalid role order');
```

Use fake provider output and `parseStoryBeats`.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/generation/generate-story.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add the V3 story system prompt**

Include this substance:

```text
You create the five-beat spoken story for a Tell Me Whyyyyyy Short.

You are given:
- TOPIC
- CREATIVE BRIEF
- CONTENT PATTERN
- SELECTED HOOK

The selected hook is fixed. Do not replace it.

Build exactly five beats:
1. hook
2. context
3. curiosity-reset
4. mechanism
5. payoff

ATTENTION RULES
- hook opens curiosity gap #1.
- context orients the viewer without fully explaining the mechanism.
- curiosity-reset MUST introduce genuinely new information and open curiosity gap #2.
- mechanism explains the hidden system and includes the proof required by the brief.
- payoff resolves and reframes; it does not merely summarize.

COPY RULES
- spokenText sounds natural aloud.
- displayText is concise visual copy, maximum 9 words.
- every beat adds new information.
- do not repeat the thesis with different wording.
- avoid jargon and unsupported numbers.
- obey the creative brief's ban list and facts fence.
- no subscribe/follow CTA.
- do not write the channel outro.

PACING
- total story duration 20–28 seconds.
- prefer 22–26 seconds.
- hook is fast, roughly 2–3 seconds.
- mechanism may receive the most time.
- do not pad beats to hit a duration.

VISUAL RULES
- every beat has one concrete visualIntent.
- every beat has at least one requiredVisualObject.
- every beat has 2–3 ordered concrete stock queries.
```

Then add pattern-specific guidance:

```text
BALANCED_REVEAL:
familiar thing → contradictory claim → context → deeper surprise → mechanism → reframe

FAMILIARITY_TWIST:
recognizable thing → challenge obvious explanation → partial answer → unexpected second purpose → proof → reframe

PERSONAL_STAKES:
concrete consequence → clarify what it is not → second question/clarification → hidden mechanism → resolution
```

Do not force wording such as “But here's the weird part”; describe the function, not a canned sentence.

- [ ] **Step 4: Implement `generateStory`**

Construct provider input with explicit blocks:

```ts
const providerInput = [
  `TOPIC: ${topic.trim()}`,
  `CREATIVE BRIEF: ${creativeBrief.trim()}`,
  `CONTENT PATTERN: ${contentPattern}`,
  'SELECTED HOOK:',
  JSON.stringify(selectedHook),
].join('\n');
```

Call provider, parse `StoryBeat[]`, then perform a focused selected-hook assertion before returning.

The returned `hook` beat must preserve exactly, after trimming:

```text
spokenText === selectedHook.spokenHook
displayText === selectedHook.displayText
visualIntent === selectedHook.visualIntent
requiredVisualObjects deep-equal selectedHook.requiredVisualObjects
searchQueries deep-equal selectedHook.searchQueries
```

If provider changes the first-frame hook contract, reject instead of silently accepting it.

- [ ] **Step 5: Run story tests and typecheck**

```bash
npm test -- tests/generation/generate-story.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/generation/generate-story.ts src/generation/prompt.ts tests/generation/generate-story.test.ts
git commit -m "feat: generate v3 curiosity-reset stories"
```

---

### Task 5: Orchestrate the two-stage V3 video plan without breaking the CLI

**Files:**
- Modify: `src/generation/generate-video-plan.ts`
- Modify/Test: `tests/generation/generate-video-plan.test.ts`
- Modify the current CLI adapter only if needed to preserve the second argument exactly

**Interfaces:**
- Consumes: `topic: string`, second argument currently called `researchQuery` or `creativeBrief`
- Consumes: `generateHooks`
- Consumes: `selectHook`
- Consumes: `generateStory`
- Produces: `Promise<VideoPlanV3>`

The public effective signature remains the current equivalent of:

```ts
export async function generateVideoPlan(
  topic: string,
  researchQuery: string,
  deps: GenerateVideoPlanDeps,
): Promise<VideoPlanV3>;
```

Semantically:

```ts
const creativeBrief = researchQuery;
```

Do not rename a public argument if existing CLI/tests rely on the old name.

- [ ] **Step 1: Write failing orchestration tests**

Add exact cases:

```ts
it('preserves topic + second CLI argument generation contract');
it('treats the second argument as the creative brief');
it('generates hooks before generating the story');
it('selects the hook in code using selectHook');
it('passes only the selected hook into story generation');
it('persists all three hook candidates in the returned plan');
it('persists selectedHookId computed by code');
it('returns formatVersion retention-v3');
it('returns exactly five V3 beats');
it('does not ask the hook provider to choose a winner');
it('does not generate a story when hook generation fails');
it('does not generate a story when hook selection input is invalid');
it('propagates story validation failure without rendering concerns');
```

Use injected `generateHooks`/`generateStory` fakes or the repository's existing dependency-injection style. Assert call order.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/generation/generate-video-plan.test.ts
```

Expected: FAIL for V3 behavior.

- [ ] **Step 3: Implement V3 orchestration**

In substance:

```ts
const normalizedTopic = topic.trim();
const creativeBrief = researchQuery.trim();

const hookCandidates = await deps.generateHooks(
  normalizedTopic,
  creativeBrief,
);

const selectedHook = selectHook(hookCandidates);

const contentPattern = inferOrReadContentPattern(
  creativeBrief,
  normalizedTopic,
);

const beats = await deps.generateStory(
  {
    topic: normalizedTopic,
    creativeBrief,
    contentPattern,
    selectedHook,
  },
);

return parseVideoPlanV3({
  formatVersion: 'retention-v3',
  topic: normalizedTopic,
  creativeBrief,
  title: normalizedTopic,
  viralAngle: deriveViralAngle(/* use current generation metadata or selected hook */),
  contentPattern,
  hookCandidates,
  selectedHookId: selectedHook.id,
  beats,
});
```

Do **not** invent a new OpenAI call solely to derive `contentPattern` or `viralAngle`.

Pattern extraction should be deterministic from the brief when present.

Implement:

```ts
export function readContentPattern(
  creativeBrief: string,
): ContentPattern | null {
  for (const pattern of CONTENT_PATTERNS) {
    if (creativeBrief.includes(pattern)) return pattern;
  }
  return null;
}
```

Fallback when the brief has no explicit pattern:

- preserve an existing model-generated pattern field if the current repository already generates one in the hook stage, **or**
- default to `BALANCED_REVEAL`.

Do not add a third API call.

For `viralAngle`, prefer an existing current field if already available. Otherwise use selected hook's `curiosityTarget` as the minimal inspectable angle rather than making a third provider call.

- [ ] **Step 4: Verify CLI compatibility**

Run the existing CLI parsing tests, plus:

```bash
npm test -- tests/generation/generate-video-plan.test.ts
npm run typecheck
```

Also run any existing CLI test such as:

```bash
npm test -- tests/cli
```

if that directory exists.

Expected: topic + second argument still reach generation unchanged except trim/semantic naming.

- [ ] **Step 5: Commit**

```bash
git add src/generation/generate-video-plan.ts tests/generation
git commit -m "feat: orchestrate retention v3 planning"
```

---

### Task 6: Adapt stock resolution and resolved-scene mapping to V3 beats

**Files:**
- Modify: `src/stock/resolve-scene-assets.ts`
- Modify: the current resolved-video domain type if separate
- Modify/Test: `tests/stock/resolve-scene-assets.test.ts`

**Interfaces:**
- Consumes: `StoryBeat.searchQueries`
- Consumes: `StoryBeat.visualIntent`
- Carries: `requiredVisualObjects`
- Produces resolved beat metadata including `selectedSearchQuery`
- Preserves portrait-before-landscape search order

- [ ] **Step 1: Add V3 compatibility tests without rewriting proven V2 resolver behavior**

Add exact cases:

```ts
it('resolves V3 beat searchQueries in existing portrait-first order');
it('preserves V3 role, spokenText, displayText, and requiredVisualObjects');
it('persists selectedSearchQuery');
it('does not alter ordered query fallback semantics');
it('reports beat id, visualIntent, and attempted queries when all searches fail');
```

Retain existing resolver tests for:

```text
first usable portrait query wins
later portrait query tried before any landscape query
landscape begins only after every portrait query fails
resolution is deterministic
```

- [ ] **Step 2: Run and verify V3 mapping failure**

```bash
npm test -- tests/stock/resolve-scene-assets.test.ts
```

Expected: only V3 shape/mapping tests should fail. Existing ordered resolver tests must continue to pass.

- [ ] **Step 3: Implement the smallest V3 mapping change**

Do not change search strategy.

The resolver loop remains equivalent to:

```ts
for (const orientation of ['portrait', 'landscape'] as const) {
  for (const query of beat.searchQueries) {
    const videos = await deps.searchVideos(query, {
      orientation,
      perPage: 15,
    });

    const selected = selectBestVideo(videos, beat.durationSeconds);

    if (selected) {
      // download
      // return all StoryBeat metadata
      // selectedSearchQuery = query
    }
  }
}
```

Resolved beat shape should preserve:

```text
id
role
durationSeconds
spokenText
displayText
emphasisWords
beatPurpose
newInformation
curiosityTarget
visualIntent
requiredVisualObjects
searchQueries
selectedSearchQuery
source metadata
localVideoPath
```

- [ ] **Step 4: Run stock tests and typecheck**

```bash
npm test -- tests/stock
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stock tests/stock src/domain
git commit -m "feat: resolve retention v3 story footage"
```

---

### Task 7: Feed narration and concise display copy into the current voiced Remotion pipeline

**Files:**
- Modify: `src/remotion/ShortComposition.tsx`
- Modify: `src/remotion/Scene.tsx`
- Modify only if needed: `src/remotion/text-layout.ts`
- Modify current TTS/audio mapping module if narration is mapped outside Remotion
- Create/Modify: `tests/remotion/short-composition.test.ts` or existing equivalent

**Interfaces:**
- Consumes: resolved V3 beats
- Uses `spokenText` for current narration/TTS/caption source as appropriate
- Uses `displayText` for the large primary on-screen copy
- Preserves role-aware visual hierarchy
- Preserves existing separate channel outro

- [ ] **Step 1: Inspect current audio/text mapping before writing tests**

Before editing, identify:

```text
A. where current TTS input comes from
B. whether captions already have a distinct field
C. whether Scene currently renders a single `text` field
D. exact current outro duration and whether it is included in plan duration
```

Record the discovered mapping in a short comment at the top of the implementation task's working notes, not in production code.

If the repository is still fully silent despite the approved assumption, STOP and report instead of inventing a TTS system. V3 preserves current audio behavior; it does not add voice from scratch.

- [ ] **Step 2: Write failing mapping/render tests**

Test these behaviors in the current test framework:

```ts
it('uses spokenText as narration/TTS source');
it('uses displayText as the large primary visual copy');
it('does not render full spokenText as the primary text card when displayText is shorter');
it('preserves emphasisWords against displayText');
it('renders hook with the strongest existing text hierarchy');
it('renders curiosity-reset as a normal story beat, not an outro');
it('keeps the channel outro separate after the payoff');
it('does not add a logo intro before the hook');
```

If the repository currently uses captions generated from TTS timing, preserve that mechanism. The critical requirement is that the large display copy is not forced to be the full narration transcript.

- [ ] **Step 3: Run and verify failure**

Run the narrow Remotion/unit test command used by the repo, e.g.:

```bash
npm test -- tests/remotion/short-composition.test.ts
```

Expected: V3 field mapping tests fail.

- [ ] **Step 4: Implement V3 field mapping**

In substance:

```tsx
<Scene
  role={beat.role}
  videoSrc={beat.localVideoPath}
  displayText={beat.displayText}
  emphasisWords={beat.emphasisWords}
/>
```

Narration mapping outside the visual card uses:

```ts
beat.spokenText
```

Do not render `beat.spokenText` as the main text block merely because the old scene used `text`.

Preserve existing:

```text
1080x1920
~30 FPS
hard/fast cuts
readability overlay
safe text region
fast hook hierarchy
channel outro after payoff
```

- [ ] **Step 5: Reconcile final duration**

After discovering current outro timing, ensure:

```text
story = 20..28 sec
prompt preference = 22..26 sec
final output <= 30 sec
```

If existing outro makes a 28-second story exceed 30 seconds, enforce a pipeline-level maximum story duration:

```ts
const maxStoryDuration =
  Math.min(28, 30 - outroDurationSeconds);
```

Do not silently truncate narration.

Add a regression test for the exact current outro duration.

- [ ] **Step 6: Run Remotion tests, smoke render, and typecheck**

```bash
npm test -- tests/remotion
npm run typecheck
npm run smoke:render
```

Expected: PASS; smoke render produces a valid local video with no network calls.

- [ ] **Step 7: Commit**

```bash
git add src/remotion tests/remotion
git add <current-audio-mapping-files-if-modified>
git commit -m "feat: render v3 spoken and display copy"
```

---

### Task 8: Persist V3 planning and selection metadata

**Files:**
- Modify: `src/pipeline/create-short.ts`
- Modify: any existing run-artifact serializer
- Modify/Test: `tests/pipeline/create-short.test.ts`

**Interfaces:**
- Consumes: `VideoPlanV3`
- Consumes: resolved V3 beats
- Produces: `plan.json`
- Produces: `resolved.json`
- Produces: `run.json`
- Preserves: `output.mp4`

- [ ] **Step 1: Write failing artifact tests**

Test:

```ts
it('writes formatVersion retention-v3 to plan.json');
it('persists all three hook candidates');
it('persists every hook sub-score');
it('persists computed total score for every hook');
it('persists selectedHookId');
it('persists selected hook tie-break metadata when a tie occurs');
it('persists five story beats with beatPurpose/newInformation/curiosityTarget');
it('persists spokenText and displayText');
it('persists requiredVisualObjects and all search queries');
it('keeps selectedSearchQuery in resolved.json');
it('writes V3 run summary fields to run.json');
it('never writes API keys or provider Authorization headers');
```

Expected `run.json` shape in substance:

```json
{
  "formatVersion": "retention-v3",
  "topic": "A Runway Can Change Its Number Without Moving",
  "contentPattern": "BALANCED_REVEAL",
  "selectedHookId": "hook-a",
  "selectedHookTotalScore": 24,
  "storyDurationSeconds": 25,
  "finalDurationSeconds": 27,
  "beatCount": 5,
  "spokenWordCounts": [9, 11, 10, 18, 12],
  "displayWordCounts": [4, 5, 4, 6, 5],
  "selectedSearchQueries": [
    "airport runway number",
    "runway airport aerial",
    "magnetic compass aviation",
    "runway threshold marking",
    "airport runway landing"
  ]
}
```

Do not snapshot exact generated prose.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/pipeline/create-short.test.ts
```

Expected: FAIL on missing V3 metadata.

- [ ] **Step 3: Add hook score serialization**

Use `totalHookScore(...)` from Task 2; do not duplicate scoring math.

Persist candidates as:

```ts
const hookCandidates = plan.hookCandidates.map((candidate) => ({
  ...candidate,
  totalScore: totalHookScore(candidate.scores),
}));
```

Tie-break metadata should be minimal and deterministic, e.g.:

```ts
selection: {
  selectedHookId: plan.selectedHookId,
  rule: 'total>clarity>visualizability>stopScroll>id',
}
```

This field can always be written; no need to detect whether a tie actually occurred if doing so adds complexity.

- [ ] **Step 4: Update run summary**

Compute word counts locally:

```ts
const countWords = (text: string) =>
  text.trim().split(/\s+/u).filter(Boolean).length;
```

Do not infer analytics.

- [ ] **Step 5: Run pipeline tests and typecheck**

```bash
npm test -- tests/pipeline
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline tests/pipeline
git commit -m "feat: persist retention v3 diagnostics"
```

---

### Task 9: Add V3 acceptance fixtures and failure classification

**Files:**
- Modify/Create: the current acceptance/smoke documentation
- Modify: `README.md`
- Create if the repo keeps fixtures in tests: `tests/fixtures/v3-acceptance.ts`
- Modify existing acceptance helper only if one exists

**Interfaces:**
- Produces three real acceptance commands
- Produces human review rubric
- Produces V3 failure classifications
- Does not add automated analytics ingestion

- [ ] **Step 1: Add the three acceptance inputs**

Create reusable fixture constants containing the topic, pattern, and a concise creative brief for:

```ts
export const V3_ACCEPTANCE_CASES = [
  {
    id: 'runway',
    topic: 'A Runway Can Change Its Number Without Moving',
    pattern: 'BALANCED_REVEAL',
    brief:
      'Pattern: BALANCED_REVEAL. Tone: aviation mind-bender with a clean visual reveal. Audience: U.S. travelers. Angle: the runway stays physically fixed while magnetic heading changes can force a new number. Hook must preserve the contradiction. Proof: show runway markings and magnetic heading drift. Ban fake thresholds and jargon. Close: the runway stayed still; the planet changed the number. Facts fence: verify FAA runway-numbering guidance.',
  },
  {
    id: 'costco',
    topic: "Costco Isn't Just Checking Whether You Paid",
    pattern: 'FAMILIARITY_TWIST',
    brief:
      'Pattern: FAMILIARITY_TWIST. Tone: confident retail-insider. Audience: Americans who shop at Costco. Angle: receipt checks are not only about theft; they can also catch checkout errors. Hook must challenge the obvious security explanation. Proof: receipt, cart, item-count or expensive-item check. Curiosity reset must reveal the customer-side consequence. Ban fake theft statistics and universal procedure claims. Close: one last audit at the exit. Facts fence: verify Costco policy and separate official practice from anecdotes.',
  },
  {
    id: 'gas-hold',
    topic: 'A $40 Fill-Up Can Lock $100+ on Your Card',
    pattern: 'PERSONAL_STAKES',
    brief:
      'Pattern: PERSONAL_STAKES. Tone: urgent money mystery that becomes reassuring. Audience: U.S. drivers. Angle: pay-at-pump authorization can temporarily reserve more than the final fuel purchase. Hook must lead with the $40 versus $100+ consequence. Proof: authorization before fuel total, then final settlement. Curiosity reset must clarify that the larger pending amount is not necessarily the final charge. Ban universal hold amounts/durations and financial advice. Close: it is a temporary placeholder for a bill that did not exist yet. Facts fence: verify merchant/card preauthorization practice and issuer variation.',
  },
] as const;
```

If these already exist in the spreadsheet/fixtures, reuse them rather than duplicating.

- [ ] **Step 2: Document V3 failure classification**

Add exactly these primary categories:

```text
HOOK_GENERATION
HOOK_SELECTION
FIRST_FRAME
CURIOSITY_RESET
STORY_REPETITION
STORY_PACING
SPOKEN_COPY
DISPLAY_COPY
VISUAL_QUERY
PEXELS_MATCH
TEXT_READABILITY
RENDERING
```

Document:

> Classify one primary failure before changing code. Fix the smallest responsible layer.

- [ ] **Step 3: Update README V3 behavior**

Document only implemented behavior:

```text
- channel generation identity: Tell Me Whyyyyyy
- two CLI arguments
- exactly 3 hook candidates
- deterministic selection rule
- five V3 story roles
- mandatory curiosity-reset
- spokenText vs displayText
- 20–28 sec story window / preferred 22–26
- current ordered Pexels resolution
- artifact locations
- real acceptance commands
```

Do not document analytics ingestion, auto-regeneration, scheduling, or topic scoring as implemented.

- [ ] **Step 4: Run documentation/fixture tests if present**

At minimum:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md tests/fixtures
git add <existing-acceptance-doc-or-helper>
git commit -m "docs: define retention v3 acceptance"
```

If no `tests/fixtures` directory is needed, omit it from `git add`.

---

### Task 10: Execute the full real V3 acceptance test

**Files:**
- No production code should be changed unless a classified failure requires a regression fix.
- Outputs: `runs/<run-id>/...`

**Interfaces:**
- Consumes: the three acceptance fixtures
- Produces: three real V3 MP4 runs
- Human grades each run against the approved rubric

- [ ] **Step 1: Run all automated verification before network acceptance**

```bash
npm test
npm run typecheck
npm run smoke:render
```

Expected: all PASS.

Do not begin real acceptance with failing local quality gates.

- [ ] **Step 2: Generate the Runway acceptance video**

Use the exact CLI shape:

```bash
npm run generate -- \
  "A Runway Can Change Its Number Without Moving" \
  "Pattern: BALANCED_REVEAL. Tone: aviation mind-bender with a clean visual reveal. Audience: U.S. travelers. Angle: the runway stays physically fixed while magnetic heading changes can force a new number. Hook must preserve the contradiction. Proof: show runway markings and magnetic heading drift. Ban fake thresholds and jargon. Close: the runway stayed still; the planet changed the number. Facts fence: verify FAA runway-numbering guidance."
```

Inspect `plan.json` before watching output:

```text
[ ] exactly 3 hooks
[ ] selected hook is declarative
[ ] selected first visual is runway-specific
[ ] curiosity-reset contains new information
[ ] five roles are correct
[ ] no repeated thesis
```

Then watch `output.mp4`.

- [ ] **Step 3: Grade Runway**

PASS only if:

```text
A. First spoken claim understandable within ~2 sec
B. First visual identifies runway/airport/runway marking
C. Display copy readable without pausing
D. Hook does not reveal full magnetic mechanism
E. Context adds information
F. Curiosity-reset opens a genuine second question
G. Mechanism explains the hidden system clearly
H. Payoff reframes rather than merely summarizes
I. Spoken copy sounds natural
J. >= 4/5 clips are semantically relevant
K. No broken frames/layout
L. Outro remains separate
M. No manual edit needed
```

A–I and K–M all required. J >= 4/5.

- [ ] **Step 4: Generate and grade Costco**

Run:

```bash
npm run generate -- \
  "Costco Isn't Just Checking Whether You Paid" \
  "Pattern: FAMILIARITY_TWIST. Tone: confident retail-insider. Audience: Americans who shop at Costco. Angle: receipt checks are not only about theft; they can also catch checkout errors. Hook must challenge the obvious security explanation. Proof: receipt, cart, item-count or expensive-item check. Curiosity reset must reveal the customer-side consequence. Ban fake theft statistics and universal procedure claims. Close: one last audit at the exit. Facts fence: verify Costco policy and separate official practice from anecdotes."
```

Use the same rubric, with special focus on:

```text
[ ] Costco/warehouse/receipt/cart recognizable immediately
[ ] context gives only a partial answer
[ ] curiosity-reset introduces a second purpose/consequence
[ ] middle does not become a list
```

- [ ] **Step 5: Generate and grade Gas Hold**

Run:

```bash
npm run generate -- \
  "A $40 Fill-Up Can Lock $100+ on Your Card" \
  "Pattern: PERSONAL_STAKES. Tone: urgent money mystery that becomes reassuring. Audience: U.S. drivers. Angle: pay-at-pump authorization can temporarily reserve more than the final fuel purchase. Hook must lead with the $40 versus $100+ consequence. Proof: authorization before fuel total, then final settlement. Curiosity reset must clarify that the larger pending amount is not necessarily the final charge. Ban universal hold amounts/durations and financial advice. Close: it is a temporary placeholder for a bill that did not exist yet. Facts fence: verify merchant/card preauthorization practice and issuer variation."
```

Special focus:

```text
[ ] first 2 sec communicates $40 vs $100+ consequence
[ ] displayText makes the number contrast instantly readable
[ ] story does not start with payment-system terminology
[ ] curiosity-reset clarifies pending vs final charge
[ ] mechanism preserves the strong deeper explanation
```

- [ ] **Step 6: Inspect output metadata**

Use the repository's existing metadata check or `ffprobe` if already available.

For each final MP4 verify:

```text
width = 1080
height = 1920
fps ~= current expected ~30
codec = H.264
final duration <= 30 sec
```

Do not add a permanent dependency solely for this check if system `ffprobe` exists.

- [ ] **Step 7: Classify every acceptance failure before editing**

Use exactly one primary category:

```text
HOOK_GENERATION
HOOK_SELECTION
FIRST_FRAME
CURIOSITY_RESET
STORY_REPETITION
STORY_PACING
SPOKEN_COPY
DISPLAY_COPY
VISUAL_QUERY
PEXELS_MATCH
TEXT_READABILITY
RENDERING
```

Then:

```text
1. identify the smallest responsible module
2. write a regression test reproducing the failure
3. run the test and confirm failure
4. implement the smallest fix
5. rerun narrow tests
6. rerun npm test + typecheck
7. regenerate only the affected acceptance video(s)
8. grade the same rubric again
```

Do not compensate for one layer by changing an unrelated layer.

- [ ] **Step 8: Final verification**

After all three real videos pass:

```bash
npm test
npm run typecheck
npm run smoke:render
```

Inspect one final V3 `plan.json`, `resolved.json`, and `run.json` manually to verify no secrets and all diagnostic metadata are present.

- [ ] **Step 9: Commit acceptance-driven fixes and final docs**

If acceptance required fixes, commit them by responsible concern, not one giant catch-all commit.

Then final documentation commit if needed:

```bash
git add README.md docs tests src
git commit -m "docs: finalize tell me why retention v3"
```

Skip this commit if README/docs were already committed and no final changes remain.

---

## Definition of Done

The V3 implementation is complete only when all of these are true:

```text
[ ] baseline repository tests passed before V3 implementation
[ ] npm test passes offline
[ ] npm run typecheck passes
[ ] npm run smoke:render passes
[ ] CLI still accepts topic + creative brief as two arguments
[ ] current TTS/audio behavior is preserved
[ ] generation-facing brand is Tell Me Whyyyyyy
[ ] exactly 3 hooks are generated
[ ] hook ids are deterministic
[ ] generic question/greeting hooks are rejected
[ ] hook scores are integer 1..5
[ ] code, not provider output, chooses the winner
[ ] selection tie breaks total > clarity > visualizability > stopScroll > id
[ ] plan.json preserves all 3 hooks and scores
[ ] story has exactly 5 V3 roles
[ ] curiosity-reset is mandatory
[ ] selected hook controls first beat and first-frame contract
[ ] spokenText and displayText are separated
[ ] displayText is <= 9 words
[ ] hook and curiosity-reset both expose curiosityTarget
[ ] each beat has beatPurpose + newInformation
[ ] each beat has >= 1 requiredVisualObject
[ ] each hook/beat has 2–3 unique ordered search queries
[ ] story duration is validated at 20–28 seconds
[ ] generator is prompted to prefer 22–26 seconds
[ ] final output never exceeds 30 seconds
[ ] existing portrait-before-landscape stock fallback remains deterministic
[ ] selectedSearchQuery remains persisted
[ ] resolved.json preserves V3 story metadata
[ ] run.json contains V3 selection/duration/word-count diagnostics
[ ] no API secret is written to artifacts
[ ] Runway real acceptance passes
[ ] Costco real acceptance passes
[ ] Gas Hold real acceptance passes
[ ] at least 4/5 clips are visually relevant in each acceptance video
[ ] no YouTube upload/scheduler/analytics/topic-scoring scope was added
```

## Agent Execution Instruction

Use a fresh agent per task.

For every task:

1. Read:
   - `docs/superpowers/specs/2026-09-03-tell-me-whyyyyyy-retention-v3-design.md`
   - this plan.
2. Inspect the current repository equivalents of the listed files before editing.
3. Preserve existing names and dependency-injection patterns when they are functionally equivalent.
4. Write/update the failing tests first.
5. Run the narrow test and confirm it fails for the intended reason.
6. Implement only the current task.
7. Run the narrow tests and `npm run typecheck`.
8. Review the diff against this task and the global constraints.
9. Fix review findings.
10. Commit only after the task passes.
11. Start the next task with a fresh agent.

Stop and report instead of silently changing scope if any of these are true:

```text
- the CLI no longer accepts a topic and second creative-brief/researchQuery argument
- the renderer is no longer Remotion
- the stock provider is no longer Pexels
- the repository is actually silent and has no current audio/TTS path
- the repository intentionally supports multiple production story schemas
- current tests prove a public compatibility requirement that V3 would break
- the current provider abstraction cannot support the two logical structured-generation stages without a major rewrite
```

If the last case occurs, report the current abstraction and propose the smallest one-call alternative that still:
- exposes exactly three hook candidates,
- deterministically computes the selected candidate in code,
- guarantees the final story uses that same selected hook,
before implementing any workaround.

## September 7 attention-review follow-up: manual footage check

Owner approved proceeding with the attention audit's footage-relevance step, with a
lightweight personal-use implementation. This adds one bounded follow-up to the plan:

- Add a terminal accept/skip/quit check with playable candidate links and required shots.
- Review ordered portrait queries before landscape; do not repeat rejected candidates
  within a scene or silently use unapproved fallback footage in the CLI.
- Keep existing programmatic resolver compatibility, local MP4, voice, karaoke, BGM,
  unique story clips and the reused opening clip for the outro.
- Validate with offline regression tests, full tests and typechecking; commit together.

This is manual visual review, not a semantic scoring model. There are no new runtime
dependencies, review dashboard, resume mechanism or automatic diagrams. The gas-nozzle
mismatch is covered by a deterministic rejected-lab/accepted-nozzle regression fixture;
a real gas-nozzle proof clip still requires the owner's visual review.
