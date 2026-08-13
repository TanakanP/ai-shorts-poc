# AI Shorts POC

Generate one silent, vertical educational short from a topic. The local pipeline creates a video
plan, downloads stock footage from Pexels, and renders an MP4 with Remotion.

## Requirements

- Node.js 22+
- npm
- OpenAI API key
- Pexels API key

## Setup

1. Install dependencies: `npm install`
2. Create a local environment file: `cp .env.example .env`
3. Add `OPENAI_API_KEY` and `PEXELS_API_KEY` to `.env`.
4. Run the offline test suite: `npm test`
5. Generate a short: `npm run generate -- "Why supermarkets put milk at the back"`

## Expected output

The rendered video is written to:

```text
runs/<run-id>/output.mp4
```

The same run directory contains intermediate JSON artifacts and downloaded scene clips for local
debugging. Creator and source attribution is recorded in `run.json`. Manually review the rendered
video for factual accuracy, legibility, and footage relevance before any public upload. Before
publishing, re-check Pexels attribution and link-back requirements and decide where the
public-facing attribution will live.
