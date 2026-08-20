# v1.1 content — what you do

Code will encode the *rules* of a punchy voiced Short. You encode *this video’s personality* in the second generate argument.

Keep using:

```bash
npm run generate -- "<topic>"
npm run generate -- "<topic>" "<creative brief>"
```

Topic-only still works. A brief is how you stop generic AI-lesson energy.

## Topic vs brief

| Field | You write | Purpose |
|---|---|---|
| **Topic** | The subject / packaging | What the video is about |
| **Brief** | Tone, audience, angle, proof, bans, close | How it should feel and argue |

The brief is **not** “explain the Wikipedia page.” If you only write “explain why X,” you will get a polite lecture again.

## Put these in every brief

Write plain sentences. You do not need a template robot block, but cover:

1. **Tone** — sly, deadpan, wonder, slightly conspiratorial then honest, etc.
2. **Audience** — who this is for in one line.
3. **Angle** — the one idea the whole video serves.
4. **Hook direction** — a **claim**, never a why/how/what question.
5. **Must-include proof** — the one image or walk they should picture.
6. **Ban list** — phrases, extra theses, jargon, fake stats.
7. **Close** — the last thought before the channel outro.
8. **Facts fence** — stay true to what you actually believe is supported.

## Weak vs strong

**Weak (v1, boring):**

```bash
npm run generate -- "Why Supermarkets Put Milk at the Back" "Explain why stores put milk at the back."
```

**Strong:**

```bash
npm run generate -- "Why Supermarkets Put Milk at the Back" "Tone: sly, like a friend who caught a trick. Audience: people who grocery shop on autopilot. Angle: the store is using your feet, not hiding milk. Hook must be a claim, not a why-question. Proof: the walk past snacks. Ban loading docks, cold-chain, and 'ever wonder'. Close: your walk is the product. No fake numbers."
```

## After each run, check `plan.json`

- Hook is a **claim** (not “Why is milk…”, “Ever wonder…”).
- Four educational beats **escalate** (hook → you/stake → proof → twist/payoff). Nothing is a paraphrase of the line before.
- Spoken lines still sound like a person, not a headline telegram.
- `searchQueries` look like **filmable things** for that line, specific first.
- Channel outro is still last and separate.

If it is dull, **rewrite the brief and generate again**. Do not ask for more pipeline features until the brief is actually doing the job.

## What you do not do

- Do not add a third CLI argument.
- Do not write the channel sign-off into the brief (code appends it).
- Do not stuff the brief with extra theses (“also mention logistics, also mention history…”).
- Do not expect topic-only generates to have a strong personality. Personality lives in the brief.
