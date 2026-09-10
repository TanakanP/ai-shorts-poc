import {describe, expect, it} from 'vitest';
import {attachChannelOutro} from '../../src/pipeline/attach-channel-outro';
import type {VideoPlan} from '../../src/domain/video-plan';

const plan: VideoPlan = {
  topic: 'Why supermarkets put milk at the back',
  title: 'Why Milk Is Always at the Back',
  viralAngle: 'The store is using your walk, not hiding the milk.',
  scenes: [
    {
      id: 'hook',
      role: 'hook',
      durationSeconds: 6,
      text: 'The milk is hiding.',
      visualIntent: 'Shopper walking toward supermarket dairy refrigerators',
      searchQueries: ['milk supermarket', 'grocery dairy aisle'],
    },
    {
      id: 'payoff',
      role: 'payoff',
      durationSeconds: 6,
      text: 'Deliveries also stay efficient.',
      visualIntent: 'Grocery delivery crates stacked at a loading dock',
      searchQueries: ['grocery delivery', 'supermarket loading dock'],
    },
  ],
};

describe('attachChannelOutro', () => {
  it('adds a new last scene for the brand sign-off', () => {
    expect(attachChannelOutro(plan, 'Curious Cart', 'If that made you look twice, follow along.')).toEqual({
      ...plan,
      scenes: [
        ...plan.scenes,
        {
          id: 'channel-outro',
          role: 'outro',
          durationSeconds: 4,
          text: 'Curious Cart. | If that made you look twice, follow along.',
          visualIntent: 'Shopper walking toward supermarket dairy refrigerators',
          searchQueries: ['milk supermarket', 'grocery dairy aisle'],
        },
      ],
    });
  });

  it('does not change the payoff script', () => {
    const next = attachChannelOutro(plan, 'Curious Cart', 'Follow along.');
    expect(next.scenes.slice(0, 2)).toEqual(plan.scenes);
    expect(next.scenes).toHaveLength(3);
    expect(next.scenes.at(-1)?.id).toBe('channel-outro');
  });

  it('keeps a question mark on the brand line', () => {
    const next = attachChannelOutro(plan, 'Tell Me Whyyyyyyyy?', 'Like and subscribe for more.');
    expect(next.scenes.at(-1)?.text).toBe('Tell Me Whyyyyyyyy? | Like and subscribe for more.');
    expect(next.scenes.at(-1)?.spokenText).toBe('Tell Me <slow>why</slow>? | Like and subscribe for more.');
  });

  it('speaks the elongated whyyyyyy for ElevenLabs instead of a tagged why', () => {
    const next = attachChannelOutro(plan, 'Tell Me Whyyyyyyyy?', 'Like and subscribe for more.', {
      slowWhy: false,
    });
    expect(next.scenes.at(-1)?.text).toBe('Tell Me Whyyyyyyyy? | Like and subscribe for more.');
    expect(next.scenes.at(-1)?.spokenText).toBe('Tell Me Whyyyyyyyy? | Like and subscribe for more.');
  });
});
