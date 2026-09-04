# Plainly Curious Retention V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Plainly Curious POC from generic 30–45 second fact videos to a deterministic 20–25 second five-beat retention format with stronger declarative hooks, concise on-screen copy, ordered multi-query visual search, and faster Remotion pacing.

**Architecture:** Keep the existing `topic/research query -> VideoPlan -> resolved Pexels assets -> Remotion props -> MP4` pipeline, but replace the v1 scene contract with a five-role V2 contract. Generation remains one structured AI step; stock resolution becomes an ordered multi-query search; rendering consumes the new roles and emphasis metadata without adding new external services.

**Tech Stack:** Existing Node.js 22+, TypeScript 5.x, npm, OpenAI JavaScript SDK, Zod, Pexels REST API, React, Remotion, Vitest, dotenv, fs/promises. Add no new runtime dependency unless the current repository already requires one for its implemented research stage.

**Spec:** `docs/superpowers/specs/2026-08-20-ai-shorts-retention-v2-design.md`

## Global Constraints

- This is a delta on top of the working AI Shorts POC; do not rebuild the repository from scratch.
- Preserve the public CLI shape: `npm run generate -- "<Topic>" "<Research Query>"`.
- Output remains local H.264 MP4, 1080×1920, 30 FPS.
- V2 videos contain exactly 5 beats in this order: `hook`, `escalation`, `mechanism`, `twist`, `payoff`.
- Every beat lasts exactly 4 or 5 seconds; total duration must be 20–25 seconds.
- Every primary on-screen text block contains 3–9 whitespace-delimited words.
- The first beat is a declarative pattern interrupt; it must not begin with `Why`, `How`, `What`, or `Ever wonder` (case-insensitive).
- The final beat resolves the story and must not contain a subscribe/follow CTA.
- Each beat has one `visualIntent` plus 2–3 ordered, unique Pexels search queries.
- The asset resolver tries all portrait queries in order before any landscape query.
- Never call OpenAI or Pexels from React/Remotion components.
- Unit/integration tests remain offline and deterministic.
- Persist the exact query that selected each stock clip.
- No voiceover, upload automation, scheduler, analytics ingestion, topic-scoring engine, new stock provider, web UI, or multi-template system in this plan.
- Keep current research behavior unchanged. This plan only changes how the existing topic/research context is converted into the video plan and how that plan is rendered.

---

## File Structure Changes

Modify the existing equivalents of these files. Do not duplicate modules under new names if the repository already has the v1 paths shown here.

```text
src/
├── domain/
│   ├── video-plan.ts                  # V2 beat contract + schema
│   └── resolved-video.ts              # selectedSearchQuery metadata
├── generation/
│   ├── prompt.ts                      # retention V2 prompt
│   └── generate-video-plan.ts         # topic + researchQuery generation
├── stock/
│   └── resolve-scene-assets.ts        # ordered multi-query resolver
├── pipeline/
│   └── create-short.ts                # V2 artifacts/run metadata
└── remotion/
    ├── ShortComposition.tsx           # 20–25 sec dynamic composition
    ├── Scene.tsx                      # role-aware visual treatment
    └── text-layout.ts                 # 3–9 word large-card layout

tests/
├── generation/
│   └── generate-video-plan.test.ts
├── stock/
│   └── resolve-scene-assets.test.ts
├── pipeline/
│   └── create-short.test.ts
└── remotion/
    └── text-layout.test.ts
```

The existing v1 `searchQuery: string` field is removed from `VideoScene`; do not maintain parallel v1/v2 scene contracts unless another existing test proves a real compatibility requirement.

---

### Task 1: Replace the v1 scene schema with the five-beat V2 contract

**Files:**
- Modify: `src/domain/video-plan.ts`
- Modify: `src/domain/resolved-video.ts`
- Test: `tests/generation/generate-video-plan.test.ts`

**Interfaces:**
- Produces: `BeatRole`
- Produces: `VideoScene`
- Produces: `VideoPlan`
- Produces: `ResolvedScene`
- Produces: `parseVideoPlan(value: unknown): VideoPlan`

Use these domain types:

```ts
export const BEAT_ROLES = [
  'hook',
  'escalation',
  'mechanism',
  'twist',
  'payoff',
] as const;

export type BeatRole = (typeof BEAT_ROLES)[number];

export type VideoScene = {
  id: string;
  role: BeatRole;
  durationSeconds: 4 | 5;
  text: string;
  emphasisWords: string[];
  visualIntent: string;
  searchQueries: string[];
};

export type VideoPlan = {
  topic: string;
  researchQuery: string;
  title: string;
  viralAngle: string;
  scenes: VideoScene[];
};
```

Extend the existing resolved scene type with:

```ts
export type ResolvedScene = VideoScene & {
  selectedSearchQuery: string;
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
  localVideoPath: string;
};
```

- [ ] **Step 1: Replace the v1 schema tests with V2 acceptance tests**

Add these exact behaviors to `tests/generation/generate-video-plan.test.ts`:

```ts
it('accepts exactly five ordered retention beats totaling 20 seconds');
it('accepts exactly five ordered retention beats totaling 25 seconds');
it('rejects any scene count other than five');
it('rejects beat roles in the wrong order');
it('rejects a scene duration outside four or five seconds');
it('rejects total duration outside 20 through 25 seconds');
it('rejects scene text below three words');
it('rejects scene text above nine words');
it('rejects a generic question hook');
it('rejects fewer than two search queries');
it('rejects more than three search queries');
it('rejects duplicate search queries inside a scene');
it('rejects blank visual intent');
it('rejects more than two emphasis words');
it('rejects an emphasis word that is not present in scene text');
```

Use this valid fixture shape in the tests:

```ts
const validPlan = {
  topic: 'Why Airplane Windows Are Round',
  researchQuery: 'Explain why modern airplane passenger windows have rounded corners instead of square corners.',
  title: 'Why Airplane Windows Are Round',
  viralAngle: 'A small window shape became a major aviation safety lesson.',
  scenes: [
    {
      id: 'hook',
      role: 'hook',
      durationSeconds: 4,
      text: 'Square windows helped cause deadly crashes',
      emphasisWords: ['deadly'],
      visualIntent: 'Early passenger jet viewed from outside with cabin windows visible',
      searchQueries: ['vintage passenger airplane', 'airplane cabin windows'],
    },
    {
      id: 'escalation',
      role: 'escalation',
      durationSeconds: 4,
      text: 'Cabin pressure stressed their sharp corners',
      emphasisWords: ['sharp'],
      visualIntent: 'Close view of an airplane window and fuselage under flight conditions',
      searchQueries: ['airplane window close up', 'airplane fuselage windows'],
    },
    {
      id: 'mechanism',
      role: 'mechanism',
      durationSeconds: 4,
      text: 'Stress concentrated in those tiny corners',
      emphasisWords: ['concentrated'],
      visualIntent: 'Detailed close view of a rounded airplane passenger window frame',
      searchQueries: ['airplane window frame', 'aircraft window close up'],
    },
    {
      id: 'twist',
      role: 'twist',
      durationSeconds: 4,
      text: 'Repeated flights could turn cracks dangerous',
      emphasisWords: ['cracks'],
      visualIntent: 'Passenger jet taking off to represent repeated pressurization cycles',
      searchQueries: ['passenger airplane takeoff', 'commercial jet takeoff'],
    },
    {
      id: 'payoff',
      role: 'payoff',
      durationSeconds: 4,
      text: 'Rounded corners spread that stress better',
      emphasisWords: ['Rounded'],
      visualIntent: 'Modern rounded airplane window seen clearly from inside the cabin',
      searchQueries: ['rounded airplane window', 'airplane window passenger view'],
    },
  ],
};
```

- [ ] **Step 2: Run the schema tests and confirm v1 fails**

```bash
npm test -- tests/generation/generate-video-plan.test.ts
```

Expected: failures because the current schema still accepts 5–7 scenes, 30–45 seconds, and single `searchQuery` fields.

- [ ] **Step 3: Implement the V2 Zod schema and cross-field refinements**

Enforce:

```text
VideoPlan.topic: trimmed length 3..200
VideoPlan.researchQuery: trimmed length 5..500
VideoPlan.title: trimmed length 5..90
VideoPlan.viralAngle: trimmed length 10..180
scenes.length: exactly 5
roles: exact BEAT_ROLES order
scene.id: /^[a-z0-9-]+$/ and unique
scene.durationSeconds: integer 4 or 5
scene.text: 3..9 whitespace-delimited words, non-empty
scene.emphasisWords: 0..2 unique values; each case-insensitively appears as a token/substring in scene.text
scene.visualIntent: trimmed length 10..180
scene.searchQueries: 2..3 unique trimmed strings, each length 3..80
total duration: 20..25 seconds
hook text: must not match /^(why|how|what|ever\s+wonder)/i
payoff text: must not match /\b(subscribe|follow|like\s+and|hit\s+the)\b/i
```

Keep `parseVideoPlan(value: unknown): VideoPlan` as the only exported runtime parser used by generation.

- [ ] **Step 4: Update `ResolvedScene` and all TypeScript call sites to compile with `searchQueries` and `selectedSearchQuery`**

Do not implement new resolver behavior yet. Make only the minimum type changes needed for the repository to typecheck after later tasks are applied.

- [ ] **Step 5: Verify**

```bash
npm test -- tests/generation/generate-video-plan.test.ts
npm run typecheck
```

Expected: schema tests PASS; typecheck may expose resolver/render call sites that still reference `searchQuery`. Fix only mechanical property-name/type errors required by this contract.

- [ ] **Step 6: Commit**

```bash
git add src/domain tests/generation/generate-video-plan.test.ts
git commit -m "feat: define retention v2 video plan"
```

---

### Task 2: Generate a viral angle and five escalating story beats

**Files:**
- Modify: `src/generation/prompt.ts`
- Modify: `src/generation/generate-video-plan.ts`
- Modify/Test: `tests/generation/generate-video-plan.test.ts`

**Interfaces:**
- Consumes: `topic: string`, `researchQuery: string`
- Produces: `generateVideoPlan(topic: string, researchQuery: string, deps: GenerateVideoPlanDeps): Promise<VideoPlan>`

If the existing repository already has this two-input signature, preserve its exact dependency-injection shape and only change the structured content contract. The public pipeline and CLI must continue to pass the second argument as `researchQuery`.

- [ ] **Step 1: Add generation tests for prompt inputs and V2 behavior**

Add tests that prove:

```ts
it('passes both topic and research query into structured generation');
it('trims topic and research query before generation');
it('rejects a blank research query before calling the provider');
it('returns a parsed five-beat V2 plan');
it('rejects provider output that repeats the title question as the hook');
it('rejects provider output with duplicate search queries');
```

The injected generator input should contain explicit labels so the model cannot confuse the two strings:

```text
TOPIC: Why Supermarkets Put Milk at the Back
RESEARCH BRIEF: Explain why supermarkets often place milk, eggs, and other staple products toward the back of the store.
```

- [ ] **Step 2: Run the tests and verify failure**

```bash
npm test -- tests/generation/generate-video-plan.test.ts
```

- [ ] **Step 3: Replace the v1 system prompt with this V2 prompt**

`src/generation/prompt.ts` must instruct the model with the following requirements in substance and testable wording:

```text
You create high-retention silent vertical educational Shorts for Plainly Curious.

Turn the supplied TOPIC and RESEARCH BRIEF into exactly five escalating beats:
1. hook
2. escalation
3. mechanism
4. twist
5. payoff

The complete video must be 20–25 seconds. Every beat lasts 4–5 seconds.

HOOK RULES
- The hook is a declarative pattern interrupt, not a restatement of the title.
- Do not start the hook with Why, How, What, or Ever wonder.
- Prefer a surprising consequence, conflict, hidden intention, danger, money, manipulation, or counterintuitive claim when the research brief supports it.
- Do not invent drama unsupported by the research brief.

STORY RULES
- Each beat must add new information; never paraphrase the previous beat.
- escalation raises stakes or curiosity.
- mechanism explains the central reason/system.
- twist adds evidence, a counterintuitive detail, or second-order effect.
- payoff resolves the original curiosity gap.
- No subscribe/follow CTA.
- Avoid unverifiable numbers and absolute claims.

TEXT RULES
- Every beat text is 3–9 words.
- Write like a large visual headline, not subtitles.
- Mark zero, one, or two exact words from the displayed text for emphasis.

VISUAL RULES
- Give every beat one concrete visualIntent.
- Give every beat 2–3 ordered Pexels search queries.
- Query 1 is the most subject-specific useful footage query.
- Queries 2–3 are progressively broader fallbacks while staying visually relevant.
- Search for visible nouns, actions, and environments, not abstract concepts.
- For a named brand/place, use the name in the first query when useful, then provide a non-branded environment fallback.
- Never use generic filler such as person walking hallway when a topic-specific environment exists.

Return only structured data matching the required schema.
```

- [ ] **Step 4: Update `generateVideoPlan` to pass topic + research query**

The effective contract must be:

```ts
export async function generateVideoPlan(
  topic: string,
  researchQuery: string,
  deps: GenerateVideoPlanDeps,
): Promise<VideoPlan>;
```

Validation before provider call:

```ts
const normalizedTopic = topic.trim();
const normalizedResearchQuery = researchQuery.trim();
if (normalizedTopic.length < 3) throw new Error('Topic must be at least 3 characters');
if (normalizedResearchQuery.length < 5) throw new Error('Research query must be at least 5 characters');
```

Provider input:

```ts
const input = `TOPIC: ${normalizedTopic}\nRESEARCH BRIEF: ${normalizedResearchQuery}`;
```

Continue to validate the provider result with `parseVideoPlan` even when provider-side structured output is enabled.

- [ ] **Step 5: Verify**

```bash
npm test -- tests/generation/generate-video-plan.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/generation tests/generation
git commit -m "feat: generate five-beat retention stories"
```

---

### Task 3: Resolve ordered, topic-specific visual queries before falling back

**Files:**
- Modify: `src/stock/resolve-scene-assets.ts`
- Test: `tests/stock/resolve-scene-assets.test.ts`
- Modify if required by resolved metadata: `src/domain/resolved-video.ts`

**Interfaces:**
- Consumes: `scene.searchQueries: string[]`
- Produces: `ResolvedScene.selectedSearchQuery: string`
- Existing `selectBestVideo(...)` quality ranking remains unchanged unless a failing existing test proves it incompatible.

- [ ] **Step 1: Replace the single-query resolver tests with ordered multi-query tests**

Add these exact cases:

```ts
it('uses the first portrait query when it yields a usable candidate');
it('tries the second portrait query when the first has no usable candidate');
it('tries the third portrait query when the first two fail');
it('does not search landscape while any later portrait query remains untried');
it('tries landscape queries in the same order only after all portrait queries fail');
it('persists the exact query that selected the clip');
it('stops searching after a clip is selected');
it('fails with scene id and all attempted queries when nothing resolves');
it('keeps deterministic scene filenames and scene order');
```

Use a two-query scene fixture in the first tests and a three-query scene fixture for fallback-order tests.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/stock/resolve-scene-assets.test.ts
```

- [ ] **Step 3: Implement the deterministic search order**

For each scene, execute exactly this search sequence:

```ts
for (const orientation of ['portrait', 'landscape'] as const) {
  for (const query of scene.searchQueries) {
    const videos = await deps.searchVideos(query, {orientation, perPage: 15});
    const selected = selectBestVideo(videos, scene.durationSeconds);
    if (selected) {
      // download and return; selectedSearchQuery = query
    }
  }
}
```

Do not randomize query order or candidate selection.

Maximum calls for a scene are six: three portrait + three landscape. A two-query scene has a maximum of four.

When all attempts fail, throw an error containing:

```text
scene id
visualIntent
attempted queries in order
```

Do not include API keys or raw Authorization headers.

- [ ] **Step 4: Include `selectedSearchQuery` in the returned resolved scene**

The returned object must include all original V2 scene fields plus:

```ts
selectedSearchQuery: query,
sourcePageUrl: selected.sourcePageUrl,
creatorName: selected.creatorName,
creatorUrl: selected.creatorUrl,
localVideoPath: destination,
```

- [ ] **Step 5: Verify stock tests**

```bash
npm test -- tests/stock
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/stock/resolve-scene-assets.ts src/domain/resolved-video.ts tests/stock/resolve-scene-assets.test.ts
git commit -m "feat: add ordered visual query fallbacks"
```

---

### Task 4: Replace subtitle-like layout with large role-aware text cards

**Files:**
- Modify: `src/remotion/text-layout.ts`
- Test: `tests/remotion/text-layout.test.ts`

**Interfaces:**
- Consumes: `text: string`, `role: BeatRole`
- Produces: `layoutSceneText(text: string, role: BeatRole): TextLayout`

Use:

```ts
export type TextLayout = {
  lines: string[];
  fontSize: number;
  maxWidth: number;
};
```

- [ ] **Step 1: Write failing V2 layout tests**

Cover these deterministic tiers:

```text
HOOK
3..5 words  -> fontSize 140, maxWidth 900
6..7 words  -> fontSize 124, maxWidth 920
8..9 words  -> fontSize 110, maxWidth 940

OTHER ROLES
3..5 words  -> fontSize 118, maxWidth 900
6..7 words  -> fontSize 106, maxWidth 920
8..9 words  -> fontSize 96, maxWidth 940
```

Also test:

```ts
it('wraps all text into at most three non-empty lines');
it('never drops or reorders words');
it('rejects fewer than three words');
it('rejects more than nine words');
it('gives hook text a larger size than the same-length payoff text');
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/remotion/text-layout.test.ts
```

- [ ] **Step 3: Implement greedy wrapping for a maximum of three lines**

Use whitespace tokenization. Choose the tier from word count and role, then greedily distribute words while preserving order. If the final result would exceed three lines, rebalance by moving trailing words from earlier lines before reducing font size. Because schema already limits text to nine words, no browser measurement library is needed.

Do not hyphenate or abbreviate generated copy inside the renderer.

- [ ] **Step 4: Verify**

```bash
npm test -- tests/remotion/text-layout.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/remotion/text-layout.ts tests/remotion/text-layout.test.ts
git commit -m "feat: enlarge retention v2 scene text"
```

---

### Task 5: Make the Remotion template faster and role-aware

**Files:**
- Modify: `src/remotion/ShortComposition.tsx`
- Modify: `src/remotion/Scene.tsx`
- Modify if required for dynamic duration: `src/remotion/Root.tsx`
- Consume: `src/remotion/text-layout.ts`

**Interfaces:**
- Composition id remains the current production composition id (`SilentShort` in the v1 plan) so rendering code does not need a second template.
- Composition props remain `{video: ResolvedVideo}`.

- [ ] **Step 1: Update dynamic duration to the V2 plan**

The composition metadata must derive:

```ts
const durationInFrames = Math.round(
  video.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0) * 30,
);
```

A valid V2 composition therefore renders between 600 and 750 frames.

- [ ] **Step 2: Replace slow scene fades with punchier cuts**

At scene boundaries, use hard cuts. Do not keep the old 6-frame scene fade in/out.

Inside each scene:

```text
video opacity: constant 1
video scale: 1.00 -> 1.06 over scene duration
text entrance: 0 -> 1 opacity over first 4 frames
text translateY: 18px -> 0 over first 5 frames
text stays fully visible for remainder of scene
```

Do not animate text out before the scene cuts.

- [ ] **Step 3: Render role-aware copy**

Call:

```ts
const layout = layoutSceneText(scene.text, scene.role);
```

Position:

```text
horizontal safe margin: at least 70px
hook vertical center: approximately 48% of frame height
other beats vertical center: approximately 58% of frame height
maximum text block width: layout.maxWidth
```

Use the existing bold Plainly Curious text family if the repository has one. Do not add a new font dependency for this task.

- [ ] **Step 4: Add emphasis highlighting without changing the displayed words**

Render scene text token-by-token while preserving exact whitespace-visible order. Any token that case-insensitively matches one of `scene.emphasisWords` uses the existing Plainly Curious yellow; all other text remains white.

Keep the existing strong shadow/stroke/readability treatment. Add or retain a dark full-frame overlay around 25–35% opacity so white/yellow text remains readable over stock footage.

- [ ] **Step 5: Keep the template visually restrained**

Allowed:

```text
large white/yellow text
one dark readability overlay
subtle video zoom
existing top progress indicator if already present
```

Remove/avoid:

```text
slow crossfades
long subtitle paragraphs
multiple transition families
stickers
emojis
random per-scene colors
new logo animation
```

- [ ] **Step 6: Preview a fixture in Remotion Studio**

```bash
npm run remotion:studio
```

Use a five-beat fixture and verify all of the following at 1080×1920:

```text
hook is obviously larger than normal scene copy
no scene contains more than three lines
no text enters top/bottom Shorts UI danger zones
hard cuts have no blank frames
first-frame text is visible within 5 frames
20-second fixture timeline is exactly 600 frames
25-second fixture timeline is exactly 750 frames
```

- [ ] **Step 7: Verify**

```bash
npm test
npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add src/remotion
git commit -m "feat: render faster five-beat shorts"
```

---

### Task 6: Persist V2 diagnostics so bad videos can be traced to generation or search

**Files:**
- Modify: `src/pipeline/create-short.ts`
- Modify existing JSON persistence helpers only if required
- Test: `tests/pipeline/create-short.test.ts`

**Interfaces:**
- Existing run directory layout stays intact.
- `plan.json` stores the complete V2 `VideoPlan`.
- `resolved.json` stores resolved scenes including `selectedSearchQuery`.
- `run.json` adds V2 metadata.

- [ ] **Step 1: Add failing pipeline-artifact tests**

Assert that a completed fake run writes `run.json` containing:

```json
{
  "formatVersion": "retention-v2",
  "beatCount": 5,
  "durationSeconds": 20,
  "wordCounts": [6, 6, 6, 6, 6],
  "selectedSearchQueries": [
    "vintage passenger airplane",
    "airplane window close up",
    "airplane window frame",
    "passenger airplane takeoff",
    "rounded airplane window"
  ]
}
```

Use the fixture's actual word counts rather than hard-coding `6` if the fixture changes; the expected test data and fixture must agree exactly.

Also assert:

```ts
it('persists visualIntent and all fallback queries in plan.json');
it('persists selectedSearchQuery in resolved.json');
it('keeps output.mp4 path behavior unchanged');
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/pipeline/create-short.test.ts
```

- [ ] **Step 3: Add V2 run metadata**

Build run metadata from the parsed/resolved plan, not from raw provider output:

```ts
const runMetadata = {
  formatVersion: 'retention-v2' as const,
  beatCount: resolved.scenes.length,
  durationSeconds: resolved.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
  wordCounts: resolved.scenes.map((scene) => scene.text.trim().split(/\s+/).length),
  selectedSearchQueries: resolved.scenes.map((scene) => scene.selectedSearchQuery),
};
```

Merge this with the run metadata fields the current repository already persists; do not delete timestamps, run ids, source attribution, or output paths already used by the POC.

- [ ] **Step 4: Update the CLI completion summary if it currently prints plan stats**

When generation finishes, print a compact summary containing:

```text
format: retention-v2
beats: 5
duration: <N>s
output: <path>
```

Do not print API keys, raw provider responses, or full stock download URLs.

- [ ] **Step 5: Verify**

```bash
npm test -- tests/pipeline/create-short.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/pipeline tests/pipeline/create-short.test.ts src/cli.ts
git commit -m "feat: persist retention v2 diagnostics"
```

---

### Task 7: Run regression checks and real V2 acceptance videos

**Files:**
- Modify: `README.md`
- No production code changes unless a failing acceptance criterion identifies a defect in Tasks 1–6.

**Interfaces:**
- Public command remains:

```bash
npm run generate -- "<Topic>" "<Research Query>"
```

- [ ] **Step 1: Run the complete offline verification suite**

```bash
npm test
npm run typecheck
```

Expected: PASS with no tests requiring internet access.

- [ ] **Step 2: Run the IKEA acceptance video**

```bash
npm run generate -- \
  "Why IKEA Makes You Walk Through the Whole Store" \
  "Explain why IKEA stores commonly use a long, guided showroom path that takes customers through many departments."
```

Automatic checks on the resulting `plan.json`:

```text
5 beats
20–25 total seconds
hook does not start with Why/How/What/Ever wonder
all text blocks 3–9 words
all scenes have 2–3 queries
role order is exact
```

Human visual check:

```text
first footage clearly suggests IKEA, furniture retail, or a showroom environment
no generic office/hotel hallway is accepted as the opening visual
at least 4 of 5 scenes visually match their visualIntent
copy is readable without pausing
story escalates rather than repeating the same explanation
```

- [ ] **Step 3: Run the airplane-window acceptance video**

```bash
npm run generate -- \
  "Why Airplane Windows Are Round" \
  "Explain why modern airplane passenger windows have rounded corners instead of square corners."
```

Human visual check:

```text
opening footage immediately shows an aircraft, fuselage, or airplane-window context
at least 4 of 5 scenes visually match
hook is a claim/consequence, not the title question
payoff resolves the engineering reason
```

- [ ] **Step 4: Run the supermarket-milk acceptance video**

```bash
npm run generate -- \
  "Why Supermarkets Put Milk at the Back" \
  "Explain why supermarkets often place milk, eggs, and other staple products toward the back of the store."
```

Human visual check:

```text
opening footage clearly shows a supermarket, grocery aisle, dairy aisle, or milk display
kitchen-only footage is not acceptable as the opening scene
at least 4 of 5 scenes visually match
copy creates a hidden-strategy curiosity gap before explaining it
```

- [ ] **Step 5: Classify any acceptance failure before changing code**

Use exactly one primary classification per failed scene/video:

```text
HOOK_QUALITY        -> generated first beat is weak, generic, or title-like
STORY_REPETITION    -> two or more beats restate the same information
TEXT_DENSITY        -> copy is too long/small despite passing schema
VISUAL_QUERY        -> generated search queries do not describe the desired footage
PEXELS_MATCH        -> queries are good but Pexels results are poor
TEXT_READABILITY    -> rendering/layout problem
PACING              -> cuts/animations feel slow or confusing
RENDERING           -> technical video defect
```

Fix the responsible layer only. Do not compensate for a weak AI query by adding random renderer behavior, and do not compensate for a renderer bug by changing the generation prompt.

- [ ] **Step 6: Update README with the V2 format and acceptance command**

Document:

```text
- the two CLI arguments
- five beat roles
- 20–25 second target
- 3–9 word copy rule
- multi-query Pexels fallback behavior
- location of plan.json, resolved.json, run.json, output.mp4
```

Do not document voiceover, upload automation, or future roadmap items as implemented.

- [ ] **Step 7: Re-run verification after any acceptance fixes**

```bash
npm test
npm run typecheck
```

Then regenerate only the acceptance video(s) affected by the fix and re-check the same rubric.

- [ ] **Step 8: Commit**

```bash
git add README.md src tests
git commit -m "docs: finalize retention v2 POC"
```

---

## Definition of Done

The change is complete only when all of these are true:

```text
[ ] npm test passes offline
[ ] npm run typecheck passes
[ ] CLI still accepts topic + research query
[ ] every parsed plan has exactly five ordered beats
[ ] every video is 20–25 seconds
[ ] every text card is 3–9 words
[ ] generic title-question hooks are rejected
[ ] every scene has 2–3 ordered search queries
[ ] resolver exhausts portrait queries before landscape
[ ] selectedSearchQuery is persisted
[ ] Remotion uses fast cuts and large role-aware text
[ ] IKEA acceptance opening is not generic hallway footage
[ ] airplane acceptance opening is obviously aviation-related
[ ] supermarket acceptance opening is supermarket/dairy-related
[ ] at least 4/5 scenes are visually relevant in each acceptance video
[ ] plan.json, resolved.json, run.json, and output.mp4 are preserved
```

## Agent Execution Instruction

Use a fresh agent per task. For each task:

1. Read this plan and the V2 design spec.
2. Inspect the current repository implementation before editing; preserve existing names when they are functionally equivalent to the paths in this plan.
3. Write or update the failing tests first.
4. Run the narrow test and confirm the intended failure.
5. Implement only that task.
6. Run the narrow tests plus `npm run typecheck`.
7. Review the diff against the task requirements.
8. Fix review findings.
9. Commit with the task's commit message.
10. Only then move to the next task.

Stop and report instead of silently changing scope if the current repository contradicts any of these assumptions:

```text
- CLI no longer accepts both topic and researchQuery
- the renderer is no longer Remotion
- Pexels is no longer the stock provider
- the repository intentionally supports multiple production scene schemas
- an existing test proves a public compatibility requirement that this V2 contract would break
```
