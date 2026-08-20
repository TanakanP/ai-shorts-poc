# v1.1 Creative brief, claim hooks, and multi-query stock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep voiced 4-beat shorts + outro, but generate claim-hooks from a creative brief and pick stock with ordered Pexels queries.

**Architecture:** Same pipeline (topic → plan → TTS → Pexels → Remotion). The second CLI argument becomes a creative brief in the planner prompt. The educational `VideoPlan` gains `viralAngle`, beat `role`s, `visualIntent`, and `searchQueries[]`. The resolver tries those queries in order and persists `selectedSearchQuery`. Voice, karaoke, BGM, unique clips, 15s floor, and outro stay.

**Tech Stack:** Existing TypeScript, Zod, Vitest, Pexels client, Remotion. No new packages.

**Content (not this plan):** `misc/v1_1_content_enhance.md` — the human writes the brief. Do not generate live videos in these tasks.

**Branch from:** tag `v1.0.0` / current `main` (`82a126d`). Do not edit the freeze tag.

---

## Locked product rules

- Educational scenes: **exactly 4**, roles in order `hook → stake → proof → payoff`.
- `attachChannelOutro` still appends `channel-outro` after parse (role `outro`).
- Hook spoken opening must **not** match `/^(why|how|what|ever\s+wonder)\b/i`.
- `searchQuery` is removed. Use `searchQueries` (2–3 unique strings).
- Speak-then-time, karaoke, BGM, unique Pexels ids, 15–60s voiced total: unchanged.
- No silent format, no 3–9 word headline-only copy, no dark wash, no YouTube.

## File structure

- Modify: `AGENTS.md`
- Modify: `src/domain/video-plan.ts`
- Modify: `src/domain/resolved-video.ts`
- Modify: `tests/fixtures/video-plan.json`
- Modify: `tests/generation/generate-video-plan.test.ts`
- Modify: `src/generation/prompt.ts`
- Modify: `src/generation/generate-video-plan.ts`
- Modify: `src/pipeline/attach-channel-outro.ts`
- Modify: `tests/pipeline/attach-channel-outro.test.ts`
- Modify: `src/stock/resolve-scene-assets.ts`
- Modify: `tests/stock/resolve-scene-assets.test.ts`
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`
- Modify: mechanical `searchQuery` call sites listed in Task 2
- Modify: `README.md`
- Modify: `package.json` (version `1.1.0` in the last task)

---

### Task 1: Point agents at this plan

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Replace AGENTS.md**

```md
# Project Instructions

This project implements voiced AI Shorts (v1.1): punchy 4-beat plans from a creative brief, karaoke captions, unique stock from ordered Pexels queries, a channel sign-off, and a local music bed.

Primary implementation plan:
docs/superpowers/plans/2026-08-20-v1-1-creative-brief-and-stock.md

Content owner notes (not code):
misc/v1_1_content_enhance.md

Rules:
- Follow the implementation plan task-by-task and in order.
- Use test-driven development.
- Do not add features outside this plan.
- Output is still a locally rendered MP4.
- Keep voice, karaoke, BGM, and the channel outro.
- No YouTube upload.
- No silent-short rewrite.
- No dark wash.
- No scheduler, database, or analytics.
- Keep modules small and independently testable.
- Run tests after every task.
- Commit after each completed task.
- Never put API keys in source control.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: point agents at v1.1 creative brief plan"
```

---

### Task 2: Four-role plan schema + fixture

**Files:**
- Modify: `src/domain/video-plan.ts`
- Modify: `src/domain/resolved-video.ts`
- Modify: `tests/fixtures/video-plan.json`
- Modify: `tests/generation/generate-video-plan.test.ts`
- Modify every remaining `searchQuery:` literal so TypeScript compiles (list below)

**Educational scene shape (use this in every test literal):**

```ts
{
  id: 'hook',
  role: 'hook',
  durationSeconds: 6,
  text: 'Stores hide the milk on purpose.',
  visualIntent: 'Shopper walking toward supermarket dairy refrigerators',
  searchQueries: ['supermarket milk fridge', 'grocery dairy aisle'],
}
```

- [ ] **Step 1: Replace `tests/fixtures/video-plan.json`**

The hook must be a **claim**, not a why-question. Add `viralAngle`. Four roles in order:

```json
{
  "topic": "Why supermarkets put milk at the back",
  "title": "Why Milk Is Always at the Back",
  "viralAngle": "The store is using your walk, not hiding the milk.",
  "scenes": [
    {
      "id": "hook",
      "role": "hook",
      "durationSeconds": 6,
      "text": "Stores hide the milk on purpose.",
      "visualIntent": "Shopper walking toward supermarket dairy refrigerators",
      "searchQueries": ["supermarket milk fridge", "grocery dairy aisle"]
    },
    {
      "id": "stake",
      "role": "stake",
      "durationSeconds": 6,
      "text": "You came for one carton | your feet still cross the store.",
      "visualIntent": "Shopper pushing a cart down a long grocery aisle",
      "searchQueries": ["shopping cart grocery aisle", "supermarket aisle shopper"]
    },
    {
      "id": "proof",
      "role": "proof",
      "durationSeconds": 6,
      "text": "That walk takes you past snacks, fruit, and deals.",
      "visualIntent": "Grocery shelves of snacks and fruit along an aisle",
      "searchQueries": ["supermarket snacks fruit shelves", "grocery end cap snacks"]
    },
    {
      "id": "payoff",
      "role": "payoff",
      "durationSeconds": 6,
      "text": "Your walk is the product | not a missing fridge.",
      "visualIntent": "Supermarket dairy milk refrigerators at the back wall",
      "searchQueries": ["supermarket dairy milk fridge", "grocery milk refrigerator"]
    }
  ]
}
```

- [ ] **Step 2: Rewrite schema tests in `tests/generation/generate-video-plan.test.ts`**

Keep caption-bar tests. Replace scene-count tests if needed so they still use 4 scenes. Add:

```ts
import {isGenericQuestionHook} from '../../src/domain/video-plan';

it('rejects a generic question hook', () => {
  const plan = copyFixture();
  plan.scenes[0].text = 'Why is milk always at the back?';
  expect(() => videoPlanSchema.parse(plan)).toThrow();
});

it('rejects educational roles in the wrong order', () => {
  const plan = copyFixture();
  plan.scenes[0].role = 'payoff';
  plan.scenes[3].role = 'hook';
  expect(() => videoPlanSchema.parse(plan)).toThrow();
});

it('rejects fewer than two search queries', () => {
  const plan = copyFixture();
  plan.scenes[0].searchQueries = ['supermarket milk fridge'];
  expect(() => videoPlanSchema.parse(plan)).toThrow();
});

it('rejects duplicate search queries in a scene', () => {
  const plan = copyFixture();
  plan.scenes[0].searchQueries = ['supermarket milk fridge', 'supermarket milk fridge'];
  expect(() => videoPlanSchema.parse(plan)).toThrow();
});

it('rejects blank visual intent', () => {
  const plan = copyFixture();
  plan.scenes[0].visualIntent = '  ';
  expect(() => videoPlanSchema.parse(plan)).toThrow();
});

it('rejects a missing viralAngle', () => {
  const plan = copyFixture();
  delete (plan as {viralAngle?: string}).viralAngle;
  expect(() => videoPlanSchema.parse(plan)).toThrow();
});

it('treats Why/How/What/Ever wonder openings as generic hooks', () => {
  expect(isGenericQuestionHook('Why is milk at the back?')).toBe(true);
  expect(isGenericQuestionHook('Ever wonder why milk hides?')).toBe(true);
  expect(isGenericQuestionHook('Stores hide the milk on purpose.')).toBe(false);
});
```

Change the old `searchQuery` field tests to `searchQueries` (blank array / too-short query / >3 queries).

- [ ] **Step 3: Run schema tests — expect FAIL**

```bash
npx vitest run tests/generation/generate-video-plan.test.ts
```

Expected: FAIL because the schema still has `searchQuery` and no `role` / `viralAngle`.

- [ ] **Step 4: Implement domain types and schema**

Replace `src/domain/video-plan.ts` with:

```ts
import {z} from 'zod';

export const EDUCATIONAL_ROLES = ['hook', 'stake', 'proof', 'payoff'] as const;
export type EducationalRole = (typeof EDUCATIONAL_ROLES)[number];
export type BeatRole = EducationalRole | 'outro';

export type VideoScene = {
  id: string;
  role: BeatRole;
  durationSeconds: number;
  text: string;
  visualIntent: string;
  searchQueries: string[];
};

export type VideoPlan = {
  topic: string;
  title: string;
  viralAngle: string;
  scenes: VideoScene[];
};

export function isGenericQuestionHook(text: string): boolean {
  const opening = text.split('|')[0]?.trim() ?? '';
  return /^(why|how|what|ever\s+wonder)\b/i.test(opening);
}

const isValidCaptionText = (text: string): boolean => {
  const parts = text.split('|').map((part) => part.trim());
  if (parts.some((part) => part.length === 0)) return false;
  if (parts.length > 3) return false;
  if (parts.some((part) => part.length < 4)) return false;
  return parts.join(' ').length >= 4;
};

const videoSceneSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  role: z.enum(EDUCATIONAL_ROLES),
  durationSeconds: z.number().int().min(4).max(8),
  text: z
    .string()
    .min(4)
    .max(100)
    .refine((text) => isValidCaptionText(text), {
      message: 'Scene text caption bars must split into 1-3 non-empty clauses',
    }),
  visualIntent: z.string().trim().min(10).max(180),
  searchQueries: z
    .array(z.string().trim().min(3).max(80))
    .min(2)
    .max(3)
    .refine((queries) => new Set(queries).size === queries.length, {
      message: 'Search queries must be unique',
    }),
});

export const videoPlanSchema = z
  .object({
    topic: z.string().min(3).max(200),
    title: z.string().min(5).max(90),
    viralAngle: z.string().trim().min(10).max(180),
    scenes: z.array(videoSceneSchema).min(4).max(4),
  })
  .superRefine((plan, context) => {
    const totalDuration = plan.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
    if (totalDuration < 16 || totalDuration > 32) {
      context.addIssue({
        code: 'custom',
        path: ['scenes'],
        message: 'Total duration must be between 16 and 32 seconds',
      });
    }

    if (new Set(plan.scenes.map((scene) => scene.id)).size !== plan.scenes.length) {
      context.addIssue({
        code: 'custom',
        path: ['scenes'],
        message: 'Scene ids must be unique',
      });
    }

    const roles = plan.scenes.map((scene) => scene.role);
    if (roles.join(',') !== EDUCATIONAL_ROLES.join(',')) {
      context.addIssue({
        code: 'custom',
        path: ['scenes'],
        message: 'Educational roles must be hook, stake, proof, payoff',
      });
    }

    const hook = plan.scenes[0];
    if (hook && isGenericQuestionHook(hook.text)) {
      context.addIssue({
        code: 'custom',
        path: ['scenes', 0, 'text'],
        message: 'Hook must not start with Why, How, What, or Ever wonder',
      });
    }
  }) satisfies z.ZodType<VideoPlan>;

export function parseVideoPlan(value: unknown): VideoPlan {
  return videoPlanSchema.parse(value);
}
```

`parseVideoPlan` still only accepts the **4 educational scenes**. Outro is attached later and uses `role: 'outro'` (allowed on the TypeScript type, not on the Zod educational schema).

Add to `ResolvedScene` in `src/domain/resolved-video.ts`:

```ts
export type ResolvedScene = VideoScene & {
  selectedSearchQuery: string;
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
  localVideoPath: string;
  localAudioPath: string;
  audioDurationSeconds: number;
  words: VoiceWord[];
};
```

- [ ] **Step 5: Mechanical TypeScript fixes**

Every `VideoScene` literal still using `searchQuery` must gain `role`, `visualIntent`, and `searchQueries` (two strings minimum). Files:

- `tests/cli.test.ts`
- `tests/pipeline/create-short.test.ts`
- `tests/pipeline/attach-channel-outro.test.ts`
- `tests/stock/resolve-scene-assets.test.ts` (scene helper)
- `tests/voice/synthesize-scene-voices.test.ts`
- `tests/remotion/composition.test.ts`
- `tests/remotion/render-short.test.ts`
- `scripts/smoke-render.ts`

For non-hook educational scenes in those tests, assign roles that match position when there are four scenes. For loose 2-scene or 5-scene **pipeline mocks** (they never call `parseVideoPlan`), any `BeatRole` is fine as long as types compile; prefer `hook` / `stake` / `proof` / `payoff` / `outro`.

Outro literals:

```ts
{
  id: 'channel-outro',
  role: 'outro',
  durationSeconds: 4,
  text: 'Curious Cart. | Follow along.',
  visualIntent: 'Opening supermarket clip looping for the sign-off',
  searchQueries: ['supermarket milk fridge', 'grocery dairy aisle'],
}
```

Create-short / CLI mocks that currently have **5 educational scenes** can stay 5 scenes: `parseVideoPlan` is not used there. Give each a role + `searchQueries` + `visualIntent` + `viralAngle` on the plan.

- [ ] **Step 6: Verify**

```bash
npx vitest run tests/generation/generate-video-plan.test.ts
npx tsc --noEmit
```

Expected: schema tests PASS. Typecheck PASS after mechanical updates.

- [ ] **Step 7: Commit**

```bash
git add src/domain tests/fixtures/video-plan.json tests/generation/generate-video-plan.test.ts tests/cli.test.ts tests/pipeline tests/stock/resolve-scene-assets.test.ts tests/voice/synthesize-scene-voices.test.ts tests/remotion scripts/smoke-render.ts
git commit -m "feat: require claim hooks, roles, and search query lists"
```

---

### Task 3: Creative brief prompt

**Files:**
- Modify: `tests/generation/generate-video-plan.test.ts`
- Modify: `src/generation/prompt.ts`
- Modify: `src/generation/generate-video-plan.ts`

- [ ] **Step 1: Replace prompt/format assertions**

Keep spoken-narration, bar, and no-brand-sign-off tests. Replace the research-brief / 4-scene delayed-answer tests:

```ts
  it('treats the second argument as an optional creative brief', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/creative brief/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/tone/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/optional/i);
  });

  it('asks for claim hooks and escalating four beats', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/exactly 4 educational scenes/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/do not start the hook with why/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/stake/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/twist/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/viralAngle|viral angle/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/searchQueries|search queries/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/visualIntent|visual intent/i);
  });
```

`formatPlanInput` tests:

```ts
  it('sends topic and creative brief as labeled blocks', () => {
    expect(formatPlanInput('Why milk is at the back', 'Tone: sly. Angle: your walk is the product.')).toContain(
      'TOPIC:\nWhy milk is at the back',
    );
    expect(formatPlanInput('Why milk is at the back', 'Tone: sly. Angle: your walk is the product.')).toContain(
      'CREATIVE BRIEF:\nTone: sly. Angle: your walk is the product.',
    );
  });

  it('sends only the topic when the brief is omitted', () => {
    expect(formatPlanInput('Why milk is at the back')).toBe('TOPIC:\nWhy milk is at the back');
    expect(formatPlanInput('Why milk is at the back', '   ')).toBe('TOPIC:\nWhy milk is at the back');
  });
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run tests/generation/generate-video-plan.test.ts
```

Expected: FAIL on `/creative brief/i` and `CREATIVE BRIEF:`.

- [ ] **Step 3: Replace the system prompt and input formatter**

`src/generation/generate-video-plan.ts` `formatPlanInput`:

```ts
export function formatPlanInput(topic: string, research?: string): string {
  const trimmedResearch = research?.trim() ?? '';
  if (!trimmedResearch) return `TOPIC:\n${topic}`;
  return `TOPIC:\n${topic}\n\nCREATIVE BRIEF:\n${trimmedResearch}`;
}
```

Keep `MIN_RESEARCH_CHARS = 20` and the same empty-vs-short rules. Keep the deps field name `research` (it is still the second CLI string).

`src/generation/prompt.ts`:

```ts
export const VIDEO_PLAN_SYSTEM_PROMPT = `You create concise vertical educational videos with spoken narration for Plainly Curious.
You receive a TOPIC and, optionally, a CREATIVE BRIEF. The topic is the subject. If a creative brief is present, follow its tone, audience, angle, must-include proof, bans, and closing thought. Stay factual; do not invent statistics. If no brief is present, use a punchy, slightly sly default voice and well-supported knowledge.
Write exactly 4 educational scenes totaling 16–32 seconds as a writing target (about 6 seconds each). Also return viralAngle: one sentence the whole video must serve. Do not write a channel sign-off; a later step adds that. Do not end with a brand name, thanks, or follow line.
Roles in order:
1. hook — a declarative claim worth proving. Do not start the hook with Why, How, What, or Ever wonder. Do not give the full answer in scene 1.
2. stake — why it matters to you/your.
3. proof — one concrete walk or image the viewer can picture. Each beat must add new information; never paraphrase the previous beat.
4. payoff — a small twist or reframe, then close. Do not introduce a second thesis. Do not say "also" to start a new idea.
Use everyday words. Do not say logistics, cold-chain, merchandising, refrigerated cases, or other lecture jargon.
Each scene.text is the exact line a narrator will speak. Insert | between on-screen clauses, at most twice. Each side must be a complete thought. Short lines may omit |. Do not speak the bar. The current word is highlighted.
Each scene lasts 4–8 seconds as a writing target; keep each line speakable in that window.
Each scene text is one short thought readable on a phone and natural when spoken aloud.
Do not include speech tags, stage directions, or SSML.
Every scene needs visualIntent (the exact shot) and searchQueries: 2–3 ordered Pexels queries. Query 1 is the most specific visible objects from THAT line, e.g. "supermarket milk fridge". Queries 2–3 are broader but still on-topic. Never abstract ideas like "consumer psychology".
Avoid unverifiable statistics and sensational claims.
Return only data matching the required schema.`;
```

- [ ] **Step 4: Verify**

```bash
npx vitest run tests/generation/generate-video-plan.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/generation/prompt.ts src/generation/generate-video-plan.ts tests/generation/generate-video-plan.test.ts
git commit -m "feat: drive the planner from an optional creative brief"
```

---

### Task 4: Outro copies the first scene’s query list

**Files:**
- Modify: `tests/pipeline/attach-channel-outro.test.ts`
- Modify: `src/pipeline/attach-channel-outro.ts`

- [ ] **Step 1: Assert outro copies `searchQueries`, `visualIntent`, and `role: 'outro'`**

Update the expected last scene in `adds a new last scene for the brand sign-off` to include those fields from the first educational scene. `searchQuery` must not appear.

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/pipeline/attach-channel-outro.test.ts
```

- [ ] **Step 3: Implement**

```ts
      {
        id: 'channel-outro',
        role: 'outro',
        durationSeconds: 4,
        text: `${name}. | ${line}`,
        visualIntent: first.visualIntent,
        searchQueries: first.searchQueries,
      },
```

- [ ] **Step 4: Verify + commit**

```bash
npx vitest run tests/pipeline/attach-channel-outro.test.ts tests/pipeline/create-short.test.ts
git add src/pipeline/attach-channel-outro.ts tests/pipeline/attach-channel-outro.test.ts
git commit -m "fix: copy ordered stock queries onto the channel outro"
```

---

### Task 5: Ordered multi-query stock pick

**Files:**
- Modify: `tests/stock/resolve-scene-assets.test.ts`
- Modify: `src/stock/resolve-scene-assets.ts`

Keep unique-id, outro-reuse, and landscape-on-zero-score behavior. `scene()` helper must return `searchQueries` (include a token that matches the default video slug `footage` so existing “one portrait search” tests do not extra-search).

- [ ] **Step 1: Add failing tests**

```ts
  it('tries the next search query when the first query only yields a zero-score slug', async () => {
    const runDirectory = await createRunDirectory();
    const deps = resolverDeps();
    deps.searchVideos
      .mockResolvedValueOnce([
        video('https://videos.pexels.com/pepper.mp4', {
          id: 501,
          url: 'https://www.pexels.com/video/a-man-looking-at-a-yellow-bell-pepper-501/',
        }),
      ])
      .mockResolvedValueOnce([]) // landscape for query 1
      .mockResolvedValueOnce([
        video('https://videos.pexels.com/milk.mp4', {
          id: 602,
          url: 'https://www.pexels.com/video/supermarket-milk-fridge-602/',
        }),
      ]);

    const resolved = await resolveSceneAssets(
      plan([
        {
          id: 'hook',
          role: 'hook',
          durationSeconds: 6,
          text: 'Stores hide the milk on purpose.',
          visualIntent: 'Shopper walking toward supermarket dairy refrigerators',
          searchQueries: ['person walking supermarket aisle', 'supermarket milk fridge'],
        },
      ]),
      runDirectory,
      deps,
    );

    expect(resolved[0]?.selectedSearchQuery).toBe('supermarket milk fridge');
    expect(resolved[0]?.sourcePageUrl).toBe(
      'https://www.pexels.com/video/supermarket-milk-fridge-602/',
    );
    expect(deps.searchVideos).toHaveBeenNthCalledWith(1, 'person walking supermarket aisle', {
      orientation: 'portrait',
      perPage: 15,
    });
    expect(deps.searchVideos).toHaveBeenNthCalledWith(3, 'supermarket milk fridge', {
      orientation: 'portrait',
      perPage: 15,
    });
  });

  it('reuses the first clip and selected query for the channel outro', async () => {
    // same as existing outro test, plus:
    expect(resolved[1]?.selectedSearchQuery).toBe(resolved[0]?.selectedSearchQuery);
  });
```

Every successful resolve must set `selectedSearchQuery`. Update existing equality assertions that listed the old scene object without that field.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run tests/stock/resolve-scene-assets.test.ts
```

Expected: FAIL — `searchQuery` is gone and the resolver does not walk the list.

- [ ] **Step 3: Implement query walk**

For each educational scene:

```ts
async function pickClip(
  scene: VideoPlan['scenes'][number],
  requiredSeconds: number,
  usedVideoIds: ReadonlySet<number>,
  deps: ResolveDeps,
): Promise<{candidate: NonNullable<ReturnType<typeof selectBestVideo>>; selectedSearchQuery: string}> {
  let fallback: {candidate: NonNullable<ReturnType<typeof selectBestVideo>>; selectedSearchQuery: string} | undefined;

  for (const query of scene.searchQueries) {
    const match = {searchQuery: query, sceneText: scene.text};
    let candidate = selectBestVideo(
      (await deps.searchVideos(query, portraitSearch)) ?? [],
      requiredSeconds,
      usedVideoIds,
      match,
    );
    const portraitScore = candidate
      ? scoreStockMatch(candidate.sourcePageUrl, query, scene.text)
      : -1;
    if (!candidate || portraitScore === 0) {
      const landscape = selectBestVideo(
        (await deps.searchVideos(query, landscapeSearch)) ?? [],
        requiredSeconds,
        usedVideoIds,
        match,
      );
      if (!candidate) candidate = landscape;
      else if (landscape) {
        const landscapeScore = scoreStockMatch(landscape.sourcePageUrl, query, scene.text);
        if (landscapeScore > portraitScore) candidate = landscape;
      }
    }
    if (!candidate) continue;
    const score = scoreStockMatch(candidate.sourcePageUrl, query, scene.text);
    if (score > 0) return {candidate, selectedSearchQuery: query};
    fallback ??= {candidate, selectedSearchQuery: query};
  }

  if (!fallback) {
    throw new Error(`No usable video for scene ${scene.id}: ${scene.searchQueries.join(' | ')}`);
  }
  return fallback;
}
```

Push onto resolved:

```ts
    resolved.push({
      ...scene,
      selectedSearchQuery: picked.selectedSearchQuery,
      sourcePageUrl: picked.candidate.sourcePageUrl,
      creatorName: picked.candidate.creatorName,
      creatorUrl: picked.candidate.creatorUrl,
      localVideoPath,
    });
```

Outro branch copies `selectedSearchQuery` from `resolved[0]`.

- [ ] **Step 4: Verify**

```bash
npx vitest run tests/stock/resolve-scene-assets.test.ts tests/stock/select-video-file.test.ts tests/stock/score-stock-match.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stock/resolve-scene-assets.ts tests/stock/resolve-scene-assets.test.ts src/domain/resolved-video.ts
git commit -m "feat: try ordered Pexels queries per beat"
```

---

### Task 6: CLI wording + README + version

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Usage string**

```ts
io.error('Usage: npm run generate -- "<topic>" ["<creative-brief>"]');
```

Update the CLI test that asserts the usage line. Keep “accepts a topic without a research brief.”

- [ ] **Step 2: README**

Say the second argument is an optional **creative brief** (tone, audience, angle, proof, bans). Point to `misc/v1_1_content_enhance.md`. Keep the two example commands; rewrite the long second string as a brief, not “explain why…”.

- [ ] **Step 3: Set `package.json` `"version"` to `"1.1.0"`**

Do not `git tag` in this task. Tag `v1.1.0` only after merge to main.

- [ ] **Step 4: Full verify**

```bash
npx vitest run && npx tsc --noEmit
```

Expected: all tests PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts tests/cli.test.ts README.md package.json
git commit -m "docs: v1.1 creative brief CLI and version bump"
```

---

## Out of scope

Silent shorts. 3–9 word headline-only copy. Removing voice/karaoke/BGM/outro. Dark wash. Extra emphasis system. YouTube. Live generate. Changing `MIN_TOTAL_SECONDS`. New CLI flags.

## After merge

```bash
git tag -a v1.1.0 -m "v1.1.0 — creative brief, claim hooks, multi-query stock"
```
