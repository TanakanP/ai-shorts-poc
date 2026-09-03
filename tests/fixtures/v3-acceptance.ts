export const V3_FAILURE_CLASSIFICATIONS = [
  'HOOK_GENERATION',
  'HOOK_SELECTION',
  'FIRST_FRAME',
  'CURIOSITY_RESET',
  'STORY_REPETITION',
  'STORY_PACING',
  'SPOKEN_COPY',
  'DISPLAY_COPY',
  'VISUAL_QUERY',
  'PEXELS_MATCH',
  'TEXT_READABILITY',
  'RENDERING',
] as const;

export type V3FailureClassification = (typeof V3_FAILURE_CLASSIFICATIONS)[number];

export const V3_ACCEPTANCE_CASES = [
  {
    id: 'runway',
    topic: 'A Runway Can Change Its Number Without Moving',
    pattern: 'BALANCED_REVEAL',
    brief:
      'Pattern: BALANCED_REVEAL. Tone: aviation mind-bender with a clean visual reveal. Audience: U.S. travelers. Angle: the runway stays physically fixed while magnetic heading changes can force a new number. Hook must preserve the contradiction. Proof: show runway markings and magnetic heading drift. Ban fake thresholds and jargon. Close: the runway stayed still; the planet changed the number. Facts fence: verify FAA runway-numbering guidance.',
  },
  {
    id: 'costco',
    topic: "Costco Isn't Just Checking Whether You Paid",
    pattern: 'FAMILIARITY_TWIST',
    brief:
      'Pattern: FAMILIARITY_TWIST. Tone: confident retail-insider. Audience: Americans who shop at Costco. Angle: receipt checks are not only about theft; they can also catch checkout errors. Hook must challenge the obvious security explanation. Proof: receipt, cart, item-count or expensive-item check. Curiosity reset must reveal the customer-side consequence. Ban fake theft statistics and universal procedure claims. Close: one last audit at the exit. Facts fence: verify Costco policy and separate official practice from anecdotes.',
  },
  {
    id: 'gas-hold',
    topic: 'A $40 Fill-Up Can Lock $100+ on Your Card',
    pattern: 'PERSONAL_STAKES',
    brief:
      'Pattern: PERSONAL_STAKES. Tone: urgent money mystery that becomes reassuring. Audience: U.S. drivers. Angle: pay-at-pump authorization can temporarily reserve more than the final fuel purchase. Hook must lead with the $40 versus $100+ consequence. Proof: authorization before fuel total, then final settlement. Curiosity reset must clarify that the larger pending amount is not necessarily the final charge. Ban universal hold amounts/durations and financial advice. Close: it is a temporary placeholder for a bill that did not exist yet. Facts fence: verify merchant/card preauthorization practice and issuer variation.',
  },
] as const;
