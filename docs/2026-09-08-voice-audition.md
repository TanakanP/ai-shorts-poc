# Voice speed audition

Generated two xAI Helix samples with identical wording, no music and no delivery tags.
Script: “A runway can change its number without moving. The painted number follows its
compass heading. But magnetic north drifts. The pavement stays put, while the number
can change.” This is a delivery sample, not a finished five-beat Short.

| Speed | Reported TTS duration | MP3 duration |
| --- | --- | --- |
| Current 1.2× | 9.10 s | 9.143 s |
| Normal 1.0× | 9.83 s | 9.874 s |

Both files verified as MP3, 44.1 kHz. Samples and a reproducible local audition script
are in ignored `runs/voice-audition-2026-09-08/`; transfer separately if needed.
This compares single-request narration, not the production scene-by-scene cadence.
One sample per speed cannot separate all generation variability from speed effects.
Listening preference is pending; no voice quality or retention improvement is claimed.
Production voice settings remain unchanged. No source code was modified.

The initial request failed TLS verification before synthesis; retry used Node's
`--use-system-ca` to use macOS trusted certificates, preserving TLS verification.
