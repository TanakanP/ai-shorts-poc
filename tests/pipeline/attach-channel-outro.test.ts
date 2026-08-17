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
  it('appends brand and sign-off to the last scene script', () => {
    expect(attachChannelOutro(plan, 'Curious Cart', 'If that made you look twice, follow along.')).toEqual({
      ...plan,
      scenes: [
        plan.scenes[0],
        {
          ...plan.scenes[1],
          text: 'Deliveries also stay efficient. | Curious Cart. If that made you look twice, follow along.',
        },
      ],
    });
  });

  it('does not change earlier scenes', () => {
    const next = attachChannelOutro(plan, 'Curious Cart', 'Follow along.');
    expect(next.scenes[0]).toEqual(plan.scenes[0]);
    expect(next.scenes).toHaveLength(2);
  });
});
