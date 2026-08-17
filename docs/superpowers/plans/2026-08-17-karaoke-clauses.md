# Karaoke Clause Windows

**Goal:** Keep yellow karaoke, but show one readable clause at a time instead of the whole spoken scene.

**Rules:** Split `VoiceWord[]` on clause boundaries (because/so/but, `;`/`:`/` ,` when both sides stand, list commas stay together, bare `and` does not split). Length cap (~40 chars) only at a safe preposition. Karaoke highlight stays on the current word inside the live window.

**Out of scope:** Merging to main, asking the model for caption lines, shrinking type.
