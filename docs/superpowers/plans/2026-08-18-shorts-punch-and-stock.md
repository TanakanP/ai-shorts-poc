# Punchy plans and matched stock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Educational shorts are a 4-beat plan (hook, you-reason, proof, payoff) and each unique Pexels clip is ranked by slug overlap with the line.

**Architecture:** Tighten `videoPlanSchema` and `VIDEO_PLAN_SYSTEM_PROMPT`. Add `scoreStockMatch` and pass scene text into `selectBestVideo` / `resolveSceneAssets`. Outro, unique ids, speak-then-time, captions, music, and YouTube stay unchanged.

**Tech Stack:** TypeScript, Zod, Vitest, existing Pexels client. No new packages.

**Spec:** `docs/superpowers/specs/2026-08-18-shorts-punch-and-stock-design.md`

---

## File structure

- Modify: `AGENTS.md` — point at this plan
- Modify: `tests/fixtures/video-plan.json` — 4 educational scenes, 24s
- Modify: `src/domain/video-plan.ts` — 4 scenes, 16–32s writing total
- Modify: `tests/generation/generate-video-plan.test.ts` — schema + prompt assertions
- Modify: `src/generation/prompt.ts` — beat roles, jargon ban, filmable queries
- Create: `src/stock/score-stock-match.ts` — slug overlap score
- Create: `tests/stock/score-stock-match.test.ts`
- Modify: `src/stock/select-video-file.ts` — optional match hint, score then quality
- Modify: `tests/stock/select-video-file.test.ts`
- Modify: `src/stock/resolve-scene-assets.ts` — pass hint; landscape when portrait score is 0
- Modify: `tests/stock/resolve-scene-assets.test.ts`
- Modify: `README.md` — 4-scene punchy short

Do not live-generate. Do not change captions, TTS, music, or outro layout.

---

### Task 1: Point the contract at this plan

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Replace AGENTS.md**

```md
# Project Instructions

This project implements voiced AI Shorts with punchy 4-scene plans, karaoke captions, unique stock ranked by slug match, a channel sign-off, optional research, and a local music bed.

Primary implementation plan:
docs/superpowers/plans/2026-08-18-shorts-punch-and-stock.md

Rules:
- Follow the implementation plan task-by-task and in order.
- Use test-driven development.
- Do not add features outside this plan.
- Output is still a locally rendered MP4.
- No YouTube upload.
- No title card.
- No vision scoring.
- No clip reuse in educational scenes.
- No scheduler.
- No database.
- No analytics.
- Keep modules small and independently testable.
- Run tests after every task.
- Commit after each completed task.
- Never put API keys in source control.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: point agents at punchy plan and stock match"
```

---

### Task 2: Four-scene writing-target schema

**Files:**
- Modify: `tests/fixtures/video-plan.json`
- Modify: `tests/generation/generate-video-plan.test.ts`
- Modify: `src/domain/video-plan.ts`

- [ ] **Step 1: Replace the fixture with a 4-scene 24-second plan**

```json
{
  "topic": "Why supermarkets put milk at the back",
  "title": "Why Milk Is Always at the Back",
  "scenes": [
    {
      "id": "hook",
      "durationSeconds": 6,
      "text": "Why is milk always so far from the entrance?",
      "searchQuery": "supermarket entrance milk"
    },
    {
      "id": "you-reason",
      "durationSeconds": 6,
      "text": "Stores want your whole trip | not just your milk run.",
      "searchQuery": "shopper walking supermarket aisle"
    },
    {
      "id": "proof",
      "durationSeconds": 6,
      "text": "That walk takes you past snacks, fruit, and deals.",
      "searchQuery": "supermarket snacks fruit shelves"
    },
    {
      "id": "payoff",
      "durationSeconds": 6,
      "text": "So the back wall is a longer path | not a mystery.",
      "searchQuery": "supermarket dairy milk fridge"
    }
  ]
}
```

- [ ] **Step 2: Rewrite the scene-count and duration tests**

In `tests/generation/generate-video-plan.test.ts`, replace the first five `videoPlanSchema` tests:

```ts
  it('accepts a 4-scene 24-second plan', () => {
    expect(parseVideoPlan(copyFixture())).toEqual(fixture);
  });

  it('rejects fewer than 4 scenes', () => {
    const plan = copyFixture();
    plan.scenes = plan.scenes.slice(0, 3).map((scene) => ({...scene, durationSeconds: 8}));

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('rejects more than 4 scenes', () => {
    const plan = copyFixture();
    plan.scenes.push({...plan.scenes[0], id: 'extra-scene'});

    expect(() => videoPlanSchema.parse(plan)).toThrow();
  });

  it('accepts a 16-second four-scene plan', () => {
    const plan = copyFixture();
    plan.scenes = plan.scenes.map((scene) => ({...scene, durationSeconds: 4}));

    expect(parseVideoPlan(plan).scenes).toHaveLength(4);
  });

  it('accepts a 32-second four-scene plan', () => {
    const plan = copyFixture();
    plan.scenes = plan.scenes.map((scene) => ({...scene, durationSeconds: 8}));

    expect(parseVideoPlan(plan).scenes).toHaveLength(4);
  });
```

Also change the invalid-AI-data test to slice 3 scenes:

```ts
    const invalidPlan = {...copyFixture(), scenes: fixture.scenes.slice(0, 3)};
```

- [ ] **Step 3: Run the schema tests and confirm they fail**

```bash
npx vitest run tests/generation/generate-video-plan.test.ts
```

Expected: FAIL on the new 4-scene / 16s cases because schema still wants 5–7 scenes and 30–45s.

- [ ] **Step 4: Update the schema**

In `src/domain/video-plan.ts`:

```ts
    scenes: z.array(videoSceneSchema).min(4).max(4),
```

and

```ts
    if (totalDuration < 16 || totalDuration > 32) {
      context.addIssue({
        code: 'custom',
        path: ['scenes'],
        message: 'Total duration must be between 16 and 32 seconds',
      });
    }
```

- [ ] **Step 5: Re-run tests**

```bash
npx vitest run tests/generation/generate-video-plan.test.ts
```

Expected: PASS (prompt tests still use the old 5–7 wording until Task 3).

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/video-plan.json tests/generation/generate-video-plan.test.ts src/domain/video-plan.ts
git commit -m "feat: require a 4-scene 16-32s writing target"
```

---

### Task 3: Punchy planner prompt

**Files:**
- Modify: `tests/generation/generate-video-plan.test.ts`
- Modify: `src/generation/prompt.ts`

- [ ] **Step 1: Replace the research/prompt assertions**

Keep existing spoken-narration, bar, and sign-off tests. Replace the research-brief test and add beat tests:

```ts
  it('tells the model to follow a research brief when one is present', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/research brief/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/well-supported/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/optional/i);
  });

  it('asks for exactly 4 educational scenes and a delayed answer', () => {
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/exactly 4 educational scenes/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/do not give the answer in scene 1/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/you/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/logistics/i);
    expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/filmable|visible objects/i);
  });
```

- [ ] **Step 2: Run the prompt tests and confirm they fail**

```bash
npx vitest run tests/generation/generate-video-plan.test.ts
```

Expected: FAIL on `/exactly 4 educational scenes/i` (current prompt still says 5–7).

- [ ] **Step 3: Replace the system prompt**

```ts
export const VIDEO_PLAN_SYSTEM_PROMPT = `You create concise vertical educational videos with spoken narration.
You receive a TOPIC and, optionally, a RESEARCH BRIEF. The topic is the video subject and hook. If a research brief is present, it is the factual scope: stay inside it, prefer well-supported practices, and separate those from common myths. If no research brief is present, use well-known, well-supported knowledge and still avoid unverifiable statistics.
Write exactly 4 educational scenes totaling 16–32 seconds as a writing target (about 6 seconds each). Do not write a channel sign-off; a later step adds that.
Scene 1 is a curiosity hook: a short question or myth spoken to the viewer. Do not give the answer in scene 1.
Scene 2 is one reason, spoken to "you" or "your".
Scene 3 is one concrete proof or walk-through the viewer can picture.
Scene 4 is the payoff in plain words. Do not introduce a second thesis. Do not say "also" to start a new idea.
Use everyday words. Do not say logistics, cold-chain, merchandising, refrigerated cases, or other lecture jargon.
Each scene.text is the exact line a narrator will speak. Insert | between on-screen clauses, at most twice. Each side must be a complete thought. Short lines may omit |. Do not speak the bar. The current word is highlighted.
Each scene lasts 4–8 seconds as a writing target; keep each line speakable in that window.
Each scene text is one short thought readable on a phone and natural when spoken aloud.
Do not include speech tags, stage directions, or SSML.
searchQuery names visible objects from THAT line, e.g. "supermarket milk fridge" or "shopping cart grocery aisle", never abstract ideas like "consumer psychology".
Avoid unverifiable statistics and sensational claims.
Return only data matching the required schema.`;
```

- [ ] **Step 4: Re-run tests**

```bash
npx vitest run tests/generation/generate-video-plan.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/generation/generate-video-plan.test.ts src/generation/prompt.ts
git commit -m "feat: write 4-beat shorts that delay the answer"
```

---

### Task 4: Slug match scorer

**Files:**
- Create: `tests/stock/score-stock-match.test.ts`
- Create: `src/stock/score-stock-match.ts`

- [ ] **Step 1: Write failing tests**

```ts
import {describe, expect, it} from 'vitest';
import {scoreStockMatch} from '../../src/stock/score-stock-match';

describe('scoreStockMatch', () => {
  it('scores 0 when the Pexels slug shares no nouns with the line', () => {
    expect(
      scoreStockMatch(
        'https://www.pexels.com/video/a-man-looking-at-a-yellow-bell-pepper-7126552/',
        'person walking supermarket aisle shopping basket',
        'Milk is often at the back | because stores want your whole trip.',
      ),
    ).toBe(0);
  });

  it('counts query and spoken nouns that appear in the slug', () => {
    expect(
      scoreStockMatch(
        'https://www.pexels.com/video/supermarket-milk-fridge-aisle-101/',
        'supermarket milk fridge',
        'Milk is at the back of the store.',
      ),
    ).toBeGreaterThan(0);
  });

  it('ranks a milk-aisle slug above a pepper slug for a milk line', () => {
    const query = 'supermarket milk fridge';
    const text = 'Why is the milk always at the back?';
    const milk = scoreStockMatch(
      'https://www.pexels.com/video/supermarket-dairy-milk-fridge-202/',
      query,
      text,
    );
    const pepper = scoreStockMatch(
      'https://www.pexels.com/video/a-man-looking-at-a-yellow-bell-pepper-7126552/',
      query,
      text,
    );
    expect(milk).toBeGreaterThan(pepper);
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npx vitest run tests/stock/score-stock-match.test.ts
```

Expected: FAIL — cannot find `scoreStockMatch`.

- [ ] **Step 3: Implement the scorer**

```ts
import {spokenSceneText} from '../captions/caption-segments';

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'at',
  'to',
  'of',
  'and',
  'or',
  'for',
  'with',
  'that',
  'this',
  'it',
  'in',
  'on',
  'your',
  'you',
  'not',
  'so',
  'as',
  'be',
  'are',
  'was',
  'from',
  'by',
  'often',
  'always',
  'why',
]);

export function matchTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function scoreStockMatch(videoUrl: string, searchQuery: string, sceneText: string): number {
  const slug = videoUrl.toLowerCase();
  const wanted = new Set([...matchTokens(searchQuery), ...matchTokens(spokenSceneText(sceneText))]);
  let score = 0;
  for (const token of wanted) {
    if (slug.includes(token)) score += 1;
  }
  return score;
}
```

- [ ] **Step 4: Re-run tests**

```bash
npx vitest run tests/stock/score-stock-match.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/stock/score-stock-match.test.ts src/stock/score-stock-match.ts
git commit -m "feat: score Pexels clips by slug overlap"
```

---

### Task 5: Rank selectBestVideo by match

**Files:**
- Modify: `tests/stock/select-video-file.test.ts`
- Modify: `src/stock/select-video-file.ts`

- [ ] **Step 1: Add a failing match-rank test** (keep existing tests; they pass with no hint)

```ts
  it('prefers a matching slug over a sharper mismatch when a hint is given', () => {
    const videos = copyVideos();
    videos[0].url = 'https://www.pexels.com/video/supermarket-milk-fridge-401/';
    videos[1].url = 'https://www.pexels.com/video/a-man-looking-at-a-yellow-bell-pepper-402/';

    expect(
      selectBestVideo(videos, 6, new Set(), {
        searchQuery: 'supermarket milk fridge',
        sceneText: 'Why is the milk always at the back?',
      }),
    ).toMatchObject({videoId: 401});
  });
```

Without the hint, video 402 still wins on resolution (existing tests).

- [ ] **Step 2: Run the new test and confirm it fails**

```bash
npx vitest run tests/stock/select-video-file.test.ts
```

Expected: FAIL — `videoId` is 402 (sharper pepper) not 401.

- [ ] **Step 3: Add an optional match hint and sort by score first**

```ts
import {scoreStockMatch} from './score-stock-match';

export type StockMatchHint = {
  searchQuery: string;
  sceneText: string;
};

export function selectBestVideo(
  videos: PexelsVideo[],
  requiredSeconds: number,
  excludeVideoIds: ReadonlySet<number> = new Set(),
  match?: StockMatchHint,
): SelectedVideo | null {
  const candidates = videos
    .filter((video) => video.duration >= requiredSeconds && !excludeVideoIds.has(video.id))
    .flatMap((video) =>
      video.video_files.filter(isMp4).map((file) => ({video, file})),
    )
    .sort((left, right) => {
      if (match) {
        const scoreDelta =
          scoreStockMatch(right.video.url, match.searchQuery, match.sceneText) -
          scoreStockMatch(left.video.url, match.searchQuery, match.sceneText);
        if (scoreDelta !== 0) return scoreDelta;
      }
      return compareCandidates(left, right);
    });
  // ...existing return
}
```

- [ ] **Step 4: Re-run tests**

```bash
npx vitest run tests/stock/select-video-file.test.ts
```

Expected: PASS (old tests omit `match` and keep quality order).

- [ ] **Step 5: Commit**

```bash
git add tests/stock/select-video-file.test.ts src/stock/select-video-file.ts
git commit -m "feat: rank stock files by slug match then quality"
```

---

### Task 6: Landscape fallback when portrait match is 0

**Files:**
- Modify: `tests/stock/resolve-scene-assets.test.ts`
- Modify: `src/stock/resolve-scene-assets.ts`

- [ ] **Step 1: Add a failing resolver test**

```ts
  it('searches landscape when the best portrait slug match is 0', async () => {
    const runDirectory = await createRunDirectory();
    const deps = resolverDeps();
    deps.searchVideos
      .mockResolvedValueOnce([
        video('https://videos.pexels.com/pepper.mp4', {
          id: 501,
          url: 'https://www.pexels.com/video/a-man-looking-at-a-yellow-bell-pepper-501/',
        }),
      ])
      .mockResolvedValueOnce([
        video('https://videos.pexels.com/milk.mp4', {
          id: 602,
          url: 'https://www.pexels.com/video/supermarket-milk-fridge-602/',
          video_files: [
            {
              id: 62,
              file_type: 'video/mp4',
              width: 1920,
              height: 1080,
              link: 'https://videos.pexels.com/milk.mp4',
            },
          ],
        }),
      ]);

    const resolved = await resolveSceneAssets(
      plan([
        {
          id: 'hook',
          durationSeconds: 6,
          text: 'Why is the milk always at the back?',
          searchQuery: 'supermarket milk fridge',
        },
      ]),
      runDirectory,
      deps,
    );

    expect(resolved[0]?.sourcePageUrl).toBe('https://www.pexels.com/video/supermarket-milk-fridge-602/');
    expect(deps.searchVideos).toHaveBeenCalledTimes(2);
    expect(deps.download).toHaveBeenCalledWith(
      'https://videos.pexels.com/milk.mp4',
      join(runDirectory, 'scene-01.mp4'),
    );
  });
```

- [ ] **Step 2: Run the resolver tests and confirm the new one fails**

```bash
npx vitest run tests/stock/resolve-scene-assets.test.ts
```

Expected: FAIL — downloads the portrait pepper and searches once.

- [ ] **Step 3: Pass the match hint and try landscape when portrait score is 0**

```ts
import {scoreStockMatch} from './score-stock-match';

    const match = {searchQuery: scene.searchQuery, sceneText: scene.text};
    let candidate = selectBestVideo(
      (await deps.searchVideos(scene.searchQuery, portraitSearch)) ?? [],
      requiredSeconds,
      usedVideoIds,
      match,
    );
    const portraitScore = candidate
      ? scoreStockMatch(candidate.sourcePageUrl, scene.searchQuery, scene.text)
      : -1;
    if (!candidate || portraitScore === 0) {
      const landscape = selectBestVideo(
        (await deps.searchVideos(scene.searchQuery, landscapeSearch)) ?? [],
        requiredSeconds,
        usedVideoIds,
        match,
      );
      if (!candidate) {
        candidate = landscape;
      } else if (landscape) {
        const landscapeScore = scoreStockMatch(
          landscape.sourcePageUrl,
          scene.searchQuery,
          scene.text,
        );
        if (landscapeScore > portraitScore) candidate = landscape;
      }
    }
```

- [ ] **Step 4: Re-run tests**

```bash
npx vitest run tests/stock/resolve-scene-assets.test.ts tests/stock/select-video-file.test.ts tests/stock/score-stock-match.test.ts
```

Expected: PASS. Existing “retries landscape when portrait empty” still passes. Unique-id and outro tests still pass.

- [ ] **Step 5: Commit**

```bash
git add tests/stock/resolve-scene-assets.test.ts src/stock/resolve-scene-assets.ts
git commit -m "feat: try landscape stock when portrait slugs miss"
```

---

### Task 7: README + full verify

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Mention the 4-beat plan in expected output**

After the generate examples, keep the rest. In the expected-output paragraph, add that educational scenes are **hook, you-reason, proof, payoff** and stock is unique and ranked by Pexels slug match.

- [ ] **Step 2: Run the full suite and typecheck**

```bash
npx vitest run && npx tsc --noEmit
```

Expected: all tests PASS, typecheck clean.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe 4-beat plans and matched stock"
```

---

## Out of scope

Live generate. Title card. YouTube copy. Vision. Reusing educational clips. Caption/voice/music/outro layout changes.
