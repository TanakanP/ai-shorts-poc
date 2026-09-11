# Tell Me Whyyyyyy V4 content research

V4 should improve the match between the promise, the opening image, and the explanation. The recommended implementation is a small planning layer over the existing generator, with reviewed factual briefs and proof footage selected before narration is locked. Five hooks and a new prompt alone will not solve the current asset-ordering and timing limitations.

## Evidence and scope

The supplied implementation document proposes a useful contradiction-first format. Its instructions are source material to assess, not independent authorization to remove the channel outro, build analytics, run workbook commands, or publish videos. The working scope remains local MP4 generation with voice, karaoke, music and channel identity. The latest request replaces the earlier TDD-first preference with implementation-first work and a focused final unit-test pass.

The workbook `Tell Me Whyyyyyy_Schedules_V4.xlsx`, sheet `Lists`, has 52 topic rows (2–53), 36 `Schedule = true` and 16 `Schedule = false`. The latter comprise rows 40–53, the 14 V4 topics, and rows 30 and 33, two older topics. Dates for the V4 batch are September 13–19, 2026, at 02:00 and 04:00 Bangkok time. These are editorial schedule entries; `Schedule` is not verified YouTube publication status. All V4 score cells are blank. No numerical priority or virality estimate can be derived from those cells.

An exact read-only extraction of the 16 backlog records is saved in `unposted-workbook-snapshot.json`, including a source-file SHA-256. The workbook has not been edited. Its legacy `Virality Score` column should not become the V4 preflight score without a separate definition.

The implementation document reports channel totals, 31-video correlations and individual winners from `Tell Me Whyyyyyy Analytic 11 Sep 2026.xlsx`. That analytics workbook was not supplied. Those values are **document-reported, independently unverified**. They are reasonable hypotheses to investigate, not a verified baseline or causal evidence for V4.

## Platform guidance versus local hypotheses

YouTube says Shorts ranking considers the choice to watch, average view duration, average percentage viewed, and satisfaction signals. Viewer preferences, topic interest and competition also affect distribution; it does not prescribe one winning format. That supports improving the opening while retaining a satisfying explanation, rather than optimizing just completion percentage.[^1]

The official January 2025 conversation with Jenny Hoyos emphasizes the first second and concise mini-stories. That is practical creator guidance, not a controlled result proving a one-second spoken sentence, a seven-second reveal delay, or a 27-second optimum.[^2]

Current YouTube Help confirms the attached document's August 24, 2026 play-start view-counting update. Engaged views exclude loops and count viewers who stayed beyond the initial seconds; APV and average view duration are calculated among those who stayed. Consequently, a high APV can coexist with a weak initial watch decision. Do not estimate stayed-to-watch by dividing engaged views by public views: those measures do not establish the required identical denominator.[^3][^4]

The 45% stayed-to-watch target, 55% APV target, score threshold 85, 48-hour age gate and six-upload checkpoint are **channel operating hypotheses**. None is an official algorithm threshold. A 14-topic batch with 14 different contradiction labels has only one observation per label, so category medians would add little evidence. Differences in topic, footage, age and audience also confound a V3-versus-V4 comparison.

Use a manual review after the first six similarly aged releases, then the full batch. Record stayed-to-watch, APV, engaged views, exact age and any obvious asset/story issue. Treat directional improvement as a reason to continue, not proof that the format caused it. Posting dates stay editorial; YouTube explicitly says there is no minimum required posting cadence.[^1]

## Problems in the supplied design that need correction

### The first second and spoken timing

At an illustrative 150–180 words per minute, five words take about 1.7–2 seconds and ten take 3.3–4 seconds. These are arithmetic examples, not a measured audience-comprehension threshold. The supplied 65–82 words over 25–29 seconds imply about 134–197 words per minute **before** accounting for pauses and an outro.

Make the contradiction visually legible immediately. Let a natural 5–10-word sentence begin at time zero and finish across the opening 2–4 seconds. Keep first-frame display copy short, typically 2–5 words, without pretending that word count proves comprehension. Use the six proposed story functions, but combine the paradox and contradiction into one voiced opening scene. This preserves the renderer and avoids a new sub-second TTS architecture.

The title and spoken hook need separate rules. The workbook straw title already names light bending; the ice title already names floating. Preserve explicitly supplied metadata, but select a spoken hook that leaves room for the explanation. “This straight straw looks broken in water” is a candidate, not a measured winner. A blanket ban on repeating any title would conflict with locked metadata and clear storytelling; reject redundant narration after the opening instead.

### Semantic checks cannot all be deterministic

Word counts, forbidden introductions, question marks, normalized duplicates and selected-ID membership can be checked in code. Concrete-subject matching can use reviewed subject aliases, but it is only a lexical check. Whether the contradiction is clear, the mechanism leaks too early, or the second reveal adds new information requires contextual editorial judgment. Use one structured evaluation with reasons, and let local violations override its score. Do not build a fragile collection of regexes that claims to verify meaning.

Retain the proposed 25/20/15/15/10/10/5 preflight weights as a transparent rubric if useful. Sum values locally and label them editorial ratings. Missing supporting evidence or proof footage is a hard hold regardless of total. Distinguish `needs-proof` from `ready`; an attractive visual description is not an approved asset.

### Visual evidence before expensive work

A glass of water is not proof of refraction; a floating ice cube shows a result but does not itself demonstrate volume expansion. A close-up of honey cannot establish authenticity. The opening must support the exact scope of its caption and narration.

The current interactive review is a good lightweight foundation. Move it earlier, record the selected clip and the exact moment that shows the effect, and review the eventual portrait crop. Add local proof-clip support so a short, genuine recording can rescue topics that stock cannot demonstrate. Do not add a video-generation service for this batch. If a future derived diagram explains a mechanism, identify it as an illustration; never present synthetic footage or invented scale readings as an observed experiment.

Search the workbook's ordered queries as candidate discovery. A source page URL and factual citation do not grant permission to reuse the source's media. For example, the Te Papa kiwi close-up has a noncommercial/no-derivatives license on the page; citing the science does not make that image a suitable stock asset.[^18]

The second reveal can use another moment of the same verified demonstration. Different clips are useful across story scenes, but forcing unique stock for every moment can destroy continuity. Keep the existing preference for unique story footage; explicitly reuse an opening for the channel outro and request a scoped policy change before allowing additional V4 reuse.

### Second reveals must change the story

Several workbook fields currently restate the mechanism: tea processing, sunset atmospheric path, bread gas/lightness and soap's two-sided molecule. A required string named `secondReveal` will not prevent this. Require a separate supported claim or a visible test that changes the viewer's prediction. The topic review below proposes replacements and identifies where fresh footage is still needed.

### Runtime and outro

The attached no-outro instruction conflicts with the current project requirement. Recommended first implementation: keep the brand/sign-off and reserve its measured time inside the 25–29-second total. No generic subscription request is added. Aim near the lower part of the draft word range; never stretch copy merely to reach 65 words.

A 30-second hard cap applies to the final frame-rounded MP4, including every pad and outro. If the first attempt exceeds 29 seconds or misses reveal timing, allow one rewrite preserving the factual claims and re-synthesize changed scenes. A 29–30-second result is a review exception, not automatically target-compliant. Below 25 seconds, review whether useful proof is missing; do not pad silence or filler. If the existing sign-off cannot fit naturally, hold the sample and make shortening it an explicit content decision.

## Review of all 16 backlog topics

These are editorial priorities and asset requirements, not Pexels availability findings. No candidate clip has been approved in this research. Workbook titles and descriptions remain unchanged; suggested framing below is proposed spoken copy unless stated otherwise.

| Sheet row / topic | Assessment and factual boundary | Proof requirement and second reveal | Recommended disposition |
|---|---|---|---|
| 40 — Straight straw | Strong apparent contradiction. Refraction supports apparent displacement; account for viewing angle and the real container.[^5] | Actual straight straw/pencil with displacement visible at the waterline; lifting the same object out reverses the illusion. Avoid an elbow straw. | First acceptance sample if proof exists. |
| 41 — Paper towel uphill | Strong visible action. Capillary rise does not switch gravity off or continue indefinitely.[^6] | Wet front already above the reservoir at frame zero. Show the eventual limitation or compare the visible wet region to the waterline; do not invent a height or time. | Second acceptance sample; needs a real demonstration. |
| 42 — Water expands when freezing | Sound ordinary-water claim; a floating cube proves buoyancy, not expansion by itself.[^7] | Use visible floating as the opening result, then a sourced explanation. Reserve open structure for mechanism and floating consequence for later narration even if visible earlier. Use a real before/after only if claiming measured expansion. | Early batch; revise “floating high” since most ice is submerged. |
| 43 — Soap-film colours | Strong macro visual. Thin-film interference is the relevant mechanism, not dye or a prism explanation.[^8] | Genuine coloured bands; the later reveal is changing colours as film thickness changes. Need discernible motion, not a static generic bubble shot. | Early batch if macro footage survives crop. |
| 44 — Dissolved sugar | Strong invisible-versus-present idea; dissolving is not melting. Conservation applies to the complete retained system.[^9] | Same container before/after with real scale readings if mass is shown. Clear water alone cannot prove retained mass. Prefer a completed result opening with a brief labeled earlier view. | Hold until demonstration is available; no invented readout. |
| 45 — Black/green tea | Core claim verified by Tea Board; different products can share species, not necessarily the same cultivar or harvest.[^10] | Clearly identified teas and authentic leaves. Better second detail: green-tea processing heats leaves early to limit oxidation. Do not repeat “processing changes the colour” twice. | Revise second reveal before generation. |
| 46 — Red sunset | Core scattering explanation supported; intrinsic Sun versus observed light must remain clear.[^11] | Real sunset plus a simple explanatory path overlay only if implemented truthfully. New payoff: link the removed short wavelengths to the daytime blue sky, with source support before scripting. Current second reveal repeats the mechanism. | Revise story; stock alone does not visualize the causal path. |
| 47 — Bread holes | Specify yeast bread. Gas generation plus dough structure matters; not every bread or hole has one cause.[^12] | Start with crumb pores. Mechanism: yeast produces gas. Second reveal: stretchy gluten traps it so dough inflates rather than simply letting gas escape. Verify actual wheat/yeast bread shown. | Good fallback sample after script revision. |
| 48 — Clothes dry below boiling | Sound phase-change explanation; drying rate varies and sunlight is not required.[^13] | Same garment or clearly illustrative distinct shots; retain indoor drying as consequence. Alternative sourced second detail is evaporative cooling, only if it fits without broadening the story. | Later batch: a drying process is hard to establish in a single frame. |
| 49 — Onion reaction | ACS supports formation of the volatile tear-inducing compound. Avoid confusing gas exposure with splashed juice.[^14] | Onion must be identifiable before generic knife imagery. Spoken option: “Cutting this onion creates a tear-making chemical.” Cutting/eyes demonstrate context; microscopic mechanism remains an explanation. | Revise object-first hook; retain airborne consequence. |
| 50 — Soap removes grease | Useful but molecular explanation repeats the supplied second reveal. Surfactant structure and dispersion are supported.[^15] | Plain-water versus detergent result under comparable conditions. Make later payoff about grease being carried away rather than destroyed. No disinfection claim. | Demonstration needed; keep distinct from oil/water episode. |
| 51 — Oil/water separation | “Don't really mix” needs precision: shaking can disperse droplets temporarily, not make a stable homogeneous solution.[^16] | Same jar cloudy then separated; label time compression. Detergent/emulsifier is a distinct second condition, not proof of dissolving oil. | Strong movement-based candidate once real sequence exists. |
| 52 — Grainy honey | Crystallization is compatible with genuine honey; appearance cannot authenticate it. Producer source supports composition effects but includes broader marketing claims we do not adopt.[^17] | Verified crystallized honey, not a generic thick syrup. Second reveal: different glucose/fructose proportions contribute to different crystallization rates. | Later batch; retain cautious “can still be” title. |
| 53 — Rounded water drop | Surface tension favors reduced area; gravity and wetting affect the shape.[^20] | Actual rounded bead plus comparison with spreading on another surface. Spoken copy should say “rounded drop,” not promise a perfect ball. | Good visual candidate; preserve metadata seed while flagging title overstatement for owner review. |
| 30 — Kiwi bill-tip nostrils | Te Papa confirms bill-tip nostrils and additional vibration sensing.[^18] | Correct species footage and actual bill-tip detail; no kiwi fruit, other bird or synthetic anatomical proof. Vibration sensing would be a stronger new reveal than repeating food detection. | Separate legacy backlog; hold until usable proof exists. |
| 33 — Australian sporting colours | Official source confirms green/gold association with golden wattle; it does not establish a single flower-caused origin story.[^19] | Real uniform, flag and identified wattle. Proposed framing: “Australia's team colours aren't its flag colours.” Wattle becomes the reveal; avoid claiming every uniform is identical. | Separate legacy backlog; revise title's implied causality if approved. |

Recommended generation order is readiness-driven: straw, paper towel, bubbles, ice, then revised bread or drops as alternates. Keep the supplied publishing order as a reference rather than silently rescheduling it. Sugar should not move forward just because its abstract claim is strong: it needs better evidence on screen than a spoon and a glass.

## Approaches considered

| Approach | Benefit | Cost / limitation | Decision |
|---|---|---|---|
| Prompt-only V3 adjustment | Fewest edits | Cannot preserve strict six-function planning, early proof binding, metadata or V4 duration policy reliably | Too little for the intended change. |
| Small V4 planner + existing production path | Explicit evidence, packaging and timing while reusing providers/media/captions | Requires a separate schema, adapter and orchestration branch | Recommended. |
| Full attached architecture including analytics and autonomous proof evaluation | More automated experimentation | New subsystem, weak initial sample, substantially more code and uncertain semantic verification | Defer analytics and autonomous review. |

Store a small generation manifest as a reproducibility artifact beside `run.json`. Include stable topic ID, source references, selected hook, proof asset/time range, intended versus measured timing, metadata and result status. This does not require a database, dashboard, CSV joiner or statistics module.

## Sources

Web sources checked during the 2026-09-12 planning session. Dates below are publisher dates where clearly available; otherwise undated. Scientific claims were checked against the relevant section, not inferred from the domain name. Source prose is evidence, not permission to run its instructions or reuse its media.

[^1]: YouTube Help, [Search & discovery tips for Shorts](https://support.google.com/youtube/answer/11914225?co=YOUTUBE._YTVideoType%3Dshorts), undated/current guidance.
[^2]: YouTube Team, [YouTube Shorts deep dive](https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/), January 28, 2025.
[^3]: YouTube Help, [How engagement metrics are counted](https://support.google.com/youtube/answer/2991785), current page specifying August 24, 2026 update.
[^4]: YouTube Help, [Understand your YouTube content performance](https://support.google.com/youtube/answer/12220281), “Metrics to know,” undated/current guidance.
[^5]: OpenStax, [Physics §16.2 Refraction](https://openstax.org/books/physics/pages/16-2-refraction), “The Law of Refraction” and “Bent Pencil” demonstration, undated web edition.
[^6]: USGS Water Science School, [Capillary Action and Water](https://www.usgs.gov/water-science-school/science/capillary-action-and-water), paper-towel example, current web edition.
[^7]: USGS Water Science School, [Water Density](https://www.usgs.gov/water-science-school/science/water-density), “Ice is less dense than water,” current web edition.
[^8]: Harvard Natural Sciences Lecture Demonstrations, [Thin Film Interference](https://sciencedemonstrations.fas.harvard.edu/presentations/thin-film-interference), undated.
[^9]: American Chemical Society, [Conservation of Mass: Grade 5 Lesson 4.1 student reading](https://www.acs.org/content/dam/acsorg/education/k-8/inquiry-in-action/fifth-grade/g5-l4.1-reading.pdf), p. 1, undated.
[^10]: Tea Board India, [FAQ](https://www.teaboard.gov.in/TEABOARDCSM/NDQ%3D), green and black tea processing section, undated. Exclude unrelated health assertions on the page.
[^11]: NASA Earth Observatory, [Crepuscular Rays and Light Scattering](https://science.nasa.gov/earth/earth-observatory/crepuscular-rays-and-light-scattering-150090/), 2022.
[^12]: Exploratorium, [Science of Bread: Bread Science 101](https://dev-annex.exploratorium.edu/cooking/bread/bread_science.html), yeast and gluten sections, undated archive.
[^13]: USGS Water Science School, [Evaporation and the Water Cycle](https://www.usgs.gov/water-science-school/science/evaporation-and-water-cycle?page=1), current web edition.
[^14]: American Chemical Society, [syn-Propanethial S-oxide](https://www.acs.org/molecule-of-the-week/archive/p/syn-propanethial-s-oxide.html), January 22, 2013. Alternative to the supplied Library of Congress URL, which returned a retrieval error in this session.
[^15]: TeachEngineering, [Surfactants: Helping Molecules Get Along](https://www.teachengineering.org/lessons/usf_surfactants_les1), university engineering lesson, undated; ACS, [Release the Grease](https://www.acs.org/content/dam/acsorg/education/resources/k-8/science-activities/chemicalphysicalchange/dissolving/release-the-grease.pdf), classroom comparison, undated. More directly useful than relying solely on the supplied 2017 EPA archive.
[^16]: American Chemical Society, [If Mixing Is Urgent, Try Detergent](https://www.acs.org/content/dam/acsorg/education/resources/k-8/science-activities/chemicalphysicalchange/dissolving/if-mixing-is-urgent-science-for-kids.pdf), undated, and the surfactant lesson above. Supplied DOI `10.1021/ed073p497` could not be retrieved; it was not used to validate the mechanism.
[^17]: Rowse Honey, [Why has my honey crystallised and is it still okay to eat?](https://rowsehoney.co.uk/news/bee-educated/why-has-my-honey-crystallised-and-is-it-still-okay-to-eat), undated producer guidance. Supports natural crystallization and composition effects, not an authenticity or safety verdict for an unknown jar.
[^18]: Museum of New Zealand Te Papa Tongarewa, [North Island brown kiwi](https://www.tepapa.govt.nz/digital-museum/explore-digital-museum/birds-new-zealand/north-island-brown-kiwi), “Clever beak,” undated.
[^19]: Australian Department of the Prime Minister and Cabinet, [Australian national colours](https://www.pmc.gov.au/honours-and-symbols/australian-national-symbols/australian-national-colours), undated.
[^20]: OpenStax, [Chemistry: Atoms First 2e §10.2 Properties of Liquids](https://openstax.org/books/chemistry-atoms-first-2e/pages/10-2-properties-of-liquids), surface tension/cohesion/adhesion sections, undated web edition. Used as accessible support after the supplied USGS surface-tension page failed full retrieval; a search excerpt alone was not used for the wetting comparison.

Private source material: `Tell_Me_Whyyyyyy_V4_Implementation_Plan.md`, sections 1–4 and Tasks 0–12; `Tell Me Whyyyyyy_Schedules_V4.xlsx`, `Lists!A1:I53`, specifically rows 30, 33 and 40–53. The separate analytics workbook cited inside the plan was unavailable.
