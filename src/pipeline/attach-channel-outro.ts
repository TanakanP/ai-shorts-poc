import type {VideoPlan} from '../domain/video-plan';

export function attachChannelOutro(plan: VideoPlan, brand: string, signoff: string): VideoPlan {
  const last = plan.scenes.at(-1);
  if (!last) return plan;
  const name = brand.trim().replace(/[.!?]+$/u, '');
  const line = signoff.trim();
  return {
    ...plan,
    scenes: [
      ...plan.scenes.slice(0, -1),
      {
        ...last,
        text: `${last.text.trim()} | ${name}. ${line}`,
      },
    ],
  };
}
