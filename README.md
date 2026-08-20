# AI Shorts POC

Generate one vertical educational short from a topic. The local pipeline creates a video
plan, synthesizes spoken narration, downloads stock footage from Pexels, and renders an MP4 with Remotion.

## Requirements

- Node.js 22+
- npm
- OpenAI API key
- Pexels API key
- xAI API key

## Setup

1. Install dependencies: `npm install`
2. Create a local environment file: `cp .env.example .env`
3. Add `OPENAI_API_KEY`, `PEXELS_API_KEY`, `XAI_API_KEY`, `CHANNEL_BRAND`, and `CHANNEL_SIGNOFF` (and optional `XAI_VOICE_ID`) to `.env`.
4. Run the offline test suite: `npm test`
5. Generate a short with a topic. An optional second argument is a **creative brief** (tone, audience, angle, proof, bans). See `misc/v1_1_content_enhance.md` for how to write one:

```bash
npm run generate -- "Why Supermarkets Put Milk at the Back"
npm run generate -- "Why Supermarkets Put Milk at the Back" "Tone: sly, like a friend who caught a trick. Audience: people who grocery shop on autopilot. Angle: the store is using your feet, not hiding milk. Hook must be a claim, not a why-question. Proof: the walk past snacks. Ban loading docks, cold-chain, and 'ever wonder'. Close: your walk is the product. No fake numbers."
```

## Expected output

The rendered video is written to:

```text
runs/<run-id>/output.mp4
```

The plan is **four educational scenes** (hook, stake, proof, payoff) plus a channel outro. Stock clips stay unique per educational scene and prefer ordered Pexels queries from the plan.
The MP4 includes spoken narration and on-screen captions that show **one model-marked clause at a time** (`|` in `scene.text`), with the **current word in yellow** (karaoke). Bars are stripped before TTS. Footage has **no dark wash**. Type is **Montserrat Black** with a black stroke at a fixed large size.
A quiet looping music bed (`assets/music/SOUNDTRACK.mp3`, overridable with `BACKGROUND_MUSIC_PATH`) plays under the voice.
A final **channel-outro** scene speaks **`CHANNEL_BRAND`. `CHANNEL_SIGNOFF`** and reuses the opening clip so replay loops to the start. The educational last scene keeps its own script and footage. The same run directory contains intermediate JSON artifacts, per-scene voice clips,
and downloaded scene footage for local debugging. Creator and source attribution is recorded in
`run.json`. Manually review the rendered video for factual accuracy, caption timing, legibility,
footage relevance, and narration before any public upload. Before publishing, re-check Pexels
attribution and link-back requirements and decide where the public-facing attribution will live.
