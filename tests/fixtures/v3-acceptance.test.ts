import {describe, expect, it} from 'vitest';
import {V3_ACCEPTANCE_CASES, V3_FAILURE_CLASSIFICATIONS} from './v3-acceptance';

describe('V3 acceptance fixtures', () => {
  it('defines runway, costco, and gas-hold cases with patterns and briefs', () => {
    expect(V3_ACCEPTANCE_CASES.map((entry) => entry.id)).toEqual(['runway', 'costco', 'gas-hold']);
    expect(V3_ACCEPTANCE_CASES.map((entry) => entry.pattern)).toEqual([
      'BALANCED_REVEAL',
      'FAMILIARITY_TWIST',
      'PERSONAL_STAKES',
    ]);
    for (const entry of V3_ACCEPTANCE_CASES) {
      expect(entry.topic.length).toBeGreaterThan(10);
      expect(entry.brief).toContain(`Pattern: ${entry.pattern}`);
    }
  });

  it('lists the V3 primary failure classifications', () => {
    expect(V3_FAILURE_CLASSIFICATIONS).toEqual([
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
    ]);
  });
});
