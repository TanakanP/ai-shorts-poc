# Catchier Shorts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make voiced shorts more catchy and readable by switching to Montserrat Black with a stroke, accumulating spoken words per scene (keeping punctuation), and bookending the last shot to the first so YouTube replay feels continuous.

**Architecture:** Keep the existing voice timeline and `voice.json` words. Restyle `WordCaption`. Replace `activeWordAt` (one token) with `activeWordsAt` (all tokens whose `startMs` has been reached). After stock merge, copy the first scene’s video path and Pexels attribution onto the last scene. Overlay the first clip at rising opacity over the last 8 frames. Do not loop audio.

**Tech Stack:** Existing TypeScript / Vitest / Remotion 4.0.509, plus `@remotion/google-fonts@4.0.509` for Montserrat 900.

---

## Locked decisions

1. **Font:** Montserrat Black (900), white fill `#f5f5f5`, `WebkitTextStroke: 6px #000`, `paintOrder: 'stroke fill'`, `textShadow: '0 4px 12px rgba(0,0,0,0.65)'`. Sentence case. Lower third stays (`flex-end`, `0 86px 360px`).
2. **Captions:** Accumulate per scene. Newest word opacity 1, earlier words 0.85. Keep `,` `.` `:` `;` `'` `?` `!`. Remove `displaySpokenWord` from the render path and delete that module.
3. **Loop:** Visual only. After merge, last scene reuses first scene `localVideoPath` + creator fields. Last 8 frames of the composition fade that first clip in. Voice and captions are not looped.

## Out of scope

YouTube upload, background music, karaoke highlight of a full static line, looping audio, skipping the last Pexels download (bookend after download is enough), bounce/scale per word.

## File structure

```text
AGENTS.md
package.json                          # @remotion/google-fonts@4.0.509
src/remotion/caption-font.ts          # load Montserrat 900
src/remotion/WordCaption.tsx          # stroke + accumulate
src/captions/active-word.ts           # activeWordsAt
src/captions/phrase-layout.ts         # font size from phrase length
src/pipeline/bookend-last-scene.ts
src/pipeline/create-short.ts
src/remotion/ShortComposition.tsx     # 8-frame start overlay at end
src/generation/prompt.ts
README.md
tests/captions/active-word.test.ts
tests/captions/phrase-layout.test.ts
tests/pipeline/bookend-last-scene.test.ts
tests/pipeline/create-short.test.ts
tests/remotion/word-caption.test.ts
tests/remotion/composition.test.ts
```

Delete after accumulate lands:

```text
src/captions/display-word.ts
tests/captions/display-word.test.ts
```

`layoutSpokenWord` in `src/captions/word-layout.ts` becomes unused. Leave the file; do not delete it in this plan.

---

### Task 1: Point the contract at this plan

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Replace AGENTS.md**

```md
# Project Instructions

This project implements voiced AI Shorts with accumulating captions, stroked Montserrat type, and a visual bookend loop.

Primary implementation plan:
docs/superpowers/plans/2026-08-17-catchier-shorts.md

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
git add AGENTS.md
git commit -m "docs: point agents at catchier shorts plan"
```

---

### Task 2: Load Montserrat Black and apply stroke

**Files:**
- Modify: `package.json` / `package-lock.json` via npm
- Create: `src/remotion/caption-font.ts`
- Modify: `src/remotion/WordCaption.tsx`
- Modify: `tests/remotion/word-caption.test.ts`

- [ ] **Step 1: Install the font package**

```bash
npm install @remotion/google-fonts@4.0.509
```

Expected: `package.json` lists `"@remotion/google-fonts": "4.0.509"` (or `^4.0.509`).

- [ ] **Step 2: Write failing style-constant tests**

Add to `tests/remotion/word-caption.test.ts`:

```ts
import {
  CAPTION_FILL,
  CAPTION_FONT_WEIGHT,
  CAPTION_STROKE,
  CAPTION_SHADOW,
} from '../../src/remotion/WordCaption';

describe('caption style', () => {
  it('uses a white fill, black stroke, and drop shadow', () => {
    expect(CAPTION_FILL).toBe('#f5f5f5');
    expect(CAPTION_FONT_WEIGHT).toBe(900);
    expect(CAPTION_STROKE).toBe('6px #000');
    expect(CAPTION_SHADOW).toBe('0 4px 12px rgba(0,0,0,0.65)');
  });
});
```

- [ ] **Step 3: Run and verify failure**

```bash
npm test -- tests/remotion/word-caption.test.ts
```

Expected: FAIL because those exports do not exist.

- [ ] **Step 4: Implement font module and wire styles**

`src/remotion/caption-font.ts`:

```ts
import {loadFont} from '@remotion/google-fonts/Montserrat';

export const {fontFamily: captionFontFamily} = loadFont('normal', {
  weights: ['900'],
  subsets: ['latin'],
});
```

In `src/remotion/WordCaption.tsx` add and use:

```ts
export const CAPTION_FILL = '#f5f5f5';
export const CAPTION_FONT_WEIGHT = 900;
export const CAPTION_STROKE = '6px #000';
export const CAPTION_SHADOW = '0 4px 12px rgba(0,0,0,0.65)';
```

Import `captionFontFamily` from `./caption-font`. On the word `div` set:

```ts
{
  color: CAPTION_FILL,
  fontFamily: captionFontFamily,
  fontWeight: CAPTION_FONT_WEIGHT,
  WebkitTextStroke: CAPTION_STROKE,
  paintOrder: 'stroke fill',
  textShadow: CAPTION_SHADOW,
}
```

Keep current replace rendering in this task. Do not change accumulate behavior yet.

- [ ] **Step 5: Verify**

```bash
npm test -- tests/remotion/word-caption.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/remotion/caption-font.ts src/remotion/WordCaption.tsx tests/remotion/word-caption.test.ts
git commit -m "feat: render captions in stroked Montserrat Black"
```

---

### Task 3: Accumulate spoken words as a pure function

**Files:**
- Modify: `src/captions/active-word.ts`
- Create: `src/captions/phrase-layout.ts`
- Modify: `tests/captions/active-word.test.ts`
- Create: `tests/captions/phrase-layout.test.ts`

- [ ] **Step 1: Replace active-word tests with accumulate cases**

Replace `tests/captions/active-word.test.ts` with:

```ts
import {describe, expect, it} from 'vitest';
import {activeWordsAt} from '../../src/captions/active-word';
import type {VoiceWord} from '../../src/domain/voice';

const words: VoiceWord[] = [
  {text: 'Did', startMs: 80, endMs: 260},
  {text: 'you', startMs: 300, endMs: 420},
  {text: 'ever', startMs: 480, endMs: 700},
  {text: 'wonder', startMs: 760, endMs: 1100},
];

describe('activeWordsAt', () => {
  it('returns no words before the first start', () => {
    expect(activeWordsAt(words, 79)).toEqual([]);
  });

  it('returns only the first word at its start', () => {
    expect(activeWordsAt(words, 80).map((word) => word.text)).toEqual(['Did']);
  });

  it('keeps earlier words after the next word starts', () => {
    expect(activeWordsAt(words, 300).map((word) => word.text)).toEqual(['Did', 'you']);
  });

  it('keeps the full phrase after the last endMs', () => {
    expect(activeWordsAt(words, 2000).map((word) => word.text)).toEqual([
      'Did',
      'you',
      'ever',
      'wonder',
    ]);
  });

  it('keeps punctuation on tokens', () => {
    expect(activeWordsAt([{text: 'reason,', startMs: 0, endMs: 200}], 50).map((word) => word.text)).toEqual([
      'reason,',
    ]);
  });

  it('returns an empty list for no words', () => {
    expect(activeWordsAt([], 0)).toEqual([]);
  });
});
```

`tests/captions/phrase-layout.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {layoutAccumulatedPhrase} from '../../src/captions/phrase-layout';

describe('layoutAccumulatedPhrase', () => {
  it('uses 72px for short phrases', () => {
    expect(layoutAccumulatedPhrase('Did you')).toEqual({fontSize: 72});
  });

  it('uses 60px for mid phrases', () => {
    expect(layoutAccumulatedPhrase('Did you ever wonder why milk')).toEqual({fontSize: 60});
  });

  it('uses 52px for long phrases', () => {
    expect(
      layoutAccumulatedPhrase('Did you ever wonder why milk is always at the back of the store'),
    ).toEqual({fontSize: 52});
  });

  it('rejects blank phrases', () => {
    expect(() => layoutAccumulatedPhrase('   ')).toThrow(/blank/i);
  });
});
```

Tiers on `text.length`: `<= 20` → 72; `21..40` → 60; otherwise 52.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/captions/active-word.test.ts tests/captions/phrase-layout.test.ts
```

Expected: FAIL because `activeWordsAt` / `layoutAccumulatedPhrase` do not exist. `activeWordAt` callers still compile until Task 4.

- [ ] **Step 3: Implement**

Replace `src/captions/active-word.ts` with:

```ts
import type {VoiceWord} from '../domain/voice';

export function activeWordsAt(words: readonly VoiceWord[], timeMs: number): VoiceWord[] {
  if (words.length === 0) return [];
  const first = words[0];
  if (!first || timeMs < first.startMs) return [];
  return words.filter((word) => timeMs >= word.startMs);
}
```

Do not keep `activeWordAt`.

`src/captions/phrase-layout.ts`:

```ts
export type AccumulatedPhraseLayout = {
  fontSize: number;
};

export function layoutAccumulatedPhrase(text: string): AccumulatedPhraseLayout {
  if (!text.trim()) throw new Error('Accumulated phrase cannot be blank');
  if (text.length <= 20) return {fontSize: 72};
  if (text.length <= 40) return {fontSize: 60};
  return {fontSize: 52};
}
```

- [ ] **Step 4: Verify these tests**

```bash
npm test -- tests/captions/active-word.test.ts tests/captions/phrase-layout.test.ts
```

Expected: those two files PASS. `npm run typecheck` may fail until Task 4 updates `WordCaption`. That is OK for this task if the only errors are `activeWordAt` missing. If typecheck fails only on `WordCaption.tsx`, proceed to Task 4 in the same session immediately after committing this task’s passing unit tests. Prefer committing even if typecheck is red **only** if you then start Task 4 without leaving main/typecheck broken on a shared branch — implementers working task-by-task should finish Task 4 next before considering the suite green.

To keep each commit typecheck-clean, also add a temporary re-export in `active-word.ts` until Task 4:

```ts
export function activeWordAt(words: readonly VoiceWord[], timeMs: number): string | null {
  const live = activeWordsAt(words, timeMs);
  return live.at(-1)?.text ?? null;
}
```

**Do this.** Typecheck stays green. Task 4 removes `activeWordAt`.

- [ ] **Step 5: Commit**

```bash
git add src/captions/active-word.ts src/captions/phrase-layout.ts tests/captions/active-word.test.ts tests/captions/phrase-layout.test.ts
git commit -m "feat: accumulate spoken words until the next start"
```

---

### Task 4: Render accumulating captions and drop mark-stripping

**Files:**
- Modify: `src/remotion/WordCaption.tsx`
- Delete: `src/captions/display-word.ts`
- Delete: `tests/captions/display-word.test.ts`
- Modify: `src/generation/prompt.ts` (on-screen line builds word by word)
- Modify: `tests/generation/generate-video-plan.test.ts` only if a prompt assertion would fail

- [ ] **Step 1: Write a failing prompt assertion**

Add to `tests/generation/generate-video-plan.test.ts` in the existing prompt describe, or create one:

```ts
it('says on-screen text builds word by word', () => {
  expect(VIDEO_PLAN_SYSTEM_PROMPT).toMatch(/word by word/i);
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/generation/generate-video-plan.test.ts
```

Expected: FAIL on `/word by word/i`.

- [ ] **Step 3: Implement WordCaption accumulate + prompt**

`WordCaption` body:

```tsx
const live = activeWordsAt(scene.words, captionTimeMs(frame, fps));
if (live.length === 0) return null;
const texts = live.map((word) => word.text);
const {fontSize} = layoutAccumulatedPhrase(texts.join(' '));

return (
  <AbsoluteFill
    style={{
      zIndex: 2,
      alignItems: 'center',
      justifyContent: WORD_CAPTION_JUSTIFY,
      padding: WORD_CAPTION_PADDING,
    }}
  >
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: '0.35em',
        rowGap: 4,
        maxWidth: 908,
        color: CAPTION_FILL,
        fontFamily: captionFontFamily,
        fontSize,
        fontWeight: CAPTION_FONT_WEIGHT,
        WebkitTextStroke: CAPTION_STROKE,
        paintOrder: 'stroke fill',
        textShadow: CAPTION_SHADOW,
        lineHeight: 1.08,
        textAlign: 'center',
      }}
    >
      {texts.map((text, index) => (
        <span key={`${index}-${text}`} style={{opacity: index === texts.length - 1 ? 1 : 0.85}}>
          {text}
        </span>
      ))}
    </div>
  </AbsoluteFill>
);
```

Remove imports of `activeWordAt`, `displaySpokenWord`, and `layoutSpokenWord`. Remove `activeWordAt` from `src/captions/active-word.ts`. Delete `src/captions/display-word.ts` and `tests/captions/display-word.test.ts`.

Replace this sentence in `src/generation/prompt.ts`:

```text
Each scene.text is the exact line a narrator will speak, and the same line appears on screen.
```

with:

```text
Each scene.text is the exact line a narrator will speak. On screen the line builds word by word as it is spoken.
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/captions tests/remotion/word-caption.test.ts tests/generation/generate-video-plan.test.ts
npm test
npm run typecheck
```

Expected: PASS. No file imports `displaySpokenWord` or `activeWordAt`.

- [ ] **Step 5: Commit**

```bash
git add src/remotion/WordCaption.tsx src/captions/active-word.ts src/generation/prompt.ts tests/generation/generate-video-plan.test.ts
git rm src/captions/display-word.ts tests/captions/display-word.test.ts
git commit -m "feat: accumulate caption words and keep punctuation"
```

---

### Task 5: Bookend the last scene to the first clip

**Files:**
- Create: `src/pipeline/bookend-last-scene.ts`
- Test: `tests/pipeline/bookend-last-scene.test.ts`
- Modify: `src/pipeline/create-short.ts`
- Modify: `tests/pipeline/create-short.test.ts`

- [ ] **Step 1: Write failing bookend tests**

`tests/pipeline/bookend-last-scene.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {bookendLastScene} from '../../src/pipeline/bookend-last-scene';

const scene = (id: string, path: string) => ({
  id,
  localVideoPath: path,
  sourcePageUrl: `https://example.com/${id}`,
  creatorName: `Creator ${id}`,
  creatorUrl: `https://example.com/creators/${id}`,
});

describe('bookendLastScene', () => {
  it('copies the first clip and attribution onto the last scene', () => {
    const first = scene('hook', '/tmp/hook.mp4');
    const mid = scene('mid', '/tmp/mid.mp4');
    const last = scene('payoff', '/tmp/payoff.mp4');
    expect(bookendLastScene([first, mid, last])).toEqual([
      first,
      mid,
      {
        ...last,
        localVideoPath: first.localVideoPath,
        sourcePageUrl: first.sourcePageUrl,
        creatorName: first.creatorName,
        creatorUrl: first.creatorUrl,
      },
    ]);
  });

  it('leaves a single scene unchanged', () => {
    const only = scene('only', '/tmp/only.mp4');
    expect(bookendLastScene([only])).toEqual([only]);
  });
});
```

In `tests/pipeline/create-short.test.ts` success case, after createShort resolves, the persisted `resolved.json` last scene must use the first scene’s `localVideoPath` and creator fields. Today the last scene is `scene-05.mp4` / `Creator 5`. Expect `scene-01.mp4` and `Creator 1` on the last scene. Also expect `attribution` last entry to match the first creator.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/pipeline/bookend-last-scene.test.ts tests/pipeline/create-short.test.ts
```

Expected: FAIL because `bookendLastScene` is missing and create-short still keeps the last downloaded clip.

- [ ] **Step 3: Implement**

`src/pipeline/bookend-last-scene.ts`:

```ts
export type BookendableScene = {
  localVideoPath: string;
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
};

export function bookendLastScene<T extends BookendableScene>(scenes: T[]): T[] {
  const first = scenes[0];
  const last = scenes.at(-1);
  if (!first || !last || scenes.length < 2) return scenes;
  return [
    ...scenes.slice(0, -1),
    {
      ...last,
      localVideoPath: first.localVideoPath,
      sourcePageUrl: first.sourcePageUrl,
      creatorName: first.creatorName,
      creatorUrl: first.creatorUrl,
    },
  ];
}
```

In `create-short.ts`, after building `resolvedScenes` and before `resolvedVideo`:

```ts
const loopedScenes = bookendLastScene(resolvedScenes);
```

Use `loopedScenes` for `resolvedVideo.scenes` and for `attribution`. Still download every Pexels clip; bookend only changes which path the last scene plays.

- [ ] **Step 4: Verify**

```bash
npm test -- tests/pipeline
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/bookend-last-scene.ts src/pipeline/create-short.ts tests/pipeline/bookend-last-scene.test.ts tests/pipeline/create-short.test.ts
git commit -m "feat: reuse the opening clip as the final shot"
```

---

### Task 6: Fade the opening clip in over the last 8 frames

**Files:**
- Modify: `src/remotion/ShortComposition.tsx`
- Modify: `tests/remotion/composition.test.ts`

- [ ] **Step 1: Write failing fade tests**

Add to `tests/remotion/composition.test.ts`:

```ts
import {loopFadeOpacity, LOOP_FADE_FRAMES} from '../../src/remotion/ShortComposition';

it('exports an 8-frame loop fade', () => {
  expect(LOOP_FADE_FRAMES).toBe(8);
});

it('keeps the opening overlay hidden until the last 8 frames', () => {
  expect(loopFadeOpacity(0, 330)).toBe(0);
  expect(loopFadeOpacity(321, 330)).toBe(0);
});

it('fades the opening overlay from 0 to 1 across the last 8 frames', () => {
  expect(loopFadeOpacity(322, 330)).toBeGreaterThan(0);
  expect(loopFadeOpacity(329, 330)).toBe(1);
});
```

`durationInFrames` 330 matches the existing fixture (4s + 7s). Last 8 frames are 322..329 inclusive.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/remotion/composition.test.ts
```

Expected: FAIL because `loopFadeOpacity` / `LOOP_FADE_FRAMES` are missing.

- [ ] **Step 3: Implement**

In `src/remotion/ShortComposition.tsx`:

```ts
export const LOOP_FADE_FRAMES = 8;

const clamped = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

export const loopFadeOpacity = (frame: number, durationInFrames: number): number => {
  if (durationInFrames <= LOOP_FADE_FRAMES) return 0;
  const start = durationInFrames - LOOP_FADE_FRAMES;
  if (frame < start) return 0;
  return interpolate(frame, [start, durationInFrames - 1], [0, 1], clamped);
};
```

Import `interpolate` from `remotion` (already has `useCurrentFrame`).

After the voice sequences, before the progress bar, if `video.scenes[0]` exists:

```tsx
const first = video.scenes[0];
const fade = loopFadeOpacity(frame, durationInFrames);
{first && fade > 0 ? (
  <AbsoluteFill style={{opacity: fade, zIndex: 1}}>
    <OffthreadVideo
      src={getVideoSource(first.localVideoPath, assetBaseUrl, localAssetPaths)}
      muted
      style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center'}}
    />
    <AbsoluteFill style={{backgroundColor: 'rgba(0, 0, 0, 0.46)'}} />
  </AbsoluteFill>
) : null}
```

Import `OffthreadVideo` from `remotion`. Captions stay zIndex 2. Do not fade audio.

- [ ] **Step 4: Verify**

```bash
npm test -- tests/remotion
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/remotion/ShortComposition.tsx tests/remotion/composition.test.ts
git commit -m "feat: crossfade the opening shot over the last frames"
```

---

### Task 7: README and smoke

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the three behaviors**

In README expected-output, state:

- On-screen text **builds word by word** as it is spoken (punctuation kept).
- Type is **Montserrat Black** with a black stroke.
- The last shot reuses the opening clip and the final frames fade toward that opening so replay is continuous.
- Still review before any public upload.

- [ ] **Step 2: Run offline gates**

```bash
npm test
npm run typecheck
npm run smoke:render
```

Expected: all PASS. `runs/smoke/output.mp4` exists and has an audio stream (`ffprobe`).

Optional live generate if keys exist:

```bash
npm run generate -- "Why supermarkets put milk at the back"
```

Watch: accumulating captions, stroked type, last shot matches first, last ~0.27s fades into the open.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe accumulate captions and visual bookend"
```

---

## Exit criteria

- Captions use Montserrat 900, white fill, 6px black stroke, drop shadow.
- Each scene accumulates words; newest word is full opacity.
- Punctuation is visible; `displaySpokenWord` is gone.
- Last resolved scene plays the first clip and shares its attribution.
- Last 8 frames fade that opening clip in. Audio is not looped.
- `npm test` and `npm run typecheck` pass.

## Follow-up (do not implement here)

YouTube upload. Background music. Skip downloading the unused last Pexels file.
