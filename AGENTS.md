# Project Instructions

This project implements voiced AI Shorts (v1.2.0 / retention-v3): three hook candidates, deterministic hook selection, a five-beat story with a mandatory curiosity-reset, spoken vs display copy, karaoke captions, unique stock from ordered Pexels queries, a channel sign-off, and a local music bed.

Primary implementation plan:
docs/superpowers/plans/2026-09-03-tell-me-whyyyyyy-retention-v3-plan.md

Content owner notes (not code):
misc/v1_1_content_enhance.md

Rules:
- Follow the implementation plan task-by-task and in order.
- Use test-driven development.
- Do not add features outside this plan.
- Output is still a locally rendered MP4.
- Keep voice, karaoke, BGM, and the channel outro.
- No YouTube upload.
- No silent-short rewrite.
- No dark wash.
- No scheduler, database, or analytics.
- Keep modules small and independently testable.
- Run tests after every task.
- Commit after each completed task.
- Never put API keys in source control.
