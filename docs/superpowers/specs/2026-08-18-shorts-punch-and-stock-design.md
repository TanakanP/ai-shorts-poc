# Punchy 4-scene plans and matched stock

Educational shorts should stop a scroll and make the picture agree with the line. The planner writes a 4-beat Short, not a mini-doc. Stock stays unique per educational scene and prefers the Pexels clip whose page slug overlaps the query and spoken nouns.

## Goal

A generated short has four spoken educational scenes (hook, you-reason, proof, payoff) plus the existing channel outro. Footage for each educational scene is the best unique Pexels match we can pick without a vision model.

## Locked decisions

1. **Exactly 4 educational scenes.** The channel outro is still appended after the plan. The model does not write the outro.
2. **Writing target 16–32 seconds.** That is the natural range of 4 scenes at 4–8 seconds each. Prompt asks for about 6 seconds per line (~24s). Real duration stays speak-then-time (20–60s voiced).
3. **Beat roles.** Scene 1 is a question or myth and must not give the answer. Scene 2 is one reason spoken to you/your. Scene 3 is one concrete proof or walk. Scene 4 is the payoff in plain words with no second thesis.
4. **No lecture jargon.** Prompt bans logistics, cold-chain, merchandising, refrigerated cases, and similar textbook phrasing.
5. **searchQuery is filmable objects from that line.** Example: `supermarket milk fridge`, not `consumer psychology`.
6. **Unique clips stay.** Educational scenes still cannot share a Pexels id. Outro still reuses the first clip.
7. **Match score, then quality.** Rank usable MP4s by slug overlap with searchQuery + spoken nouns, then today's portrait / resolution / id tie-break. If the best portrait score is 0, search landscape and take the higher score. If every usable hit scores 0, keep today's quality picker so generate still works.
8. **No vision, no extra providers, no title card, no YouTube copy, no middle-scene clip reuse.**

## Architecture

`generateVideoPlan` still validates a `VideoPlan`. Schema becomes 4 scenes and 16–32s writing total. The system prompt encodes beat roles and filmable queries.

`scoreStockMatch(videoUrl, searchQuery, sceneText)` counts how many tokens from the query and spoken line (bars stripped, stopwords dropped) appear in the Pexels page URL slug.

`selectBestVideo` accepts an optional match hint and sorts by score descending, then existing quality rules.

`resolveSceneAssets` passes `scene.searchQuery` and `scene.text` into that picker. Portrait is still first. Landscape runs when portrait has no usable clip **or** the best portrait match score is 0.

## Data flow

Topic (+ optional research) → structured plan (4 scenes) → validate → attach outro → TTS → unique Pexels search per educational scene → score/rank → download → bookend outro to first clip → render.

## Error handling

Invalid scene count or writing total still fails plan parse before any paid voice/stock call. No usable Pexels clip after portrait and landscape still throws `No usable video for scene …`. A zero match score is not an error.

## Testing

Offline only in this work:

- Schema accepts 4×6s and the 16s / 32s edges; rejects 3 and 5 scenes.
- Prompt asserts 4 scenes, delayed answer, you-language, jargon ban, filmable queries.
- Scorer: pepper slug vs milk/supermarket tokens scores 0; milk-aisle slug scores higher.
- Picker prefers a lower-resolution clip with a higher match over a sharper mismatch.
- Resolver searches landscape when the best portrait match is 0, and still skips used ids.

No live `npm run generate` in the implementation tasks.

## Out of scope

Title card. YouTube title/description/hashtags. Vision scoring. Reusing one hero clip across educational scenes. Changing captions, voice, music, or outro layout.
