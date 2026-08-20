import {z} from 'zod';

export const EDUCATIONAL_ROLES = ['hook', 'stake', 'proof', 'payoff'] as const;
export type EducationalRole = (typeof EDUCATIONAL_ROLES)[number];
export type BeatRole = EducationalRole | 'outro';

export type VideoScene = {
  id: string;
  role: BeatRole;
  durationSeconds: number;
  text: string;
  visualIntent: string;
  searchQueries: string[];
};

export type VideoPlan = {
  topic: string;
  title: string;
  viralAngle: string;
  scenes: VideoScene[];
};

export function isGenericQuestionHook(text: string): boolean {
  const opening = text.split('|')[0]?.trim() ?? '';
  return /^(why|how|what|ever\s+wonder)\b/i.test(opening);
}

const isValidCaptionText = (text: string): boolean => {
  const parts = text.split('|').map((part) => part.trim());
  if (parts.some((part) => part.length === 0)) return false;
  if (parts.length > 3) return false;
  if (parts.some((part) => part.length < 4)) return false;
  return parts.join(' ').length >= 4;
};

const videoSceneSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  role: z.enum(EDUCATIONAL_ROLES),
  durationSeconds: z.number().int().min(4).max(8),
  text: z
    .string()
    .min(4)
    .max(100)
    .refine((text) => isValidCaptionText(text), {
      message: 'Scene text caption bars must split into 1-3 non-empty clauses',
    }),
  visualIntent: z.string().trim().min(10).max(180),
  searchQueries: z
    .array(z.string().trim().min(3).max(80))
    .min(2)
    .max(3)
    .refine((queries) => new Set(queries).size === queries.length, {
      message: 'Search queries must be unique',
    }),
});

export const videoPlanSchema = z
  .object({
    topic: z.string().min(3).max(200),
    title: z.string().min(5).max(90),
    viralAngle: z.string().trim().min(10).max(180),
    scenes: z.array(videoSceneSchema).min(4).max(4),
  })
  .superRefine((plan, context) => {
    const totalDuration = plan.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
    if (totalDuration < 16 || totalDuration > 32) {
      context.addIssue({
        code: 'custom',
        path: ['scenes'],
        message: 'Total duration must be between 16 and 32 seconds',
      });
    }

    if (new Set(plan.scenes.map((scene) => scene.id)).size !== plan.scenes.length) {
      context.addIssue({
        code: 'custom',
        path: ['scenes'],
        message: 'Scene ids must be unique',
      });
    }

    const roles = plan.scenes.map((scene) => scene.role);
    if (roles.join(',') !== EDUCATIONAL_ROLES.join(',')) {
      context.addIssue({
        code: 'custom',
        path: ['scenes'],
        message: 'Educational roles must be hook, stake, proof, payoff',
      });
    }

    const hook = plan.scenes[0];
    if (hook && isGenericQuestionHook(hook.text)) {
      context.addIssue({
        code: 'custom',
        path: ['scenes', 0, 'text'],
        message: 'Hook must not start with Why, How, What, or Ever wonder',
      });
    }
  }) satisfies z.ZodType<VideoPlan>;

export function parseVideoPlan(value: unknown): VideoPlan {
  return videoPlanSchema.parse(value);
}
