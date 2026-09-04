# Plainly Curious Retention V2 Design

**Status:** Approved direction from the Plainly Curious content review on 2026-08-20.

## Problem

The v1 POC proves that the system can automatically turn a topic into a rendered vertical Short, but the first published results look too much like generic AI fact videos. The current first beat often restates the title as a question, footage can be only loosely related to the subject, text is long and subtitle-like, and 30–45 second pacing is too slow for the current no-voice format.

This iteration optimizes the generated video itself rather than posting time or upload automation.

## Goal

Produce a 20–25 second silent Short that creates a curiosity gap immediately, delivers five escalating story beats, uses much shorter on-screen text, and tries multiple subject-specific stock-footage queries per beat before falling back.

## Story Format

Every video has exactly five beats in this order:

1. `hook` — a declarative pattern interrupt; do not simply ask the title question.
2. `escalation` — make the claim more interesting or raise the stakes.
3. `mechanism` — explain the core reason or system.
4. `twist` — add evidence, a counterintuitive detail, or a second-order effect.
5. `payoff` — resolve the curiosity gap with a concise conclusion; no subscribe/follow CTA.

Each beat lasts 4–5 seconds, making the complete video 20–25 seconds.

The hook must not begin with generic question phrasing such as “Why…”, “How…”, “What…”, or “Ever wonder…”. It should sound like a claim worth proving. Examples of desired shape, not hard-coded copy:

- “IKEA actually wants you to get lost.”
- “Square airplane windows helped cause deadly crashes.”
- “Your supermarket may be making you walk farther on purpose.”

## On-Screen Copy

Each beat uses 3–9 words of primary text. The copy should be understandable without audio, but it is intentionally compressed rather than written like subtitles.

The generator may mark up to two exact words or short tokens from the beat text for yellow emphasis. All other text remains white.

Each beat must introduce new information. Rephrasing the previous beat is a generation failure.

## Visual Intent and Search

Each beat contains:

- one human-readable `visualIntent` describing the exact scene we want,
- 2–3 ordered Pexels search queries,
- the first query as the most specific useful query,
- broader fallbacks only after the specific query.

Example:

```json
{
  "visualIntent": "Customer walking through a supermarket dairy aisle toward milk refrigerators",
  "searchQueries": [
    "supermarket milk aisle",
    "grocery dairy aisle customer",
    "supermarket refrigerator milk"
  ]
}
```

The resolver tries all portrait queries in order before trying landscape queries. The selected query is persisted for debugging.

For named places or brands, the first query should contain the named entity when it is useful for search, with a non-branded environment fallback. The system must not fall back immediately to abstract or visually generic searches such as `consumer psychology`, `business strategy`, or `person walking hallway`.

## Rendering Style

- 1080×1920, 30 FPS, H.264 MP4.
- Exactly five visual beats.
- Hard cuts between beats; remove long crossfades that slow the video down.
- Full-frame stock footage with `object-fit: cover` and subtle 1.00→1.06 motion.
- Dark readability overlay behind text.
- Text occupies a large safe central/lower-middle region, not a tiny subtitle strip.
- Hook is visually largest.
- 1–2 emphasized words may use the existing Plainly Curious yellow.
- Text animation is fast: roughly 4–6 frames, not a slow reveal.
- No stickers, emojis, random transitions, or new visual-template system in this iteration.

## Domain Contract

The V2 plan replaces the v1 single-query scene contract with:

```ts
export type BeatRole =
  | 'hook'
  | 'escalation'
  | 'mechanism'
  | 'twist'
  | 'payoff';

export type VideoScene = {
  id: string;
  role: BeatRole;
  durationSeconds: 4 | 5;
  text: string;
  emphasisWords: string[];
  visualIntent: string;
  searchQueries: string[];
};

export type VideoPlan = {
  topic: string;
  researchQuery: string;
  title: string;
  viralAngle: string;
  scenes: VideoScene[];
};
```

Resolved scenes additionally persist `selectedSearchQuery` so poor footage can be traced back to the exact query that produced it.

## CLI

Preserve the current public command shape:

```bash
npm run generate -- "<Topic>" "<Research Query>"
```

This change must not introduce a new required CLI argument.

## Debug Artifacts

Every run keeps:

- `plan.json` — V2 angle, five beat roles, copy, visual intent, and all search queries.
- `resolved.json` — selected stock result and `selectedSearchQuery` for every beat.
- `run.json` — `formatVersion: "retention-v2"`, total duration, beat count, word counts, and selected queries.
- `output.mp4` — final video.

## Out of Scope

Do not add voiceover, YouTube upload, scheduler, analytics ingestion, automatic topic scoring, AI-generated video, new stock providers, a web UI, or multi-template support in this iteration.

## Acceptance Criteria

A generated V2 Short must satisfy all automatic rules:

- exactly five scenes,
- roles exactly `hook → escalation → mechanism → twist → payoff`,
- total duration 20–25 seconds,
- every scene 4–5 seconds,
- every on-screen text block 3–9 words,
- hook does not begin with generic title-question phrasing,
- every scene has 2–3 unique search queries,
- every scene has a non-empty visual intent,
- emphasis words, when present, exist in the displayed text,
- output remains 1080×1920 H.264 at 30 FPS.

For the real acceptance run, generate the three original topics: IKEA, airplane windows, and supermarket milk. Human review must confirm that at least four of five scenes per video are visually relevant, the first visual identifies the topic or environment immediately, copy is readable without pausing, and the five beats feel like one escalating story rather than five unrelated facts.
