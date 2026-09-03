import {z} from 'zod';
import {stripSpeechTags} from '../captions/speech-tags';

export const EDUCATIONAL_ROLES = ['hook', 'stake', 'proof', 'twist', 'payoff'] as const;
export type EducationalRole = (typeof EDUCATIONAL_ROLES)[number];
export type BeatRole = EducationalRole | StoryRole | 'outro';

export type VideoScene = {
  id: string;
  role: BeatRole;
  durationSeconds: number;
  text: string;
  visualIntent: string;
  searchQueries: string[];
  spokenText?: string;
  displayText?: string;
  emphasisWords?: string[];
  beatPurpose?: string;
  newInformation?: string;
  curiosityTarget?: string;
  requiredVisualObjects?: string[];
};

export type VideoPlan = {
  topic: string;
  title: string;
  viralAngle: string;
  scenes: VideoScene[];
};

export const CHANNEL_OUTRO_DURATION_SECONDS = 4;
export const MIN_STORY_DURATION_SECONDS = 20;
export const MAX_STORY_DURATION_SECONDS = 28;
export const MAX_FINAL_DURATION_SECONDS = 30;

export function maxStoryDurationSeconds(outroDurationSeconds: number): number {
  return Math.min(MAX_STORY_DURATION_SECONDS, MAX_FINAL_DURATION_SECONDS - outroDurationSeconds);
}

export function narrationSource(scene: Pick<VideoScene, 'text' | 'spokenText'>): string {
  return scene.spokenText ?? scene.text;
}

export function isGenericQuestionHook(text: string): boolean {
  const opening = stripSpeechTags(text.split('|')[0] ?? '');
  return /^(why|how|what|ever\s+wonder)\b/i.test(opening);
}

const isValidCaptionText = (text: string): boolean => {
  const parts = text.split('|').map((part) => stripSpeechTags(part));
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
    .max(160)
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
    scenes: z.array(videoSceneSchema).min(5).max(5),
  })
  .superRefine((plan, context) => {
    const totalDuration = plan.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
    if (totalDuration < 20 || totalDuration > 40) {
      context.addIssue({
        code: 'custom',
        path: ['scenes'],
        message: 'Total duration must be between 20 and 40 seconds',
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
        message: 'Educational roles must be hook, stake, proof, twist, payoff',
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

export const CONTENT_PATTERNS = [
  'BALANCED_REVEAL',
  'FAMILIARITY_TWIST',
  'PERSONAL_STAKES',
] as const;

export type ContentPattern = (typeof CONTENT_PATTERNS)[number];

export type HookScores = {
  stopScroll: number;
  clarity: number;
  contradiction: number;
  personalRelevance: number;
  visualizability: number;
};

const HOOK_IDS = ['hook-a', 'hook-b', 'hook-c'] as const;

export type HookConcept = {
  id: (typeof HOOK_IDS)[number];
  spokenHook: string;
  displayText: string;
  curiosityTarget: string;
  visualIntent: string;
  requiredVisualObjects: string[];
  searchQueries: string[];
  scores: HookScores;
};

export const STORY_ROLES = [
  'hook',
  'context',
  'curiosity-reset',
  'mechanism',
  'payoff',
] as const;

export type StoryRole = (typeof STORY_ROLES)[number];

export type StoryBeat = {
  id: string;
  role: StoryRole;
  durationSeconds: number;
  spokenText: string;
  displayText: string;
  emphasisWords: string[];
  beatPurpose: string;
  newInformation: string;
  curiosityTarget?: string;
  visualIntent: string;
  requiredVisualObjects: string[];
  searchQueries: string[];
};

export type VideoPlanV3 = {
  formatVersion: 'retention-v3';
  topic: string;
  creativeBrief: string;
  title: string;
  viralAngle: string;
  contentPattern: ContentPattern;
  hookCandidates: HookConcept[];
  selectedHookId: HookConcept['id'];
  beats: StoryBeat[];
};

const BANNED_HOOK_STARTS = [
  'why',
  'how',
  'what',
  'did you know',
  'have you ever wondered',
  'ever wonder',
  'ever notice',
  'hey',
  'welcome',
  "today we're",
  'in this video',
] as const;

export function normalizeHookStart(text: string): string {
  return text
    .trim()
    .replace(/^[\s"'“”‘’()[\]{}.,!:-]+/u, '')
    .toLowerCase();
}

export function isBannedHookOpening(text: string): boolean {
  const normalized = normalizeHookStart(text).replace(/^(why|how|what)['’]s\b/u, '$1');
  return (
    normalized.endsWith('?') ||
    BANNED_HOOK_STARTS.some(
      (prefix) =>
        normalized === prefix ||
        normalized.startsWith(`${prefix} `) ||
        normalized.startsWith(`${prefix},`),
    )
  );
}

function countWords(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function normalizedComparable(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function hasUniqueTrimmedLowercase(values: string[]): boolean {
  const normalized = values.map((value) => value.trim().toLowerCase());
  return new Set(normalized).size === normalized.length;
}

function hasUniqueNormalized(values: string[]): boolean {
  const normalized = values.map(normalizedComparable);
  return new Set(normalized).size === normalized.length;
}

function displayContainsEmphasisWord(displayText: string, word: string): boolean {
  const display = normalizedComparable(displayText);
  const target = normalizedComparable(word);
  return target.length > 0 && display.includes(target);
}

function hasSubscribeOrFollowCta(text: string): boolean {
  return (
    /\bsubscribe\b/iu.test(text) ||
    /\bfollow\s+(me|us|for)\b/iu.test(text) ||
    /#follow\b/iu.test(text)
  );
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

const wordCountRefine = (maxWords: number) => (value: string) => {
  const words = countWords(value);
  return words >= 1 && words <= maxWords;
};

const uniqueSearchQueries = z
  .array(z.string().trim().min(1))
  .min(2)
  .max(3)
  .refine(hasUniqueTrimmedLowercase, {
    message: 'Search queries must be unique',
  });

const nonEmptyText = z.string().trim().min(1);

const requiredVisualObjectsSchema = z.array(z.string().trim().min(1)).min(1);

const hookScoreSchema = z.number().int().min(1).max(5);

const hookScoresSchema = z.object({
  stopScroll: hookScoreSchema,
  clarity: hookScoreSchema,
  contradiction: hookScoreSchema,
  personalRelevance: hookScoreSchema,
  visualizability: hookScoreSchema,
});

const hookConceptSchema = z
  .object({
    id: z.enum(HOOK_IDS),
    spokenHook: z
      .string()
      .trim()
      .min(1)
      .refine(wordCountRefine(22), {message: 'Spoken hook must be 1 to 22 words'}),
    displayText: z
      .string()
      .trim()
      .min(1)
      .refine(wordCountRefine(9), {message: 'Display text must be 1 to 9 words'}),
    curiosityTarget: nonEmptyText,
    visualIntent: nonEmptyText,
    requiredVisualObjects: requiredVisualObjectsSchema,
    searchQueries: uniqueSearchQueries,
    scores: hookScoresSchema,
  })
  .superRefine((hook, context) => {
    if (isBannedHookOpening(hook.spokenHook)) {
      context.addIssue({
        code: 'custom',
        path: ['spokenHook'],
        message: 'Hook must not use a banned opening or end with a question mark',
      });
    }
  }) satisfies z.ZodType<HookConcept>;

export const hookCandidatesSchema = z
  .array(hookConceptSchema)
  .min(3)
  .max(3)
  .superRefine((candidates, context) => {
    const ids = candidates.map((candidate) => candidate.id);
    if (ids.slice().sort().join(',') !== [...HOOK_IDS].sort().join(',')) {
      context.addIssue({
        code: 'custom',
        path: ['id'],
        message: 'Hook ids must be hook-a, hook-b, and hook-c exactly once',
      });
    }

    if (!hasUniqueNormalized(candidates.map((candidate) => candidate.spokenHook))) {
      context.addIssue({
        code: 'custom',
        path: ['spokenHook'],
        message: 'Spoken hooks must be unique after normalization',
      });
    }
  }) satisfies z.ZodType<HookConcept[]>;

const storyBeatSchema = z
  .object({
    id: nonEmptyText,
    role: z.enum(STORY_ROLES),
    durationSeconds: z.number().positive(),
    spokenText: nonEmptyText,
    displayText: z
      .string()
      .trim()
      .min(1)
      .refine(wordCountRefine(9), {message: 'Display text must be 1 to 9 words'}),
    emphasisWords: z.array(z.string().trim().min(1)).max(2),
    beatPurpose: nonEmptyText,
    newInformation: nonEmptyText,
    curiosityTarget: nonEmptyText.optional(),
    visualIntent: nonEmptyText,
    requiredVisualObjects: requiredVisualObjectsSchema,
    searchQueries: uniqueSearchQueries,
  })
  .superRefine((beat, context) => {
    for (const [index, word] of beat.emphasisWords.entries()) {
      if (!displayContainsEmphasisWord(beat.displayText, word)) {
        context.addIssue({
          code: 'custom',
          path: ['emphasisWords', index],
          message: 'Emphasis words must appear in display text',
        });
      }
    }
  }) satisfies z.ZodType<StoryBeat>;

export const storyBeatsSchema = z
  .array(storyBeatSchema)
  .min(5)
  .max(5)
  .superRefine((beats, context) => {
    if (new Set(beats.map((beat) => beat.id)).size !== beats.length) {
      context.addIssue({
        code: 'custom',
        message: 'Beat ids must be unique',
      });
    }

    const roles = beats.map((beat) => beat.role);
    if (roles.join(',') !== STORY_ROLES.join(',')) {
      context.addIssue({
        code: 'custom',
        path: ['role'],
        message: 'Story roles must be hook, context, curiosity-reset, mechanism, payoff',
      });
    }

    const totalDuration = beats.reduce((total, beat) => total + beat.durationSeconds, 0);
    const maxStoryDuration = maxStoryDurationSeconds(CHANNEL_OUTRO_DURATION_SECONDS);
    if (totalDuration < MIN_STORY_DURATION_SECONDS || totalDuration > maxStoryDuration) {
      context.addIssue({
        code: 'custom',
        path: ['durationSeconds'],
        message: `Total duration must be between ${MIN_STORY_DURATION_SECONDS} and ${maxStoryDuration} seconds`,
      });
    }

    const requireCuriosityTarget = (role: StoryRole) => {
      const index = beats.findIndex((beat) => beat.role === role);
      const beat = index >= 0 ? beats[index] : undefined;
      if (!beat?.curiosityTarget?.trim()) {
        context.addIssue({
          code: 'custom',
          path: index >= 0 ? [index, 'curiosityTarget'] : [],
          message: `${role} must include a curiosity target`,
        });
      }
    };

    requireCuriosityTarget('hook');
    requireCuriosityTarget('curiosity-reset');

    if (!hasUniqueNormalized(beats.map((beat) => beat.spokenText))) {
      context.addIssue({
        code: 'custom',
        path: ['spokenText'],
        message: 'Spoken text must be unique across beats after normalization',
      });
    }

    if (!hasUniqueNormalized(beats.map((beat) => beat.displayText))) {
      context.addIssue({
        code: 'custom',
        path: ['displayText'],
        message: 'Display text must be unique across beats after normalization',
      });
    }

    const hook = beats.find((beat) => beat.role === 'hook');
    if (hook && isBannedHookOpening(hook.spokenText)) {
      context.addIssue({
        code: 'custom',
        path: ['spokenText'],
        message: 'Hook must not use a banned opening or end with a question mark',
      });
    }

    const payoff = beats.find((beat) => beat.role === 'payoff');
    if (
      payoff &&
      (hasSubscribeOrFollowCta(payoff.spokenText) || hasSubscribeOrFollowCta(payoff.displayText))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['spokenText'],
        message: 'Payoff must not include a subscribe or follow CTA',
      });
    }
  }) satisfies z.ZodType<StoryBeat[]>;

const videoPlanV3Schema = z
  .object({
    formatVersion: z.literal('retention-v3'),
    topic: nonEmptyText,
    creativeBrief: nonEmptyText,
    title: nonEmptyText,
    viralAngle: nonEmptyText,
    contentPattern: z.enum(CONTENT_PATTERNS),
    hookCandidates: hookCandidatesSchema,
    selectedHookId: z.enum(HOOK_IDS),
    beats: storyBeatsSchema,
  })
  .superRefine((plan, context) => {
    const selectedHook = plan.hookCandidates.find((candidate) => candidate.id === plan.selectedHookId);
    if (!selectedHook) {
      context.addIssue({
        code: 'custom',
        path: ['selectedHookId'],
        message: 'selectedHookId must reference an existing hook candidate',
      });
      return;
    }

    const hookBeat = plan.beats.find((beat) => beat.role === 'hook');
    if (!hookBeat) {
      context.addIssue({
        code: 'custom',
        path: ['beats'],
        message: 'Story must include a hook beat',
      });
      return;
    }

    const contractMatches =
      hookBeat.spokenText.trim() === selectedHook.spokenHook.trim() &&
      hookBeat.displayText.trim() === selectedHook.displayText.trim() &&
      hookBeat.visualIntent.trim() === selectedHook.visualIntent.trim() &&
      stringArraysEqual(hookBeat.requiredVisualObjects, selectedHook.requiredVisualObjects) &&
      stringArraysEqual(hookBeat.searchQueries, selectedHook.searchQueries);

    if (!contractMatches) {
      context.addIssue({
        code: 'custom',
        path: ['beats', 0],
        message: 'Hook beat copy and first-frame contract must match the selected hook',
      });
    }
  }) satisfies z.ZodType<VideoPlanV3>;

export const hookCandidatesEnvelopeSchema = z.object({
  hookCandidates: hookCandidatesSchema,
});

export const storyBeatsEnvelopeSchema = z.object({
  beats: storyBeatsSchema,
});

export function parseHookCandidates(value: unknown): HookConcept[] {
  return hookCandidatesSchema.parse(value);
}

export function parseStoryBeats(value: unknown): StoryBeat[] {
  return storyBeatsSchema.parse(value);
}

export function parseVideoPlanV3(value: unknown): VideoPlanV3 {
  return videoPlanV3Schema.parse(value);
}

export function videoPlanFromV3(plan: VideoPlanV3): VideoPlan {
  return {
    topic: plan.topic,
    title: plan.title,
    viralAngle: plan.viralAngle,
    scenes: plan.beats.map((beat) => ({
      id: beat.id,
      role: beat.role,
      durationSeconds: beat.durationSeconds,
      text: beat.spokenText,
      spokenText: beat.spokenText,
      displayText: beat.displayText,
      emphasisWords: beat.emphasisWords,
      beatPurpose: beat.beatPurpose,
      newInformation: beat.newInformation,
      curiosityTarget: beat.curiosityTarget,
      visualIntent: beat.visualIntent,
      requiredVisualObjects: beat.requiredVisualObjects,
      searchQueries: beat.searchQueries,
    })),
  };
}
