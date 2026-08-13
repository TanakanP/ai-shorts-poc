# AI Shorts POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local CLI that accepts one topic and automatically renders one coherent 30–45 second, 1080×1920 MP4 YouTube Short using AI-generated scene plans, Pexels portrait stock footage, animated on-screen text, and Remotion, with no voiceover or upload automation.

**Architecture:** Use a deterministic pipeline with explicit artifacts at each stage: `topic -> VideoPlan JSON -> resolved stock assets -> Remotion props -> MP4`. Keep generation, Pexels resolution/downloading, rendering, and orchestration behind narrow interfaces so each can be tested independently and swapped later. All external calls are isolated behind adapters; unit tests use fixtures/fakes and never require OpenAI or Pexels network access.

**Tech Stack:** Node.js 22+, TypeScript 5.x, npm, OpenAI official JavaScript SDK + Responses API, Zod, Pexels REST API via native `fetch`, React, Remotion, Vitest, dotenv, fs/promises.

## Global Constraints

- POC v1 only: local CLI input to local MP4 output.
- No YouTube API, scheduler, database, analytics, voiceover, speech recognition, or web UI.
- Output format: H.264 MP4, 1080×1920, 30 FPS, 30–45 seconds.
- Scene count: 5–7 scenes.
- Each scene has one short readable text block and one Pexels search query.
- On-screen text is the complete narrative; video must remain understandable with audio muted.
- Prefer portrait Pexels videos; permit landscape fallback only when no usable portrait candidate exists.
- Never call third-party APIs from React/Remotion components; resolve/download all assets before rendering.
- Persist intermediate artifacts under `runs/<run-id>/` for debugging.
- API secrets come only from environment variables and must never be logged or committed.
- External API responses must be runtime-validated before use.
- Unit/integration tests must run without internet access.
- Fail the run rather than silently rendering an obviously invalid video plan.
- YAGNI: one visual template, one typography style, one transition family, no plugin system.

---

## File Structure

Create this structure unless the repository already has an equivalent convention:

```text
.
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── cli.ts
│   ├── config.ts
│   ├── domain/
│   │   ├── video-plan.ts
│   │   └── resolved-video.ts
│   ├── generation/
│   │   ├── generate-video-plan.ts
│   │   └── prompt.ts
│   ├── stock/
│   │   ├── pexels-client.ts
│   │   ├── select-video-file.ts
│   │   ├── resolve-scene-assets.ts
│   │   └── download-file.ts
│   ├── pipeline/
│   │   ├── create-run-directory.ts
│   │   ├── create-short.ts
│   │   └── persist-json.ts
│   └── remotion/
│       ├── index.ts
│       ├── Root.tsx
│       ├── ShortComposition.tsx
│       ├── Scene.tsx
│       ├── text-layout.ts
│       └── render-short.ts
├── tests/
│   ├── fixtures/
│   │   ├── video-plan.json
│   │   ├── pexels-search-response.json
│   │   └── tiny-video.mp4
│   ├── generation/
│   │   └── generate-video-plan.test.ts
│   ├── stock/
│   │   ├── select-video-file.test.ts
│   │   └── resolve-scene-assets.test.ts
│   ├── pipeline/
│   │   └── create-short.test.ts
│   └── remotion/
│       └── text-layout.test.ts
└── runs/
    └── .gitkeep
```

### Core domain contracts

All tasks must converge on these contracts exactly:

```ts
export type VideoScene = {
  id: string;
  durationSeconds: number;
  text: string;
  searchQuery: string;
};

export type VideoPlan = {
  topic: string;
  title: string;
  scenes: VideoScene[];
};

export type ResolvedScene = VideoScene & {
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
  localVideoPath: string;
};

export type ResolvedVideo = {
  runId: string;
  title: string;
  fps: 30;
  width: 1080;
  height: 1920;
  scenes: ResolvedScene[];
};
```

Invariant: `sum(scenes.durationSeconds)` must be from `30` through `45`, inclusive.

---

### Task 1: Bootstrap the executable TypeScript/Remotion project

**Files:**
- Create/Modify: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create/Modify: `.gitignore`
- Create: `src/config.ts`
- Create: `src/domain/video-plan.ts`
- Create: `src/domain/resolved-video.ts`
- Create: `runs/.gitkeep`
- Test: `tests/config.test.ts`

**Interfaces:**
- Produces: `loadConfig(env?: NodeJS.ProcessEnv): AppConfig`
- Produces: `VideoScene`, `VideoPlan`, `ResolvedScene`, `ResolvedVideo`

- [ ] **Step 1: Initialize package metadata and install only POC dependencies**

Use npm. Add scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "generate": "tsx src/cli.ts",
    "remotion:studio": "remotion studio src/remotion/index.ts"
  }
}
```

Install runtime dependencies:

```bash
npm install openai zod dotenv react react-dom remotion @remotion/renderer @remotion/bundler
npm install -D typescript tsx vitest @types/node @types/react @types/react-dom
```

- [ ] **Step 2: Write failing config tests**

```ts
import {describe, expect, it} from 'vitest';
import {loadConfig} from '../src/config';

describe('loadConfig', () => {
  it('requires OPENAI_API_KEY and PEXELS_API_KEY', () => {
    expect(() => loadConfig({})).toThrow(/OPENAI_API_KEY/);
  });

  it('returns validated config', () => {
    expect(loadConfig({OPENAI_API_KEY: 'oa-test', PEXELS_API_KEY: 'px-test'})).toEqual({
      openAiApiKey: 'oa-test',
      pexelsApiKey: 'px-test',
    });
  });
});
```

- [ ] **Step 3: Run the test and verify failure**

Run:

```bash
npm test -- tests/config.test.ts
```

Expected: FAIL because `src/config.ts` does not exist.

- [ ] **Step 4: Implement environment validation**

Use Zod. Do not accept empty strings. Export:

```ts
export type AppConfig = {
  openAiApiKey: string;
  pexelsApiKey: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig;
```

`.env.example` must contain only:

```dotenv
OPENAI_API_KEY=
PEXELS_API_KEY=
```

`.gitignore` must include `.env`, `runs/*`, `!runs/.gitkeep`, `node_modules`, and Remotion build/cache output if generated.

- [ ] **Step 5: Define the core domain types exactly as specified above**

Keep them free of SDK/framework types.

- [ ] **Step 6: Verify project health**

Run:

```bash
npm test -- tests/config.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json .env.example .gitignore src/domain src/config.ts tests/config.test.ts runs/.gitkeep
git commit -m "chore: bootstrap AI shorts POC"
```

---

### Task 2: Define and validate the AI-generated VideoPlan

**Files:**
- Modify: `src/domain/video-plan.ts`
- Create: `src/generation/prompt.ts`
- Create: `src/generation/generate-video-plan.ts`
- Test: `tests/generation/generate-video-plan.test.ts`
- Create fixture: `tests/fixtures/video-plan.json`

**Interfaces:**
- Consumes: `VideoPlan`
- Produces: `videoPlanSchema`
- Produces: `generateVideoPlan(topic: string, deps: GenerateVideoPlanDeps): Promise<VideoPlan>`

Use dependency injection so tests do not call OpenAI:

```ts
export type StructuredPlanGenerator = (args: {
  system: string;
  input: string;
}) => Promise<unknown>;

export type GenerateVideoPlanDeps = {
  generateStructured: StructuredPlanGenerator;
};
```

- [ ] **Step 1: Write VideoPlan schema tests**

Test these cases:

```ts
it('accepts a 6-scene 36-second plan');
it('rejects fewer than 5 scenes');
it('rejects more than 7 scenes');
it('rejects total duration below 30 seconds');
it('rejects total duration above 45 seconds');
it('rejects blank text or searchQuery');
it('rejects duplicate scene ids');
```

Use the fixture topic `Why supermarkets put milk at the back` with six 6-second scenes.

- [ ] **Step 2: Run tests and verify failure**

```bash
npm test -- tests/generation/generate-video-plan.test.ts
```

Expected: FAIL because schema/generator are absent.

- [ ] **Step 3: Implement `videoPlanSchema` with cross-field refinement**

Rules:

```text
VideoPlan.title: 5..90 characters
VideoPlan.topic: 3..200 characters
scenes: 5..7
scene.id: /^[a-z0-9-]+$/
scene.durationSeconds: integer 4..8
scene.text: 4..100 characters
scene.searchQuery: 2..80 characters
total duration: 30..45 seconds
scene ids: unique
```

Export `parseVideoPlan(value: unknown): VideoPlan`.

- [ ] **Step 4: Create the exact POC generation prompt**

`src/generation/prompt.ts` should export a system prompt that tells the model:

```text
You create concise silent vertical educational videos.
The on-screen text must tell the entire story without narration.
Create 5–7 scenes totaling 30–45 seconds.
Each scene lasts 4–8 seconds.
Each scene text is one short thought readable on a phone.
Use concrete visual nouns for Pexels search queries, not abstract concepts.
Search queries should describe footage, e.g. "shopping cart supermarket aisle", not "consumer psychology".
The first scene is a strong curiosity hook.
The final scene gives the payoff; do not add subscribe/follow CTAs.
Avoid unverifiable statistics and sensational claims.
Return only data matching the required schema.
```

- [ ] **Step 5: Implement `generateVideoPlan` as validation around an injected structured generator**

Behavior:

```ts
export async function generateVideoPlan(
  topic: string,
  deps: GenerateVideoPlanDeps,
): Promise<VideoPlan> {
  if (topic.trim().length < 3) throw new Error('Topic must be at least 3 characters');
  const raw = await deps.generateStructured({system: VIDEO_PLAN_SYSTEM_PROMPT, input: topic.trim()});
  return parseVideoPlan(raw);
}
```

Add tests for topic trimming, short-topic rejection, valid generated data, and invalid AI data.

- [ ] **Step 6: Add OpenAI adapter without coupling it to pipeline logic**

In the same file, export:

```ts
export function createOpenAIStructuredPlanGenerator(apiKey: string): StructuredPlanGenerator;
```

Use the official OpenAI JavaScript SDK and Responses API. Request structured output using the SDK's current documented schema mechanism; validate the returned value again with `videoPlanSchema` regardless of provider-side schema enforcement. Do not hard-code response parsing outside this adapter.

- [ ] **Step 7: Verify**

```bash
npm test -- tests/generation/generate-video-plan.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/video-plan.ts src/generation tests/generation tests/fixtures/video-plan.json
git commit -m "feat: generate validated short video plans"
```

---

### Task 3: Implement deterministic Pexels search and candidate selection

**Files:**
- Create: `src/stock/pexels-client.ts`
- Create: `src/stock/select-video-file.ts`
- Create fixture: `tests/fixtures/pexels-search-response.json`
- Test: `tests/stock/select-video-file.test.ts`

**Interfaces:**
- Produces: `PexelsVideo`, `PexelsVideoFile`
- Produces: `PexelsClient.searchVideos(query: string, options?: SearchOptions): Promise<PexelsVideo[]>`
- Produces: `selectBestVideo(videos: PexelsVideo[], requiredSeconds: number): SelectedVideo | null`

Define:

```ts
export type SearchOptions = {
  orientation: 'portrait' | 'landscape';
  perPage: number;
};

export type SelectedVideo = {
  videoId: number;
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
  duration: number;
  downloadUrl: string;
  width: number;
  height: number;
};
```

- [ ] **Step 1: Write candidate-selection tests using a fixture**

Cover:

```text
- prefer MP4 portrait file >= 1080x1920
- otherwise choose highest-resolution portrait MP4
- ignore HLS/m3u8 entries
- reject a source video shorter than requiredSeconds
- return null when no usable file exists
- selection must be deterministic for the same response
```

- [ ] **Step 2: Run test and verify failure**

```bash
npm test -- tests/stock/select-video-file.test.ts
```

- [ ] **Step 3: Implement the pure selection function**

Ranking order:

```text
1. source video duration >= requiredSeconds
2. MP4 only
3. portrait file (height > width)
4. width >= 1080 and height >= 1920 preferred
5. larger pixel area
6. stable tie-break by video id then file id
```

Do not randomize selection in v1; reproducibility is more valuable than variety during POC debugging.

- [ ] **Step 4: Implement Pexels REST client**

Call:

```text
GET https://api.pexels.com/v1/videos/search
Authorization: <PEXELS_API_KEY>
```

First search uses:

```text
query=<scene.searchQuery>
orientation=portrait
size=medium
per_page=15
locale=en-US
```

Runtime-validate the minimum response fields used by the app. Treat non-2xx as a typed error that includes status but never includes the API key.

- [ ] **Step 5: Add Pexels client tests with mocked `fetch`**

Verify exact URL parameters, Authorization header presence, successful parsing, 401 handling, 429 handling, and malformed payload rejection.

- [ ] **Step 6: Verify**

```bash
npm test -- tests/stock
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/stock/pexels-client.ts src/stock/select-video-file.ts tests/stock tests/fixtures/pexels-search-response.json
git commit -m "feat: search and select Pexels footage"
```

---

### Task 4: Resolve every scene to a local video file with one controlled fallback

**Files:**
- Create: `src/stock/download-file.ts`
- Create: `src/stock/resolve-scene-assets.ts`
- Test: `tests/stock/resolve-scene-assets.test.ts`

**Interfaces:**
- Consumes: `VideoPlan`, `PexelsClient`, `selectBestVideo`
- Produces: `resolveSceneAssets(plan: VideoPlan, runDir: string, deps: ResolveDeps): Promise<ResolvedScene[]>`

Define:

```ts
export type ResolveDeps = {
  searchVideos: (query: string, options: SearchOptions) => Promise<PexelsVideo[]>;
  download: (url: string, destination: string) => Promise<void>;
};
```

- [ ] **Step 1: Write failing resolver tests**

Test:

```text
- portrait result resolves and downloads once
- if portrait has no usable result, retry exactly once with landscape
- if both searches fail to produce a candidate, reject with scene id + search query
- downloaded filenames are deterministic: scene-01.mp4, scene-02.mp4, ...
- no later scenes download after a scene resolution failure
- returned order matches VideoPlan order
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/stock/resolve-scene-assets.test.ts
```

- [ ] **Step 3: Implement safe streaming download**

`downloadFile(url, destination)` must:

```text
- use fetch
- require 2xx
- stream/write to <destination>.partial
- atomically rename to destination only after completion
- delete .partial on error
- reject zero-byte downloads
```

- [ ] **Step 4: Implement scene resolution**

For each scene sequentially:

```text
1. search portrait, 15 results
2. select candidate
3. if none, search landscape, 15 results
4. select candidate
5. if none, fail run
6. download candidate to deterministic local path
7. carry Pexels page/creator attribution metadata into ResolvedScene
```

Sequential resolution is intentional for POC simplicity and predictable API use.

- [ ] **Step 5: Verify**

```bash
npm test -- tests/stock
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/stock/download-file.ts src/stock/resolve-scene-assets.ts tests/stock/resolve-scene-assets.test.ts
git commit -m "feat: resolve scene footage locally"
```

---

### Task 5: Implement phone-readable text layout as a pure function

**Files:**
- Create: `src/remotion/text-layout.ts`
- Test: `tests/remotion/text-layout.test.ts`

**Interfaces:**
- Produces: `layoutSceneText(text: string): TextLayout`

Define:

```ts
export type TextLayout = {
  lines: string[];
  fontSize: number;
};
```

- [ ] **Step 1: Write failing tests**

Use deterministic rules rather than browser text measurement in v1. Test:

```text
- <= 28 chars => max 2 lines, fontSize 96
- 29..55 chars => max 3 lines, fontSize 82
- 56..100 chars => max 4 lines, fontSize 70
- words are never dropped or reordered
- no line is blank
- text >100 chars rejects
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/remotion/text-layout.test.ts
```

- [ ] **Step 3: Implement greedy word wrapping**

Use target character budgets per line derived from the tiers above. Break only at whitespace; do not hyphenate in POC.

- [ ] **Step 4: Verify**

```bash
npm test -- tests/remotion/text-layout.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/remotion/text-layout.ts tests/remotion/text-layout.test.ts
git commit -m "feat: add deterministic short text layout"
```

---

### Task 6: Build the single Remotion visual template

**Files:**
- Create: `src/remotion/index.ts`
- Create: `src/remotion/Root.tsx`
- Create: `src/remotion/ShortComposition.tsx`
- Create: `src/remotion/Scene.tsx`
- Modify: `src/remotion/text-layout.ts`

**Interfaces:**
- Consumes: `ResolvedVideo`
- Produces composition id: `SilentShort`
- Composition props: `{video: ResolvedVideo}`

- [ ] **Step 1: Register a dynamic-duration composition**

The composition must be exactly:

```text
id: SilentShort
width: 1080
height: 1920
fps: 30
durationInFrames: round(sum(scene.durationSeconds) * 30)
```

Use Remotion's metadata/dynamic props mechanism current for the installed version rather than hard-coding 30 seconds.

- [ ] **Step 2: Implement scene sequencing**

For each `ResolvedScene`:

```text
- show downloaded video full-frame
- crop using object-fit: cover
- center focal crop by default
- show a dark translucent readability overlay
- render text centered in the safe middle region, avoiding top/bottom UI zones
- use `layoutSceneText()` for line breaking/font size
```

- [ ] **Step 3: Implement one restrained animation language**

Only these effects in v1:

```text
Scene entrance: opacity 0 -> 1 over first 6 frames
Scene exit: opacity 1 -> 0 over last 6 frames
Text entrance: opacity + translateY(24px -> 0) over first 8 frames
Video motion: subtle scale 1.00 -> 1.04 over full scene
Progress bar: 6px at top, width proportional to total video progress
```

Do not add multiple transition types, emojis, stickers, sound effects, or random styling.

- [ ] **Step 4: Add Pexels attribution to rendered end frame only if needed for compliance policy chosen by product owner**

For the POC, always persist attribution in `run.json` and README. Do not clutter each scene with creator credits. Before public publishing, re-check Pexels attribution/link-back requirements and decide where the public-facing attribution will live.

- [ ] **Step 5: Manually preview fixture props in Remotion Studio**

Run:

```bash
npm run remotion:studio
```

Use a fixture-backed dev composition. Verify:

```text
- no text clipped at 1080x1920
- every scene covers the frame
- long fixture text remains readable
- scene boundaries have no blank frames
- total timeline is 30–45 seconds
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/remotion
git commit -m "feat: add silent short Remotion template"
```

---

### Task 7: Programmatically render the composition to MP4

**Files:**
- Create: `src/remotion/render-short.ts`
- Test: `tests/remotion/render-short.test.ts`

**Interfaces:**
- Produces: `renderShort(video: ResolvedVideo, outputPath: string, deps?: RenderDeps): Promise<void>`

Keep Remotion renderer calls behind injectable wrappers where practical to allow orchestration tests without launching Chromium.

- [ ] **Step 1: Write a failing contract test around render orchestration**

Verify the renderer receives:

```text
composition id: SilentShort
codec: h264
input props containing exact ResolvedVideo
output path supplied by caller
```

Mock bundle/selectComposition/renderMedia boundaries in the unit test.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/remotion/render-short.test.ts
```

- [ ] **Step 3: Implement renderer using current Remotion server-side rendering APIs**

Required flow:

```text
1. bundle src/remotion/index.ts once per CLI invocation
2. select `SilentShort` with inputProps
3. renderMedia with H.264 to requested .mp4
4. surface rendering failures unchanged except for a short contextual prefix
```

Do not manually invoke FFmpeg in POC unless required by the current Remotion version.

- [ ] **Step 4: Add an opt-in real render smoke test command**

Add npm script:

```json
"smoke:render": "tsx scripts/smoke-render.ts"
```

Create `scripts/smoke-render.ts` that uses checked-in `tests/fixtures/tiny-video.mp4` to make a 5-second local test render without network/API keys. The smoke render is not part of `npm test`.

- [ ] **Step 5: Verify**

```bash
npm test -- tests/remotion/render-short.test.ts
npm run typecheck
npm run smoke:render
```

Expected: `runs/smoke/output.mp4` exists and is non-zero.

- [ ] **Step 6: Commit**

```bash
git add src/remotion/render-short.ts tests/remotion/render-short.test.ts scripts/smoke-render.ts package.json package-lock.json
git commit -m "feat: render silent shorts to mp4"
```

---

### Task 8: Implement run directories and intermediate artifact persistence

**Files:**
- Create: `src/pipeline/create-run-directory.ts`
- Create: `src/pipeline/persist-json.ts`
- Test: `tests/pipeline/run-artifacts.test.ts`

**Interfaces:**
- Produces: `createRunDirectory(topic: string, root?: string): Promise<{runId: string; runDir: string}>`
- Produces: `persistJson(path: string, value: unknown): Promise<void>`

- [ ] **Step 1: Write failing artifact tests**

Verify:

```text
- generated run id is filesystem-safe
- two runs cannot overwrite one another
- JSON is pretty-printed and ends with newline
- topic text itself does not become an unsafe path
```

Use run id format:

```text
YYYYMMDD-HHmmss-<8 hex chars>
```

The random suffix prevents collisions and avoids putting sensitive/free-form topic content in directory names.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/pipeline/run-artifacts.test.ts
```

- [ ] **Step 3: Implement**

Each successful/failed run directory may contain:

```text
runs/<run-id>/
├── plan.json
├── resolved.json
├── assets/
│   ├── scene-01.mp4
│   └── ...
├── output.mp4
└── run.json
```

`run.json` records only non-secret operational metadata:

```ts
{
  runId,
  topic,
  status: 'started' | 'resolved' | 'rendered' | 'failed',
  startedAt,
  finishedAt?: string,
  error?: {stage: string; message: string}
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/pipeline/run-artifacts.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/create-run-directory.ts src/pipeline/persist-json.ts tests/pipeline/run-artifacts.test.ts
git commit -m "feat: persist short generation run artifacts"
```

---

### Task 9: Orchestrate topic → plan → assets → MP4

**Files:**
- Create: `src/pipeline/create-short.ts`
- Test: `tests/pipeline/create-short.test.ts`

**Interfaces:**
- Consumes all earlier interfaces.
- Produces:

```ts
export type CreateShortResult = {
  runId: string;
  outputPath: string;
  planPath: string;
  resolvedPath: string;
};

export async function createShort(
  topic: string,
  deps: CreateShortDeps,
): Promise<CreateShortResult>;
```

- [ ] **Step 1: Write an end-to-end orchestration test with fakes**

Assert exact stage order:

```text
create run dir
-> generate plan
-> persist plan.json
-> resolve assets
-> persist resolved.json
-> render
-> persist final run.json status=rendered
```

Also test failures in generation, resolution, and rendering. On failure, `run.json` must become `status=failed` with the stage name, then the original error is rethrown.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/pipeline/create-short.test.ts
```

- [ ] **Step 3: Implement orchestration with no business logic duplicated inside it**

Use stages exactly:

```ts
type RunStage = 'generation' | 'stock-resolution' | 'render';
```

Create `ResolvedVideo` only after all assets have resolved:

```ts
{
  runId,
  title: plan.title,
  fps: 30,
  width: 1080,
  height: 1920,
  scenes: resolvedScenes,
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/pipeline/create-short.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/create-short.ts tests/pipeline/create-short.test.ts
git commit -m "feat: orchestrate automated short generation"
```

---

### Task 10: Add the user-facing CLI

**Files:**
- Create: `src/cli.ts`
- Modify: `README.md`
- Test: `tests/cli.test.ts`

**Interfaces:**
- User command: `npm run generate -- "Why supermarkets put milk at the back"`

- [ ] **Step 1: Write failing CLI parsing tests**

Test:

```text
- joins all positional args into one topic
- rejects no topic with usage text
- does not print API keys
- success output includes run id and output path
- failure output identifies stage and run directory, then exits non-zero
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/cli.test.ts
```

- [ ] **Step 3: Wire real dependencies only in `cli.ts`**

Dependency assembly belongs here:

```text
loadConfig
create OpenAI structured generator
create Pexels client
use real downloader
use real renderer
call createShort
```

No other module should read `process.env` or instantiate vendor SDK clients directly.

- [ ] **Step 4: Make console output compact and useful**

Example:

```text
Creating short: Why supermarkets put milk at the back
[1/3] Generated 6-scene plan (36s)
[2/3] Resolved 6 stock clips
[3/3] Rendered video
Done: runs/20260813-021530-a1b2c3d4/output.mp4
```

Do not print model raw responses, Pexels JSON, authorization headers, or download URLs by default.

- [ ] **Step 5: Document local setup**

README must include:

```text
Requirements
- Node.js 22+
- npm
- OpenAI API key
- Pexels API key

Setup
1. npm install
2. cp .env.example .env
3. add keys
4. npm test
5. npm run generate -- "Why supermarkets put milk at the back"

Expected output
runs/<run-id>/output.mp4
```

Also document that POC output must be manually reviewed before any public upload.

- [ ] **Step 6: Verify**

```bash
npm test
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts tests/cli.test.ts README.md
git commit -m "feat: add topic-to-short CLI"
```

---

### Task 11: Run the real POC acceptance test

**Files:**
- No production code expected unless a defect is found.
- Generated runtime artifacts: `runs/<run-id>/...`

**Interfaces:**
- User-visible acceptance command:

```bash
npm run generate -- "Why supermarkets put milk at the back"
```

- [ ] **Step 1: Run all offline quality gates first**

```bash
npm test
npm run typecheck
npm run smoke:render
```

Expected: all PASS.

- [ ] **Step 2: Configure real credentials locally**

Set `OPENAI_API_KEY` and `PEXELS_API_KEY` only in `.env`. Confirm `.env` is ignored:

```bash
git check-ignore .env
```

Expected: `.env` is reported as ignored.

- [ ] **Step 3: Run the exact POC topic**

```bash
npm run generate -- "Why supermarkets put milk at the back"
```

Expected:

```text
- one run directory created
- plan.json valid with 5–7 scenes
- total plan duration 30–45 seconds
- every resolved scene has a local video
- output.mp4 exists and is non-zero
```

- [ ] **Step 4: Programmatically inspect output metadata**

Use `ffprobe` if available (Remotion/FFmpeg tooling may expose it); otherwise use a Node media metadata package only for this acceptance check. Verify:

```text
width = 1080
height = 1920
fps ≈ 30
duration = 30..45 seconds
video codec = H.264
```

Do not add a permanent dependency solely for the check if system `ffprobe` is present.

- [ ] **Step 5: Human watchability review**

Watch the entire generated Short once with audio muted and grade each as PASS/FAIL:

```text
A. Hook understandable within first 2 seconds
B. No text clipped by frame edges
C. Each text card can be read before scene changes
D. At least 5 of 6-ish stock clips are semantically related to their text
E. No obvious blank/black frames
F. Video communicates one coherent answer from hook to payoff
G. No manual edit was needed between command and MP4
```

Acceptance threshold: A, B, C, E, F, G must PASS, and D must be at least 80% of scenes.

- [ ] **Step 6: If acceptance fails, classify before changing code**

Only classify into one of these buckets:

```text
PLAN_QUALITY      -> prompt/schema problem
SEARCH_QUERY      -> AI searchQuery problem
PEXELS_MATCH      -> stock resolution/selection problem
TEXT_READABILITY  -> layout/template problem
PACING            -> duration/template problem
RENDERING         -> Remotion/asset technical problem
```

Fix the smallest responsible module, add a regression test, rerun all quality gates, then rerun the real POC topic.

- [ ] **Step 7: Commit acceptance-driven fixes, if any**

Use a specific commit, e.g.:

```bash
git commit -am "fix: improve Pexels fallback for silent short"
```

---

## POC Exit Criteria

The POC is complete only when all of these are true:

- `npm test` passes with no network access.
- `npm run typecheck` passes.
- `npm run smoke:render` produces a local MP4 without API keys.
- One real CLI command accepts a free-form topic and produces `runs/<run-id>/output.mp4`.
- Real output is H.264 MP4, 1080×1920, ~30 FPS, 30–45 seconds.
- Video has 5–7 sequential stock-video scenes and readable animated text.
- No voiceover, upload, scheduler, database, or analytics code exists in the POC branch.
- Intermediate `plan.json` and `resolved.json` make failures debuggable.
- At least 80% of automatically selected clips are judged semantically relevant in the acceptance run.
- No API secret appears in git-tracked files, logs, test snapshots, or run artifacts.

## Explicitly Deferred to Post-POC

Do not implement these while executing this plan:

```text
voiceover / TTS
word-level captions
background music selection
YouTube authentication/upload
cron/GitHub Actions scheduling
analytics ingestion
AI topic discovery
multi-channel publishing
multiple visual templates
AI-generated imagery/video
clip relevance scoring with vision models
asset caching/deduplication
parallel Pexels downloading
database/storage layer
web dashboard
```

## Codex Execution Notes

1. Before implementation, create an isolated worktree using the repository's preferred workflow.
2. Execute tasks in order; do not jump directly to the end-to-end pipeline.
3. Use TDD for pure/domain/orchestration behavior. Rendering visual correctness still needs the explicit smoke + human acceptance gate.
4. Do not introduce abstractions that are unused by this POC.
5. If a current SDK API differs from examples in this plan, consult the vendor's official documentation and adapt only the adapter boundary; preserve the domain interfaces in this plan.
6. If Remotion licensing for the intended deployment model becomes relevant, stop expansion beyond local POC and review current licensing before building hosted automation.
7. Do not add automatic public publishing until the generated videos have been manually reviewed across a meaningful sample.

