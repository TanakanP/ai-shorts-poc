import {describe, expect, it} from 'vitest';
import {attachChannelOutro} from '../../src/pipeline/attach-channel-outro';
import type {VideoPlan} from '../../src/domain/video-plan';

const plan: VideoPlan = {
  topic: 'Why supermarkets put milk at the back',
  title: 'Why Milk Is Always at the Back',
  scenes: [
    {id: 'hook', durationSeconds: 6, text: 'The milk is hiding.', searchQuery: 'milk supermarket'},
    {id: 'payoff', durationSeconds: 6, text: 'Deliveries also stay efficient.', searchQuery: 'grocery delivery'},
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
          durationSeconds: 4,
          text: 'Curious Cart. | If that made you look twice, follow along.',
          searchQuery: 'milk supermarket',
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
});
