# V5 original animation (owner workflow)

V5 is an **opt-in** engine. It plans a source-backed voiced Short, exports Grok
first-frame and six-second animation prompts, then pauses so you can generate the
clips yourself. Copy the MP4s into the printed run directory, resume, and bind
each filename to a scene. The program renders a local MP4. It does **not** call
Grok Imagine, search Pexels, or upload anywhere.

`npm run generate` without `CONTENT_ENGINE_VERSION=v5` still uses **V3**. Default
generate does not produce original animation.

V5 needs **no Pexels key**. Script and voice API keys for the selected providers
are still required. Channel brand, sign-off and local BGM stay in `.env`. Grok
generation stays manual.

Generated illustrations support the reviewed story. They are **not** documentary
proof of a real experiment.

## Sample brief

[`pen-cap-hole.json`](pen-cap-hole.json) copies the V4 sample's `topicId`, `topic`,
`subjectAliases`, facts, source URLs, `factBoundaries`, `titleSeed` and
`descriptionSeed` exactly. `localProof` is removed. `visualStyle` is
`Clean 3D educational animation` (the V5 default if a brief omits it).

The sample keeps the V4 `creativeBrief` prose, including stock-search and
`localProof` instructions, so packaging language and claims stay identical. **V5
ignores stock/proof instructions in that prose** and uses generated illustrations
instead.

Source review is still required if you change claims, sources, fact boundaries or
the topic. Do not expand claims or add sources without checking the linked pages.

Topic in the command must match the brief:

`A Pen-Cap Hole Is an Airway Safety Feature`

## First run

From the repository root, in an **interactive** terminal:

```sh
CONTENT_ENGINE_VERSION=v5 CONTENT_BRIEF_PATH=content/v5/pen-cap-hole.json \
  npm run generate -- "A Pen-Cap Hole Is an Airway Safety Feature" "Use the reviewed brief"
```

The first run:

1. Loads the reviewed brief.
2. Asks you to approve the contradiction package, then the narrated story.
3. Synthesizes voice and checks measured timing (at most one story rewrite).
4. Generates and asks you to approve five prompt pairs.
5. Writes `grok-prompts.json` and `grok-prompts.md` in the run directory.

It then **exits 0** without importing videos or rendering. You should see
`Status: awaiting-assets`, the missing scene IDs, a prompts path
(`runs/<runId>/grok-prompts.json`), and a resume command. It does **not** print
`Done: output.mp4` while waiting. That wait is success, not a failure.

Copy the printed resume command. The CLI quotes the run directory with
`JSON.stringify`, so paths with spaces stay valid.

## Two copyable prompts per scene

Open `runs/<runId>/grok-prompts.md`. Each of the five scenes
(`contradiction`, `clue`, `mechanism`, `second_reveal`, `payoff`) has:

- Narration, fact IDs, required visible action
- **Used duration** (the shorter interval the Short actually displays)
- **Requested source duration: 6s**
- A fenced **Image prompt** block
- A fenced **Video prompt** block

Do not put filenames inside those prompts. Scene-to-file assignments live in
`scene-assets.json` after import.

### Generate in Grok

For every scene:

1. Copy the **Image prompt** block. Generate a still in Grok.
2. Use **that still as the video's first frame** (frame zero) with the matching
   **Video prompt**. Request a six-second 9:16 clip.
3. Download the MP4.

The image is the opening frame of the motion clip, not a separate still the
renderer will play. Keep identity, proportions and environment consistent across
scenes (see the run-level visual style and continuity in the markdown). Do not
bake captions, labels, logos, music or dialogue into the media; the Short mutes
clip audio and adds karaoke later.

Required action must finish inside the scene's **used** interval, not only near
the end of the six-second source. Later scenes reserve the first six frames
(0.2s) for an incoming transition.

## Copy files into the printed run directory

Copy each downloaded MP4 into the **printed** run directory (`runs/<runId>/`
from the resume command). Filenames can stay arbitrary. Example: Grok names a
file `Ptko4.mp4`; leave it as `Ptko4.mp4`. Do not rename to scene IDs unless you
want to.

Use a single `.mp4` basename only. No paths, URLs, subfolders or
`output.mp4` (that name is reserved for the finished Short).

Five story scenes need **five distinct files** (different bytes). The channel
outro reuses the opening clip; do not generate a sixth video.

## Resume and import

```sh
CONTENT_ENGINE_VERSION=v5 npm run generate -- --resume runs/<runId>
```

Use the exact quoted command the first run printed if the path has spaces.

Resume reuses the approved brief, package, story, voice, timing and prompts. It
does not reread an edited topic JSON; a changed brief file requires a fresh run.

For each missing scene the program shows the scene ID, narration, visual intent
and both prompts, then asks:

```text
Video filename for mechanism (or q to save and stop):
```

Type the basename you copied, for example:

```text
Ptko4.mp4
```

`mechanism` binds to `Ptko4.mp4` by the name you enter, not by copy order or
directory sort.

Then:

- `Clip start in seconds [0]:` — Enter for `0`
- `Crop position x% y% [50% 50%]:` — Enter for `50% 50%`
- Watch the portrait still and the **used-interval** motion preview (opening also
  previews the **outro** interval from the same file)
- `Does this exact crop show the required action with consistent continuity? [y/n/q]`
- `Briefly describe the observed action:`

Each approved assignment is saved immediately.

### Invalid files, pause, replace

- A bad filename, missing file, non-decodable MP4, too-short selected interval,
  reserved `output.mp4`, or a duplicate of another story clip **retries the same
  scene**. The previous valid approval for a different scene is kept.
- Enter `q` on filename, trim, crop, confirm, observed action, or replace to
  **save and stop**. Exit is 0 with `Status: awaiting-assets` and the remaining
  scene IDs. Resume later; completed script/TTS work and earlier approvals stay.
- After all five are approved, the map is printed (`sceneId: fileName`). Enter a
  scene ID (`contradiction`, `clue`, `mechanism`, `second_reveal`, `payoff`) to
  replace that video, or press Enter to render. A replacement is kept only after
  the new file is approved; declining a candidate leaves the old valid binding.
- Missing or changed bytes on resume clear **only that scene's** approval.

When render succeeds, the CLI prints `Done: …/output.mp4` and the manifest path.

## Six-second sources versus shorter used duration

Six seconds is the **requested source length**. Displayed scenes follow measured
voice and are usually shorter (opening at most 6.0s of source; later scenes at
most 5.8s of source after the six-frame transition). Import accepts a decodable
MP4 that covers the reviewed interval from your trim start. A clip a little
off of exactly six seconds is fine if it still covers that interval. The program
does not loop, freeze, slow, speed, or truncate speech to fit a short file.

The channel **outro reuses the opening** animation. The opening file must cover
both the opening used interval and the outro used interval. Payoff keeps its own
clip.

Imported videos are **muted**. Narration, karaoke and local BGM come from the
existing voice/music path, not from Grok audio.

Final target is 25–29 seconds including the configured sign-off, hard maximum 30,
1080×1920 at 30fps, no dark wash.

## Keys and engines

| Engine | How | Pexels |
| --- | --- | --- |
| V3 (default) | `npm run generate -- "<topic>" "<brief>"` | Required |
| V4 | `CONTENT_ENGINE_VERSION=v4` plus a reviewed brief path | Required |
| V5 | `CONTENT_ENGINE_VERSION=v5` plus a reviewed brief path | **Not required** |

Selected `SCRIPT_PROVIDER` / `VOICE_PROVIDER` credentials remain required for V5.
A Grok subscription does not replace them. Set `CONTENT_ENGINE_VERSION=v5` in the
shell (or temporarily in `.env`); leave the committed `.env.example` default at
`v3`.
