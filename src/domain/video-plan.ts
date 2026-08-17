import {z} from 'zod';

export type VideoScene = {
  id: string;
  durationSeconds: number;
  text: string;
  searchQuery: string;
};

export type VideoPlan = {
  topic: string;
  title: string;
  scenes: VideoScene[];
};

const isValidCaptionText = (text: string): boolean => {
  const parts = text.split('|').map((part) => part.trim());
  if (parts.some((part) => part.length === 0)) return false;
  if (parts.length > 3) return false;
  if (parts.some((part) => part.length < 4)) return false;
  const spoken = parts.join(' ');
  return spoken.length >= 4;
};

const videoSceneSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  durationSeconds: z.number().int().min(4).max(8),
  text: z
    .string()
    .min(4)
    .max(100)
    .refine((text) => isValidCaptionText(text), {
      message: 'Scene text caption bars must split into 1-3 non-empty clauses',
    }),
  searchQuery: z.string().min(2).max(80).refine((query) => query.trim().length >= 2),
});

export const videoPlanSchema = z
  .object({
    topic: z.string().min(3).max(200),
    title: z.string().min(5).max(90),
    scenes: z.array(videoSceneSchema).min(5).max(7),
  })
  .superRefine((plan, context) => {
    const totalDuration = plan.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
    if (totalDuration < 30 || totalDuration > 45) {
      context.addIssue({
        code: 'custom',
        path: ['scenes'],
        message: 'Total duration must be between 30 and 45 seconds',
      });
    }

    if (new Set(plan.scenes.map((scene) => scene.id)).size !== plan.scenes.length) {
      context.addIssue({
        code: 'custom',
        path: ['scenes'],
        message: 'Scene ids must be unique',
      });
    }
  }) satisfies z.ZodType<VideoPlan>;

export function parseVideoPlan(value: unknown): VideoPlan {
  return videoPlanSchema.parse(value);
}
