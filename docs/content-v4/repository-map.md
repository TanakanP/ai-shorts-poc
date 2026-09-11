# V4 repository map

Baseline: `cfa7bd4`, merged locally from `codex/services-explore` into `main`; V4 branch: `codex/v4-content`. Research/planning date: 2026-09-12 (Bangkok).

`npm run generate -- "topic" "creative brief"` invokes `tsx src/cli.ts`. The second argument is a creative brief, not an implemented web-research step. Production generation requires an interactive terminal for footage review.

## Current flow and V4 changes

| Responsibility | Existing implementation | V4 disposition |
|---|---|---|
| CLI/configuration | `src/cli.ts`, `src/config.ts` | Preserve positional arguments; add engine dispatch and optional reviewed brief path. |
| Provider construction | `src/providers.ts` | Reuse selected script and voice providers; allow V4 Zod envelopes. |
| Structured model calls | `src/generation/generate-video-plan.ts` | Reuse OpenAI/xAI structured clients; do not build another API wrapper. |
| Hooks | `src/generation/generate-hooks.ts`, `select-hook.ts`, `prompt.ts` | Keep V3; V4 has five candidates and stricter local rules. |
| Story/schema | `src/generation/generate-story.ts`, `src/domain/video-plan.ts` | Keep V3 three-hook/five-role contracts; add separate V4 planning schema and explicit adapter. |
| Research | Creative-brief string only | Local reviewed topic briefs with claim/source pairs; no automatic research service. |
| Orchestration | `src/pipeline/create-short.ts` | V3 unchanged; V4 proof review precedes final script and TTS. |
| Asset search/download | `src/stock/pexels-client.ts`, `select-video-file.ts`, `resolve-scene-assets.ts`, `download-file.ts` | Reuse search and media selection; add approved proof binding and trim/crop metadata. |
| Asset approval | `src/stock/review-clip.ts` | Reuse human review; inspect contradiction/action, not just matching objects. |
| Asset ranking | `src/stock/score-stock-match.ts` | URL/query similarity is candidate ranking, never visual verification. Automatic callers can currently accept zero-match fallback footage. |
| Speech | `src/voice/synthesize-scene-voices.ts`, `scene-duration.ts` | Reuse synthesis and word timing; expose V4 timing policy and one rewrite opportunity before final rejection. |
| Voice providers | `xai-tts-client.ts`, `elevenlabs-tts-client.ts` | xAI uses reported duration; ElevenLabs probes MP3 duration. Measure final exported runtime too. |
| Captions | `src/captions/*`, `src/remotion/WordCaption.tsx` | Preserve karaoke and spoken/display split. Strip speech tags/bars for word counts. |
| Outro | `src/pipeline/attach-channel-outro.ts`, `bookend-last-scene.ts` | Preserve channel identity under current project rules; budget actual outro duration. Never overwrite a V4 payoff asset implicitly. |
| Rendering | `src/remotion/Scene.tsx`, `ShortComposition.tsx`, `render-short.ts` | Preserve MP4, voice, BGM and no dark wash. Add explicit asset trim/crop only where required. |
| Artifacts | `create-run-directory.ts`, `persist-json.ts`, `create-short.ts` | Keep `runs/<runId>/`; add V4 content/proof/manifest JSON beside existing artifacts. |

Current sequence: generate hooks → select → generate story → append outro → TTS → review/download stock → replace last scene footage with opening → render → run summary.

Proposed V4 sequence: reviewed brief → frame/five hooks → local rules + editorial evaluation → approve actual proof media → final story → adapter/outro → TTS → measured timing check/one rewrite → final asset-length check → render → MP4 duration check → local manifest.

## Verified baseline

- Existing final source commit `e5acd5b` changed the voiced maximum from 33 to 35 seconds. Four assertions still expected 33; corrected the boundary inputs and README in `cfa7bd4`, without changing runtime code.
- `npm test`: **40 files, 434 tests passed** after the correction. Local HTTP-server tests require execution outside the restrictive sandbox.
- `npm run typecheck`: passed.
- `git diff --check`: passed before the baseline commit.
- Fast-forward means merged `main` contains exactly the tested tree. No remote push was performed; the source branch remains available.
- No new paid V3 or V4 generation was performed for this planning task. A live V3 reference render remains an implementation acceptance step; passing unit tests does not establish media quality.

## Integration traps

1. V3 schema duration and audio duration have different limits: planned final maximum 30 seconds, actual voiced maximum 35. V4 needs its own final runtime policy, not a global V3 change.
2. Scene audio currently has a 1.5-second minimum and 0.3-second tail pad. A one-second separately voiced paradox beat cannot fit this contract.
3. Visual scene transitions overlap by six frames; audio scenes do not. Final runtime uses rounded per-scene frame durations, not just the sum of raw MP3 durations.
4. `Scene.tsx` starts footage at its beginning and centre-crops with `objectFit: cover`. An approved source clip may lose its proof moment or object after those transformations.
5. Large display text currently renders only for `role === 'hook'`. A V4 `paradox` role needs mapping or explicit renderer support.
6. `bookendLastScene()` replaces the last asset unconditionally. Keep it for the legacy channel-outro flow; do not apply it to a semantic V4 payoff without a deliberate loop decision.
7. `createProviders()` currently restricts schemas to the two V3 envelopes. V4 schema support is a wiring change, not a new provider integration.
8. Workbook commands pass A and D, while final title/description live in F and G. The current CLI cannot preserve both metadata cells reliably from those commands alone.
