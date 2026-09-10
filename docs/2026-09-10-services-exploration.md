# Service exploration — video first

Checked 10 September 2026. This is a research shortlist, not a quality benchmark. No paid generations, subscriptions or provider integrations were started.

Local `main` now includes the attention improvements through `9895167`. Exploration continues on `codex/services-explore`. Current pipeline: OpenAI script generation, xAI voice, Pexels stock, local Remotion MP4. Preserve voice, captions, BGM, outro and the 15–33-second voiced limit.

## Video shortlist

The problem is finding the correct visible action, not merely attractive footage. More stock increases choice; generation can supply custom scenes but may depict the science incorrectly. Keep human preview and rejection for both.

| Service | Why test it | Current API cost, USD | Main tradeoff |
| --- | --- | --- | --- |
| Pixabay | Easiest additional stock source; compare everyday-object coverage against Pexels | Free API | Another catalogue may still miss the exact action. Check returned dimensions for portrait suitability. |
| Shutterstock | Paid real-footage candidate with video search and licensing APIs | Confirm video licensing/API plan before trial | More licensing expense and setup than Pixabay; coverage must be tested. |
| fal-hosted Wan | Additional generated-video candidate behind a hosted API | Model-specific pricing; check the chosen endpoint | fal is a hosting platform, Wan is the model; version, price and quality vary. |
| Google Veo 3.1 Lite | First generated-video candidate: text/image input, portrait output, 4/6/8-second clips | $0.05/s at 720p; $0.08/s at 1080p | Preview model; inspect physical behaviour carefully. Generated audio is unnecessary for our separate narration. |
| Runway Gen-4 Turbo | Animate an approved starting image for more control over the initial composition | $0.05/s, plus the starting image if generated | Image input required; preparing the image adds a step. |
| xAI Grok Imagine Video | Convenient trial alongside the existing xAI account | Original `grok-imagine-video`: $0.05/s at 480p, $0.07/s at 720p; media input charges may apply | Same provider does not prove better footage. Do not confuse this model with the more expensive 1.5 version. |

Sources: [Pixabay API](https://pixabay.com/api/docs/), [Veo pricing](https://ai.google.dev/gemini-api/docs/pricing), [Veo Lite formats and durations](https://blog.google/innovation-and-ai/technology/ai/veo-3-1-lite/), [Runway pricing](https://docs.dev.runwayml.com/guides/pricing/), [Runway supported inputs](https://docs.dev.runwayml.com/guides/models/), [xAI API pricing](https://docs.x.ai/developers/pricing).

Additional sources: [Shutterstock video search](https://www.shutterstock.com/developers/documentation/searching), [Wan hosted endpoint](https://fal.ai/models/fal-ai/wan/v2.7/text-to-video), [fal billing units](https://fal.ai/docs/documentation/model-apis/pricing).

Pixabay requires 24-hour request caching and source identification when showing search results; avoid mass automated querying. A small user-triggered search/preview flow fits our personal workflow. [API requirements](https://pixabay.com/api/docs/)

My recommendation: compare Pixabay and Pexels first, then test Veo Lite only on the missing shots. Keep generated visuals illustrative; a realistic-looking clip is not factual evidence. For a hard mechanism, a simple explanatory diagram or a personally filmed demonstration can be more useful than repeated generations.

## Script and voice alternatives

| Stage | Candidate | Reason to audition |
| --- | --- | --- |
| Script | xAI Grok | First script alternative to try because we already use xAI voice. Structured JSON output can represent our hook candidates and beats. Reuse the account and potentially the key, subject to its endpoint/model permissions. |
| Script | Gemini 3.1 Flash-Lite | Low-cost baseline: $0.25/M input and $1.50/M output tokens. Test the existing hooks and five-beat schema, factual fidelity and stock-friendly visual ideas. |
| Script | Claude Sonnet family | Compare writing quality on the same briefs. Select the currently available model from the official catalogue before implementation; no quality advantage has been measured here. |
| Voice | ElevenLabs | First alternate voice audition. Its timing endpoint returns character alignment suitable for our caption conversion. Starter is $6/month with 30k shared credits and a commercial licence. |
| Voice | Cartesia Sonic | Second audition candidate; its WebSocket API supports timestamps. More integration work than our current single-response TTS flow. |
| Voice | Amazon Polly | Third alternate with word-level speech marks. Audio and speech marks require separate requests; confirm the chosen engine/voice supports the marks needed for karaoke. |

Sources: [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Claude catalogue](https://platform.claude.com/docs/en/models/overview), [ElevenLabs timing API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps), [ElevenLabs pricing](https://elevenlabs.io/pricing), [Cartesia timestamp API](https://docs.cartesia.ai/api-reference/tts/websocket).

Additional sources: [xAI structured outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs), [xAI key permissions](https://docs.x.ai/developers/rest-api-reference/management/auth), [Polly speech marks](https://docs.aws.amazon.com/polly/latest/dg/speechmarks.html).

### Using xAI for scripts as well as voice

Yes: Grok generates the text/JSON, while the existing TTS endpoint speaks the selected script. This does not require changing the voice. The existing `XAI_API_KEY` can be reused if its permissions include the selected text model and endpoint; account-specific access has not been tested. Text and speech incur their respective API charges.

The current script adapter uses OpenAI `responses.parse` and Zod schemas. Add an alternate adapter using xAI's documented structured-output interface, preserving local schema validation, deterministic hook selection and all story rules. Do not assume every OpenAI request option transfers unchanged. Compare the same three briefs before selecting a new default. Video remains the first exploration priority.

## First small comparison

Use three current topics: condensation on a glass, popcorn popping, and the bent-straw refraction illusion. These cover an easy object shot, fast action and a physically demanding effect.

1. Search Pexels and Pixabay with the same three queries per topic; inspect up to five candidates per query. Record usable shots, portrait crop and review time in a small local table.
2. For missing shots, try two six-second Veo Lite 720p candidates per topic: 36 generated seconds, approximately **$1.80** at the published rate. This is a proposed trial, not spend already incurred; retries increase cost.
3. Compare object accuracy, visible action, physical plausibility, portrait framing and cost per accepted shot. A pretty but incorrect mechanism fails.
4. Integrate only the useful provider, then audition alternate voices and scripts. Keep existing providers as the comparison baseline.

No provider winner is established until those clips are reviewed. API and consumer-app subscriptions can have different billing; the figures above refer to the cited API or named subscription tier.
