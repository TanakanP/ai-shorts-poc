# V5 original animated scenes — design for review

**Status:** Proposed design accompanying the requested coding plan. No runtime implementation is included.

**Base:** `codex/v5`, created from `release/v1.2.0` at `14f76c5`.

## Intended result

Replace V5's stock-footage discovery with original animation made manually in Grok Imagine. For each story scene, the program produces two copyable prompts:

1. An image prompt for the initial frame.
2. An image-to-video prompt requesting a six-second animation of that frame.

The owner generates the media in Grok, copies each MP4 into `runs/<runId>/`, and enters its filename for the corresponding scene. The program validates and previews the assigned video, records approval, and renders the voiced Short locally.

The requested six seconds is a workflow target supplied by the owner, not an assumption that the application can control Grok's output. Probe every downloaded file. Grok account access, generation and downloads remain manual; existing script/TTS providers remain responsible for their existing jobs.

## Scope and defaults

- Add opt-in `CONTENT_ENGINE_VERSION=v5`. Preserve V3/V4 behavior and the current V3 default.
- Produce five original story clips: `contradiction`, `clue`, `mechanism`, `second_reveal`, `payoff`.
- As in V4, the visual `paradox` function shares the contradiction scene. It does not need a sixth clip or separate narration.
- Preserve the channel outro and explicitly reuse the opening animation for its background. No extra Grok generation is required for the outro.
- Preserve voice, spoken/display copy, karaoke, BGM, opening emphasis, no dark wash, and local 1080×1920, 30fps MP4 output.
- Preserve source-backed facts, metadata seeds, delayed mechanism, distinct second reveal, and human factual review. Generated imagery illustrates supported claims; it is not documentary evidence of a real experiment.
- Default proposed style: clean 3D educational animation. A `visualStyle` string in the brief can override it. Subject appearance, proportions, materials, palette and environment are defined once per run and included in every prompt. Style remains an owner-review choice.
- No direct Imagine API calls, subscription login automation, Pexels fallback, web UI, upload, scheduler, database or analytics.
- No automatic looping, slowing, speeding, freezing, or speech truncation to make an undersized clip fit.
- Implement code first, add focused new unit tests in final polish, run existing tests after every coding task, and commit each completed task, following the project workflow.

## Approaches considered

| Approach | Benefit | Cost / decision |
|---|---|---|
| Dedicated V5 planning/import path feeding the existing renderer | Separates generated illustrations from V4's reviewed-footage proof; clean rollback | Recommended. A few new focused modules, existing TTS/render reused |
| Treat generated files as V4 `localProof` | Small initial patch | Rejected: V4 scripts require approved footage first and package prompts explicitly forbid unavailable animation |
| Automate Grok generation and downloads | Less manual handoff | Deferred: not requested; introduces account integration instead of using the owner's existing workflow |

## User workflow

The commands below are planned interfaces and are not implemented yet.

```sh
CONTENT_ENGINE_VERSION=v5 CONTENT_BRIEF_PATH=content/v5/pen-cap-hole.json \
  npm run generate -- "<exact topic from brief>" "Use the reviewed brief"
```

1. Load reviewed facts, plan/approve the package and narrated story.
2. Synthesize voice, check actual durations, and use at most one story rewrite if needed. Approve any allowed overall editorial timing exception.
3. Generate and approve the five prompt pairs using the final story and measured scene windows. Save `grok-prompts.json` and `grok-prompts.md`.
4. Exit successfully with status `awaiting-assets`, exact run directory and resume command. Normal waiting is not an error.
5. Owner generates the first frame, then uses that image with its matching motion prompt in Grok. Copy resulting MP4s into the printed run directory; filenames can stay arbitrary, such as `Ptko4.mp4`.
6. Resume:

```sh
CONTENT_ENGINE_VERSION=v5 npm run generate -- --resume runs/<runId>
```

7. For each missing scene, show its ID, narration, visual intent and prompts. Ask, for example, `Video filename for mechanism (or q to save and stop):`. Enter `Ptko4.mp4`.
8. Validate the file, choose trim/crop, preview the exact portrait interval, confirm the required action and give a short observed-action description. Save each approved assignment immediately. Rejections allow another filename; `q` preserves completed assignments and exits `awaiting-assets`.
9. Show a summary of all five assignments. Allow a scene ID to replace its video, or Enter to continue to render. A replacement is committed to the manifest only after it is approved.
10. Render `output.mp4`, retain the thumbnail, and verify encoded duration/dimensions/fps before recording `rendered`.

The first run intentionally spends script/TTS calls before the manual Grok work. This lets prompts fit the actual narration and avoids asking the owner to regenerate videos after a timing rewrite.

## Prompt contents and consistency

`grok-prompts.md` groups prompts by stable scene ID and scene number. Each entry includes narration, supported fact IDs, required visible action, requested source duration (6s), measured used interval, and two clearly separated copyable text blocks. JSON stores the same content for binding and checkpoints.

The image prompt defines one still composition: subject, starting physical state, environment, framing, lighting, camera, continuity details and 9:16 composition. The opening must already show the contradiction without revealing the mechanism. It must not describe an entire sequence as if it were one image.

The video prompt explicitly uses the supplied image as frame zero, preserves identity and geometry, requests a six-second continuous shot, and describes the motion/action/camera and settled end state. Required action must finish inside the **used** interval, not only near the end of the six-second source. For scenes after the first, allow the six-frame transition before the important action. Remaining source time can hold a naturally settled pose. Request no text, captions, logos, music or dialogue; final video audio is muted regardless of what Grok produces.

Carry fact boundaries into prompts. Do not invent physical mechanisms, numeric measurements, labels or secondary events. Review covers action legibility, consistency, accurate illustration and absence of early reveals. Prompt validation checks structure and references; it cannot establish visual truth or guarantee that Grok obeyed the prompt.

## Timing contract

Six seconds is the source clip length, not a requirement to display all six seconds. Five full six-second scenes plus an outro would exceed the existing 30-second ceiling.

Retain a 25–29-second total target, 30-second hard maximum, and the existing 0.3-second voice tail pad. Every scene must fit its source interval, including the renderer's six-frame incoming transition on all scenes except the opening:

```ts
const sceneFrames = Math.round(scene.durationSeconds * 30);
const requiredFrames = sceneFrames + (sceneIndex === 0 ? 0 : 6);
const availableFrames = Math.floor((media.durationSec - trimStartSec) * 30 + 1e-6);
// requiredFrames <= 180 before export; <= availableFrames on import/render.
```

This gives at most 6.0s for the opening and 5.8s for each later scene's padded timeline when using six-second sources. Apply it to the outro too, since that reuses the opening source. Hard per-clip constraints cannot be waived by an editorial timing exception.

The V4 story prompt's seven-second mechanism and second-reveal targets must change in V5. A feasible target skeleton is opening 0–3, clue 3–8.2, mechanism 8.2–14, second reveal 14–19.5, payoff 19.5–24, followed by the measured outro. These are planning targets only; actual speech drives acceptance. Keep mechanism onset at/after 7s and second reveal onset within 14–21s. Shorten narration within the single rewrite budget if a scene exceeds capacity. If the outro alone cannot fit, hold with an explicit sign-off diagnostic; do not silently change branding.

Import accepts a decodable MP4 that covers the required selected interval. A small duration difference from six seconds is not itself a failure; a shorter file is usable only if it covers the exact scene. Longer sources are trimmed to the reviewed interval. Portrait is preferred; other aspect ratios require the same explicit portrait crop preview. Resolution/fps differences are handled by the existing renderer, with final format verified.

## Contracts and persistence

Use V5-specific package/story/prompt/binding contracts. Reuse V4 fact and hook utilities where they are independent of Pexels and proof assets. Never fabricate approved `ProofBinding` entries to pass a V4 gate.

The content plan keeps the six narrative functions, references fact IDs and planned scene IDs, and carries version `v5`. V5 package shots carry `visualIntent` and `factIds`, with no stock query requirement. Imported bindings carry `kind: generated`, `provider: grok-imagine`, `sceneId`, prompt hash, file hash, relative filename, trim, crop, measured media metadata, approval and observed action. Preserve generated provenance in manifests without inventing Pexels source URLs or creators.

| Artifact | Purpose |
|---|---|
| `resume.json` | Schema/engine versions, original input and non-secret settings fingerprint |
| `brief.json`, `package.json`, `content-plan.json` | Reviewed inputs and approved planning outputs |
| `voice.json`, `timed-plan.json`, `timing-attempt-*.json` | Measured audio, scene windows, rewrite history and timing decision |
| `grok-prompts.json`, `grok-prompts.md` | Versioned prompt pack and copyable owner instructions |
| `scene-assets.json` | Explicit scene-to-filename mapping, hashes and approvals |
| `checkpoint-*.json` | Atomic completed-stage caches and approvals bound to exact inputs |
| `resolved.json` | Validated renderer input with original-media provenance |
| `generation-manifest.json`, `run.json` | Stage/status, source facts, prompts, bindings, timing, safe errors and final result |
| `output.mp4`, `thumbnail.jpg` | Existing local deliverables |

Statuses: `awaiting-assets`, `hold`, `revise`, `failed`, `rendering`, `rendered`. `awaiting-assets` exits 0; declined factual/story review holds rather than claiming successful render.

Accept only a single MP4 basename in the run directory. Reject path traversal, absolute paths, URLs, non-files, symlinks escaping the run directory, and application-owned outputs/previews. Do not discover assignments by directory sort order. Reject a duplicate video hash across distinct story scenes; the outro is the only explicit reuse.

Resume validates engine/schema version and fingerprints for story/prompt versions, script model, voice provider/model/ID, channel settings, brief/style, and music identity. Keep cached outputs only for identical dependencies. Parse checkpoint data, verify referenced files, and rehash imported media before reuse and before/after rendering. Changed/missing media invalidates its approval and returns that scene to review. Never reuse stale final success after any dependency changed. No secrets belong in fingerprints or artifacts.

For this initial V5, changing saved upstream planning inputs/settings requires a fresh run and a clear diagnostic. Media replacement within a run is supported. This keeps manual generation stable without building a general editing/revision system.

## Acceptance

- Five prompt pairs are produced without Pexels access or a Pexels key.
- Each pair fits the reviewed story, consistent style and measured used interval.
- `Ptko4.mp4` can bind to `mechanism` regardless of its filename or copy order.
- Partial import, quit, retry and render failure retain valid approvals and completed script/TTS work.
- Missing, changed, duplicate, corrupt or too-short clips never silently render or trigger stock fallback.
- Final MP4 uses all five reviewed generated clips and the opening clip for the outro, with existing narration/captions/music intact.
- Final duration is at most 30s and output is 1080×1920 at 30fps; V3/V4 tests remain passing.
- Manual owner acceptance verifies Grok output quality. Automated tests make no claim to verify animation factual accuracy.
