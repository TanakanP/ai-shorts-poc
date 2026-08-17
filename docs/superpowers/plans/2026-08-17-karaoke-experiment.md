# Karaoke Caption Experiment

**Goal:** Try two visual changes without touching main: undimmed footage, and a full-sentence karaoke caption (current word yellow).

**Locked decisions**

1. `SCENE_WASH_OPACITY = 0`. Do not draw the 46% black overlay.
2. Show every `scene.words` token for the whole scene.
3. Highlight only the current word (`currentWordIndexAt`) in `#ffe14d`. Other words stay `#f5f5f5`.
4. Keep Montserrat Black, stroke, lower third, punctuation, bookend, and no first/last fade-to-black.

**Out of scope**

YouTube upload, background music, chunked replace captions, merging to main.
