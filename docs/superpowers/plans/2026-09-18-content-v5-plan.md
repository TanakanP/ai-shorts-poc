# V5 Original Animated Scenes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task, inline. Steps use checkbox (`- [ ]`) syntax for tracking. Follow the project's code-first workflow; focused new unit tests are final polish. This document is a planning deliverable, not authorization to start coding.

**Goal:** Export first-frame and six-second animation prompts for each story scene, import the owner's Grok MP4s by filename, and render an original voiced Short locally.

**Architecture:** Add an opt-in V5 pipeline beside V3/V4. Finalize source-backed story and measured narration before exporting prompts; pause for manual generation, then bind reviewed local MP4s to stable scene IDs. Reuse providers, TTS, captioning, local media probing/previews, BGM and Remotion rendering.

**Tech Stack:** Existing TypeScript, Node.js 22+, Zod, structured text providers, xAI/ElevenLabs TTS, Remotion/bundled FFmpeg and Vitest. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-09-18-content-v5-design.md` (proposed design for owner review).

## Global constraints

- Preserve V3/V4 behavior and the current V3 default; opt into V5 explicitly.
- Five generated story assets; paradox shares contradiction; outro reuses opening.
- Six seconds is the requested source duration; displayed intervals follow measured voice.
- Keep voice, spoken/display copy, karaoke, BGM, channel outro, opening emphasis and no dark wash.
- Local 1080×1920, 30fps MP4; 25–29-second target, 30-second hard maximum including outro.
- Keep source-backed facts and factual review. Generated illustrations are not documentary proof.
- Preserve the existing six-frame transitions and 0.3-second speech tail pad.
- No automatic looping, slowing, speeding, freezing, or speech truncation to fit clips.
- No Imagine account/API integration, Pexels fallback, upload, scheduler, database or analytics.
- No secrets in source control, checkpoints, manifests or error logs.
- Implement code first, add focused new unit tests in final polish, run existing tests after every coding task, and commit each completed task.

## Repository findings and boundaries

Base commit: `14f76c5`, checked out on `codex/v5` from `release/v1.2.0`. No V5 implementation existed at planning time.

- `src/content/v4/plan.ts` explicitly requires genuine footage, three Pexels queries per shot, and approved proof before scripting. Do not reuse those prompts unchanged.
- `src/pipeline/create-short-v4.ts` has proof-before-story ordering; V5 requires story/timing-before-prompts-before-import.
- `src/content/v4/adapter.ts` already maps six functions to five scenes, but binds `ProofBinding` and assumes stock provenance. Add a V5 adapter instead of fake V4 proof.
- `src/config.ts` always requires `PEXELS_API_KEY` and recognizes only V3/V4. Make Pexels conditional by engine.
- `src/content/v4/checkpoints.ts` is typed to `V4Deps`. Reuse its atomic read/write helpers only; add V5 stage dependencies and schema validation.
- `src/remotion/ShortComposition.tsx` consumes six extra source frames for incoming transitions. `src/remotion/Root.tsx` uses per-scene rounding only for V4; extend that rule to V5.
- `src/remotion/Scene.tsx` already mutes clip audio and honors crop/trim. Its optional `proofAssetId` also disables decorative zoom; add a narrowly scoped V5 disable-zoom flag rather than labeling generated media as proof.

## File map

| File | Responsibility |
|---|---|
| `src/content/v5/contracts.ts` | Zod schemas and exported V5 types |
| `src/content/v5/brief.ts` | V5 brief loading, style default and reviewed legacy-brief adaptation |
| `src/content/v5/rules.ts` | V5 package/story gates, no media-dependent proof rules |
| `src/content/v5/plan.ts` | Structured package/story generation and bounded feedback |
| `src/content/v5/timing.ts` | Frame capacity and V5 timing decisions |
| `src/content/v5/prompts.ts` | Structured Grok prompt generation and readable export |
| `src/content/v5/assets.ts` | Local filename resolution, media validation, hashes and bindings |
| `src/content/v5/asset-review.ts` | Interactive import, trim/crop preview and replacement |
| `src/content/v5/adapter.ts` | Story-to-voice plan and approved binding-to-renderer conversion |
| `src/content/v5/checkpoints.ts` | Validated atomic checkpoints and dependency checks |
| `src/content/v5/cli.ts` | Production dependencies, new/resume CLI and terminal lifecycle |
| `src/pipeline/create-short-v5.ts` | Ordered orchestration and final artifact/status verification |

Small shared edits: `src/config.ts`, `src/cli.ts`, `src/domain/video-plan.ts`, `src/domain/resolved-video.ts`, `src/remotion/Scene.tsx`, `src/remotion/Root.tsx`. Documentation: `AGENTS.md`, `README.md`, `.env.example`, `content/v5/README.md` and one sample brief. No wholesale shared-type migration or V4 rewrite.

## Task 1: Define V5 contracts, brief input and configuration

**Files:** Create `src/content/v5/contracts.ts`, `src/content/v5/brief.ts`; modify `src/config.ts`, `tests/config.test.ts`, `AGENTS.md`. Future tests: `tests/content/v5/contracts.test.ts`, `brief.test.ts`.

**Interfaces:** Export the types/schemas below from `contracts.ts`. `loadV5Brief(topic, creativeBrief, path, deps)` returns `Promise<V5Brief>`; deps use the existing `StructuredPlanGenerator` and `confirmFacts(brief): Promise<boolean>` pattern. Reuse existing fact/hook/rubric shapes by schema composition.

```ts
type SceneId = 'contradiction' | 'clue' | 'mechanism' | 'second_reveal' | 'payoff';
type V5Brief = Omit<TopicBrief, 'localProof'> & {visualStyle: string};
type V5Package = Omit<V4Package, 'shots'> & {
  shots: {beatId: SceneId; visualIntent: string; factIds: string[]}[];
};
type V5SelectedPackage = V5Package & {
  evaluatedHooks: EvaluatedHook[]; selectedHookId: string; preflightScore: number;
};
type V5Story = Omit<V4Story, 'beats'> & {
  beats: (Omit<V4Story['beats'][number], 'proofIds'> & {sceneId: SceneId})[];
};
type V5ContentPlan = V5Story & {
  version: 'v5'; topicId: string; topic: string; package: V5SelectedPackage;
  facts: V5Brief['facts']; factBoundaries: string[]; title: string; description: string;
};
type ScenePrompt = {
  sceneId: SceneId; factIds: string[]; visualIntent: string;
  imagePrompt: string; videoPrompt: string;
  durationSeconds: 6; aspectRatio: '9:16'; requiredFrames: number;
  promptHash: string;
};
type PromptPack = {
  schemaVersion: 1; engineVersion: 'v5'; planHash: string;
  visualStyle: string; continuity: string; scenes: ScenePrompt[];
};
type MediaInfo = {durationSec: number; width: number; height: number; fps: number};
type GeneratedBinding = {
  sceneId: SceneId; kind: 'generated'; provider: 'grok-imagine';
  fileName: string; localPath: string; sha256: string; promptHash: string;
  trimStartSec: number; cropPosition: string; media: MediaInfo;
  observedAction: string; approved: true;
};
```

- [ ] Implement local Zod schemas for these contracts. Require unique/exact scene IDs and ordered six story functions; paradox maps to contradiction. Require nonempty prompts, positive integer `requiredFrames <= 180`, valid finite media numbers, unique known fact IDs and matching scene references. Use strict provider envelopes without local defaults; fill hashes/version constants in application code rather than trusting model output.
- [ ] Implement `loadV5Brief` using V4's factual-input rules. Parse reviewed V4 JSON briefs as a compatibility input, explicitly discard their `localProof` media assignments, preserve facts/metadata, and default absent style to `Clean 3D educational animation`. Accept an explicit V5 `visualStyle`. Text briefs still require supplied URLs and owner fact confirmation; never invent sources.
- [ ] Change configuration without touching engine dispatch yet:

```ts
CONTENT_ENGINE_VERSION: z.enum(['v3', 'v4', 'v5']).default('v3'),
PEXELS_API_KEY: z.string().trim().default(''),
// Add PEXELS_API_KEY to loadConfig's required list only when engine !== 'v5'.
```

- [ ] Update the existing config test that rejects `v5` to reject `v6`; assert V5 accepts missing Pexels while V3/V4 still reject it. Keep selected script/voice credentials required; a Grok subscription does not replace this program's configured provider credentials.
- [ ] Update `AGENTS.md` to identify this plan for authorized V5 work, retain the V4 plan for V4 maintenance and preserve all unrelated constraints. Scope the stock/proof rule to V3/V4.
- [ ] Verify: `npm test -- tests/config.test.ts tests/content/v4/contracts.test.ts tests/providers.test.ts` and `npm run typecheck`. Expected: existing provider/V4 behavior passes and V5 config cases pass.
- [ ] Commit explicit changed files: `feat: define v5 original animation contracts`.

## Task 2: Plan a source-backed story that fits six-second sources

**Files:** Create `src/content/v5/rules.ts`, `plan.ts`, `timing.ts`, `adapter.ts`. Future tests: `tests/content/v5/rules.test.ts`, `plan.test.ts`, `timing.test.ts`, `adapter.test.ts`.

**Interfaces:** `planV5Package(brief, generate, record): Promise<V5SelectedPackage>`; `planV5Story(brief, pack, generate, outro, revision?): Promise<V5ContentPlan>`; `videoPlanFromV5(plan): VideoPlan`; `requiredSourceFrames(durationSeconds, sceneIndex, fps = 30): number`; `evaluateV5Timing(plan: VideoPlan, voice: VoiceManifest): V5TimingResult`. Export `Revision` from `contracts.ts`, `V5TimingResult` from `timing.ts`, and define `V5StoryRevisionNeeded` carrying the rejected `V5ContentPlan` and reasons.

```ts
type V5TimingResult = TimingResult & {
  capacityReasons: string[]; requiredFramesByScene: Record<string, number>;
};
type Revision = {previous: V5ContentPlan; feedback: string[]};
const requiredSourceFrames = (seconds: number, index: number, fps = 30) =>
  Math.round(seconds * fps) + (index === 0 ? 0 : SCENE_FADE_FRAMES);
```

- [ ] Implement package gating using existing hook lexical/duplicate/score helpers, but validate V5 shots directly; do not call V4's stock-query validator or add dummy queries. Preserve five hook candidates, score thresholds, selection ties and metadata seeds. Allow one package revision as in V4 and persist attempts.
- [ ] Implement V5 story generation with the six V4 functions and five scene IDs. Ground narration in supplied facts and planned actions. Replace `proofIds` validation with fact/scene consistency. Keep selected hook verbatim, new second-reveal fact, word limits and no generic CTA. Validate contiguous positive target windows and the spec's reveal windows. Raise `V5StoryRevisionNeeded` with the draft on editorial/structural rejection.
- [ ] Put the spec's feasible target skeleton in the prompt, explicitly budget the outro, and instruct short natural narration per scene. Do not reuse V4's two seven-second scene targets.
- [ ] Implement `videoPlanFromV5` with the existing role mapping, `ensureCaptionBars`, `sanitizeEmphasisWords` and `openingEmphasis`. Set legacy `searchQueries: []` only at this renderer/voice compatibility boundary. Append the outro through `attachChannelOutro` in orchestration.
- [ ] Implement timing by reusing `evaluateV4Timing` for frame-rounded overall/reveal checks, then add `requiredFramesByScene` and hard capacity reasons for every scene, including outro. Mark oversized scenes as rewrite-needed; capacity failure remains a hold after the shared single story rewrite. An outro failure points to the sign-off and cannot be fixed by changing story text. Validate audio/word timing through existing utilities.
- [ ] Verify: `npm test -- tests/content/v4 tests/voice tests/pipeline/attach-channel-outro.test.ts tests/captions` and `npm run typecheck`. Expected: existing story, voice and caption behavior passes.
- [ ] Commit: `feat: plan v5 stories within generated clip timing`.

## Task 3: Export matched Grok first-frame and animation prompts

**Files:** Create `src/content/v5/prompts.ts`; extend `contracts.ts` for strict provider response schema. Future test: `tests/content/v5/prompts.test.ts`.

**Interfaces:** `generateGrokPrompts(brief: V5Brief, plan: V5ContentPlan, timedPlan: VideoPlan, generate: StructuredPlanGenerator): Promise<PromptPack>`; `formatGrokPrompts(pack: PromptPack, plan: V5ContentPlan): string`. The model supplies continuity and per-scene creative text; the application supplies scene timing, version, plan hash and prompt hashes.

```ts
// Hash includes every value whose change requires a fresh clip review.
const promptHashInput = {
  sceneId, imagePrompt, videoPrompt, visualStyle, continuity,
  factIds, visualIntent, requiredFrames, durationSeconds: 6, aspectRatio: '9:16',
};
```

- [ ] Build prompts from finalized story + measured timing, with one shared continuity description. Request the two distinct prompt kinds defined in the spec. Include supported facts/boundaries, no early mechanism reveal, consistent geometry and no baked-in text/audio. First-frame text describes a still; motion text starts from that image.
- [ ] Compute each scene's consumed interval using `requiredSourceFrames`. For the opening also check outro reuse fits the same six-second source, without extending the opening's storytelling deadline to the outro length. Make required actions visible during that scene's own used interval; later clips reserve the first six frames for transition.
- [ ] Validate exactly five distinct scenes with nonempty text and correct fact mappings; reject unknown IDs or mismatched order. Allow one corrective structured-output retry with reasons, then hold. Record attempts; invalid packs never reach export/approval.
- [ ] Serialize matching JSON and Markdown. The Markdown includes the run-level style/continuity, scene number/ID, narration, fact IDs, actual used duration and separate image/video copy blocks. Explain generate image → use it with video prompt → download MP4 → copy to run → resume. Keep file assignments in `scene-assets.json`, not inside editable prose.
- [ ] Support human prompt review before publishing the approved pack to `awaiting-assets`. Decline holds the run with the rejected pack available for inspection. Changes to upstream story/style require a fresh run in this first version.
- [ ] Verify: `npm test -- tests/generation tests/content/v4` and `npm run typecheck`. Expected: existing structured generation remains passing.
- [ ] Commit: `feat: export grok image and six-second animation prompts`.

## Task 4: Import and review local videos by scene and filename

**Files:** Create `src/content/v5/assets.ts`, `asset-review.ts`; extend `adapter.ts`; modify `src/domain/video-plan.ts`, `src/domain/resolved-video.ts`, `src/remotion/Scene.tsx`, `src/remotion/Root.tsx`. Future tests: `tests/content/v5/assets.test.ts`, `asset-review.test.ts`; existing render tests.

**Interfaces:** `resolveGeneratedFile(runDir: string, fileName: string): Promise<string>`; `inspectGeneratedAsset(input, deps): Promise<GeneratedBinding>`; `reviewGeneratedAssets(input, deps): Promise<{status: 'ready' | 'awaiting-assets'; bindings: GeneratedBinding[]}>`; `bindV5Scenes(timedPlan: VideoPlan, manifest: VoiceManifest, prompts: PromptPack, bindings: GeneratedBinding[]): ResolvedScene[]`.

Define inspection input `{runDir, fileName, scene: ScenePrompt, trimStartSec, cropPosition, observedAction}`; deps `{probe: (path: string) => Promise<MediaInfo>}`. Inspection requires a nonempty reviewed observed action. Review input adds `{prompts, timedPlan, previous: GeneratedBinding[]}`; deps include `ask`, `log`, `probe`, `preview` (same signature as `previewProof`) and `record(bindings): Promise<void>`.

```ts
const availableFrames = Math.floor((media.durationSec - trimStartSec) * 30 + 1e-6);
if (availableFrames < scene.requiredFrames) {
  throw new ContentHold([`${scene.sceneId}: clip does not cover the reviewed scene interval`]);
}
// Recheck hashes and all required scene IDs in bindV5Scenes' caller before rendering.
```

- [ ] Resolve a single trimmed `.mp4` basename beneath the real run directory. Reject `/`, `\\`, absolute paths, URLs, `.`/`..`, directories and out-of-run symlinks. Reject application-owned `output.mp4` and preview filenames. Require a readable regular file, decode/probe it and stream SHA-256 hashing. Extend local validation to reject nonfinite duration/fps, zero video dimensions and invalid crop percentages.
- [ ] Validate trim start, available frames and unique source hash among story scenes. For opening import, require the larger of its own required frames and the outro's required frames, and preview both used intervals before approval. Keep its prompt's action deadline tied to the opening narration. Do not enforce exact six-second equality or fabricate metadata. Use `probeMedia`, `cropFractions` and `previewProof` without changing V4 behavior. Save previews in a dedicated subdirectory of the run.
- [ ] Implement an injectable terminal review loop: show scene/prompt, request filename, retry invalid media, choose trim/crop, create still + exact used motion preview, review factual action and continuity, collect observed action, then persist the approved binding immediately. Rejected files create no approval. `q` returns `awaiting-assets` with earlier approvals intact.
- [ ] Revalidate previous bindings on resume (prompt hash, file bytes, path and interval). Changed/missing media clears only that scene's approval. After all bindings are ready, show the explicit map and allow a scene ID to replace it before render. Keep the old valid binding until a new candidate is accepted; no duplicate accepted hashes.
- [ ] Bind by `sceneId`, never file order. Map outro to the opening binding; check its own duration against the opening source too. Preserve exact TTS words/audio paths, trim/crop and provenance. Compatibility stock strings may be empty, with creator text `Owner-generated animation`; never invent Pexels URLs.
- [ ] Extend renderer contracts minimally:

```ts
// VideoScene
disableVideoZoom?: boolean;
// ResolvedScene
generatedAsset?: {provider: 'grok-imagine'; sceneId: string; sha256: string; promptHash: string};
// ResolvedVideo
engineVersion?: 'v4' | 'v5';
```

Set `disableVideoZoom: true` for V5; `Scene` uses scale 1 when it or the existing `proofAssetId` is present. Keep clip audio muted. Extend `calculateVideoMetadata`'s frame-sum branch to `v4 || v5`; leave V3 rounding unchanged.
- [ ] Verify: `npm test -- tests/remotion tests/content/v4/adapter.test.ts tests/content/v4/proof.test.ts tests/stock` and `npm run typecheck`. Expected: V4 proof/stock and renderer behavior passes.
- [ ] Commit: `feat: bind reviewed grok videos to v5 scenes`.

## Task 5: Wire resumable V5 orchestration and CLI

**Files:** Create `src/content/v5/checkpoints.ts`, `cli.ts`, `src/pipeline/create-short-v5.ts`; modify `src/cli.ts`. Future tests: `tests/content/v5/checkpoints.test.ts`, `cli.test.ts`, `tests/pipeline/create-short-v5.test.ts`.

**Interfaces:** `createShortV5(topic: string, deps: V5Deps): Promise<V5Result>`; `withV5Checkpoints(deps: V5Deps, run): V5Deps`; `createV5ProductionDeps(config, research, ask, log): V5Deps`; `runV5Cli(args: string[]): Promise<number>`. Keep module imports acyclic with type-only imports, matching V4.

```ts
type V5Result = {
  runId: string; runDir: string; manifestPath: string;
} & (
  {status: 'awaiting-assets'; promptsPath: string; missingSceneIds: SceneId[]}
  | {status: 'rendered'; outputPath: string}
);
type V5Deps = {
  createRunDirectory: V4Deps['createRunDirectory'];
  persistJson: V4Deps['persistJson'];
  loadBrief: (topic: string) => Promise<V5Brief>;
  package: (brief: V5Brief, record: (value: unknown) => Promise<void>) => Promise<V5SelectedPackage>;
  approvePackage: (pack: V5SelectedPackage) => Promise<boolean>;
  story: (brief: V5Brief, pack: V5SelectedPackage, revision?: Revision) => Promise<V5ContentPlan>;
  approveStory: (plan: V5ContentPlan) => Promise<boolean>;
  synthesize: V4Deps['synthesize'];
  reviewTiming: (timing: V5TimingResult) => Promise<string | null>;
  prompts: (brief: V5Brief, plan: V5ContentPlan, timed: VideoPlan) => Promise<PromptPack>;
  approvePrompts: (pack: PromptPack) => Promise<boolean>;
  exportPrompts: (runDir: string, pack: PromptPack, plan: V5ContentPlan) => Promise<void>;
  assets: (pack: PromptPack, timed: VideoPlan, runDir: string,
    record: (bindings: GeneratedBinding[]) => Promise<void>,
    previous?: GeneratedBinding[]) => Promise<{status: 'ready' | 'awaiting-assets'; bindings: GeneratedBinding[]}>;
  validateAssets: (pack: PromptPack, timed: VideoPlan, bindings: GeneratedBinding[]) => Promise<void>;
  render: V4Deps['render']; probe: V4Deps['probe'];
  channel: V4Deps['channel']; voiceProvider: V4Deps['voiceProvider'];
  backgroundMusicPath: string; stage?: (name: string) => void;
  resume: boolean;
};
```

- [ ] Implement stages: brief → package/approval → story/approval → voice/timing and optional single story rewrite → prompts/approval/export → awaiting-assets on first invocation → import/review on resume → asset recheck → resolved → render → encoded verification. Share a single rewrite budget across story rejection and timing failure; persist draft/reasons/attempts. Hard clip capacity and >30s cannot be accepted as timing exceptions.
- [ ] Write all artifacts listed in the spec. Save `timed-plan.json` with the voice manifest, record actual used frames, prompt/binding provenance, original facts and rewrite count. Distinguish normal waiting from hold/revise/failure. Do not print `Done: output.mp4` while waiting.
- [ ] Implement schema-validated atomic cache records, reusing existing atomic I/O primitives only. Bind approvals to exact accepted content hashes; never cache declines. Preserve individual media approvals on partial import failure. Cache only successful completed provider work; validate audio bytes/paths and voice settings before reuse. Resume from final accepted story/timing state so a previously consumed rewrite budget is not reset.
- [ ] Store `resume.json` with engine/schema version, original inputs, brief/style identity and non-secret provider/channel/music fingerprints. Include model/voice IDs, prompt-contract version and music content hash. Reject cross-version/malformed checkpoints, changed saved upstream content/settings and incompatible brief changes with a fresh-run diagnostic. Resume never reads a V4 run as V5.
- [ ] Before reusing a `rendered` result, validate the manifest fingerprint, source/audio hashes and output hash/metadata. An unchanged successful run returns its existing result; replacements or stale output trigger new review/render. Recheck input hashes after render; concurrent input changes must not be recorded as successful final output.
- [ ] Wire CLI dispatch explicitly for `v5`, `v4`, `v3` using validated configuration. Avoid creating a Pexels client or any stock dependency in V5 production setup. Support current positional topic/brief and strict `--resume <runDir>` argument validation. Open/close terminal safely; print a shell-quoted resume command for paths with spaces. Record safe provider diagnostics without credentials.
- [ ] On an invalid filename retry the same scene; on missing/changed approved media require that scene again; on render failure retain valid approvals for resume. On `q`, return exit 0 with missing scene IDs and exact resume instructions.
- [ ] Verify: `npm test -- tests/cli.test.ts tests/pipeline tests/config.test.ts tests/providers.test.ts` and `npm run typecheck`. Expected: legacy CLI/pipeline cases pass.
- [ ] Commit: `feat: add resumable v5 prompt and video workflow`.

## Task 6: Document the owner workflow and add a reviewed sample

**Files:** Modify `README.md`, `.env.example`; create `content/v5/README.md`, `content/v5/pen-cap-hole.json` derived from existing `content/v4/pen-cap-hole.json`.

**Interfaces:** Documentation matches the implemented `runV5Cli`; sample validates against `V5Brief`.

- [ ] Copy the existing sample's facts, source URLs, fact boundaries and metadata exactly; remove local stock/proof assignments and add `visualStyle`. Do not expand claims or re-research unrelated topics. Explain that source review is still required if claims are changed.
- [ ] Document the first run and resume commands from the spec, both copyable prompt blocks, use of the image as the video's first frame, copying arbitrary filenames into the correct run, and the `mechanism` → `Ptko4.mp4` interaction. Document replacements, pauses, six-second source versus shorter used duration, outro reuse and clip muting.
- [ ] Document that V5 needs no Pexels key, uses the configured script/voice API keys, and the owner's Grok generation stays manual. Keep V3/V4 instructions clearly scoped; do not claim existing commands already produce original content by default.
- [ ] Verify: `npm test` and `npm run typecheck`; validate the sample using `npx tsx -e 'import {readFileSync} from "node:fs"; import {v5BriefSchema} from "./src/content/v5/contracts.ts"; v5BriefSchema.parse(JSON.parse(readFileSync("content/v5/pen-cap-hole.json", "utf8")));'`. Export the brief schema under that name in Task 1. Expected: offline tests/typecheck and sample parsing pass.
- [ ] Commit: `docs: explain v5 manual grok generation and import`.

## Task 7: Focused unit and integration test polish

**Files:** Add the V5 tests named in Tasks 1–5 and shared `tests/content/v5/fixtures.ts`; extend `tests/config.test.ts`, `tests/remotion/composition.test.ts`, `tests/remotion/scene.test.ts` as needed. Use temporary run directories and injected providers/media readers; no paid calls in tests.

- [ ] Cover five unique prompt pairs, missing/duplicate/unknown scenes, nonempty image/video prompts, fact references, shared continuity, preserved metadata, missing Pexels key, V4 compatibility input and absence of fabricated proof.
- [ ] Cover frame boundaries and ensure later-scene transitions count against source capacity:

```ts
it('budgets incoming transition frames inside six seconds', () => {
  expect(requiredSourceFrames(6, 0)).toBe(180);
  expect(requiredSourceFrames(5.8, 1)).toBe(180);
  expect(requiredSourceFrames(5.8 + 1 / 30, 1)).toBe(181);
});
```

- [ ] Cover missing/nondecodable/nonfinite media, too-short selected intervals, invalid trim/crop, same file bytes under two filenames, path escape including symlinks, reserved output names and arbitrary valid filenames. Test that outro reuses opening while payoff keeps its own asset.
- [ ] Cover explicit scene assignment in shuffled filename order, prompt/media hash changes forcing review, replacement decline preserving the previous valid choice, partial import followed by quit/resume, malformed/cross-version checkpoints and changed settings. Use actual temporary file bytes to exercise hashing rather than only mocks.
- [ ] Add injected pipeline tests asserting observable behavior: first run exports prompts and returns waiting without calling import/render; resume reuses approved story/prompts/audio; single rewrite cap survives resume; capacity failures never render; no stock service is constructed/called; failed render never records success; edited inputs cannot reuse final output.
- [ ] Add exact final-MP4 gate tests for dimensions/fps/duration mismatch and >30s. Confirm V5 sums rounded scene frames in metadata and retains muted videos, no zoom/no wash, aligned voice, karaoke, music and outro.
- [ ] Run `npm test` and `npm run typecheck`. Expected: complete offline suite passes, including unchanged V3/V4 regression paths.
- [ ] Commit: `test: cover v5 prompts imports timing and resume`.

## Task 8: Real Grok and local render acceptance

**Files:** Create `docs/content-v5/sample-reviews/2026-09-18-validation.md` (use execution date if later). Keep paid/generated assets only in ignored `runs/`.

- [ ] Run the sample with the owner's configured script/voice providers when live generation is authorized. Verify five coherent prompt pairs and a waiting manifest before any file is supplied. Record the run ID and actual durations.
- [ ] Owner generates the five first frames and matching six-second videos in Grok, copies them into the run and supplies filenames. This manual step is required acceptance, not something an offline test or placeholder can claim completed.
- [ ] Approve two scenes, quit, resume, and verify the completed provider work and approvals are reused. Bind one video using an arbitrary name such as `Ptko4.mp4`, then review all five used intervals and the reused outro interval.
- [ ] Render and probe `output.mp4`. Play the whole Short and inspect accurate action, continuity, reveal timing, no truncated action, no blank tail frames, hook/caption legibility, audible narration/BGM and correct outro. Confirm 1080×1920, 30fps and <=30s. A 25–29s exception must have its recorded review reason.
- [ ] Record the tested revision, run ID, actual format/duration, owner approval and any unperformed checks. If media or provider access is unavailable, mark live acceptance incomplete; do not substitute existing stock clips.
- [ ] Run `npm test` and `npm run typecheck` after any resulting code changes, then commit the validation record and relevant fixes. Keep each fix within this plan's scope.

## Completion checklist

- [ ] V5 exports the requested two prompts per scene.
- [ ] Owner filenames bind unambiguously to scenes and survive restarts.
- [ ] All displayed scenes fit their source clips, including transitions/outro.
- [ ] Local voiced MP4 and thumbnail are verified; V3/V4 still work.
- [ ] No Pexels calls occur in V5 and no Grok integration was added.
- [ ] Offline verification and real-media acceptance are reported separately.
