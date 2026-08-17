# Chunked Captions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop unbounded caption accumulate from shrinking type: grow a short 3–5 word window, then replace it with the next window, at a fixed large font.

**Architecture:** Keep `voice.json` word timings. Add a pure chunker that splits a scene’s `VoiceWord[]` into short windows using hard stops (`.?!`), soft stops (`,;:` after ≥ 3 words), a 5-word cap, and a 28-character cap. At time `t`, show only the current window’s already-started words. `WordCaption` renders that window. Do not change TTS, timeline, bookend, or loop fade.

**Tech Stack:** Existing TypeScript / Vitest / Remotion 4.0.509. No new dependencies.

---

## Locked decisions

1. **Window, not scene.** Accumulate inside one chunk. When the next chunk starts, replace the on-screen phrase. Do not show earlier chunks.
2. **Hybrid splits.** Start a new chunk before adding the next word when **any** of these is true:
   - **Hard stop** — previous token ends with `.` `?` `!`
   - **Soft stop** — previous token ends with `,` `;` `:` **and** the current chunk already has ≥ 3 words
   - **Word cap** — the current chunk already has **5** words
   - **Character cap** — joining the current chunk plus the next word with single spaces would exceed **28** characters
3. **Never drop a word.** A token longer than 28 characters still becomes its own chunk. An empty current chunk always accepts the next word.
4. **Keep punctuation.** Do not strip marks. `,` and `.` help the reader on short chunks.
5. **Fixed type.** `fontSize` is **72**. Delete shrink-to-fit (`layoutAccumulatedPhrase` and its 60/52 tiers). Two lines are allowed only if a single long token wraps.
6. **Timing.** Precompute chunks from the scene word list. At time `t`, pick the last chunk whose first word has `startMs <= t`, then keep words in that chunk with `startMs <= t`. The last word of a chunk stays on screen until the next chunk’s first `startMs`.
7. **Style inside a chunk.** Newest word opacity 1, earlier words in the same chunk 0.85. Montserrat Black, stroke, lower third, bookend, and loop fade stay as they are.

On the screenshot sentence `The longer your route, the more chances you have to add extras.`:

| Chunk | Text |
|---|---|
| 1 | `The longer your route,` |
| 2 | `the more chances you have` |
| 3 | `to add extras.` |

(Soft stop after `route,`; then word/char cap splits the second clause.)

## Out of scope

YouTube upload, background music, karaoke highlight, mark-stripping, changing TTS, changing scene duration, looping audio, changing the bookend or 8-frame fade, persistable chunk artifacts.

## File structure

```text
AGENTS.md
docs/superpowers/plans/2026-08-17-chunked-captions.md
src/captions/caption-chunk.ts         # chunkCaptionWords + activeCaptionChunk
src/captions/active-word.ts           # keep; activeCaptionChunk reuses activeWordsAt
src/remotion/WordCaption.tsx          # render current chunk at 72px
src/generation/prompt.ts
README.md
tests/captions/caption-chunk.test.ts
tests/generation/generate-video-plan.test.ts
```

Delete after Task 4 (shrink is no longer used):

```text
src/captions/phrase-layout.ts
tests/captions/phrase-layout.test.ts
```

Leave `src/captions/word-layout.ts` alone (already unused by render).

Work from the existing isolated worktree:

```text
/Users/tanakanpramot/Documents/PersonalWorkingspace/ai-shorts-poc/.worktrees/feat-catchier-shorts
```

Branch: `feat/catchier-shorts`. Do not work on `main`.

---

### Task 1: Point the contract at this plan

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/superpowers/plans/2026-08-17-chunked-captions.md` (this file; already written — add and commit it)

- [ ] **Step 1: Replace AGENTS.md**

```md
# Project Instructions

This project implements voiced AI Shorts with chunked accumulating captions, stroked Montserrat type, and a visual bookend loop.

Primary implementation plan:
docs/superpowers/plans/2026-08-17-chunked-captions.md

Rules:
- Follow the implementation plan task-by-task and in order.
- Use test-driven development.
- Do not add features outside this plan.
- Output is still a locally rendered MP4.
- No YouTube upload.
- No background music.
- No karaoke full-line highlight.
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
git add AGENTS.md docs/superpowers/plans/2026-08-17-chunked-captions.md
git commit -m "docs: point agents at chunked captions plan"
```

---

### Task 2: Chunk spoken words with hybrid stops

**Files:**
- Create: `src/captions/caption-chunk.ts`
- Create: `tests/captions/caption-chunk.test.ts`

- [ ] **Step 1: Write the failing chunker tests**

Create `tests/captions/caption-chunk.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {chunkCaptionWords} from '../../src/captions/caption-chunk';
import type {VoiceWord} from '../../src/domain/voice';

const timed = (texts: string[]): VoiceWord[] =>
  texts.map((text, index) => ({
    text,
    startMs: index * 200,
    endMs: index * 200 + 150,
  }));

const textsOf = (chunks: VoiceWord[][]): string[][] =>
  chunks.map((chunk) => chunk.map((word) => word.text));

describe('chunkCaptionWords', () => {
  it('returns no chunks for no words', () => {
    expect(chunkCaptionWords([])).toEqual([]);
  });

  it('keeps a single word as one chunk', () => {
    expect(textsOf(chunkCaptionWords(timed(['Wow!'])))).toEqual([['Wow!']]);
  });

  it('hard-stops after a token that ends with . ? or !', () => {
    expect(textsOf(chunkCaptionWords(timed(['Wait.', 'Did', 'you?']))).toEqual([
      ['Wait.'],
      ['Did', 'you?'],
    ]);
  });

  it('soft-stops after a comma only when the chunk already has at least 3 words', () => {
    expect(textsOf(chunkCaptionWords(timed(['The', 'longer', 'your', 'route,', 'the'])))).toEqual([
      ['The', 'longer', 'your', 'route,'],
      ['the'],
    ]);
  });

  it('does not soft-stop a two-word comma phrase', () => {
    expect(textsOf(chunkCaptionWords(timed(['Hello,', 'world'])))).toEqual([['Hello,', 'world']]);
  });

  it('caps a chunk at 5 words', () => {
    expect(
      textsOf(chunkCaptionWords(timed(['one', 'two', 'three', 'four', 'five', 'six']))),
    ).toEqual([
      ['one', 'two', 'three', 'four', 'five'],
      ['six'],
    ]);
  });

  it('starts a new chunk when adding the next word would exceed 28 characters', () => {
    expect(textsOf(chunkCaptionWords(timed(['extraordinarily', 'sophisticated'])))).toEqual([
      ['extraordinarily'],
      ['sophisticated'],
    ]);
  });

  it('keeps a single token longer than 28 characters', () => {
    const long = 'supercalifragilisticexpialidocious';
    expect(textsOf(chunkCaptionWords(timed([long, 'next'])))).toEqual([[long], ['next']]);
  });

  it('keeps apostrophes and does not treat them as stops', () => {
    expect(textsOf(chunkCaptionWords(timed(["don't", 'stop', 'now'])))).toEqual([
      ["don't", 'stop', 'now'],
    ]);
  });

  it('splits the supermarket-route sentence on the screenshot', () => {
    expect(
      textsOf(
        chunkCaptionWords(
          timed([
            'The',
            'longer',
            'your',
            'route,',
            'the',
            'more',
            'chances',
            'you',
            'have',
            'to',
            'add',
            'extras.',
          ]),
        ),
      ),
    ).toEqual([
      ['The', 'longer', 'your', 'route,'],
      ['the', 'more', 'chances', 'you', 'have'],
      ['to', 'add', 'extras.'],
    ]);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/captions/caption-chunk.test.ts
```

Expected: FAIL because `chunkCaptionWords` is not exported.

- [ ] **Step 3: Write the minimal chunker**

Create `src/captions/caption-chunk.ts`:

```ts
import type {VoiceWord} from '../domain/voice';

export const CAPTION_CHUNK_MAX_WORDS = 5;
export const CAPTION_CHUNK_MAX_CHARS = 28;

const HARD_STOP = /[.?!]$/;
const SOFT_STOP = /[,;:]$/;

const joinedLength = (chunk: readonly VoiceWord[], next: VoiceWord): number =>
  [...chunk, next].map((word) => word.text).join(' ').length;

export function chunkCaptionWords(words: readonly VoiceWord[]): VoiceWord[][] {
  if (words.length === 0) return [];

  const chunks: VoiceWord[][] = [];
  let current: VoiceWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current);
    current = [];
  };

  for (const word of words) {
    if (current.length === 0) {
      current.push(word);
      continue;
    }

    const previous = current.at(-1);
    const shouldStartNew =
      previous !== undefined &&
      (HARD_STOP.test(previous.text) ||
        (SOFT_STOP.test(previous.text) && current.length >= 3) ||
        current.length >= CAPTION_CHUNK_MAX_WORDS ||
        joinedLength(current, word) > CAPTION_CHUNK_MAX_CHARS);

    if (shouldStartNew) flush();
    current.push(word);
  }

  flush();
  return chunks;
}
```

Do not implement `activeCaptionChunk` in this task.

- [ ] **Step 4: Verify**

```bash
npm test -- tests/captions/caption-chunk.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/captions/caption-chunk.ts tests/captions/caption-chunk.test.ts
git commit -m "feat: split captions into short hybrid chunks"
```

---

### Task 3: Pick the live caption chunk at a timestamp

**Files:**
- Modify: `src/captions/caption-chunk.ts`
- Modify: `tests/captions/caption-chunk.test.ts`

- [ ] **Step 1: Write the failing picker tests**

Append to `tests/captions/caption-chunk.test.ts`:

```ts
import {activeCaptionChunk, chunkCaptionWords} from '../../src/captions/caption-chunk';

describe('activeCaptionChunk', () => {
  const words = timed([
    'The',
    'longer',
    'your',
    'route,',
    'the',
    'more',
    'chances',
    'you',
    'have',
    'to',
    'add',
    'extras.',
  ]);
  const chunks = chunkCaptionWords(words);

  it('returns no words before the first start', () => {
    expect(activeCaptionChunk(chunks, -1)).toEqual([]);
  });

  it('grows the first chunk word by word', () => {
    expect(activeCaptionChunk(chunks, 0).map((word) => word.text)).toEqual(['The']);
    expect(activeCaptionChunk(chunks, 200).map((word) => word.text)).toEqual(['The', 'longer']);
    expect(activeCaptionChunk(chunks, 600).map((word) => word.text)).toEqual([
      'The',
      'longer',
      'your',
      'route,',
    ]);
  });

  it('holds the finished chunk until the next chunk starts', () => {
    expect(activeCaptionChunk(chunks, 700).map((word) => word.text)).toEqual([
      'The',
      'longer',
      'your',
      'route,',
    ]);
  });

  it('replaces with the next chunk when that chunk starts', () => {
    expect(activeCaptionChunk(chunks, 800).map((word) => word.text)).toEqual(['the']);
    expect(activeCaptionChunk(chunks, 1600).map((word) => word.text)).toEqual([
      'the',
      'more',
      'chances',
      'you',
      'have',
    ]);
  });

  it('holds the last chunk after the last word', () => {
    expect(activeCaptionChunk(chunks, 4000).map((word) => word.text)).toEqual([
      'to',
      'add',
      'extras.',
    ]);
  });

  it('returns no words for no chunks', () => {
    expect(activeCaptionChunk([], 0)).toEqual([]);
  });
});
```

`timed()` uses `startMs = index * 200`, so:

- `route,` starts at 600; `the` starts at 800
- `have` starts at 1600; `to` starts at 1800

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/captions/caption-chunk.test.ts
```

Expected: FAIL because `activeCaptionChunk` is not exported.

- [ ] **Step 3: Implement the picker**

Add to `src/captions/caption-chunk.ts`:

```ts
import {activeWordsAt} from './active-word';

export function activeCaptionChunk(
  chunks: readonly VoiceWord[][],
  timeMs: number,
): VoiceWord[] {
  const current = chunks.findLast((chunk) => {
    const first = chunk[0];
    return first !== undefined && timeMs >= first.startMs;
  });
  if (!current) return [];
  return activeWordsAt(current, timeMs);
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/captions/caption-chunk.test.ts tests/captions/active-word.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/captions/caption-chunk.ts tests/captions/caption-chunk.test.ts
git commit -m "feat: show only the current caption chunk"
```

---

### Task 4: Render the current chunk at a fixed 72px

**Files:**
- Modify: `src/remotion/WordCaption.tsx`
- Modify: `tests/remotion/word-caption.test.ts`
- Delete: `src/captions/phrase-layout.ts`
- Delete: `tests/captions/phrase-layout.test.ts`

- [ ] **Step 1: Write the failing font-size test**

Add to `tests/remotion/word-caption.test.ts`:

```ts
import {CAPTION_FONT_SIZE} from '../../src/remotion/WordCaption';

describe('caption size', () => {
  it('keeps a fixed large size instead of shrinking to the full sentence', () => {
    expect(CAPTION_FONT_SIZE).toBe(72);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/remotion/word-caption.test.ts
```

Expected: FAIL because `CAPTION_FONT_SIZE` is not exported.

- [ ] **Step 3: Wire WordCaption to the chunk window and drop shrink**

In `src/remotion/WordCaption.tsx`:

- Export `export const CAPTION_FONT_SIZE = 72;`
- Replace `activeWordsAt` / `layoutAccumulatedPhrase` with:

```ts
import {activeCaptionChunk, chunkCaptionWords} from '../captions/caption-chunk';

const live = activeCaptionChunk(chunkCaptionWords(scene.words), captionTimeMs(frame, fps));
if (live.length === 0) return null;
const texts = live.map((word) => word.text);
```

- Set the phrase `div` `fontSize` to `CAPTION_FONT_SIZE` (not a layout helper).
- Keep Montserrat, stroke, lower third, flex wrap, newest-word opacity 1 / others 0.85.

Delete `src/captions/phrase-layout.ts` and `tests/captions/phrase-layout.test.ts`. Nothing else should import `layoutAccumulatedPhrase`.

- [ ] **Step 4: Verify**

```bash
npm test -- tests/remotion/word-caption.test.ts tests/captions
npm test
npm run typecheck
```

Expected: PASS. No file imports `layoutAccumulatedPhrase`.

- [ ] **Step 5: Commit**

```bash
git add src/remotion/WordCaption.tsx tests/remotion/word-caption.test.ts
git rm src/captions/phrase-layout.ts tests/captions/phrase-layout.test.ts
git commit -m "feat: render caption chunks at a fixed large size"
```

---

### Task 5: Prompt, README, and smoke

**Files:**
- Modify: `src/generation/prompt.ts`
- Modify: `tests/generation/generate-video-plan.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing prompt assertion**

Replace the existing `says on-screen text builds word by word` test with:

```ts
it('says on-screen text builds in short phrases then replaces', () => {
  expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/short phrases/i);
  expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/replace/i);
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/generation/generate-video-plan.test.ts
```

Expected: FAIL on `/short phrases/i` (current prompt still says `word by word`).

- [ ] **Step 3: Update prompt and README**

In `src/generation/prompt.ts` replace:

```text
Each scene.text is the exact line a narrator will speak. On screen the line builds word by word as it is spoken.
```

with:

```text
Each scene.text is the exact line a narrator will speak. On screen the spoken line builds in short phrases, then the next phrase replaces it.
```

In `README.md` expected-output, replace the sentence that says captions **build word by word** with:

```text
The MP4 includes spoken narration and on-screen captions that **build in short 3–5 word phrases**, then replace with the next phrase (punctuation is kept). Type is **Montserrat Black** with a black stroke at a fixed large size.
```

Keep the bookend / fade / review sentences.

- [ ] **Step 4: Verify**

```bash
npm test
npm run typecheck
npm run smoke:render
```

Expected: all PASS. `runs/smoke/output.mp4` exists and has an audio stream (`ffprobe`).

Do **not** run a live `npm run generate` in this task (uses paid APIs). Offline smoke is enough.

- [ ] **Step 5: Commit**

```bash
git add src/generation/prompt.ts tests/generation/generate-video-plan.test.ts README.md
git commit -m "docs: describe chunked replace captions"
```

---

## Exit criteria

- Scene words are split by hybrid hard/soft/word/char rules into ≤ 5 word / ≤ 28 character windows (except a single longer token).
- `WordCaption` shows only the current window, growing word by word, then replacing.
- Punctuation is visible. Font size is 72. `layoutAccumulatedPhrase` is gone.
- Bookend and 8-frame fade are unchanged.
- `npm test`, `npm run typecheck`, and `npm run smoke:render` pass.

## Follow-up (do not implement here)

YouTube upload. Background music. Live regenerate of the supermarket short for visual QA (optional after merge).
