# Project Instructions

This project implements voiced AI Shorts. V4 adds contradiction-first planning and reviewed visual proof while preserving V3 as a rollback path, spoken/display copy, karaoke, unique stock, channel sign-off and local music.

Primary implementation plan:
docs/superpowers/plans/2026-09-12-content-v4-plan.md

Content owner notes (not code):
misc/v1_1_content_enhance.md

Rules:
- Follow the implementation plan task-by-task and in order.
- Implement code first; add focused unit tests as final polish, per the approved V4 workflow.
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
