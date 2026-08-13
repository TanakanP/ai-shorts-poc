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
3. Add `OPENAI_API_KEY`, `PEXELS_API_KEY`, and `XAI_API_KEY` (and optional `XAI_VOICE_ID`) to `.env`.
4. Run the offline test suite: `npm test`
5. Generate a short: `npm run generate -- "Why supermarkets put milk at the back"`

## Expected output

The rendered video is written to:

```text
runs/<run-id>/output.mp4
```

The MP4 includes spoken narration. The same run directory contains intermediate JSON artifacts,
per-scene voice clips, and downloaded scene footage for local debugging. Creator and source
attribution is recorded in `run.json`. Manually review the rendered video for factual accuracy,
legibility, footage relevance, and narration before any public upload. Before publishing,
re-check Pexels attribution and link-back requirements and decide where the public-facing
attribution will live.
