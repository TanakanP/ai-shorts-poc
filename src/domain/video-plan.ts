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

const videoSceneSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  durationSeconds: z.number().int().min(4).max(8),
  text: z.string().min(4).max(100).refine((text) => text.trim().length >= 4),
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
