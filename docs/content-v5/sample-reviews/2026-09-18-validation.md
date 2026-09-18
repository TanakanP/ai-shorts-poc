# V5 implementation validation

Implementation tasks 1–7 are complete. Task 8 is pending live Grok generation and
local render acceptance; V3 remains the default. No V5 content sample has been
accepted or published.

This record was written 2026-09-19. Live generation was not authorized in this
session: there is no interactive owner TTY, and Grok clip generation is a manual
owner step that cannot be automated here. Offline tests are not a substitute.
Existing V3/V4 stock clips were not copied into a V5 run.

## Automated verification

- Pre-task HEAD: `349c1a0` (`349c1a0efe76475405f87ebefc34e4fa0736c7e1`),
  `test: cover v5 prompts imports timing and resume`, branch `codex/v5`.
- `npm test`: **597 passing tests across 60 files**.
- `npm run typecheck`: passed (`tsc --noEmit`).
- `git diff --check`: passed.

V5 CLI, prompt export, filename import and resume are implemented on this
revision (Tasks 1–7, `775f605`..`349c1a0`). Offline coverage includes:

- Five unique image/video prompt pairs, shared continuity, fact references and
  measured used intervals.
- First-run export returning `awaiting-assets` without import or render.
- Arbitrary basename binding (`Ptko4.mp4`) by scene ID, not copy order.
- Partial import, `q`, resume reusing approved story/prompts/audio, and
  replacement decline keeping the previous valid clip.
- Opening source covering the reused outro interval; payoff keeping its own clip.
- No Pexels/stock client in V5 production setup; no Imagine API client.
- Encoded-MP4 gates (1080×1920, 30fps, ≤30s) and V3/V4 regression paths.

Those tests inject fixtures and fake media. They do not establish Grok visual
quality, live TTS delivery, or a real `output.mp4`.

## Live generation and import (not performed)

Authorized first-run command (from `content/v5/README.md`), **not executed**:

```sh
CONTENT_ENGINE_VERSION=v5 CONTENT_BRIEF_PATH=content/v5/pen-cap-hole.json \
  npm run generate -- "A Pen-Cap Hole Is an Airway Safety Feature" "Use the reviewed brief"
```

The following were **not performed**:

- Interactive first run with the owner's configured script/voice providers.
- Inspection of five coherent live prompt pairs and a waiting manifest before
  any file is supplied.
- Recording a live run ID or actual scene/audio durations.
- Owner generation of five first frames and matching six-second 9:16 videos in
  Grok.
- Copying those MP4s into a run directory.
- Resume, filename entry (including an arbitrary name such as `Ptko4.mp4`),
  trim/crop, used-interval previews, observed-action review.
- Approve two scenes, quit, resume, and verify reused provider work and
  approvals.
- Review of all five used intervals and the reused outro interval.
- Render, probe, or playback of `output.mp4` / `thumbnail.jpg`.

No `runs/` assets were created for this record. Paid or generated media must
stay in ignored `runs/` only. Do not treat V3/V4 stock under `runs/` as V5
proof footage.

## Local rendering checks (not performed)

No live V5 MP4 exists to probe. The following remain unverified on real media:

- Accurate illustrated action and continuity across scenes.
- Reveal timing (mechanism delayed; second reveal distinct).
- No truncated action and no blank tail frames.
- Hook and caption legibility.
- Audible narration, karaoke, BGM and the correct channel outro.
- Encoded format 1080×1920, 30fps, duration ≤30s (25–29s target; any exception
  in that window needs a recorded review reason).

V3 remains the default generate path. This task did not re-run a live V3 or V4
sample.

## Remaining owner acceptance work

Use the commands in [`content/v5/README.md`](../../../content/v5/README.md).
Work from an **interactive** terminal with selected `SCRIPT_PROVIDER` /
`VOICE_PROVIDER` credentials. V5 needs no Pexels key. A Grok subscription does
not replace script/voice keys. Grok generation stays manual.

1. First run:

   ```sh
   CONTENT_ENGINE_VERSION=v5 CONTENT_BRIEF_PATH=content/v5/pen-cap-hole.json \
     npm run generate -- "A Pen-Cap Hole Is an Airway Safety Feature" "Use the reviewed brief"
   ```

   Approve the contradiction package, then the narrated story. After voice and
   timing (at most one story rewrite), approve five prompt pairs. Confirm the
   process exits 0 with `Status: awaiting-assets`, the missing scene IDs
   (`contradiction`, `clue`, `mechanism`, `second_reveal`, `payoff`), prompts
   path `runs/<runId>/grok-prompts.json`, and a resume command. It must **not**
   print `Done: output.mp4` while waiting. Record the run ID and actual
   durations. Copy the printed resume command (`JSON.stringify` quotes paths
   that contain spaces).

2. Open `runs/<runId>/grok-prompts.md`. For each of the five scenes, copy the
   **Image prompt**, generate a still in Grok, then use **that still as the
   video's first frame** with the matching **Video prompt**. Request a
   six-second 9:16 clip. Download the MP4. Keep identity and environment
   consistent; do not bake captions, logos, music or dialogue into the media.

3. Copy each MP4 into the **printed** run directory. Filenames may stay
   arbitrary (example: `Ptko4.mp4`). Use a single `.mp4` basename only; do not
   use `output.mp4`. Five story scenes need five distinct files. The channel
   outro reuses the opening clip; do not generate a sixth video.

4. Resume:

   ```sh
   CONTENT_ENGINE_VERSION=v5 npm run generate -- --resume runs/<runId>
   ```

   Confirm approved brief, package, story, voice, timing and prompts are reused.

5. Approve two scenes, enter `q` to save and stop, resume again, and confirm
   completed provider work and earlier approvals persist. Bind one video using
   an arbitrary name such as `Ptko4.mp4` (the documented `mechanism` example).
   Review all five used-interval previews and the reused outro interval from the
   opening file.

6. After all five are approved, press Enter to render. Probe `output.mp4`. Play
   the whole Short and inspect the checks listed above. Confirm 1080×1920,
   30fps and ≤30s.

7. Record the tested revision, run ID, actual format/duration, owner approval
   and any unperformed checks in this folder. Do not substitute stock clips.

Keep V5 opt-in. Do not change the default engine to V5 as part of this
acceptance. Do not add Imagine API integration or Pexels fallback.

All outputs remain local. No analytics subsystem, scheduler, upload or database
was introduced.
