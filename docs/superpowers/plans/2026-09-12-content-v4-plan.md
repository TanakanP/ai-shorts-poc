# Tell Me Whyyyyyy lightweight V4 implementation plan

> Execute inline with the executing-plans workflow, task by task. Implement useful code changes first; add focused unit coverage in the final polish task, per the 2026-09-12 request. Commit each completed implementation task. This is a proposed plan, not evidence that V4 has been implemented or its samples accepted.

**Goal:** Generate a local voiced Short whose opening visibly supports a declarative contradiction, whose explanation earns a distinct second reveal, and whose final MP4 fits a natural 25–29-second target.

**Architecture:** Add a small V4 planning/orchestration path alongside V3. Reuse the structured model clients, stock search and human review, TTS, captions, BGM and Remotion renderer. Reviewed local briefs carry source-backed claims; a proof review happens before the final script and speech.

**Tech stack:** Existing TypeScript, Node, Zod, OpenAI-compatible clients, Pexels, xAI/ElevenLabs voice, Remotion and Vitest. No new runtime dependency is planned.

**Design/evidence:** `docs/content-v4/research-and-topic-review.md`; actual file mapping in `docs/content-v4/repository-map.md`. Original proposal: `/Users/tanakan.pramot/Downloads/Tell_Me_Whyyyyyy_V4_Implementation_Plan.md`; original workbook: `/Users/tanakan.pramot/Downloads/Tell Me Whyyyyyy_Schedules_V4.xlsx`.

## Scope and explicit departures from the attachment

- Preserve `npm run generate -- "topic" "creative brief"` and both existing provider choices.
- Default stays V3 until two real V4 MP4s pass manual review; retain V3 for rollback.
- Preserve voice, karaoke, local BGM, channel outro and no dark wash. No upload, scheduler, database or analytics module. Keep output under `runs/<runId>/`.
- A generation manifest is local provenance, not an analytics pipeline. Attached Task 9 and analytics portions of Task 11 are deferred under the current project rules.
- Keep six narrative functions, but combine the paradox and contradiction into one voiced opening scene. Do not force a 5–10-word sentence into one second or build silent standalone scenes.
- Preserve the existing outro inside the total time budget. Removing or shortening the sign-off is a separate content decision if samples demonstrate a need; the attachment does not authorize it.
- Sources and local/stock proof must support the claim. No invented numeric evidence, generated experiment footage or semantic “verification” based on URL keywords.
- Existing checks remain useful throughout; no new TDD ceremony is required. Run existing affected tests after implementation tasks, and do the focused new unit tests and complete suite in Task 7.
- This plan replaces the V3 task sequence only for subsequent authorized V4 work. Update `AGENTS.md` in Task 1 to identify the V4 plan and final-polish testing preference, while preserving scope exclusions.

## Completed preparation

- [x] Inspect branch and actual pipeline.
- [x] Correct stale tests/README left behind by the existing 33→35-second audio-limit change; runtime code unchanged.
- [x] Verify 434 tests across 40 files and typecheck.
- [x] Commit correction as `cfa7bd4`; fast-forward `codex/services-explore` into local `main`.
- [x] Create and check out `codex/v4-content`; no push.
- [x] Read both supplied files; save exact 16-row backlog snapshot and researched topic review.

## Minimal contracts and module boundaries

New files should stay focused, but avoid one file for each field or a general-purpose workflow framework:

| File | Responsibility |
|---|---|
| `src/content/v4/contracts.ts` | Zod input/output shapes and locally validated types. |
| `src/content/v4/brief.ts` | Read a selected local JSON brief or structured interpretation of the existing creative-brief argument. |
| `src/content/v4/plan.ts` | Two bounded model stages: packaging/hooks, then asset-aware final story; metadata handling. |
| `src/content/v4/rules.ts` | Hook lexical gates, duplicate suppression, score arithmetic and structural story checks. |
| `src/content/v4/proof.ts` | Candidate discovery, explicit approval, approved asset bindings and hold reasons. |
| `src/content/v4/adapter.ts` | Convert six narrative functions into five ordinary voiced story scenes. |
| `src/content/v4/timing.ts` | Final timing calculation, reveal timing and one-rewrite decision. |
| `src/pipeline/create-short-v4.ts` | Ordered V4 orchestration and local artifact persistence. |

Reuse `src/config.ts` for V4 settings rather than introducing another config loader. Store first-batch briefs as `content/v4/<topicId>.json`, not TypeScript topic logic. Copy reviewed facts and suggested corrections into those records only during implementation; the snapshot remains the unchanged source record.

Key handoffs:

```ts
type Fact = {id: string; statement: string; sourceUrls: string[]};
type TopicBrief = {
  topicId: string; topic: string; creativeBrief: string;
  subjectAliases: string[]; facts: Fact[]; factBoundaries: string[];
  titleSeed: string | null; descriptionSeed: string | null;
};
type ProofBinding = {
  id: string; beatIds: string[]; factIds: string[];
  kind: 'stock' | 'local'; localPath: string;
  sourcePageUrl: string | null; creatorName: string | null;
  creatorUrl: string | null; licenseNote: string;
  trimStartSec: number; usableDurationSec: number;
  cropPosition: string; observedAction: string;
  approved: boolean;
};
type GateResult = {
  decision: 'hold' | 'revise' | 'ready'; reasons: string[];
};
```

`V4ContentPlan` has version, stable topicId, contradiction type, packaging claim, first-frame proof intent, five candidates with IDs, selected ID, rubric values/reasons, six ordered narrative beats, sources/fact boundaries, title and description. Each beat has `factIds`, `newInformation`, `spokenText`, `displayText`, proof-binding IDs and target start/end. The visual-only paradox function may have empty spoken text; every exported voiced scene must have narration. Use separate API-compatible Zod envelopes and local semantic validation, following the V3 pattern.

Keep target timing separate from actual timing. A final `generation-manifest.json` records both, plus proof approvals, applied metadata seeds, word count, status and rewrite count. Stable IDs are authored in local briefs; new ad-hoc topics get an ID saved at first generation and reusable by brief path. Never recompute a stable ID from the final title.

## Task 1 — Establish V4 input/configuration without changing the default

**Files:** new `contracts.ts`, `brief.ts`; modify `src/config.ts`, `.env.example`, `src/providers.ts`, `AGENTS.md`; create reviewed pilot briefs under `content/v4/`.

**Interface:** `loadV4Brief(topic: string, creativeBrief: string, path?: string): Promise<TopicBrief>`; `contentEngineVersion: 'v3' | 'v4'` on configuration, default `v3`.

- [ ] Add `CONTENT_ENGINE_VERSION` and optional `CONTENT_BRIEF_PATH`; reject unsupported engine names. Keep positional arguments unchanged.
- [ ] For a file brief, validate topic ID, nonempty source-backed facts, subject aliases and explicit metadata seeds. Reject a mismatched topic rather than silently selecting another record.
- [ ] For free text, use a structured model result to interpret the supplied brief, then require operator confirmation of its factual claim/source mapping before assets or TTS. Do not treat a syntactically valid URL as a read/verified source. Hold if no supporting source is provided; a web-research engine is outside this build.
- [ ] Make provider schema selection accept V4 envelopes without altering provider/model defaults or duplicating clients. Keep the current V3 envelopes intact.
- [ ] Add straw and paper-towel briefs first, including source citations and factual boundaries from the review. Keep all 16 workbook records traceable; the two legacy topics do not automatically become V4 rollout entries.
- [ ] Update project instructions to point to this plan and its testing preference. Run existing config/provider tests and typecheck; commit `feat: add opt-in v4 content briefs`.

## Task 2 — Generate a contradiction package and five viable hooks

**Files:** new `plan.ts`, `rules.ts`; use existing structured clients.

**Interfaces:** `planV4Package(brief, generateStructured)` returns the validated frame, five hook candidates and proposed metadata; `evaluateHookRules(text, brief)` returns violations; `selectV4Hook(candidates)` returns a surviving candidate or a hold result.

- [ ] One structured call produces the frame, five candidates and rubric evidence. The model can rate semantic quality, but cannot mark its own hard violations acceptable.
- [ ] Count words after removing caption bars and supported speech tags. Reject any question mark, banned starts (why/how/what/who/when/where), banned setup phrases and more than 12 words. Prefer 5–10; a shorter/11–12-word survivor needs an explicit review reason.
- [ ] Normalize punctuation/case for exact duplicates. For near duplicates, compare normalized token sets with a documented 0.8 Jaccard threshold; treat that as a diversity heuristic, not truth evaluation.
- [ ] Require a reviewed subject alias in the opening clause. Keep contextual checks—contradiction clarity, mechanism disclosure and new information—in the structured editorial evaluation and manual package review.
- [ ] Calculate the proposed weighted rubric locally, with each factor in its allowed range. Below 75 → hold; 75–84 → revise; 85+ → eligible for proof review. Never label this virality probability.
- [ ] Select by editorial total, then clarity, then candidate ID. Store every candidate, score and rejected reason. Allow at most one package revision, then hold if none survives.
- [ ] Preserve supplied title/description seeds verbatim. Without seeds, generate concise declarative metadata with `#Shorts #EverydayScience`; no large tag-list generator.
- [ ] Run existing generation tests/typecheck; commit `feat: plan and gate v4 contradiction hooks`.

## Task 3 — Approve the proof before final scripting

**Files:** new `proof.ts`; modify `src/stock/review-clip.ts`, `resolve-scene-assets.ts`, `src/domain/resolved-video.ts`, `src/remotion/Scene.tsx` as narrowly needed.

**Interface:** `resolveV4Proof(package, brief, deps): Promise<{gate: GateResult; bindings: ProofBinding[]}>`.

- [ ] Use three ordered queries and current portrait/landscape search. Search provides candidates only; disable the automatic zero-match fallback for V4.
- [ ] Review the exact contradiction/result and intended mechanism/consequence shots. Store the observed action, clip ID/local path, trim start, usable duration, source and license information.
- [ ] Let a brief specify a local genuine proof clip. Check it exists and can be decoded; include owner-provided provenance. Do not use local-path possession as an inferred license.
- [ ] Review a portrait still at the chosen opening time and a short moving preview for action-dependent claims. Respect crop position in the final render; validate trim start is nonnegative and selected interval is inside the clip.
- [ ] Bind approved assets to beat/fact IDs. Do not re-search and silently replace proof later. Select unique story footage under current rules; the existing outro reuse remains explicit.
- [ ] On missing/declined proof, write a hold reason and stop before final script/TTS. A planned diagram alone is not implemented proof; automated diagrams and generated video are deferred.
- [ ] Run existing stock/render tests plus typecheck; commit `feat: review v4 proof before narration`.

## Task 4 — Write an asset-aware story and adapt it to the renderer

**Files:** extend `plan.ts`/`rules.ts`; new `adapter.ts`; reuse caption utilities, `attach-channel-outro.ts` and renderer contracts.

**Interfaces:** `planV4Story(brief, package, bindings, generateStructured): Promise<V4ContentPlan>`; `videoPlanFromV4(plan): VideoPlan`.

- [ ] Produce six ordered narrative functions: paradox, contradiction, clue, mechanism, second reveal, payoff. Require a separate supported `newInformation` claim/test for the second reveal; a repeated explanation is a revision reason.
- [ ] Combine paradox + contradiction into one opening voiced scene, mapped to renderer role `hook`. Map clue→`context`, mechanism→`mechanism`, second reveal→`curiosity-reset`, payoff→`payoff`. Keep V4 semantic roles in the content plan; do not pass the V4 plan through the order-sensitive V3 parser.
- [ ] The paradox function is visible from frame zero, while the selected spoken hook can span the opening. No blank silent Short and no extra one-second MP3.
- [ ] Start with about 65–72 total spoken words including the existing sign-off; treat 82 as draft maximum, not a desired length. Allow a shorter truthful script when timing and clarity justify it.
- [ ] Target the full mechanism around 7 seconds and distinct second reveal at 14–21 seconds. Reserve measured outro time inside the final 25–29 seconds. The attached 21–27 payoff window must shrink as necessary to include that outro.
- [ ] Reject unknown fact references, changed selected-hook text, an unsupported causal claim, repeated explanatory beats or a generic subscription payoff. Preserve display/spoken separation and karaoke bars.
- [ ] Append the current channel outro. Apply opening bookend reuse only to the known outro scene; preserve the actual payoff asset.
- [ ] Run existing caption/outro tests and typecheck; commit `feat: adapt v4 stories to voiced scenes`.

## Task 5 — Fit actual speech and final media timing

**Files:** new `timing.ts`; modify `src/voice/synthesize-scene-voices.ts`, `scene-duration.ts` only through an optional policy; retain V3 defaults.

**Interface:** `evaluateV4Timing(timedPlan, voiceManifest, fps): {gate: GateResult; needsRewrite: boolean; actualDurationSec: number; actualBeatStarts: Record<string, number>}`.

- [ ] Allow synthesis to return timed audio to V4's gate before applying the V3 total-limit rejection. Keep provider validation, valid word alignments, 1.5-second scene minimum and existing padding unless a measured sample justifies a V4-specific change.
- [ ] Calculate `sum(round(scene.durationSeconds * fps)) / fps`, including outro/pads. Derive spoken mechanism/reset starts from scene starts plus the first relevant word alignment, not model target timestamps.
- [ ] If over 29 seconds, revise once while protecting the hook, supported mechanism, new second reveal and payoff. Re-synthesize changed narration and rebuild all caption/timing manifests. Never speed up speech or truncate the explanation as a fallback.
- [ ] Also use the one revision for early complete disclosure or a second reveal outside its target window. A factual-clarity timing exception requires a recorded reason and manual review; a clock check alone cannot detect semantic disclosure.
- [ ] After that single revision, over 30 seconds is hold. 29–30 seconds or below 25 seconds is review, not automatic acceptance. Do not add filler to meet a floor. If under 23 seconds, explicitly inspect for omitted proof or explanation.
- [ ] Recheck approved clip usable lengths after TTS and any rewrite, including the existing six-frame visual transition requirement. Hold or select and approve new media if too short; never silently loop a proof action.
- [ ] Run existing voice/timeline tests and typecheck; commit `feat: fit v4 narration to measured duration`.

## Task 6 — Wire the opt-in pipeline and finish local artifacts

**Files:** new `src/pipeline/create-short-v4.ts`; modify `src/cli.ts`; reuse run-directory/persistence/render functions; update `README.md`.

**Interface:** `createShortV4(topic, deps)` returns the existing result paths plus content-plan/proof/manifest paths. Keep V3 `createShort()` intact.

- [ ] Dispatch from configured engine. Use packaging → proof → story → voice/timing → media recheck → render in that order. Make CLI stage errors identify the actual V4 stage.
- [ ] Persist `content-plan.json`, `proof.json`, `voice.json`, `resolved.json`, `generation-manifest.json` and existing run summary under the same unique run directory. Distinguish hold/revise/failed/rendered status; no manifest may claim success before render completes.
- [ ] Manifest includes schema/engine version, stable topic ID, input topic, source facts, all hook decisions, selected hook, proof bindings, metadata, spoken word count, actual/target timings, rewrite count and timestamps. Reuse existing serialization helpers; no analytics classifier.
- [ ] Probe final MP4 duration; fail acceptance beyond 30 seconds even if audio estimates passed. Use final measured duration in the manifest.
- [ ] Document the unchanged positional CLI and a metadata-preserving optional invocation:

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/straw-refraction.json npm run generate -- "A Straight Straw Can Look Bent in Water" "Use the reviewed brief"
```

- [ ] Populate remaining reviewed V4 briefs from the snapshot with the documented content corrections. Keep original title/description seeds; require an explicit override for suggested title changes. Document that old workbook commands alone do not carry F/G metadata.
- [ ] Run existing CLI/pipeline tests and typecheck; commit `feat: wire opt-in v4 generation and manifests`.

## Task 7 — Focused final unit-test polish

**Files:** `tests/content/v4/rules.test.ts`, `contracts.test.ts`, `adapter.test.ts`, `timing.test.ts`, `tests/pipeline/create-short-v4.test.ts`; extend existing config/provider/render tests where needed.

- [ ] Cover real failure boundaries: source-less brief, duplicate hook IDs, no surviving hooks, question marks inside a sentence, banned phrases after leading quotes/tags, unknown facts and missing second reveal.
- [ ] Check rubric boundaries 74/75/84/85 and deterministic tie-breaking. Prove that missing proof holds even with a perfect editorial score.
- [ ] Assert pipeline order and call counts: hold means zero TTS/render calls; approved media stays bound; revision happens at most once; local proof paths work; failure artifacts do not claim a rendered result.
- [ ] Test final duration at 29, 30 and just over 30 using frame-rounded scenes, pads and outro; separately test reveal starts and short clip rejection after rewrite.
- [ ] Verify adapter preserves narration, captions, hook card, sign-off and payoff footage. Verify local/stock trim and crop make it into rendering without mutating V3 defaults.
- [ ] Use small manually reviewed straw/paper/bread fixtures. Do not assert “runway is objectively 90/100”; subjective scores are fixture inputs, not scientific ground truth. Avoid snapshotting model prose.
- [ ] Run `npm test`, `npm run typecheck` and `git diff --check`; commit `test: cover v4 content and timing gates` when passing.

## Task 8 — Real samples, content review and rollout

- [ ] Generate one known-good V3 topic through the interactive CLI; save metadata/log paths and inspect the local MP4 as a live reference. No exact model-output identity is promised.
- [ ] Generate V4 straw and paper towel, only when their proof footage is available. Bubbles or revised bread may replace a held topic, with the reason recorded; do not fake a demo to satisfy the checklist.
- [ ] For each sample, inspect frame zero and the first second muted: object/effect visible, crop correct, short display copy legible and no opening fade hiding proof.
- [ ] Listen at normal speed: natural hook, clear causal chain, genuinely new second reveal, audible sign-off, correct karaoke, balanced BGM and no abrupt cuts. Confirm source-supported boundaries and metadata seeds.
- [ ] Check the encoded MP4 is 1080×1920/30fps, targets 25–29 seconds, never exceeds 30 seconds and matches persisted actual timings. Confirm the proof moment survives final rendering.
- [ ] Save a concise review per sample under `docs/content-v4/sample-reviews/`, identifying run paths, decisions and any exception. A mock/dry run is not a reviewed real MP4.
- [ ] Only after two accepted samples, switch default to V4, keep explicit V3 mode, run affected config checks/full suite/typecheck and commit `feat: enable reviewed v4 generation by default`.

Publishing and analytics remain manual work outside this implementation. The September dates are a proposed batch schedule, not a reason to lower the proof or audio standard. Inspect a similar-age first-six cohort and the full batch for direction; do not claim a statistically established win from this small, varied set.

## Attachment coverage

| Attached task | This plan |
|---|---|
| 0 — mapping/baseline | Preparation + repository map; live V3 sample in Task 8. |
| 1 — contracts/config | Task 1. |
| 2 — framing/preflight | Task 2; editorial ratings distinguished from hard holds. |
| 3 — hooks | Task 2. |
| 4 — six beats | Task 4; six functions adapted to five voiced story scenes. |
| 5 — proof before script | Task 3; explicit human approval and selected crop/trim. |
| 6 — duration feedback | Task 5; total MP4 timing including outro. |
| 7 — metadata | Tasks 1, 2 and 6; seeds transferred through JSON brief path. |
| 8 — manifest | Task 6; existing run-directory convention. |
| 9 — analytics | Deferred: explicitly outside current project scope. |
| 10 — version switch | Tasks 1, 6 and 8. |
| 11 — regression goldens | Task 7, excluding analytics classifications. |
| 12 — acceptance/default | Task 8; requires two real reviewed V4 samples. |

This delivers the content-generation improvement without claiming full implementation of the attachment's analytics or no-outro requirements. Those departures are deliberate and visible.
