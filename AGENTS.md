# Project Instructions

This project implements voiced AI Shorts. V5 adds original Grok-generated animation import beside V3 and V4. V4 adds contradiction-first planning and reviewed visual proof while preserving V3 as a rollback path. Spoken/display copy, karaoke, channel sign-off and local music are shared. Unique stock and reviewed visual proof apply to V3/V4.

Authorized V5 implementation plan:
docs/superpowers/plans/2026-09-18-content-v5-plan.md

V4 maintenance plan:
docs/superpowers/plans/2026-09-12-content-v4-plan.md

Content owner notes (not code):
misc/v1_1_content_enhance.md

Rules:
- Follow the implementation plan task-by-task and in order. For V5 work use the V5 plan; for V4 maintenance use the V4 plan.
- Implement code first; add focused unit tests as final polish, per the approved workflow.
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
