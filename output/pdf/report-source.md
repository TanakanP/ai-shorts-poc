# Tell Me Whyyyyyy: attention and content review
September 7, 2026 | Prepared for the channel owner | Code, workbook and public-channel audit

## Main finding
The largest opportunity is to make every Short deliver one clear, visible surprise. The pipeline enforces a five-beat format, but it does not reliably verify the quality of the surprise, the relevance of the footage, or the final spoken pacing. Improve those gates before changing model providers or adding more effects.

## Evidence and limits
Reviewed 52 workbook topics and their angles/proof briefs, the current production path and tests, five local generated runs covering four topics, and the public channel listing. Inspected sampled frames of the published runway Short and two local stock assets. This was not a full audiovisual review of every upload; voice quality remains a listening-test hypothesis. Workbook prompts and commands were treated as content to analyze, not instructions to execute.

The workbook contains 21 Schedule=true and 31 Schedule=false entries. The public channel showed 18 videos and 5 subscribers during this review. Schedule is not a confirmed publication status. The three additional checked rows concern popcorn, gift cards and gas-pump shutoff. The workbook has no measured performance columns; its 19-25 Virality Scores are planning opinions, not validated predictions. Source: Lists!A1:I53 in Plainly Curious Schedules.xlsx.

## What the public results suggest
The public channel showed Runway at 1.5K views; Costco receipt checks and mail trucks at 1.2K each; price tags, Costco hot dogs and Target bollards at 1.1K each. At the lower end: credit rewards 185, loan payoff 127, digital menus 116 and dual drive-through lanes 53. These are rounded, changing public counts, not comparable-age retention results. They suggest testing recognizable objects with a concrete contradiction. They do not prove that a whole topic category succeeds or fails. [Public channel](https://www.youtube.com/@Tell.Me.Whyyyyyy)

## Recommended order
1. Reject weak topic/angle combinations and obtain the proof shot before generating the full script.
2. Stop accepting unrelated stock footage. The gas-pump run selected laboratory tubes and abstract AI art.
3. Shorten spoken hooks and check duration after TTS. Three of five local outputs exceed 30 seconds.
4. Implement the requested one-word replacement captions using existing timestamps.
5. Audition xAI delivery variations on identical scripts, then consider a provider comparison if needed.

All 384 existing tests and TypeScript checking passed. Three localhost tests initially hit sandbox port restrictions, then passed with localhost access. Passing tests establish software behavior, not editorial quality. No production code or workbook was changed; the existing package-lock.json modification was preserved.

---PAGE---
# Storytelling: the format is stronger than the editing

## Hooks are self-scored and too long in practice
One model call generates and rates all three hooks; code then sorts those ratings. Across 15 locally saved candidates, 55 of 75 dimension ratings were 5, 19 were 4, and one was 3. Three selected hooks scored a perfect 25. This is deterministic selection of subjective judgments, not evidence of audience appeal. See src/generation/generate-hooks.ts:26 and select-hook.ts:3.

Start with three genuinely different angles: a contradiction, a consequence, and an observable mystery. Pick the clearest accurate claim with a shot that actually exists. A second model judge may help editing, but is still a heuristic. Do not build a large scoring system around uncalibrated numbers.

The hook prompt asks for roughly 2-3 seconds, while validation permits up to 22 words. Actual hook scene durations were 4.40, 5.73, 5.47, 3.27 and 3.00 seconds. Try approximately 6-10 spoken words, then measure the synthesized result. This is an editorial starting range, not a YouTube benchmark. See prompt.ts:104 and src/domain/video-plan.ts:319.

## A named curiosity reset can still be boring
Validation checks roles and nonempty newInformation fields; duplicate checks catch repeated text, not repeated meaning. The current prompt already requests novelty and a satisfying payoff. Repeating those instructions will not guarantee either. Read the five beats aloud as one story and ask what genuinely changed at each transition. See src/domain/video-plan.ts:364, 426 and 441.

In the exit-number run, the mechanism begins with "Federal guidance supports matching exits to mileposts." The useful reveal is the subtraction: 145 minus 120 is roughly 25 miles on the same mileage-numbered stretch. The payoff then implies one exit number estimates remaining distance, but that needs a destination/reference point. Put the calculation on screen; keep source attribution in the production notes. The stop-sign run similarly says "MUTCD" aloud, spending listener effort on an acronym.

The rumble-strip reset lists shoulder, centerline and transverse types. That adds facts, but changes a physical mystery into a taxonomy. Prefer a deeper consequence or demonstration of the same mechanism. Keep five roles, but let them form a connected explanation instead of five miniature headlines.

## Two factual and configuration gaps
The production OpenAI call uses model 'gpt-5.6' and structured output, with no retrieval tool in that request. A brief saying "verify FHWA" is not a verification step. Supply a short, already-checked fact packet: source URL, supported claim, necessary qualification and forbidden inference. See src/generation/generate-video-plan.ts:110.

All five local briefs request SURPRISED_REVEAL, which is not one of the three supported patterns. Code silently falls back to BALANCED_REVEAL. The workbook itself uses supported values. Validate the pattern or explicitly map an agreed synonym; do not silently substitute it. See generate-video-plan.ts:36 and src/domain/video-plan.ts:127.

---PAGE---
# Footage: retrieval is being mistaken for proof

## The mismatch has a clear code path
src/stock/score-stock-match.ts:43 counts substring overlap between query/narration tokens and the Pexels page URL. It never inspects pixels. The resolver accepts the first query with a positive score, prioritizing portrait before landscape, and ultimately permits a zero-score fallback. requiredVisualObjects is generated but not enforced by this selection. See src/stock/resolve-scene-assets.ts:30-65.

The gas-pump run, 20260907-003643-11ea51e7, demonstrates the failure:

| Intended shot | Selected result | Why it fails |
| --- | --- | --- |
| Nozzle sensing tube | Man using laboratory test tubes | A tube word match does not show nozzle anatomy. |
| Nozzle airflow animation | Abstract AI artwork | Animation is a medium, not the required mechanism. |
| Automatic shutoff mechanism | Quiet gas station at twilight | Establishes setting but does not explain shutoff. |

Sampled frames independently confirmed the laboratory and abstract-art selections. The published runway Short also showed a travel map and flowers during a later explanation. That single observation establishes a mismatch in the sampled segment, not a whole-video relevance score.

## Use stock for context; show the actual proof
Before scripting, identify one indispensable image or action. For a gas nozzle, it is the hole and the shutoff mechanism. For a runway, it is the marking and heading relationship. For exit numbers, it is the two signs and their distance. Generic scenery can establish place, but cannot substitute for these proofs.

The smallest reliable workflow is a local preview/contact-sheet review and an explicit approved clip choice. Ordered Pexels queries can remain. Continue searching when the required object/action is absent, even if the URL score is positive. If no appropriate shot exists, report the missing shot instead of silently filling the slot.

Pexels documents video_pictures previews; the client currently discards them. Retaining previews would support review. A later vision check could sample multiple frames, returning match, mismatch or uncertain, but still needs review for ambiguous actions. It is optional scope beyond the existing v3 plan. [Pexels API documentation](https://www.pexels.com/api/documentation/)

## Some topics need a different visual treatment
The current plan asks for gas-nozzle cutaways, airflow arrows and other illustrations that the renderer does not create. Scene.tsx provides stock playback and motion, and displays the large card only for the hook. Merely improving search phrases cannot manufacture a custom diagram.

For mechanisms inside objects, propose a small, accurately authored Remotion/SVG diagram or an approved reference asset. For brand-specific stories, obtain identifiable footage rather than implying a generic shop is Costco or Target. Diagram support and manual asset overrides are proposed additions to scope, not changes made by this audit.

---PAGE---
# Voice and captions: improve the experience together

## The voice needs direction, not just speed
The xAI client hardcodes speed 1.2, synthesizes each scene separately, and adds 0.3 seconds after each scene. This can create an even, segmented cadence; it does not prove the voice itself is poor. The current story prompt lacks the delivery-tag guidance present in the legacy prompt. See src/voice/xai-tts-client.ts:17, synthesize-scene-voices.ts:27 and scene-duration.ts:1.

Audition the same short script with the current voice at normal and current speed, then vary only one element: a pause before the reveal or emphasis on a whole key phrase. Keep music level constant. Judge first-sentence clarity, natural stress, pronunciation and whether the payoff lands. Avoid shouting every sentence. xAI supports speed controls, pauses and phrase-level delivery tags. [xAI text-to-speech documentation](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech)

Use existing supported tags first. New tags such as slow delivery require extending caption sanitization and tests so markup cannot appear on screen. Voice provider comparison is worthwhile only after fixing the script and testing the delivery already available.

## Enforce duration on the voiced timeline
Local final durations were 30.32, 32.34, 30.26, 28.01 and 29.73 seconds. The plan validates a 20-26-second story, but the voice stage permits 15-60 seconds overall. The 4-second outro occupies about 12-14% of these outputs. Keep the channel sign-off; make sure the story earns its time before it.

Use actual audio and padding to enforce the intended final ceiling. An overlong result should produce a focused rewrite/review request, not cut off speech or be accelerated until unclear. Automatic regeneration is not required for the first fix. See src/voice/scene-duration.ts:16 and src/pipeline/create-short.ts:74.

## Yes: true one-word replacement is feasible
Despite its name, WordCaption renders an entire clause and highlights the active word. Explicit pipe-separated clauses bypass automatic splitting; alignment failure can show the whole scene. The nominal 40-character clause limit is only a soft rule. See src/remotion/WordCaption.tsx:25, 55; src/captions/caption-segments.ts:72, 91; caption-clauses.ts:99.

Reuse scene.words and render only the current spoken word at a stable position, with no accumulation and no karaoke highlight. Define silence behavior: blank before the first word, hold through very short gaps, clear on longer pauses, and clear after the final word. currentWordIndexAt uses start times, so end-time handling needs an explicit rule. Keep punctuation attached and preserve the separate outro treatment.

Compare the requested version with the existing captions on identical audio and footage. Check long words, numbers, timing boundaries and phone readability. One-word captions reduce simultaneous text, but can make fast narration harder to follow; they are an experiment, not a proven retention improvement. If needed later, compare short phrase replacement as a separate option.

---PAGE---
# Topics: choose a stronger promise before filling the schedule

## Keep the channel identity; narrow the editorial test
The workbook is thematically coherent around everyday American systems. The inconsistency is in the strength of the question: some topics contain a contradiction, others merely announce a fact or a broad explanation. Keep three related lanes: hidden design in objects, recognizable retail systems, and everyday money surprises. Do not infer that money topics are weak simply from lower raw views.

Your September 3 design notes report Runway at 55.7% stayed-to-watch with 20s engaged AVD over 27s; Costco receipts at 40.8%, 16s over 30s; gas-card holds at 25.5%, 32s over 31s. These are historical owner-note figures, not freshly verified Studio exports. They suggest distinct problems: the gas-hold opening needs work, while Costco's middle may need work. One topic per pattern is too little to generalize.

## Replace Virality Score with explicit editorial decisions
Before approving a brief, answer five questions: Will the intended viewer recognize it immediately? Is the reveal non-obvious? Can we show the proof? Is there one clear consequence? Can we support the claim with a reliable source? If proof or accuracy is missing, hold the topic. Use keep, reframe or hold, with a reason; avoid false precision.

The workbook repeats extensive packaging instructions, and many titles already reveal the answer. Keep the factual fences but compress the creative brief to: intended viewer, misconception, unresolved question, visible proof, exact qualification, and payoff. The production prompt already supplies much of the repeated format guidance.

## Best next candidates to develop
Prioritize stop-sign silhouette, rumble strips, red reflectors, exit-number distance and the backwards flag patch, subject to accurate proof assets. Gas-pump shutoff remains promising but should wait for a proper mechanism visual. For a second lane, develop airline overbooking with a concrete seats-versus-passengers illustration. These are editorial priorities, not forecast winners.

Reframe gift cards: the current title states the definition of prepayment. Find a sourced consequence instead. Reframe digital menus around one observed change rather than "became software." Reframe school-zone signs around a recognizable silhouette test. Hold broad explanations of milk jugs and water-heater locations until there is a specific, surprising causal story. Avoid near-duplicate gas and hotel preauthorization stories close together unless the second adds something materially new.

The remaining pages list a disposition for every workbook row. Those judgments assess the current angle and producibility. They are not a fact-check of all 52 claims, and do not direct deletion or reposting of existing uploads. Existing posted stories should inform the next topic, not trigger automatic replacement.

---PAGE---
# A small comparison plan and a concrete rewrite

## Test one change at a time
First fix demonstrably unrelated footage and incorrect or overlong copy; keep an archived baseline. Then make local comparisons on the same three scripts: current versus one-word captions; current voice delivery versus one deliberate delivery variation. Review muted first frames and listen without visuals. Keep music and story constant while comparing each variable.

Publish only reviewed versions through your normal process. Over the next 9-12 suitable Shorts, compare against similar-topic, similar-length uploads at the same age after publication. Record feed exposure, stayed-to-watch, engaged views, average view duration, average percentage viewed and subscriber response in the existing workbook or notes. This is a manual experiment, not a new analytics subsystem. Small samples and changing audience exposure prevent causal certainty.

YouTube identifies chose-to-view, average duration and percentage viewed as ranking signals alongside satisfaction; topic interest and competition also matter. There is no required minimum posting cadence. Use your channel baseline rather than universal thresholds or a single viral outlier. [Shorts discovery guidance](https://support.google.com/youtube/answer/11914225?co=YOUTUBE._YTVideoType%3Dshorts&hl=en) and [Shorts analytics guidance](https://support.google.com/youtube/answer/12942217?co=YOUTUBE._YTVideoType%3Dshorts&hl=en).

## Example: exit numbers, with the demonstration first
Draft for review, not a generated or published video. Keep the existing sign-off separate. Rough target: 22-25 seconds of story, subject to actual TTS timing.

| Beat | Spoken draft | Visual proof |
| --- | --- | --- |
| Hook | These exit numbers can reveal the miles between them. | Two clearly illustrated signs: 120 and 145. |
| Context | On mileage-numbered highways, they track mileposts. | Simple road with marked distances. |
| Reset | So the next exit number might jump by twenty-five. | Compare the two exit labels. |
| Mechanism | From Exit 120 to Exit 145 on the same stretch? Roughly twenty-five miles. | 145 minus 120 equals 25, with a distance line. |
| Payoff | Some roads number exits in order instead. Check the system, and those signs become a distance clue. | Contrast distance numbering with sequential numbering. |

FHWA explains both systems and the distance use of milepost-based numbering. The page itself notes some dated information, so use this for the general principle and verify any named route against its current state DOT guidance. [FHWA Interstate exit numbers](https://www.fhwa.dot.gov/programadmin/interstate.cfm)

## Implementation boundary
Immediate editorial work: tighter briefs, verified fact packets, asset review and same-script listening tests. Next code changes: caption replacement, voiced-duration checks, explicit pattern validation and safer stock fallback. Later only if needed: approved diagrams, asset overrides and sampled-frame vision review. These extend or revise parts of the existing v3 plan; this audit implements none of them. Keep local MP4, voice, BGM and outro. No upload automation, scheduler or database is needed.


---PAGE---
# Topic decisions: workbook rows 2-19

Editorial assessment of current angles, not measured virality or a full factual clearance. Row numbers refer to the Lists sheet. Keep means develop the angle, not repost an existing upload.

| Row and current topic | Recommendation |
| --- | --- |
| 2. Costco Isn't Just Checking Whether You Paid | Keep: recognizable ritual; show a real accuracy check, not generic checkout. |
| 3. Interstate Numbers Are a Hidden Road Code | Reframe: teach one numbering rule with a map; avoid three rules at once. |
| 4. That Tiny 9/10 on Gas Prices Is a Century-Old Pricing Fossil | Reframe: shorten the opening to the tiny fraction; historical origin needs sourcing. |
| 5. America Washes Eggs—That's Why They Need the Fridge | Reframe: title gives away the mechanism; retain country and safety qualifications. |
| 6. A Runway Can Change Its Number Without Moving | Keep: strongest visible reference; obtain runway markings and heading proof. |
| 7. America Built Mail Trucks Backwards on Purpose | Keep: clear apparent contradiction; show the driver reaching a curbside mailbox. |
| 8. A $40 Fill-Up Can Lock $100+ on Your Card | Reframe: preserve the stakes; simplify the opening and label pending versus settled. |
| 9. Paying Off a Loan Can DROP Your Credit Score | Hold: nuanced scoring story; current brief risks implying a closed loan disappears. |
| 10. Costco's $1.50 Hot Dog Is a Marketing Weapon | Keep: recognizable price anchor; support the economics and current price. |
| 11. America's Price Tags Often Hide the Final Price | Keep: easy expectation-versus-receipt contrast; specify tax variation. |
| 12. Costco Built a Supply Chain to Protect a $4.99 Chicken | Reframe: familiar chicken, abstract supply chain; one sourced operational example. |
| 13. Your Credit Card Rewards Aren't Really Free | Reframe: show one payment flow; avoid implying every reward has one funding source. |
| 14. Target's Giant Red Balls Are Actually Safety Equipment | Keep: highly visible object; verify intended protection and avoid staged crash claims. |
| 15. Trader Joe's Runs Its Stores With a Secret Bell Code | Keep: familiar setting and a concrete code; use a sourced store example. |
| 16. Amazon Makes Warehouses Faster by Making Shelves Look Random | Keep: visible disorder versus software location; verify the facility workflow. |
| 17. Free Refills Are Cheap Enough to Feel Generous | Reframe: give the viewer a specific marginal-cost surprise; no invented cost numbers. |
| 18. Two Drive-Thru Lanes Fix a Bottleneck You Can't See | Reframe: two cars ordering at once is the demonstration; skip vague bottleneck language. |
| 19. Fast-Food Menus Became Software—and Now They Can Change What You Notice | Reframe: one menu change and its consequence; the current title is abstract. |

---PAGE---
# Topic decisions: workbook rows 20-36

Editorial assessment of current angles, not measured virality or a full factual clearance. Row numbers refer to the Lists sheet. Keep means develop the angle, not repost an existing upload.

| Row and current topic | Recommendation |
| --- | --- |
| 20. Movie Theaters Need Your Popcorn More Than You Think | Reframe: show a sourced revenue split; avoid universal profit percentages. |
| 21. A Gift Card Gives the Store Your Money Before You Buy Anything | Reframe: title is obvious prepayment; find a less obvious supported consequence. |
| 22. Your Gas Pump Stops Because of a Tiny Hole You Never Notice | Keep, asset-gated: high curiosity; needs nozzle detail and a correct mechanism visual. |
| 23. The Highway Is Literally Designed to Yell at Your Tires | Keep: strong physical demonstration; avoid turning the reset into a list of types. |
| 24. Exit 145 Can Tell You How Far You've Driven | Reframe: distance between two exits, not distance since the viewer started driving. |
| 25. A Stop Sign Still Works Even If You Can't Read It | Keep: reveal the silhouette; distinguish recognition from permission to proceed. |
| 26. School-Zone Signs Have a Shape Almost No Other Sign Gets | Reframe: invite recognition of the shape before naming the explanation. |
| 27. Red Road Reflectors Can Mean You're Going the Wrong Way | Keep: strong visual consequence; verify marker context and direction. |
| 28. Toll Roads Can Charge You at 70 MPH | Reframe: familiar technology needs a less familiar mechanism or failure case. |
| 29. America's Emergency Alert Sound Is Supposed to Be Annoying | Hold: weak novelty and specialized signal issues; source and review the treatment. |
| 30. Tornado Sirens Aren't Really Built for People Indoors | Hold for source review: meaningful misconception, but official local guidance is needed. |
| 31. American Walls Are Built to Go Up Fast, Not Feel Solid | Reframe: avoid implying walls are flimsy by design; pick a visible construction benefit. |
| 32. Your Basement Depends on What the Ground Forces Builders to Do | Reframe: too many causes; choose one sourced regional comparison. |
| 33. America Put Food Grinders Under Millions of Kitchen Sinks | Reframe: most target viewers recognize disposers; find the surprising system constraint. |
| 34. America's Huge Toilet-Stall Gaps Come From the Partition System | Reframe: high recognition, diffuse causation; source one mechanism, avoid a single-cause myth. |
| 35. American Homes Quietly Use Both 120V and 240V | Reframe: use a clear appliance comparison; avoid wiring advice and unexplained diagrams. |
| 36. One Side of Your Outlet Is Wider for a Safety Reason | Keep, source-gated: strong visible asymmetry; needs accurate safety explanation. |

---PAGE---
# Topic decisions: workbook rows 37-53

Editorial assessment of current angles, not measured virality or a full factual clearance. Row numbers refer to the Lists sheet. Keep means develop the angle, not repost an existing upload.

| Row and current topic | Recommendation |
| --- | --- |
| 37. Those Tiny Holes in U.S. Plug Prongs Are Not Decorative | Hold: brief already lists competing explanations; verify a specific design before claiming purpose. |
| 38. Your Smoke Detector May Wait Until 3 A.M. to Complain | Keep, source-gated: relatable event; qualify the explanation and avoid unsafe advice. |
| 39. That Giant Exit Push Bar Is Built for Panic | Keep: visible action and human consequence; source the hardware explanation. |
| 40. Every U.S. Airline Ticket Still Carries a Post-9/11 Security Fee | Reframe: universal every-ticket claim needs checking; make the fee understandable. |
| 41. Airlines Can Sell More Tickets Than the Plane Has Seats | Keep, source-gated: seats-versus-bookings contradiction; distinguish practice from passenger rules. |
| 42. Airport Codes Like ORD and MCO Are Fossils From Names That Disappeared | Keep: recognizable codes with historical reveals; use one airport first. |
| 43. TSA's Tiny Hand Swab Is Looking for Chemical Traces | Reframe: answer is already in title; focus on the bounded detectable trace, no evasion details. |
| 44. A $200 Hotel Room Can Lock Up Much More Than $200 on Your Card | Reframe: overlaps gas holds; develop only with a distinct hotel-specific consequence. |
| 45. A Car Can Cost More While the Monthly Payment Barely Changes | Keep, source-gated: concrete payment-versus-total illustration; show all assumptions. |
| 46. That Giant New-Car Window Sticker Is Required by Federal Law | Reframe: federal requirement alone is a weak payoff; reveal useful label information. |
| 47. Your Paycheck May Travel Through a Money Network Born in the 1970s | Hold: age of infrastructure alone is not surprising enough; find a personal consequence. |
| 48. The Gas Pump Uses Your ZIP Code as a Tiny Fraud Check | Reframe: fraud check is predictable; explain one verified limitation or mechanism. |
| 49. A ZIP Code Starting With 0 or 9 Already Tells You Where It Is | Keep: simple geographic reveal; show a correctly sourced map and exceptions. |
| 50. 911 Doesn't Always Get a Perfect GPS Dot From Your Phone | Hold for source review: high stakes; current location technology and official guidance required. |
| 51. The 'Backwards' U.S. Flag Patch Is Actually Pointing Forward | Keep: visual contradiction with a clear reveal; qualify the uniform context. |
| 52. America's Gallon Milk Jug Was Built for a Bigger Grocery System | Hold: diffuse household/logistics explanation; needs a sharper supported contrast. |
| 53. Your Water Heater's Location Reveals How Your House Was Engineered | Hold: too many causes for one Short; choose a specific location comparison. |
