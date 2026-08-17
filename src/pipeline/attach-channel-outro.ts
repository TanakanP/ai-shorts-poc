import type {VideoPlan} from '../domain/video-plan';

export function attachChannelOutro(plan: VideoPlan, brand: string, signoff: string): VideoPlan {
  const first = plan.scenes[0];
  if (!first) return plan;
  const name = brand.trim().replace(/[.!?]+$/u, '');
  const line = signoff.trim();
  return {
    ...plan,
    scenes: [
      ...plan.scenes,
      {
        id: 'channel-outro',
        durationSeconds: 4,
        text: `${name}. | ${line}`,
        searchQuery: first.searchQuery,
      },
    ],
  };
}
