# V5 pilot: four briefs, one post per day

Prepared 13 October 2026. These are source-checked V5 inputs for the first block of the editorial pilot. Target audience: global English-speaking viewers. Use the current V5 engine and manual Gemini/Google Flow import. Package, narration, prompt and actual asset review still happen during generation.

Post **one Short per day** in the order below, starting when the first video is ready. No start date or posting hour has been assumed. Use a comparable posting slot across the four days and record actual publication timestamps in Asia/Bangkok. These entries are a manual run order, not an upload schedule or scheduler.

| Day | Condition | Brief | YouTube title seed |
|---|---|---|---|
| 1 | A | [01-round-street-cover.json](01-round-street-cover.json) | That Round Street Cover Has a Job You Missed |
| 2 | B | [02-road-salt-subzero.json](02-road-salt-subzero.json) | Salt Can Melt Road Ice Below 0°C |
| 3 | C | [03-breakaway-sign-support.json](03-breakaway-sign-support.json) | That Road Sign Has a Safety Feature You Missed |
| 4 | D | [04-spillway-baffle-blocks.json](04-spillway-baffle-blocks.json) | Why This Dam Has Concrete Teeth |

A/B use familiar questions; C/D use less familiar components. A/C retain the agreed current title style; B/D use more concrete packaging. These are editorial labels, not verified demand or saturation categories. All four remain within infrastructure. Four different videos are an exploratory block, not a definitive causal A/B test.

## What each brief contains

Each JSON has a unique pilot topic ID, source-to-fact mapping, fact boundaries, title and description seeds, an opening candidate, five scene directions, photoreal subject continuity and the existing V5 timing requirements. The engine generates and reviews its five hook candidates; the suggested opening is not a locked or already evaluated package.

The protected second reveal uses fact ID `consequence`:

- **A:** the round cover can also be rolled on its edge. This is distinct from the geometry preventing it passing through its matching opening.
- **B:** crews can pre-wet the salt at the spinner so more adheres instead of bouncing away. This is distinct from lowering water's freezing point.
- **C:** overtightening the referenced base plates can stop correct release. This is distinct from the intended breakaway mechanism.
- **D:** the basin helps protect the downstream riverbed from erosion. This is distinct from what the blocks do to the incoming flow energy.

Keep voice, karaoke, local music, sign-off, five story assets and local MP4 rendering. Aim for the same 25–29-second range including sign-off. Do not change title/opening choices during the first seven days after publication. Generated clips illustrate the explanation; they are not footage of an actual experiment, collision or dam release.

## Run commands

Run these from the repository root in an interactive terminal. Each topic argument exactly matches its JSON. `FAST_MODE=false` enables the existing crop and motion review even if fast mode is enabled elsewhere.

### Day 1: That Round Street Cover Has a Job You Missed

```sh
CONTENT_ENGINE_VERSION=v5 FAST_MODE=false \
  CONTENT_BRIEF_PATH=content/v5/pilot-2026-10-13/01-round-street-cover.json \
  npm run generate -- 'A Round Street Cover Cannot Pass Through Its Matching Opening' 'Use the reviewed pilot brief'
```

### Day 2: Salt Can Melt Road Ice Below 0°C

```sh
CONTENT_ENGINE_VERSION=v5 FAST_MODE=false \
  CONTENT_BRIEF_PATH=content/v5/pilot-2026-10-13/02-road-salt-subzero.json \
  npm run generate -- 'Dissolved Road Salt Can Melt Ice Below Zero Degrees Celsius' 'Use the reviewed pilot brief'
```

### Day 3: That Road Sign Has a Safety Feature You Missed

```sh
CONTENT_ENGINE_VERSION=v5 FAST_MODE=false \
  CONTENT_BRIEF_PATH=content/v5/pilot-2026-10-13/03-breakaway-sign-support.json \
  npm run generate -- 'A Breakaway Road Sign Support Is Designed to Release at Its Base' 'Use the reviewed pilot brief'
```

### Day 4: Why This Dam Has Concrete Teeth

```sh
CONTENT_ENGINE_VERSION=v5 FAST_MODE=false \
  CONTENT_BRIEF_PATH=content/v5/pilot-2026-10-13/04-spillway-baffle-blocks.json \
  npm run generate -- 'Concrete Baffle Blocks Dissipate Spillway Energy Before It Reaches the Riverbed' 'Use the reviewed pilot brief'
```

Each first run stops at `awaiting-assets` after planning, voice/timing and prompt review. Generate the five Gemini stills and matching Flow clips using the saved prompt pack, then copy the MP4s into that run directory.

For resume, use the exact command printed for that run and explicitly keep `FAST_MODE=false` if your environment normally enables it. For example, replacing the placeholder with the actual printed directory:

```sh
CONTENT_ENGINE_VERSION=v5 FAST_MODE=false \
  CONTENT_BRIEF_PATH=content/v5/pilot-2026-10-13/01-round-street-cover.json \
  npm run generate -- --resume runs/ACTUAL_RUN_DIRECTORY
```

Use the corresponding brief path for Days 2–4. Resume imports and reviews the files before rendering; it does not publish. Existing V5 owner instructions are in [the V5 workflow guide](../README.md).

## Visual review priorities

- **A:** matching cover/frame proportions, intact seating lip, and a smaller clear opening. Handling uses a clearly recognizable small workshop prop. Do not show a heavy cover casually lifted on a live road.
- **B:** plausible partial melting, no invented thermometer reading, and pre-wetting the salt at the spinner rather than confusing it with direct road anti-icing. Say zero degrees Celsius in speech.
- **C:** one accurate rectangular slip-base support design across shots. Inspect the cited base/hinge references before approving imagery. Model motion must not look like documentary crash footage; give no bolt-adjustment instructions.
- **D:** blocks belong in the downstream stilling basin, with consistent flow direction and a visible outgoing channel. No generated disaster or claim of an actual release at Gross Dam.

Check the first frame on mute and the mechanism at the actual 9:16 crop and used interval. Readable files and sufficient duration do not establish factual visual accuracy.

## Source review

Sources checked 13 October 2026:

- **A:** [DomCast, circular-cover geometry, seating and rolling](https://www.domcastmetals.com/why-are-manhole-covers-round). This is a municipal castings supplier explanation, not a certification or a universal claim about every cover.
- **B:** [MnDOT maintenance FAQ](https://www.dot.state.mn.us/maintenance/faq.html), sections on salting, limitations, pre-wetting and pavement temperature. The pilot uses this accessible primary source instead of reusing the older batch's USGS link without checking its claims.
- **C:** [FHWA sign supports](https://highways.dot.gov/safety/local-rural/maintenance-signs-and-sign-supports/iv-sign-supports), especially the I-beam/slip-base explanation, and [TxDOT breakaway-post maintenance](https://www.txdot.gov/content/txdotoms/us/en/manuals/trf/smk/sign_maintenance/roadside_sign_supports-i1007283/breakaway_posts-i1002346.html) for overtightening.
- **D:** [Denver Water, Gross Dam baffle blocks](https://www.denverwater.org/tap/push-top-gross-dam-two-parts), and the [Bureau of Reclamation glossary](https://www.usbr.gov/library/glossary/), entries `Baffle block (dentate)` and `Stilling basin`. The operator photograph provides context; do not claim the generated illustration reproduces its site exactly.

Change claims or geometry only after source review. A schema pass does not certify generated visual truth or predict performance.

## Manual measurement

At **24 hours, 72 hours and seven days after each actual publication**, capture public views, engaged views, shown in feed, stayed to watch, average view duration, average percentage viewed, traffic-source mix, shares and subscriber metrics. Leave missing values blank. Record the actual title and opening along with condition A–D.

Compare equal elapsed ages. Review the first block after all four have their seven-day snapshots, and retain its observations for the six-block comparison. Do not declare a winning direction from one high-view upload. No analytics subsystem, automatic upload or reminder is added by these briefs.
