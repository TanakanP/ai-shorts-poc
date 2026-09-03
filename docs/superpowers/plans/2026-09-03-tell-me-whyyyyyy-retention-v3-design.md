# Tell Me Whyyyyyy Retention V3 Design

**Status:** Draft for user review  
**Date:** 2026-09-03  
**Supersedes for content/story behavior:** `2026-08-20-ai-shorts-retention-v2-design.md`  
**Builds on:** the current working AI Shorts pipeline and `v1_1_content_enhance.md`

## 1. Problem

The production pipeline is working: it can take a topic plus creative brief, generate a Short, resolve stock footage, render the video, and publish content that YouTube does place into the Shorts feed.

The remaining bottleneck is not basic generation or posting time. It is the **viewer-attention funnel**.

Early Tell Me Whyyyyyy results show three distinct behaviors:

| Reference video | Stayed to watch | Engaged AVD | Video length | Approx. engaged % viewed | Lesson |
|---|---:|---:|---:|---:|---|
| `A Runway Can Change Its Number Without Moving` | 55.7% | 20s | 27s | ~74% | Best balanced reference: strong entry + strong retention |
| `Costco Isn't Just Checking Whether You Paid` | 40.8% | 16s | 30s | ~53% | High-recognition topic gets distribution, but middle story loses attention |
| `A $40 Fill-Up Can Lock $100+ on Your Card` | 25.5% | 32s | 31s | ~103% | Weak entry, but viewers who stay watch extremely deeply |

These are not universal YouTube thresholds. They are internal Tell Me Whyyyyyy evidence.

V3 must therefore optimize two different problems independently:

1. **Stop the swipe** — make the first frame and first spoken sentence instantly understandable, surprising, and visually concrete.
2. **Hold attention after entry** — create a second curiosity gap before the middle becomes a flat explanation.

V2 already introduced declarative hooks, five escalating beats, concise text, and better visual search. V3 keeps those strengths but makes hook choice and story structure explicit, inspectable parts of the domain model.

---

## 2. Goal

Generate a punchy voiced vertical Short that:

- starts with a strong declarative claim rather than a question,
- generates and evaluates multiple hook options before committing to the story,
- makes the topic visually recognizable in the first frame,
- creates a **primary curiosity gap** immediately,
- creates a **second curiosity gap / curiosity reset** around the first third of the story,
- gives every beat new information rather than paraphrasing prior beats,
- separates natural spoken narration from concise on-screen text,
- preserves factual constraints from the creative brief,
- preserves the current stock-footage resolver and Remotion pipeline unless a V3 requirement directly needs a small extension,
- remains debuggable through `plan.json`, `resolved.json`, and `run.json`.

The user-facing goal is simple:

> A viewer should understand why the first claim is surprising within roughly two seconds, then receive a new reason to keep watching before the original curiosity is fully resolved.

---

## 3. Core Product Principle

### Code owns format. The creative brief owns personality.

The public command stays:

```bash
npm run generate -- "<topic>" "<creative brief>"
```

Topic-only generation may remain supported if it already works.

Do **not** add a third CLI argument.

The creative brief continues to define:

- tone,
- audience,
- one central angle,
- packaging claim / hook direction,
- must-include proof,
- ban list,
- close,
- factual fence,
- optional content pattern.

The V3 code owns:

- hook candidate generation,
- hook hard rules,
- hook scoring structure,
- deterministic hook selection,
- first-frame contract,
- five story roles,
- second curiosity-gap requirement,
- spoken/display copy separation,
- duration constraints,
- plan validation,
- debug metadata.

The channel sign-off/outro stays separate from the brief. Generated story copy must not manually write the channel outro.

---

## 4. Brand

Generation-facing references to the old channel name `Plainly Curious` should become `Tell Me Whyyyyyy`.

Do not redesign logos, banners, colors, or the full Remotion visual template as part of V3.

The content identity is:

> Familiar everyday thing → surprising claim → hidden reason → satisfying reframe.

The current content focus is especially strong around American systems people recognize: retail, roads, airports, money, payments, homes, infrastructure, and familiar brands.

The generator must not hard-code “American” into every video. The topic and creative brief determine geographic relevance.

---

## 5. V3 Content Patterns

The creative brief may provide one of these patterns. The revised 52-topic workbook already uses them.

```ts
export type ContentPattern =
  | 'BALANCED_REVEAL'
  | 'FAMILIARITY_TWIST'
  | 'PERSONAL_STAKES';
```

If the brief explicitly names a pattern, the generator must honor it.

If no pattern is supplied, generation may infer the best pattern from the topic and brief.

### 5.1 BALANCED_REVEAL

Reference behavior: Runway Numbers.

Use when the topic contains:

- a familiar object/system,
- an impossible-sounding or counterintuitive fact,
- a hidden mechanism,
- a visual payoff.

Story shape:

```text
Familiar object
→ contradictory claim
→ context
→ deeper surprise
→ mechanism
→ reframe
```

Example shape:

> This runway can change its number without moving.

The explanation should not be revealed completely in the first line.

### 5.2 FAMILIARITY_TWIST

Reference behavior: Costco.

Use when recognition itself is powerful:

- Costco,
- Target,
- Trader Joe's,
- airports,
- familiar road signs,
- common household objects.

Story shape:

```text
Recognizable thing
→ challenge obvious explanation
→ partial answer
→ SECOND purpose / unexpected consequence
→ proof
→ reframe
```

The middle must contain a second curiosity gap. This pattern must not become “hook, then 20 seconds of explanation.”

### 5.3 PERSONAL_STAKES

Reference behavior: Gas Hold.

Use when the strongest entry is a consequence to the viewer:

- money,
- price,
- time,
- access,
- risk,
- an unexpectedly large number,
- a familiar action producing a strange result.

Story shape:

```text
Concrete consequence
→ "this is not what it looks like"
→ second question/clarification
→ hidden mechanism
→ resolution
```

The first spoken sentence should usually contain the concrete consequence before system terminology.

---

## 6. V3 Generation Flow

V2 effectively generated the story in one pass.

V3 changes the content planning sequence:

```text
TOPIC + CREATIVE BRIEF
        ↓
current research / factual context
        ↓
infer or read CONTENT PATTERN
        ↓
generate exactly 3 HOOK CANDIDATES
        ↓
validate hard hook rules
        ↓
score candidate dimensions
        ↓
deterministically select best valid candidate
        ↓
generate five-beat story AROUND selected hook
        ↓
validate story contract
        ↓
resolve stock footage
        ↓
render
        ↓
persist debug artifacts
```

The provider may produce hook candidates and the story in one structured API response if that is materially simpler in the current repository, but the **domain contract must still expose hook candidates separately from the selected story**.

Do not render three videos. Generate three hook concepts, select one, and render one Short.

---

## 7. Hook Candidate Contract

V3 introduces an explicit hook-planning object.

```ts
export type HookScores = {
  stopScroll: number;          // integer 1..5
  clarity: number;             // integer 1..5
  contradiction: number;       // integer 1..5
  personalRelevance: number;   // integer 1..5
  visualizability: number;     // integer 1..5
};

export type HookConcept = {
  id: 'hook-a' | 'hook-b' | 'hook-c';

  spokenHook: string;
  displayText: string;

  curiosityTarget: string;

  visualIntent: string;
  requiredVisualObjects: string[];
  searchQueries: string[];

  scores: HookScores;
};
```

### Required candidate count

Exactly 3 candidates.

### Hook scores

Each dimension is an integer from 1 through 5.

The scores are **generation heuristics**, not predictions of YouTube performance.

Do not encode a claim such as “a score of 20 guarantees virality.”

### Deterministic selection

Code computes total score from the five dimensions.

```ts
export function totalHookScore(scores: HookScores): number {
  return (
    scores.stopScroll +
    scores.clarity +
    scores.contradiction +
    scores.personalRelevance +
    scores.visualizability
  );
}
```

Select the highest-scoring **valid** candidate.

Tie-breaking order:

1. higher `clarity`,
2. higher `visualizability`,
3. higher `stopScroll`,
4. lexical candidate id order: `hook-a`, `hook-b`, `hook-c`.

Do not allow the provider to return a separate arbitrary `winner` that bypasses deterministic selection.

---

## 8. Hook Hard Rules

Every hook candidate must satisfy all of these.

### 8.1 Declarative, not a question

Reject a hook whose normalized spoken text:

- starts with `Why`,
- starts with `How`,
- starts with `What`,
- starts with `Did you know`,
- starts with `Have you ever wondered`,
- starts with `Ever wonder`,
- starts with `Ever notice`,
- ends in `?`.

Matching is case-insensitive after trimming leading punctuation/whitespace.

### 8.2 No greetings or channel intro

Reject hooks that begin with generic setup such as:

- `Hey`,
- `Welcome`,
- `Today we're`,
- `In this video`,
- channel-name introduction.

The first spoken content must be the story claim.

### 8.3 Do not fully answer the topic

The hook should expose the contradiction, consequence, hidden intention, or surprising fact.

It should **not** explain the complete mechanism.

Bad:

> Gas stations reserve a larger amount because card networks use preauthorization.

Better:

> A $40 fill-up can temporarily lock more than $100 on your card.

### 8.4 Natural spoken language

The spoken hook should sound like a person speaking, not a thumbnail headline.

Preferred spoken hook length:

```text
6–18 words
```

This is a schema preference. Reject over 22 words.

### 8.5 Display copy is separate

`displayText` is not a transcript of the full hook.

Preferred:

```text
2–8 words
```

Maximum:

```text
9 words
```

Example:

```text
spokenHook:
"A $40 fill-up can temporarily lock more than $100 on your card."

displayText:
"$40 GAS → $100+ HOLD"
```

### 8.6 Candidate diversity

Three candidates must not be trivial rewrites.

At minimum, normalized `spokenHook` values must be unique.

The prompt must ask for meaningfully different hook angles where the brief allows them, for example:

- contradiction,
- personal consequence,
- unexpected purpose.

Do not require the three candidates to invent different factual theses.

---

## 9. First-Frame Contract

The hook is not only copy. It is copy + visual.

The selected HookConcept becomes the first scene's visual contract.

### First-frame requirements

Within the first frame / first visual moment:

- the subject should be recognizable with sound muted,
- use one dominant object/environment instead of generic filler,
- when the topic depends on a number, price, sign, card, road marking, or named object, visually prioritize it,
- on-screen text must reinforce the spoken claim, not introduce a separate idea,
- the first visual search query must be the most concrete and topic-specific usable query.

Examples:

### Runway

```text
spoken:
"This runway can change its number without moving."

display:
"SAME RUNWAY. NEW NUMBER."

visual:
runway number marking / runway threshold

avoid:
generic passenger looking through airplane window
```

### Gas hold

```text
spoken:
"A $40 fill-up can temporarily lock more than $100 on your card."

display:
"$40 GAS → $100+ HOLD"

visual:
gas pump + payment/card context

avoid:
generic person driving
```

### Costco

```text
spoken:
"Costco isn't just checking whether you paid."

display:
"NOT JUST SECURITY"

visual:
warehouse exit / receipt / full cart

avoid:
generic supermarket hallway
```

V3 does not add a vision model to automatically prove that a downloaded Pexels clip contains every required object. The structured plan makes the requirement explicit; real acceptance still includes human visual review.

---

## 10. Story Contract

V2 used:

```text
hook → escalation → mechanism → twist → payoff
```

V3 makes the attention logic more explicit:

```ts
export type StoryRole =
  | 'hook'
  | 'context'
  | 'curiosity-reset'
  | 'mechanism'
  | 'payoff';
```

Exactly five story beats remain.

### 10.1 `hook`

Purpose:

- stop the swipe,
- make the contradiction/consequence instantly clear,
- open curiosity gap #1.

Must use the selected HookConcept.

### 10.2 `context`

Purpose:

- tell the viewer why the claim matters,
- give only enough information to orient them,
- move the story forward.

It must not fully resolve the mechanism.

### 10.3 `curiosity-reset`

Purpose:

- open curiosity gap #2,
- introduce genuinely new information,
- create a second reason to continue watching.

This is a mandatory V3 beat, not optional flavor.

Examples of valid shapes:

```text
"But here's the part most people miss..."
"And sometimes that mistake costs YOU money."
"That still isn't the weirdest part."
"The number tells you more than direction."
```

Do not hard-code those phrases. Generate topic-specific copy.

A curiosity reset is invalid when it merely paraphrases the hook or context.

### 10.4 `mechanism`

Purpose:

- explain the central system/reason,
- deliver the proof promised by the creative brief,
- satisfy the viewer's curiosity without jargon dumping.

### 10.5 `payoff`

Purpose:

- resolve the central contradiction,
- reframe the familiar object/system,
- leave one memorable final thought.

No subscribe/follow CTA in the generated payoff.

The existing channel outro remains separate.

---

## 11. Spoken Text vs Display Text

V3 requires separate narration and on-screen copy.

If the current repository already has separate fields, preserve the existing equivalent names.

If it still uses one `text` property for both narration and screen text, split it.

Proposed V3 beat shape:

```ts
export type StoryBeat = {
  id: string;
  role: StoryRole;

  durationSeconds: number;

  spokenText: string;
  displayText: string;
  emphasisWords: string[];

  beatPurpose: string;
  newInformation: string;
  curiosityTarget?: string;

  visualIntent: string;
  requiredVisualObjects: string[];
  searchQueries: string[];
};
```

### Why separate them

Spoken narration must sound natural.

On-screen text must be fast to read.

One string should not be forced to satisfy both requirements.

### Spoken text rules

- conversational American English unless brief says otherwise,
- natural sentence rhythm,
- no headline-telegram narration,
- no repeated thesis,
- avoid jargon unless immediately understandable,
- avoid unverifiable numbers,
- obey the brief's ban list and facts fence.

### Display text rules

Preferred:

```text
2–8 words
```

Maximum:

```text
9 words
```

It should communicate the visual idea, not subtitle every spoken word.

`emphasisWords`:

- zero to two items,
- each must exist in `displayText`,
- case-insensitive matching is acceptable.

---

## 12. Beat Metadata for Debugging

Every beat must explain its narrative job in structured metadata.

### `beatPurpose`

One concise sentence describing why this beat exists in the story.

Example:

> Reopen curiosity by revealing that the receipt check can catch errors that hurt the customer, not only the store.

### `newInformation`

One concise statement of the new factual idea introduced by this beat.

This field helps humans inspect whether two beats are merely paraphrasing each other.

### `curiosityTarget`

Required for:

- `hook`,
- `curiosity-reset`.

It describes the unresolved thought the viewer should currently have.

Example:

```text
hook curiosityTarget:
"How can the same physical runway legitimately need a new number?"

curiosity-reset curiosityTarget:
"What changed if the runway itself did not?"
```

The generated narration must not literally speak this metadata unless appropriate.

---

## 13. Duration and Pacing

Do not return to V2's rigid “every beat is exactly 4 or 5 seconds” rule.

Observed videos show that different story jobs need different space.

### Preferred complete story duration

Before the existing separate channel outro:

```text
22–26 seconds
```

### Allowed story duration

```text
20–28 seconds
```

### Preferred final video duration

Including existing outro:

```text
23–28 seconds
```

### Maximum final duration

```text
30 seconds
```

The system should reject a plan exceeding the allowed story duration unless the current renderer includes non-story lead/trail duration outside the plan. The implementation plan must reconcile exact current outro timing after inspecting the repo.

### Role guidance

Not schema-exact constants, but prompt guidance:

```text
hook              ~2–3 sec
context           ~3–5 sec
curiosity-reset   ~3–5 sec
mechanism         ~6–8 sec
payoff            ~4–6 sec
```

The mechanism is allowed more narration because it is the explanatory core.

Do not artificially lengthen a beat to hit a target.

Every spoken line should either:

1. create/renew curiosity, or
2. pay off curiosity with new information.

If it does neither, remove it.

---

## 14. Visual Search

Preserve V2's ordered multi-query behavior.

Every beat still has:

- one concrete `visualIntent`,
- 2–3 ordered unique stock search queries,
- specific first query,
- broader but still relevant fallbacks,
- portrait queries exhausted before landscape queries,
- persisted `selectedSearchQuery`.

V3 additionally adds `requiredVisualObjects`.

Example:

```ts
{
  visualIntent:
    'Close view of a fuel pump while a customer pays by card',
  requiredVisualObjects: [
    'fuel pump',
    'payment card'
  ],
  searchQueries: [
    'credit card payment gas pump',
    'paying at fuel pump',
    'gas station pump close up'
  ]
}
```

Search queries must describe filmable nouns, actions, and environments.

Reject abstract filler such as:

```text
consumer psychology
financial concept
business strategy
person thinking
generic hallway
```

when a concrete subject exists.

No new stock provider is required.

---

## 15. Suggested V3 Domain Model

The exact file names may differ in the current repo. Preserve equivalent existing modules rather than duplicating them.

```ts
export type ContentPattern =
  | 'BALANCED_REVEAL'
  | 'FAMILIARITY_TWIST'
  | 'PERSONAL_STAKES';

export type HookScores = {
  stopScroll: number;
  clarity: number;
  contradiction: number;
  personalRelevance: number;
  visualizability: number;
};

export type HookConcept = {
  id: 'hook-a' | 'hook-b' | 'hook-c';
  spokenHook: string;
  displayText: string;
  curiosityTarget: string;
  visualIntent: string;
  requiredVisualObjects: string[];
  searchQueries: string[];
  scores: HookScores;
};

export type StoryRole =
  | 'hook'
  | 'context'
  | 'curiosity-reset'
  | 'mechanism'
  | 'payoff';

export type StoryBeat = {
  id: string;
  role: StoryRole;
  durationSeconds: number;

  spokenText: string;
  displayText: string;
  emphasisWords: string[];

  beatPurpose: string;
  newInformation: string;
  curiosityTarget?: string;

  visualIntent: string;
  requiredVisualObjects: string[];
  searchQueries: string[];
};

export type VideoPlanV3 = {
  formatVersion: 'retention-v3';

  topic: string;
  creativeBrief: string;
  title: string;
  viralAngle: string;
  contentPattern: ContentPattern;

  hookCandidates: HookConcept[];
  selectedHookId: HookConcept['id'];

  beats: StoryBeat[];
};
```

### Legacy naming

The current code/public signature may still call the second argument `researchQuery`.

Do not break the CLI solely to rename it.

Internally, V3 may normalize:

```ts
const creativeBrief = researchQuery;
```

or preserve the existing property if renaming would cause unnecessary compatibility churn.

The important semantic rule is:

> the second argument is the creative brief that controls how the video feels and argues.

---

## 16. Structured Generation Requirements

The model prompt must tell the provider, in substance:

```text
You create high-retention voiced vertical Shorts for Tell Me Whyyyyyy.

TOPIC is what the video is about.
CREATIVE BRIEF defines personality, audience, angle, proof, bans, close, facts fence, and optional content pattern.

Do not write a polite lecture.
Do not start by asking the topic as a question.

First generate exactly 3 meaningfully different hook candidates.
Every hook is a declarative claim.
Every hook includes:
- spoken hook
- short display copy
- unresolved curiosity target
- exact first visual intent
- required visible objects
- 2–3 ordered stock queries
- five 1–5 scores

Then build exactly 5 story beats around the selected hook:
1. hook
2. context
3. curiosity-reset
4. mechanism
5. payoff

The curiosity-reset must introduce new information and reopen curiosity.
Do not reveal the full mechanism in the first five seconds.
Every beat must add new information.
Spoken lines sound natural.
Display text is short and visual.
Search queries describe concrete filmable things.
Obey the brief's bans and factual fence.
Do not include the channel outro in the story.
Return only structured data.
```

Do not require the provider to choose the hook winner. Code selects it deterministically.

If implementation uses one provider call, the provider may generate the story assuming the candidate it believes will win **only if** code then verifies that the story's hook corresponds to the deterministic selected candidate. If that creates inconsistency, use two generation stages:

```text
call 1: generate 3 hook candidates
code: select winner
call 2: generate story from selected hook
```

### Recommended approach

Use **two logical generation stages** if the current OpenAI abstraction makes this clean.

Reason:

- hook selection becomes deterministic,
- the story cannot accidentally be written around a losing candidate,
- hook failures are easier to diagnose,
- later experimentation can replace hook scoring without rewriting story generation.

Do not introduce a second provider/vendor; both stages may use the same existing OpenAI client.

---

## 17. Validation

Provider-side structured output is not sufficient by itself.

Continue to validate parsed results locally.

### Hook candidate validation

Reject when:

- candidate count is not exactly 3,
- id set is not exactly `hook-a`, `hook-b`, `hook-c`,
- any score is outside integer 1..5,
- spoken hook is blank,
- display text is blank,
- curiosity target is blank,
- required visual object list is empty,
- search query count is outside 2..3,
- duplicate query exists within a candidate,
- normalized hooks are duplicates,
- hook violates banned opening/question rules,
- display text exceeds 9 words,
- spoken hook exceeds 22 words.

### Selected hook validation

- `selectedHookId` must be computed by code,
- story hook `spokenText` must equal the selected HookConcept `spokenHook` after normalization,
- story hook `displayText` must equal selected hook display text,
- story hook visual intent/queries must come from the selected hook contract rather than being silently regenerated into a different first-frame idea.

### Story validation

Reject when:

- beat count is not exactly 5,
- role order differs from:
  `hook → context → curiosity-reset → mechanism → payoff`,
- total story duration is outside 20..28 seconds,
- display text exceeds 9 words,
- required visual objects are empty,
- search query count is outside 2..3,
- duplicate search query exists within a beat,
- hook curiosity target is missing,
- curiosity-reset curiosity target is missing,
- exact normalized spoken text repeats between beats,
- exact normalized display text repeats between beats,
- payoff contains explicit subscribe/follow CTA,
- emphasis word does not exist in display text.

Semantic paraphrase detection does not need a new AI review service in V3. Prompt design + `beatPurpose` + `newInformation` + human acceptance review are sufficient for this iteration.

---

## 18. Prompt Ban List Enforced by Code

At minimum, first-hook validation must recognize these banned starts:

```text
why
how
what
did you know
have you ever wondered
ever wonder
ever notice
hey
welcome
today we're
in this video
```

The creative brief may add additional banned phrases for a topic.

Do not hard-code topic-specific bans into global validation.

---

## 19. Debug Artifacts

Persist enough information to diagnose performance failures after publishing.

### `plan.json`

Must contain:

- `formatVersion: "retention-v3"`,
- topic,
- creative brief,
- title,
- viral angle,
- content pattern,
- all three hook candidates,
- all hook sub-scores,
- computed total hook score,
- selected hook id,
- tie-break decision if relevant,
- five story beats,
- beat purpose,
- new information,
- curiosity targets,
- spoken text,
- display text,
- visual intents,
- required visual objects,
- all search queries.

### `resolved.json`

Continue to persist:

- resolved clip metadata per beat,
- selected search query,
- source metadata,
- local path.

### `run.json`

Include at minimum:

```text
formatVersion
topic
contentPattern
selectedHookId
selectedHookTotalScore
storyDurationSeconds
finalDurationSeconds
beatCount
spokenWordCounts
displayWordCounts
selectedSearchQueries
```

Do not put API keys, Authorization headers, or hidden provider reasoning into artifacts.

---

## 20. Failure Classification

V3 expands the existing quality buckets.

Use one primary classification per failure.

```text
HOOK_GENERATION
  Three candidate hooks are weak, generic, repetitive, or factually unsupported.

HOOK_SELECTION
  Candidate scores/selection choose an obviously worse valid hook or selection is non-deterministic.

FIRST_FRAME
  Hook concept is good but visual intent, required objects, display text, or selected footage does not identify the subject quickly.

CURIOSITY_RESET
  Beat 3 does not reopen curiosity or merely paraphrases prior information.

STORY_REPETITION
  Multiple beats repeat the same thesis.

STORY_PACING
  The story is correct but spends too long before new information/payoff.

SPOKEN_COPY
  Narration sounds like headlines, robotic fragments, or a lecture.

DISPLAY_COPY
  On-screen text is too dense, redundant, or unreadable.

VISUAL_QUERY
  Generated search queries do not describe the intended concrete footage.

PEXELS_MATCH
  Search queries are good but the stock provider returns poor matches.

TEXT_READABILITY
  Rendering/layout problem.

RENDERING
  Technical video defect.
```

Fix the responsible layer only.

Do not “fix” a poor hook by adding random transitions.

Do not “fix” a Pexels mismatch by changing factual story copy.

---

## 21. Rendering Requirements

V3 is not a visual-template redesign.

Preserve the successful V2 rendering principles unless current repo behavior has already intentionally changed them:

- 1080×1920,
- ~30 FPS,
- H.264 MP4,
- full-frame video,
- fast cuts,
- large readable display text,
- safe text area,
- subtle footage motion if already used,
- strong hook text hierarchy,
- no slow intro before the hook,
- existing channel outro remains separate.

The first frame must not spend time displaying a logo before the claim.

If the current voiced implementation has word-level captions or TTS, preserve them. V3 does not replace the audio engine; it changes the content plan supplied to it.

---

## 22. Out of Scope

Do not add these as part of V3:

- YouTube upload automation,
- posting scheduler,
- automatic analytics ingestion,
- automated Stayed-to-Watch feedback loop,
- runtime topic virality scoring,
- spreadsheet parsing inside the video generator,
- auto-reordering the posting schedule,
- new stock providers,
- AI-generated video provider,
- vision-model footage scoring,
- multiple Remotion templates,
- automatic A/B publishing,
- automatic regeneration after low views,
- a web dashboard.

The 52-topic Excel workbook remains the external content-strategy layer.

Its `Virality Score` is planning metadata, not a runtime V3 model feature.

---

## 23. Acceptance Topics

Replace the old V2 IKEA / airplane-window / supermarket-milk acceptance trio with the three videos that gave the clearest real Tell Me Whyyyyyy performance lessons.

### A. Balanced reference

```text
Topic:
A Runway Can Change Its Number Without Moving

Pattern:
BALANCED_REVEAL
```

Human acceptance:

- first sentence is a contradiction understandable immediately,
- first visual clearly shows runway/airport/runway marking,
- hook does not explain magnetic drift completely,
- curiosity reset adds a second reason to continue,
- mechanism explains magnetic heading/drift without jargon dumping,
- payoff reframes the runway number,
- five beats form one story.

### B. Familiarity reference

```text
Topic:
Costco Isn't Just Checking Whether You Paid

Pattern:
FAMILIARITY_TWIST
```

Human acceptance:

- Costco/warehouse/receipt/cart context is visually obvious immediately,
- opening challenges the obvious “theft/security only” explanation,
- context gives a partial answer,
- curiosity-reset introduces the customer-side or second-purpose twist,
- the middle does not become a list,
- payoff reframes the exit check as an audit/control rather than repeating the hook.

### C. Personal-stakes reference

```text
Topic:
A $40 Fill-Up Can Lock $100+ on Your Card

Pattern:
PERSONAL_STAKES
```

Human acceptance:

- the monetary consequence is understandable in the first 2 seconds,
- first-frame display copy includes the `$40 → $100+` contrast or equally clear equivalent,
- hook does not begin with “gas stations use preauthorization because…”,
- curiosity reset clarifies that the larger amount is not necessarily the final settled charge,
- mechanism preserves the strong payment explanation,
- payoff resolves the apparent missing-money contradiction without giving financial advice.

---

## 24. Automatic Acceptance Criteria

A V3 plan passes automatic validation only when:

```text
[ ] formatVersion is retention-v3
[ ] exactly 3 hook candidates exist
[ ] hook ids are hook-a, hook-b, hook-c
[ ] every hook score is integer 1..5
[ ] all hook spoken texts are unique
[ ] all hooks pass declarative-hook validation
[ ] every hook has 2–3 unique search queries
[ ] every hook has >=1 requiredVisualObject
[ ] code deterministically selects the winner
[ ] exactly 5 story beats exist
[ ] roles are hook → context → curiosity-reset → mechanism → payoff
[ ] story hook matches selected HookConcept
[ ] hook has curiosityTarget
[ ] curiosity-reset has curiosityTarget
[ ] story duration is 20–28 seconds
[ ] preferred generated duration is 22–26 seconds unless content needs otherwise
[ ] every displayText is <=9 words
[ ] every beat has non-empty beatPurpose
[ ] every beat has non-empty newInformation
[ ] every beat has >=1 requiredVisualObject
[ ] every beat has 2–3 unique search queries
[ ] no exact spoken/display duplicate exists across beats
[ ] payoff contains no subscribe/follow CTA
[ ] selectedSearchQuery remains persisted after resolution
[ ] final output remains valid vertical H.264 MP4
[ ] plan.json/resolved.json/run.json/output.mp4 are preserved
```

---

## 25. Human Acceptance Criteria

For each of the three acceptance topics:

```text
A. First spoken claim is understandable within ~2 seconds.
B. First visual identifies the subject/environment without relying on narration.
C. Display copy can be read without pausing.
D. Hook creates curiosity without explaining the full mechanism.
E. Context adds information rather than rephrasing the hook.
F. Curiosity-reset creates a real second unanswered thought.
G. Mechanism delivers the promised proof/reason.
H. Payoff resolves and reframes rather than summarizes.
I. Spoken copy sounds like a person, not five thumbnail headlines.
J. At least 4/5 selected clips are semantically relevant.
K. No obvious blank, black, clipped, or broken visual frames.
L. Channel outro remains separate from story copy.
M. No manual editing is required between CLI command and final MP4.
```

All of A–I, K–M must PASS.

J must be at least 4/5 scenes.

---

## 26. Post-Publish Evaluation Targets

These are **internal experiment targets**, not YouTube rules and not implementation acceptance gates.

For Shorts roughly 23–28 seconds long:

```text
Stayed to watch:
  target direction > 50%

Average percentage viewed among engaged viewers:
  target direction > 70%
```

The purpose of V3 is to improve both dimensions at once.

Reference interpretation:

```text
Runway:
strong entry + strong retention

Costco:
recognition/entry opportunity, but middle retention needs improvement

Gas Hold:
entry needs improvement, back-half story is already strong
```

Do not automatically regenerate or delete a Short when it misses these numbers. Analytics automation is outside V3.

---

## 27. Compatibility / Migration

V3 is a delta on the working repository.

Before implementation, Codex must inspect the current state and reconcile these known historical changes:

1. V2 spec describes silent Shorts.
2. Later v1.1 content guidance describes a punchy voiced Short.
3. V3 assumes the **current repository's audio/TTS behavior is authoritative** and preserves it.
4. Public CLI remains topic + optional/current second creative-brief argument.
5. The second argument may still be named `researchQuery` in code for compatibility; do not break the public interface just to rename it.
6. Existing Pexels ordered-query behavior should be preserved.
7. Existing Remotion rendering should be changed only where needed to consume V3 story/display fields.

If the repo contradicts one of these assumptions, Codex must stop and report the contradiction before silently redesigning the architecture.

---

## 28. Recommended Implementation Boundary

V3 should touch only the smallest set of responsibilities needed for this design.

Expected equivalents:

```text
src/
├── domain/
│   └── video-plan.*            # V3 hook + story contracts and validation
├── generation/
│   ├── prompt.*                # hook/story prompt rules
│   ├── generate-hooks.*        # optional new focused module
│   └── generate-video-plan.*   # deterministic hook selection + story generation
├── stock/
│   └── resolve-scene-assets.*  # preserve ordered query resolution; consume V3 fields
├── pipeline/
│   └── create-short.*          # persist retention-v3 metadata
└── remotion/
    └── existing components     # consume spoken/display copy; minimal V3 changes
```

Do not create modules with these exact names if equivalent focused modules already exist.

The implementation plan must be derived from the repository after inspection, not force a parallel architecture.

---

## 29. Definition of Done

V3 is complete only when:

```text
[ ] existing baseline tests pass before V3 work begins
[ ] V3 tests are written test-first
[ ] typecheck passes
[ ] CLI compatibility is preserved
[ ] exactly 3 hooks are generated and persisted
[ ] hook validation rejects generic question openings
[ ] hook selection is deterministic
[ ] selected hook drives first story beat and first-frame contract
[ ] five V3 roles are enforced
[ ] curiosity-reset is mandatory
[ ] spokenText/displayText are separate or mapped to equivalent existing fields
[ ] 20–28 second story validation is enforced
[ ] V2 ordered Pexels fallback remains deterministic
[ ] selectedSearchQuery remains persisted
[ ] retention-v3 artifacts are inspectable
[ ] Runway acceptance video passes human review
[ ] Costco acceptance video passes human review
[ ] Gas Hold acceptance video passes human review
[ ] no analytics/upload/scheduler scope is added
```

---

## 30. Next Step After Spec Approval

After the user approves this document, create a separate implementation plan using the Superpowers writing-plans workflow.

Target repository paths:

```text
docs/superpowers/specs/2026-09-03-tell-me-whyyyyyy-retention-v3-design.md
docs/superpowers/plans/2026-09-03-tell-me-whyyyyyy-retention-v3.md
```

The implementation plan should be task-by-task, TDD-first, and should require Codex to inspect the current repository before deciding whether V3 needs one structured model call or the recommended two logical generation stages.
