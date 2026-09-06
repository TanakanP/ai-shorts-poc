# Attention review handoff

## Resume here on the new MacBook

Read `AGENTS.md`, this note, and `output/pdf/report-source.md`. The complete report is `output/pdf/tell-me-whyyyyyy-attention-review.pdf`; evidence and limitations are in `output/pdf/research-evidence.md`.

The owner requested analysis of inconsistent topics, flat xAI voice-over, unrelated Pexels footage, long captions, and boring OpenAI-generated stories. They prefer true one-word replacement captions, without karaoke. This session completed the audit only; no proposed feature was implemented or final implementation plan approved.

## Findings and priorities

1. Improve topic/angle selection and obtain a concrete proof shot before scripting. The workbook contains 52 topics; the report assesses every row.
2. Stock scoring checks URL substrings, not video content. Gas-nozzle shots selected laboratory tubes and abstract art. Require actual object/action relevance and avoid silent unsuitable fallback.
3. Hooks can be too long after synthesis. Three of five local outputs exceeded 30 seconds; the voice timeline allows up to 60 seconds despite the tighter story target. Measure actual voiced timing.
4. WordCaption displays entire clauses with karaoke highlighting. Existing timestamps can support true one-word replacement; specify pause/end behavior and preserve the separate sign-off.
5. Audition xAI delivery on identical scripts before changing provider. Speed is fixed at 1.2, scenes are synthesized independently, and each gets 0.3 seconds of padding.
6. Hooks are self-rated with heavily inflated scores; structural story checks do not guarantee novelty. Prefer demonstrations and connected storytelling.
7. Local briefs use unsupported SURPRISED_REVEAL, which silently defaults to BALANCED_REVEAL. The workbook uses supported patterns.
8. The production structured generation call has no retrieval tool. A brief saying "verify" does not perform fact-checking.

## Scope and validation

Existing project instructions require the retention-v3 implementation plan, TDD, per-task checks and commits. Future changes should reconcile the new caption preference and other proposed scope changes with that plan before implementation. Keep local MP4 output, voice, BGM and outro; no upload automation, scheduler, database or analytics subsystem.

All 384 tests (32 files) and typechecking passed during the audit. Three localhost tests initially failed with sandbox EPERM, then passed with localhost access. The pre-existing package-lock.json change was not part of the audit.

Public channel: https://www.youtube.com/@Tell.Me.Whyyyyyy . The observed public listing contained 18 videos; the workbook had 21 Schedule=true rows. Do not equate Schedule with confirmed publication. Public views are unequal-age observations. Historic analytics are in the September 3 design notes, not fresh Studio exports. No complete listening comparison was performed, and no retention gain is established.

## Files to transfer separately

- `Plainly Curious Schedules.xlsx` was read from the old Mac's Downloads folder and is not included in this commit.
- `runs/` contains ignored generated MP4s, source clips, audio and JSON artifacts cited by the report. Copy it separately if the original evidence/rendered media is needed.
- Transfer `.env` credentials securely, outside Git. Reinstall dependencies with `npm ci` on the new machine.
- Git preserves committed files, not the Codex conversation itself. This note and the report preserve the working conclusions and next steps independently of task-history migration.

Suggested new-task prompt: "Read AGENTS.md, docs/2026-09-07-attention-review-handoff.md and output/pdf/report-source.md. Help me turn the attention-review recommendations into the next scoped implementation plan. Start with footage relevance, actual voiced timing and true one-word replacement captions."
