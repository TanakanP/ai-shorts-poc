# V4 implementation validation

Implementation tasks 1–7 are complete. Task 8 is pending live media acceptance; V3 remains the default. No V4 content sample has been accepted or published.

## Automated verification

- `npm test`: **493 passing tests across 46 files**.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- New coverage includes hook/score boundaries, all 14 reviewed briefs, source/ID checks, proof holds, six-function adaptation, actual timing, the one-rewrite limit, failure manifests, unchanged-audio reuse and V4 frame rounding.
- Independent code review identified missing held-hook rejection evidence and an early-disclosure path that skipped the permitted rewrite. Both were corrected; regression tests cover them.

## Live provider attempts

Command:

```sh
CONTENT_ENGINE_VERSION=v4 CONTENT_BRIEF_PATH=content/v4/straw-refraction.json npm run generate -- "A Straight Straw Can Look Bent in Water" "Use the reviewed brief"
```

Both attempts stopped at packaging, before footage review, final script, TTS or rendering:

- `runs/20260912-235236-aabbd67e/`: xAI generation failed; the initial wrapper logged only the public error message.
- `runs/20260912-235338-dd6ecc8b/`: failure manifest records `{provider: "xai", kind: "transport"}` after safe diagnostics were added.

A direct connectivity check to `https://api.x.ai` established a connection through `Zscaler/6.2`, then failed with `Recv failure: Connection reset by peer`. This supports a network-path failure rather than a content-quality decision. It does not establish whether a later API/schema problem might appear once connectivity is restored. No provider settings or network controls were changed.

## Local rendering checks

A synthetic fixture was used only to exercise media code. It is not proof footage and does not satisfy real-content acceptance.

- The first preview attempt exposed missing `crop`/`setsar` filters in Remotion's bundled FFmpeg. Previews now use a small Remotion composition with the same `OffthreadVideo` trim and CSS crop as the final video, without adding a dependency.
- `runs/v4-smoke/proof-preview.jpg` and `proof-preview.mp4` were created successfully. The portrait still was visually inspected.
- The subsequent full short render failed with `NetworkError: A network error occurred.` in the existing rendering path. That path loads Montserrat through `@remotion/google-fonts`; the precise failing request was not captured, so font loading is a suspected cause, not a confirmed diagnosis.
- V4 composition duration now uses the same per-scene frame rounding as its voice timeline and duration gate. V3 metadata calculation remains unchanged.

## Remaining acceptance work

1. Restore working provider/render network access and retry the straw package.
2. Review genuine proof clips/crops for straw and paper towel (or documented allowed alternates). No clip availability has been established by the failed requests.
3. Complete the two live V4 generations and manually review first frame, speech, karaoke, second reveal, sign-off, facts, metadata and encoded duration.
4. Generate/review a live V3 reference as specified in Task 8.
5. Change the default to V4 only after two real V4 MP4s pass review. Do not treat the synthetic preview or mocked pipeline tests as those samples.

All outputs remain local. No analytics subsystem, scheduler, upload or database was introduced.
