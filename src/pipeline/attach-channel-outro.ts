import {CHANNEL_OUTRO_DURATION_SECONDS, type VideoPlan} from '../domain/video-plan';

export function attachChannelOutro(plan: VideoPlan, brand: string, signoff: string): VideoPlan {
  const first = plan.scenes[0];
  if (!first) return plan;
  const name = brand.trim();
  const spokenName = /[.!?]$/u.test(name) ? name : `${name}.`;
  const line = signoff.trim();
  return {
    ...plan,
    scenes: [
      ...plan.scenes,
      {
        id: 'channel-outro',
        role: 'outro',
        durationSeconds: CHANNEL_OUTRO_DURATION_SECONDS,
        text: `${spokenName} | ${line}`,
        visualIntent: first.visualIntent,
        searchQueries: first.searchQueries,
      },
    ],
  };
}
