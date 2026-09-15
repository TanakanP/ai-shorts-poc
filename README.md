# AI Shorts POC

Generate one vertical Tell Me Whyyyyyy Short from a topic and creative brief. The local
pipeline creates a retention-v3 video plan, synthesizes spoken narration, downloads stock
footage from Pexels, and renders an MP4 with Remotion.

## Requirements

- Node.js 22+
- npm
- Pexels API key
- API keys for the selected script and voice providers

## Setup

1. Install dependencies: `npm install`
2. Create a local environment file: `cp .env.example .env`
3. Add `PEXELS_API_KEY`, `CHANNEL_BRAND`, `CHANNEL_SIGNOFF`, and the keys for your selected providers to `.env` (see below).
4. Run the offline test suite: `npm test`
5. Generate a short with a topic and a **creative brief** (tone, audience, angle, proof, bans, optional content pattern):

```bash
npm run generate -- "<topic>" "<creative brief>"
```

The second argument is required for retention-v3 planning (at least 5 characters). See `misc/v1_1_content_enhance.md` for how to write a brief.

## Choosing providers

Set these independently in `.env`; existing installations keep OpenAI scripts and xAI voice by default:

```dotenv
SCRIPT_PROVIDER=openai
VOICE_PROVIDER=xai
```

| Setting | Choices | Required settings |
| --- | --- | --- |
| `SCRIPT_PROVIDER` | `openai` (default) | `OPENAI_API_KEY` |
| | `xai` | `XAI_API_KEY`; optional `XAI_SCRIPT_MODEL` (default `grok-4.3`) |
| `VOICE_PROVIDER` | `xai` (default) | `XAI_API_KEY`; optional `XAI_VOICE_ID` (default `eve`; keep your existing `helix` setting if preferred) |
| | `elevenlabs` | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`; optional `ELEVENLABS_MODEL` (default `eleven_multilingual_v2`) |

For Grok scripts with ElevenLabs narration:

```dotenv
SCRIPT_PROVIDER=xai
VOICE_PROVIDER=elevenlabs
XAI_API_KEY=your_xai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_selected_voice_id
```

Use a voice ID available to your ElevenLabs account, not its display name. The existing xAI key must permit the chosen text model and endpoint. Only selected providers need keys; Pexels and channel settings remain required. Normal generate commands are unchanged. Provider failures stop the run rather than silently switching services.

Both script providers use the same hook/story schemas, validation and deterministic hook selection. ElevenLabs uses its timestamp endpoint and MP3 44.1 kHz/128 kbps output, converts character timing to captions, and measures actual audio duration locally. It removes the supported xAI speech tags instead of reading them aloud; expressive delivery can therefore differ. Voice speed remains 1.2x, and the local 1.6-second outro “why” extension applies to both voices.

References: [xAI structured output](https://docs.x.ai/developers/model-capabilities/text/structured-outputs), [ElevenLabs speech with timing](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps), [ElevenLabs speed](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/can-i-change-the-pace-of-the-voice).

Provider routing, request/response handling, timing conversion and validation are covered offline. Account access and real voice delivery still need a live run with your selected credentials.

## Retention v3 behavior

- Channel generation identity: **Tell Me Whyyyyyy**
- Public CLI: two arguments, `topic` + `creative brief`
- Exactly **3 hook candidates** (`hook-a`, `hook-b`, `hook-c`)
- Code selects the winner: total score, then clarity, visualizability, stopScroll, then id
- Five story roles: `hook` → `context` → `curiosity-reset` → `mechanism` → `payoff`
- `curiosity-reset` is mandatory (second curiosity gap)
- `spokenText` is narration/TTS; `displayText` is the large on-screen card (max 9 words)
- Karaoke captions still follow TTS word timings
- Story duration is validated at 20–26 seconds (26s max so a 4s outro stays ≤ 30s). Prompts prefer 22–26 seconds
- Ordered Pexels resolution is unchanged: per query, portrait then landscape; `selectedSearchQuery` is persisted
- Artifacts: `runs/<run-id>/plan.json`, `resolved.json`, `run.json`, `output.mp4`

## Acceptance commands

```bash
npm run generate -- \
  "A Runway Can Change Its Number Without Moving" \
  "Pattern: BALANCED_REVEAL. Tone: aviation mind-bender with a clean visual reveal. Audience: U.S. travelers. Angle: the runway stays physically fixed while magnetic heading changes can force a new number. Hook must preserve the contradiction. Proof: show runway markings and magnetic heading drift. Ban fake thresholds and jargon. Close: the runway stayed still; the planet changed the number. Facts fence: verify FAA runway-numbering guidance."

npm run generate -- \
  "Costco Isn't Just Checking Whether You Paid" \
  "Pattern: FAMILIARITY_TWIST. Tone: confident retail-insider. Audience: Americans who shop at Costco. Angle: receipt checks are not only about theft; they can also catch checkout errors. Hook must challenge the obvious security explanation. Proof: receipt, cart, item-count or expensive-item check. Curiosity reset must reveal the customer-side consequence. Ban fake theft statistics and universal procedure claims. Close: one last audit at the exit. Facts fence: verify Costco policy and separate official practice from anecdotes."

npm run generate -- \
  "A $40 Fill-Up Can Lock $100+ on Your Card" \
  "Pattern: PERSONAL_STAKES. Tone: urgent money mystery that becomes reassuring. Audience: U.S. drivers. Angle: pay-at-pump authorization can temporarily reserve more than the final fuel purchase. Hook must lead with the $40 versus $100+ consequence. Proof: authorization before fuel total, then final settlement. Curiosity reset must clarify that the larger pending amount is not necessarily the final charge. Ban universal hold amounts/durations and financial advice. Close: it is a temporary placeholder for a bill that did not exist yet. Facts fence: verify merchant/card preauthorization practice and issuer variation."
```

Reusable constants live in `tests/fixtures/v3-acceptance.ts`.

## Human review rubric

For each acceptance video:

- A. First spoken claim is understandable within ~2 seconds
- B. First visual identifies the subject/environment without relying on narration
- C. Display copy can be read without pausing
- D. Hook creates curiosity without explaining the full mechanism
- E. Context adds information rather than rephrasing the hook
- F. Curiosity-reset creates a real second unanswered thought
- G. Mechanism delivers the promised proof/reason
- H. Payoff resolves and reframes rather than summarizes
- I. Spoken copy sounds like a person, not five thumbnail headlines
- J. At least 4/5 selected clips are semantically relevant
- K. No obvious blank, black, clipped, or broken visual frames
- L. Channel outro remains separate from story copy
- M. No manual editing is required between CLI command and final MP4

A–I and K–M must pass. J must be at least 4/5 scenes.

## Failure classification

Classify **one primary failure** before changing code. Fix the smallest responsible layer.

```text
HOOK_GENERATION
HOOK_SELECTION
FIRST_FRAME
CURIOSITY_RESET
STORY_REPETITION
STORY_PACING
SPOKEN_COPY
DISPLAY_COPY
VISUAL_QUERY
PEXELS_MATCH
TEXT_READABILITY
RENDERING
```

This pipeline does not ingest analytics, auto-regenerate, schedule posts, or score topics at runtime.

## Expected output

The rendered video is written to:

```text
runs/<run-id>/output.mp4
```

The plan is five V3 story beats plus a 4-second channel outro. `plan.json` stores all three hooks, scores, totals, `selectedHookId`, and spoken/display copy. `run.json` stores selection, duration, and word-count diagnostics. Stock clips stay unique per educational scene and prefer ordered Pexels queries from the plan.
The MP4 includes spoken narration, a large `displayText` card, and one-word replacement captions from TTS word timings (the separate outro retains its two-line treatment). Footage has **no dark wash**. Type is **Montserrat Black** with a black stroke.
A quiet looping music bed (`assets/music/SOUNDTRACK.mp3`, overridable with `BACKGROUND_MUSIC_PATH`) plays under the voice.
A final **channel-outro** scene speaks **`CHANNEL_BRAND` then `CHANNEL_SIGNOFF`** as two stacked lines (keeps the brand's `?` / `!` / `.` if you set one) and reuses the opening clip so replay loops to the start. The last story beat keeps its own script and footage. Creator and source attribution is recorded in `run.json`. Manually review the rendered video for factual accuracy, caption timing, legibility, footage relevance, and narration before any public upload. Before publishing, re-check Pexels attribution and link-back requirements and decide where the public-facing attribution will live.

## Footage review

Run `npm run generate -- "<topic>" "<creative brief>"` in an interactive terminal.
After voice synthesis, each stock candidate shows the scene's visual intent, required
objects, Pexels page and playable video link. Open the preview and enter `y` to use it,
`n` to try another clip, or `q` to stop. Accept only footage that actually shows the
required object/action. The outro reuses the approved opening clip.

Review tries the ordered portrait queries before landscape queries. Rejected clips
are not shown again for that scene. If nothing is approved, generation stops with the
missing scene and required shot instead of using a fallback. Refine the brief/search
queries and retry; this small workflow does not resume a stopped run. Voice generation
has already happened at this point, so a fresh run will incur generation/TTS costs again.

For gas-pump shutoff, a generic station or laboratory tube is not proof of the nozzle
sensing hole or shutoff mechanism. Stop if that proof shot is unavailable. Approval is
manual: URL scoring only orders candidates and cannot establish visual relevance.
The lower-level resolver retains automatic selection for existing programmatic callers
that omit the review callback; the normal CLI always requires review.

The synthesized timeline must be 15–35 seconds, including every scene's 0.3-second
padding and the spoken channel outro. An overlong result stops during voice synthesis,
before stock review or rendering, with its measured duration and a request to shorten
the script/sign-off. Audio is not truncated or automatically accelerated. This total
limit does not yet enforce a separate hook-duration limit.

Story captions show one white word at a time, retaining punctuation and the existing
position/font. Gaps up to 150 ms hold the preceding word; longer pauses and the end
of speech clear the caption. The hook display card and separate outro are unchanged.

Hook generation aims for 6–10 spoken words and rejects candidates over 12 words
(excluding delivery tags and caption separators). The three prompts explore a
contradiction, a consequence and a visible mystery where the brief supports them.
Story guidance follows one concrete example through the reset and proof. These are
editorial directions, not verified novelty or calibrated audience predictions; the
existing deterministic score-based selection remains unchanged. Word count alone
does not guarantee a 2–3-second spoken hook.

Each completed render also saves `thumbnail.jpg` beside `output.mp4`: the first frame of the finished video at its original resolution.
# V4 content generation (opt-in)

V4 adds five declarative hook candidates, reviewed source-backed briefs, visual proof
approval before final scripting/TTS, a distinct second reveal, and a 25–29-second
final-video target (hard maximum 30). Voice, karaoke, music and the channel sign-off
remain. V3 is still the default until two real V4 samples pass review.

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/road-sign-retroreflection.json npm run generate -- "Road Signs Shine by Throwing Your Headlights Back" "Use the reviewed brief"
CONTENT_ENGINE_VERSION=v3 npm run generate -- "topic" "creative brief"
```

Run from an interactive terminal. V4 first shows the proposed hook/package, then
asks how to search Pexels for each unfinished scene: press Enter/1 to use the
suggested keywords, or 2 to type your own (separate alternative phrases with `;`).
Manual keywords replace the suggested terms for that scene's search.
After downloading a candidate, V4 prints the original video path and source link.
Watch it and answer whether it contains the required object/action. Rejecting it
skips start/crop questions and tries another candidate. Only accepted candidates
ask for start time and crop, then show portrait stills and motion previews for final
approval. This final check confirms the detail survived the crop. Approved scenes
are reused on resume without asking for search or review again. Missing proof holds
the topic before speech synthesis. The final story is reviewed before narration.

The 16 current unposted briefs and per-topic commands are in [content/v4/README.md](content/v4/README.md). Each has stable topic ID, source-backed
facts, factual boundaries and workbook title/description seeds with documented factual corrections. A file brief
is treated as reviewed content; its topic must match the command. Without a file,
the existing creative-brief argument must contain sources, and the interpreted
claim/source mapping requires review. The generator does not browse those URLs.
The old workbook commands do not include the title/description columns; use the
brief path to preserve that metadata. The original workbook is unchanged.

To supply genuine local footage, add `localProof` entries to a brief, with `beatId`
(`contradiction`, `clue`, `mechanism`, `second_reveal`, or `payoff`), `path`,
`licenseNote`, `trimStartSec` and `cropPosition` (for example `"50% 50%"`). Paths are
relative to the JSON file. Each story scene needs a distinct clip under the current
footage policy; only the channel outro deliberately reuses the opening. Local clips
still require crop/action review. Do not put unlicensed source-page media in a brief.

Each V4 run saves `brief.json`, package attempts and decisions, `proof.json`,
`content-plan.json`, `voice.json`, `resolved.json`, timing attempts, and a
`generation-manifest.json` beside the MP4 in `runs/<runId>/`. Holds/failures retain
their stage and reason. A timing rewrite is limited to one; unchanged speech is
reused. There is no automatic speech speed-up or proof-action looping. Final timing
includes per-scene pads, frame rounding and the outro, and is checked against the
encoded MP4. A 29–30-second or short result needs an explicit timing-review reason.

Implementation/research: `docs/superpowers/plans/2026-09-12-content-v4-plan.md` and
`docs/content-v4/research-and-topic-review.md`. Publishing and analytics are outside
this local prototype.

### Resume an interrupted V4 run

New V4 runs print their resume command before generation starts:

```sh
CONTENT_ENGINE_VERSION=v4 npm run generate -- --resume runs/<runId>
```

This reuses the run's saved brief, package, successful approvals, individual approved
footage choices, story and completed narration. It continues with the unfinished work;
missing footage is reviewed again and missing audio is regenerated. A timing revision
with changed content needs its own approval. Keep the original voice, channel and music
settings. Resume uses the saved brief rather than rereading an edited topic JSON.
If narration failed partway through synthesis, that incomplete narration stage is retried.
The final render is retried rather than resumed frame by frame.

Runs created before resumable checkpoints were added cannot reliably restore all
approvals. Their existing diagnostic files are retained, but do not count as recorded
approval checkpoints. No automatic approval is inferred from an unapproved draft.

V4 opening titles now carry yellow emphasis words through to the renderer. Older story
plans without keyword metadata fall back to the last meaningful title word, preserving
the approved title text.
