# One-Word Replace Captions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current full-sentence title cards with one spoken word at a time, held until the next word starts, using timestamps already stored in `voice.json`.

**Architecture:** Keep TTS and `voice.json` unchanged. Copy each scene’s `words` onto `ResolvedScene` in `create-short`. A pure `activeWordAt(words, timeMs)` picks the live word. Render that word on the **voice timeline** (not the overlapped visual scene timeline) so caption time matches the MP3. Drop `layoutSceneText` from `Scene.tsx`.

**Tech Stack:** Existing TypeScript, Vitest, Remotion. No `@remotion/captions`. No new npm dependency.

---

## Locked decisions

- Style is **replace**, not karaoke and not accumulate: `Did` then `you` then `ever`.
- Hold word `i` from `words[i].startMs` until `words[i+1].startMs`. After the last word, hold until the scene ends.
- Before the first word starts, show nothing.
- Empty `words` fails the run at merge. Do not fall back to `scene.text`.
- Punctuation stays on the token (`reason,`, `accident.`).
- Captions live on `createVoiceTimeline` so frame 0 is audio start. Visual fades may still overlap; words must not start early during the 6-frame overlap.
- One typeface, one color (`#f5f5f5`), no bounce, no stroke, no highlight.
- Composition id stays `SilentShort`.
- No music, no YouTube, no karaoke pager.

## Out of scope

Karaoke highlight, accumulating phrases, `@remotion/captions`, YouTube caption tracks, per-word scale animation, deleting `text-layout.ts`.

## File structure

```text
AGENTS.md
src/domain/resolved-video.ts          # words: VoiceWord[]
src/captions/active-word.ts           # activeWordAt
src/captions/word-layout.ts           # layoutSpokenWord
src/pipeline/create-short.ts          # copy words; reject empty
src/remotion/WordCaption.tsx          # one word
src/remotion/Scene.tsx                # video + dim only
src/remotion/ShortComposition.tsx     # WordCaption on voice sequences
src/remotion/Root.tsx                 # fixture words
scripts/smoke-render.ts               # fixture words
tests/captions/active-word.test.ts
tests/captions/word-layout.test.ts
tests/pipeline/create-short.test.ts
tests/cli.test.ts                     # compile-only words
tests/remotion/*.ts
```

`StockScene` stays audio-and-words free:

```ts
export type ResolvedScene = VideoScene & {
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
  localVideoPath: string;
  localAudioPath: string;
  audioDurationSeconds: number;
  words: VoiceWord[];
};

export type StockScene = Omit<
  ResolvedScene,
  'localAudioPath' | 'audioDurationSeconds' | 'words'
>;
```

---

### Task 1: Allow captions in the project contract

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Replace AGENTS.md**

```md
# Project Instructions

This project implements voiced AI Shorts with one-word replace captions.

Primary implementation plan:
docs/superpowers/plans/2026-08-15-word-replace-captions.md

Rules:
- Follow the implementation plan task-by-task and in order.
- Use test-driven development.
- Do not add features outside the captions plan.
- Output is still a locally rendered MP4.
- No YouTube upload.
- No background music.
- No karaoke or accumulating captions.
- No scheduler.
- No database.
- No analytics.
- Keep modules small and independently testable.
- Run tests after every task.
- Commit after each completed task.
- Never put API keys in source control.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: point agents at one-word caption plan"
```

---

### Task 2: Pure active-word picker

**Files:**
- Create: `src/captions/active-word.ts`
- Test: `tests/captions/active-word.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import {describe, expect, it} from 'vitest';
import {activeWordAt} from '../../src/captions/active-word';
import type {VoiceWord} from '../../src/domain/voice';

const words: VoiceWord[] = [
  {text: 'Did', startMs: 80, endMs: 260},
  {text: 'you', startMs: 300, endMs: 420},
  {text: 'ever', startMs: 480, endMs: 700},
  {text: 'wonder', startMs: 760, endMs: 1100},
];

describe('activeWordAt', () => {
  it('returns null before the first word starts', () => {
    expect(activeWordAt(words, 79)).toBeNull();
  });

  it('returns the first word at its start', () => {
    expect(activeWordAt(words, 80)).toBe('Did');
  });

  it('holds a short word until the next word starts', () => {
    expect(activeWordAt(words, 280)).toBe('Did');
    expect(activeWordAt(words, 299)).toBe('Did');
    expect(activeWordAt(words, 300)).toBe('you');
  });

  it('holds the last word after its endMs', () => {
    expect(activeWordAt(words, 2000)).toBe('wonder');
  });

  it('keeps punctuation on the token', () => {
    expect(activeWordAt([{text: 'reason,', startMs: 0, endMs: 200}], 50)).toBe('reason,');
  });

  it('returns null for an empty word list', () => {
    expect(activeWordAt([], 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/captions/active-word.test.ts
```

Expected: FAIL because `activeWordAt` does not exist.

- [ ] **Step 3: Implement**

`src/captions/active-word.ts`:

```ts
import type {VoiceWord} from '../domain/voice';

export function activeWordAt(words: readonly VoiceWord[], timeMs: number): string | null {
  if (words.length === 0) return null;
  const first = words[0];
  if (!first || timeMs < first.startMs) return null;

  let current = first.text;
  for (const word of words) {
    if (timeMs >= word.startMs) current = word.text;
    else break;
  }
  return current;
}
```

Assume `words` are in start order as written by TTS. Do not sort.

- [ ] **Step 4: Verify**

```bash
npm test -- tests/captions/active-word.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/captions/active-word.ts tests/captions/active-word.test.ts
git commit -m "feat: pick the spoken word held until the next starts"
```

---

### Task 3: Single-word layout

**Files:**
- Create: `src/captions/word-layout.ts`
- Test: `tests/captions/word-layout.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import {describe, expect, it} from 'vitest';
import {layoutSpokenWord} from '../../src/captions/word-layout';

describe('layoutSpokenWord', () => {
  it('uses 120px for short words', () => {
    expect(layoutSpokenWord('Did')).toEqual({fontSize: 120});
    expect(layoutSpokenWord('accident.')).toEqual({fontSize: 120});
  });

  it('uses 96px for mid-length words', () => {
    expect(layoutSpokenWord('supermarket')).toEqual({fontSize: 96});
  });

  it('uses 72px for long words', () => {
    expect(layoutSpokenWord('misunderstandings')).toEqual({fontSize: 72});
  });

  it('rejects blank text', () => {
    expect(() => layoutSpokenWord('   ')).toThrow(/blank/i);
  });
});
```

Tiers: length `<= 10` → 120; `11..16` → 96; otherwise 72. Measure `text.length` including punctuation.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/captions/word-layout.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement**

`src/captions/word-layout.ts`:

```ts
export type SpokenWordLayout = {
  fontSize: number;
};

export function layoutSpokenWord(text: string): SpokenWordLayout {
  if (!text.trim()) throw new Error('Spoken word cannot be blank');
  if (text.length <= 10) return {fontSize: 120};
  if (text.length <= 16) return {fontSize: 96};
  return {fontSize: 72};
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/captions
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/captions/word-layout.ts tests/captions/word-layout.test.ts
git commit -m "feat: size one-word captions by character length"
```

---

### Task 4: Attach words to resolved scenes

**Files:**
- Modify: `src/domain/resolved-video.ts`
- Modify: `src/pipeline/create-short.ts`
- Modify: `tests/pipeline/create-short.test.ts`
- Modify: `tests/cli.test.ts`
- Modify: `tests/remotion/composition.test.ts`
- Modify: `tests/remotion/render-short.test.ts`
- Modify: `src/remotion/Root.tsx`
- Modify: `scripts/smoke-render.ts`

Stock tests stay unchanged.

- [ ] **Step 1: Write the failing merge test**

In `tests/pipeline/create-short.test.ts`:

1. Add `words` to each `voiceResult.manifest.scenes` entry (they already have `words` with a first-token stub). Keep that.
2. Extend `resolvedScenes` so each scene includes `words: voiceResult.manifest.scenes[index].words`.
3. Add a new test after the success case:

```ts
it('fails stock-resolution when a voice scene has no words', async () => {
  const events: string[] = [];
  const {deps} = fakeDeps(events);
  const empty = {
    ...voiceResult,
    manifest: {
      ...voiceResult.manifest,
      scenes: voiceResult.manifest.scenes.map((scene, index) =>
        index === 0 ? {...scene, words: []} : scene,
      ),
    },
  };
  deps.synthesizeSceneVoices = async () => empty;

  await expect(createShort(topic, deps)).rejects.toThrow(/words/i);
  expect(events).toContain('persist run.json:failed');
});
```

To make `fakeDeps` overwriteable, change `const deps` to `let deps` or return a mutable object (it already returns `{deps}` — assign `deps.synthesizeSceneVoices` after). TypeScript allows replacing the function property.

Also add compile-only `words: [{text: 'Hello', startMs: 0, endMs: 400}]` to every other `ResolvedScene` literal so `tsc` can pass after the type change.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/pipeline/create-short.test.ts
```

Expected: FAIL because `words` is not copied / empty words do not throw.

- [ ] **Step 3: Implement domain + merge**

`src/domain/resolved-video.ts`:

```ts
import type {VideoScene} from './video-plan.js';
import type {VoiceWord} from './voice.js';

export type ResolvedScene = VideoScene & {
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
  localVideoPath: string;
  localAudioPath: string;
  audioDurationSeconds: number;
  words: VoiceWord[];
};

export type StockScene = Omit<
  ResolvedScene,
  'localAudioPath' | 'audioDurationSeconds' | 'words'
>;

export type ResolvedVideo = {
  runId: string;
  title: string;
  fps: 30;
  width: 1080;
  height: 1920;
  scenes: ResolvedScene[];
};
```

In `create-short.ts` merge:

```ts
if (!voice || voice.sceneId !== scene.id) {
  throw new Error(`Voice manifest missing scene ${scene.id}`);
}
if (voice.words.length === 0) {
  throw new Error(`Voice manifest has no words for scene ${scene.id}`);
}
return {
  ...scene,
  localAudioPath: voice.localAudioPath,
  audioDurationSeconds: voice.audioDurationSeconds,
  words: voice.words,
};
```

Add `words` to Root, smoke, CLI, remotion fixtures:

```ts
words: [{text: 'Hello', startMs: 0, endMs: 400}],
```

Smoke may use a few words so a 5s render changes on screen:

```ts
words: [
  {text: 'A', startMs: 0, endMs: 200},
  {text: 'five-second', startMs: 400, endMs: 1200},
  {text: 'smoke', startMs: 1400, endMs: 2000},
  {text: 'render.', startMs: 2200, endMs: 3000},
],
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/pipeline/create-short.test.ts tests/stock tests/cli.test.ts
npm run typecheck
```

Expected: PASS. Stock tests still have no `words`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/resolved-video.ts src/pipeline/create-short.ts tests/pipeline/create-short.test.ts tests/cli.test.ts tests/remotion src/remotion/Root.tsx scripts/smoke-render.ts
git commit -m "feat: copy spoken words onto resolved scenes"
```

Only stage files that actually changed.

---

### Task 5: Render one word on the voice timeline

**Files:**
- Create: `src/remotion/WordCaption.tsx`
- Modify: `src/remotion/Scene.tsx`
- Modify: `src/remotion/ShortComposition.tsx`
- Test: `tests/remotion/word-caption.test.ts`

- [ ] **Step 1: Write failing caption-time tests**

`tests/remotion/word-caption.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {captionTimeMs} from '../../src/remotion/WordCaption';

describe('captionTimeMs', () => {
  it('converts composition frames to milliseconds', () => {
    expect(captionTimeMs(0, 30)).toBe(0);
    expect(captionTimeMs(15, 30)).toBe(500);
    expect(captionTimeMs(30, 30)).toBe(1000);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/remotion/word-caption.test.ts
```

Expected: FAIL because `captionTimeMs` is not exported.

- [ ] **Step 3: Implement caption UI and strip title cards**

`src/remotion/WordCaption.tsx`:

```tsx
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {activeWordAt} from '../captions/active-word';
import {layoutSpokenWord} from '../captions/word-layout';
import type {ResolvedScene} from '../domain/resolved-video';

export const captionTimeMs = (frame: number, fps: number): number =>
  Math.round((frame / fps) * 1000);

export const WordCaption = ({scene}: {scene: ResolvedScene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const word = activeWordAt(scene.words, captionTimeMs(frame, fps));
  if (!word) return null;
  const {fontSize} = layoutSpokenWord(word);

  return (
    <AbsoluteFill
      style={{
        zIndex: 2,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '360px 86px 440px',
      }}
    >
      <div
        style={{
          color: '#f5f5f5',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize,
          fontWeight: 700,
          lineHeight: 1.04,
          textAlign: 'center',
        }}
      >
        {word}
      </div>
    </AbsoluteFill>
  );
};
```

In `ShortComposition.tsx`, put `WordCaption` **inside the voice `Sequence`**, next to `Html5Audio`:

```tsx
<Sequence key={`${scene.id}-voice`} from={from} durationInFrames={voiceDuration} name={`${scene.id}-voice`}>
  <Html5Audio src={getVideoSource(scene.localAudioPath, assetBaseUrl, localAssetPaths)} />
  <WordCaption scene={scene} />
</Sequence>
```

In `Scene.tsx` delete `layoutSceneText`, the text `AbsoluteFill`, and `textProgress`. Keep the video, dim overlay, Ken Burns, and scene fade. Remove the unused `layoutSceneText` import.

Do not delete `src/remotion/text-layout.ts` or its tests.

- [ ] **Step 4: Verify**

```bash
npm test -- tests/remotion tests/captions
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/remotion/WordCaption.tsx src/remotion/Scene.tsx src/remotion/ShortComposition.tsx tests/remotion/word-caption.test.ts
git commit -m "feat: show one spoken word at a time"
```

---

### Task 6: Docs and smoke check

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the caption style**

In README expected-output (or a short “What you get” paragraph), state that on-screen text is one spoken word at a time, timed to the voice, and that the MP4 should still be reviewed before any public upload.

- [ ] **Step 2: Run offline gates**

```bash
npm test
npm run typecheck
npm run smoke:render
```

Expected: tests and typecheck PASS. `runs/smoke/output.mp4` exists. Watch or `ffprobe` to confirm audio remains muxed.

Optional if keys exist:

```bash
npm run generate -- "Why supermarkets put milk at the back"
```

Watch the MP4 muted-off: each spoken word replaces the previous; `is` / `a` / `the` stay until the next word; no full-sentence card; no word during the first ~80ms of a scene if TTS has lead-in.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe one-word replace captions"
```

---

## Exit criteria

- `activeWordAt` holds until the next `startMs`.
- Remotion shows at most one word.
- Title cards are gone.
- Captions share the voice timeline clock.
- `resolved.json` includes `words`.
- Empty words fail the run.
- No karaoke, music, or YouTube code.
- `npm test` and `npm run typecheck` pass.

## Follow-up (do not implement here)

Background music. YouTube upload.
