import {z} from 'zod';
import {
  ContentHold, interpretedBriefSchema, factSchema, packageSchema as v4PackageSchema, storySchema as v4StorySchema,
  V4_BEATS, VOICED_BEATS, type TopicBrief, type V4Package, type V4Story, type EvaluatedHook,
} from '../v4/contracts';

export {ContentHold, interpretedBriefSchema, V4_BEATS, VOICED_BEATS, factSchema};

const text = z.string().trim().min(1);
const cropPosition = z.string().regex(/^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/);
const finitePositive = z.number().finite().positive();
export const v5SceneIdSchema = z.enum(VOICED_BEATS);
export type SceneId = z.infer<typeof v5SceneIdSchema>;

function exactSceneIds(ids: string[], ctx: z.RefinementCtx, ordered = false) {
  if (new Set(ids).size !== ids.length)
    ctx.addIssue({code: 'custom', message: 'Scene IDs must be unique'});
  if (ordered ? ids.join(',') !== VOICED_BEATS.join(',')
    : ids.length !== VOICED_BEATS.length || VOICED_BEATS.some(id => !ids.includes(id)))
    ctx.addIssue({code: 'custom', message: 'Exactly the five voiced scene IDs are required'});
}

function uniqueIds(ids: string[], ctx: z.RefinementCtx, message: string) {
  if (new Set(ids).size !== ids.length) ctx.addIssue({code: 'custom', message});
}

export const v5BriefSchema = z.object({
  topicId: text.regex(/^[a-z0-9-]+$/), topic: text, creativeBrief: text,
  subjectAliases: z.array(text).min(1), facts: z.array(factSchema).min(2),
  factBoundaries: z.array(text).min(1), titleSeed: text.nullable(), descriptionSeed: text.nullable(),
  visualStyle: text,
}).superRefine((brief, ctx) => uniqueIds(brief.facts.map(f => f.id), ctx, 'Fact IDs must be unique'));
export type V5Brief = Omit<TopicBrief, 'localProof'> & {visualStyle: string};

export const v5ShotSchema = z.object({
  beatId: v5SceneIdSchema, visualIntent: text, factIds: z.array(text).min(1),
});
const v5PackageObjectSchema = v4PackageSchema.extend({shots: z.array(v5ShotSchema).length(5)});
export const v5PackageGenerationSchema = v5PackageObjectSchema;
export const v5PackageSchema = v5PackageObjectSchema.superRefine((pack, ctx) =>
  exactSceneIds(pack.shots.map(s => s.beatId), ctx));
export type V5Package = Omit<V4Package, 'shots'> & {
  shots: {beatId: SceneId; visualIntent: string; factIds: string[]}[];
};

const evaluatedHookSchema = v4PackageSchema.shape.hooks.element.extend({
  violations: z.array(z.string()), wordCount: z.number().int().nonnegative(),
});
export const v5SelectedPackageSchema = v5PackageObjectSchema.extend({
  evaluatedHooks: z.array(evaluatedHookSchema).length(5), selectedHookId: text, preflightScore: z.number(),
}).superRefine((pack, ctx) => exactSceneIds(pack.shots.map(s => s.beatId), ctx));
export type V5SelectedPackage = V5Package & {
  evaluatedHooks: EvaluatedHook[]; selectedHookId: string; preflightScore: number;
};

const v5BeatObjectSchema = v4StorySchema.shape.beats.element.omit({proofIds: true}).extend({
  sceneId: v5SceneIdSchema,
});
function refineStoryBeats(story: {beats: {id: typeof V4_BEATS[number]; sceneId: SceneId}[]}, ctx: z.RefinementCtx) {
  if (story.beats.map(b => b.id).join(',') !== V4_BEATS.join(','))
    ctx.addIssue({code: 'custom', message: 'Six ordered V4 functions are required'});
  for (const beat of story.beats) {
    const expected = beat.id === 'paradox' ? 'contradiction' : beat.id;
    if (beat.sceneId !== expected)
      ctx.addIssue({code: 'custom', message: `Beat ${beat.id} must map to scene ${expected}`});
  }
}
const v5StoryObjectSchema = v4StorySchema.extend({beats: z.array(v5BeatObjectSchema).length(6)});
export const v5StoryGenerationSchema = v5StoryObjectSchema.extend({
  beats: z.array(v5BeatObjectSchema.extend({emphasisWords: z.array(text).max(2)})).length(6),
});
export const v5StorySchema = v5StoryObjectSchema.superRefine(refineStoryBeats);
export type V5Story = Omit<V4Story, 'beats'> & {
  beats: (Omit<V4Story['beats'][number], 'proofIds'> & {sceneId: SceneId})[];
};

export const v5ContentPlanSchema = v5StoryObjectSchema.extend({
  version: z.literal('v5'), topicId: text.regex(/^[a-z0-9-]+$/), topic: text,
  package: v5SelectedPackageSchema, facts: z.array(factSchema).min(2),
  factBoundaries: z.array(text).min(1), title: text, description: text,
}).superRefine((plan, ctx) => {
  refineStoryBeats(plan, ctx);
  uniqueIds(plan.facts.map(f => f.id), ctx, 'Fact IDs must be unique');
  const facts = new Set(plan.facts.map(f => f.id));
  const unknown = (ids: string[]) => ids.some(id => !facts.has(id));
  if (!facts.has(plan.package.secondRevealFactId) || plan.package.shots.some(s => unknown(s.factIds)))
    ctx.addIssue({code: 'custom', message: 'Package references unknown facts'});
  for (const beat of plan.beats) {
    const shot = plan.package.shots.find(s => s.beatId === beat.sceneId);
    if (!shot) ctx.addIssue({code: 'custom', message: `Beat ${beat.id} references missing scene ${beat.sceneId}`});
    else if (unknown(beat.factIds) || beat.factIds.some(id => !shot.factIds.includes(id)))
      ctx.addIssue({code: 'custom', message: `Beat ${beat.id} facts do not match scene ${beat.sceneId}`});
  }
});
export type V5ContentPlan = V5Story & {
  version: 'v5'; topicId: string; topic: string; package: V5SelectedPackage;
  facts: V5Brief['facts']; factBoundaries: string[]; title: string; description: string;
};

export type Revision = {previous: V5ContentPlan; feedback: string[]};

export class V5StoryRevisionNeeded extends ContentHold {
  constructor(reasons: string[], readonly draft: V5ContentPlan) {
    super(reasons, 'revise');
    this.name = 'V5StoryRevisionNeeded';
  }
}

export const scenePromptSchema = z.object({
  sceneId: v5SceneIdSchema, factIds: z.array(text).min(1), visualIntent: text,
  imagePrompt: text, videoPrompt: text,
  durationSeconds: z.literal(6), aspectRatio: z.literal('9:16'),
  requiredFrames: z.number().int().positive().max(180), promptHash: text,
}).superRefine((scene, ctx) => uniqueIds(scene.factIds, ctx, 'Fact IDs must be unique'));
export type ScenePrompt = {
  sceneId: SceneId; factIds: string[]; visualIntent: string;
  imagePrompt: string; videoPrompt: string;
  durationSeconds: 6; aspectRatio: '9:16'; requiredFrames: number;
  promptHash: string;
};

export const promptPackGenerationSchema = z.object({
  continuity: z.string(),
  scenes: z.array(z.object({
    sceneId: v5SceneIdSchema, imagePrompt: z.string(), videoPrompt: z.string(),
  })),
});
export const promptPackSchema = z.object({
  schemaVersion: z.literal(1), engineVersion: z.literal('v5'), planHash: text,
  visualStyle: text, continuity: text, scenes: z.array(scenePromptSchema).length(5),
}).superRefine((pack, ctx) => exactSceneIds(pack.scenes.map(s => s.sceneId), ctx, true));
export type PromptPack = {
  schemaVersion: 1; engineVersion: 'v5'; planHash: string;
  visualStyle: string; continuity: string; scenes: ScenePrompt[];
};

export const mediaInfoSchema = z.object({
  durationSec: finitePositive, width: finitePositive, height: finitePositive, fps: finitePositive,
});
export type MediaInfo = {durationSec: number; width: number; height: number; fps: number};

export const generatedBindingSchema = z.object({
  sceneId: v5SceneIdSchema, kind: z.literal('generated'), provider: z.literal('grok-imagine'),
  fileName: text, localPath: text, sha256: text, promptHash: text,
  trimStartSec: z.number().finite().nonnegative(), cropPosition, media: mediaInfoSchema,
  observedAction: text, approved: z.literal(true),
});
export type GeneratedBinding = {
  sceneId: SceneId; kind: 'generated'; provider: 'grok-imagine';
  fileName: string; localPath: string; sha256: string; promptHash: string;
  trimStartSec: number; cropPosition: string; media: MediaInfo;
  observedAction: string; approved: true;
};
