import {z} from 'zod';

const text = z.string().trim().min(1);
const url = z.string().url().refine(value => /^https?:\/\//.test(value), 'HTTP source required');
export const V4_BEATS = ['paradox', 'contradiction', 'clue', 'mechanism', 'second_reveal', 'payoff'] as const;
export const VOICED_BEATS = ['contradiction', 'clue', 'mechanism', 'second_reveal', 'payoff'] as const;
export const factSchema = z.object({id: text, statement: text, sourceUrls: z.array(url).min(1)});
export const localProofSchema = z.object({
  beatId: z.enum(VOICED_BEATS), path: text, licenseNote: text,
  trimStartSec: z.number().nonnegative().default(0),
  cropPosition: z.string().regex(/^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/).default('50% 50%'),
});
export const briefSchema = z.object({
  topicId: text.regex(/^[a-z0-9-]+$/), topic: text, creativeBrief: text,
  subjectAliases: z.array(text).min(1), facts: z.array(factSchema).min(2),
  factBoundaries: z.array(text).min(1), titleSeed: text.nullable(), descriptionSeed: text.nullable(),
  localProof: z.array(localProofSchema).default([]),
}).superRefine((brief, ctx) => {
  if (new Set(brief.facts.map(f => f.id)).size !== brief.facts.length)
    ctx.addIssue({code: 'custom', message: 'Fact IDs must be unique'});
  if (new Set(brief.localProof.map(p => p.beatId)).size !== brief.localProof.length)
    ctx.addIssue({code: 'custom', message: 'Local proof beat IDs must be unique'});
});
// API envelope has no defaults or local refinements.
export const interpretedBriefSchema = z.object({
  subjectAliases: z.array(z.string()), facts: z.array(z.object({
    id: z.string(), statement: z.string(), sourceUrls: z.array(z.string()),
  })), factBoundaries: z.array(z.string()), titleSeed: z.string().nullable(), descriptionSeed: z.string().nullable(),
});
export type TopicBrief = z.infer<typeof briefSchema>;
export type GateResult = {decision: 'hold' | 'revise' | 'ready'; reasons: string[]};
export class ContentHold extends Error {
  constructor(readonly reasons: string[], readonly decision: 'hold' | 'revise' = 'hold', readonly details?: unknown) {
    super(reasons.join('; ')); this.name = 'ContentHold';
  }
}

export const RUBRIC_WEIGHTS = {visibleContradiction: 25, recognizability: 20, familiarity: 15,
  curiosityGap: 15, secondReveal: 10, payoff: 10, explainable: 5} as const;
const rating = z.number().min(0).max(5);
export const packageSchema = z.object({
  contradictionType: text, packagingClaim: text, firstFrameProof: text,
  secondReveal: text, secondRevealFactId: text,
  rubric: z.object({visibleContradiction: rating, recognizability: rating, familiarity: rating,
    curiosityGap: rating, secondReveal: rating, payoff: rating, explainable: rating}),
  rubricReasons: z.array(text).min(1),
  hooks: z.array(z.object({
    id: text, text, displayText: text, score: rating, clarity: rating,
    contradictionClear: z.boolean(), mechanismLeaked: z.boolean(), reason: text,
    wordCountException: z.string().nullable(),
  })).length(5),
  shots: z.array(z.object({
    beatId: z.enum(VOICED_BEATS), visualIntent: text,
    factIds: z.array(text).min(1), searchQueries: z.array(text).length(3),
  })).length(5),
  title: text, description: text,
});
export type V4Package = z.infer<typeof packageSchema>;
export type EvaluatedHook = V4Package['hooks'][number] & {violations: string[]; wordCount: number};
export type SelectedPackage = V4Package & {evaluatedHooks: EvaluatedHook[]; selectedHookId: string; preflightScore: number};

export const proofBindingSchema = z.object({
  id: text, beatIds: z.array(z.enum(V4_BEATS)).min(1), factIds: z.array(text).min(1),
  kind: z.enum(['stock', 'local']), localPath: text, sourcePageUrl: url.nullable(),
  creatorName: z.string().nullable(), creatorUrl: z.string().nullable(), licenseNote: text,
  selectedSearchQuery: z.string().nullable().default(null),
  trimStartSec: z.number().nonnegative(), usableDurationSec: z.number().positive(),
  cropPosition: z.string().regex(/^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/),
  observedAction: text, approved: z.literal(true),
});
export type ProofBinding = z.infer<typeof proofBindingSchema>;
export const storySchema = z.object({
  beats: z.array(z.object({
    id: z.enum(V4_BEATS), spokenText: z.string(), displayText: z.string(),
    newInformation: text, factIds: z.array(text).min(1), proofIds: z.array(text).min(1),
    targetStartSec: z.number().nonnegative(), targetEndSec: z.number().positive(),
  })).length(6),
  editorial: z.object({factsSupported: z.boolean(), distinctSecondReveal: z.boolean(),
    earlyMechanismLeak: z.boolean(), reasons: z.array(text).min(1)}),
});
export type V4Story = z.infer<typeof storySchema>;
export type V4ContentPlan = V4Story & {
  version: 'v4'; topicId: string; topic: string; package: SelectedPackage;
  facts: TopicBrief['facts']; factBoundaries: string[]; title: string; description: string;
};

export class StoryRevisionNeeded extends ContentHold {
  constructor(reasons: string[], readonly draft: V4ContentPlan) {
    super(reasons, 'revise');
    this.name = 'StoryRevisionNeeded';
  }
}
