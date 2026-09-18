import {createHash} from 'node:crypto';
import {access} from 'node:fs/promises';
import {join} from 'node:path';
import {z, type ZodType} from 'zod';
import {readCheckpoint, writeCheckpoint} from '../v4/checkpoints';
import type {V5Deps} from '../../pipeline/create-short-v5';
import type {SynthesizeSceneVoicesResult} from '../../voice/synthesize-scene-voices';
import {
  ContentHold, V5StoryRevisionNeeded, VOICED_BEATS, generatedBindingSchema, promptPackSchema, v5BriefSchema,
  v5ContentPlanSchema, v5SelectedPackageSchema, type GeneratedBinding, type V5Brief, type V5ContentPlan,
} from './contracts';
import {hashFile, revalidateGeneratedBinding} from './assets';

export {readCheckpoint, writeCheckpoint};

export const V5_PROMPT_CONTRACT_VERSION = 1;
export const V5_CHECKPOINT_SCHEMA_VERSION = 1;

export const v5ResumeSettingsSchema = z.object({
  scriptProvider: z.enum(['openai', 'xai']),
  scriptModel: z.string().trim().min(1),
  voiceProvider: z.enum(['xai', 'elevenlabs']),
  voiceId: z.string().trim().min(1),
  elevenLabsModel: z.string().trim().min(1),
  channelBrand: z.string().trim().min(1),
  channelSignoff: z.string().trim().min(1),
  musicContentHash: z.string().trim().min(1),
  promptContractVersion: z.literal(V5_PROMPT_CONTRACT_VERSION),
});
export const v5ResumeSchema = z.object({
  schemaVersion: z.literal(V5_CHECKPOINT_SCHEMA_VERSION),
  engineVersion: z.literal('v5'),
  topic: z.string().trim().min(1),
  research: z.string(),
  briefIdentity: z.string().trim().min(1).optional(),
  briefFileHash: z.string().optional(),
  visualStyle: z.string().trim().min(1).optional(),
  topicId: z.string().trim().min(1).optional(),
  settings: v5ResumeSettingsSchema,
});
export type V5ResumeState = z.infer<typeof v5ResumeSchema>;

const checkpointEnvelopeSchema = z.object({
  engineVersion: z.literal('v5'),
  schemaVersion: z.literal(V5_CHECKPOINT_SCHEMA_VERSION),
  value: z.unknown(),
});
const storyCacheSchema = z.object({
  plan: v5ContentPlanSchema,
  reasons: z.array(z.string().trim().min(1)).min(1).optional(),
});
const voiceWordSchema = z.object({text: z.string(), startMs: z.number(), endMs: z.number()});
const synthesizeCacheSchema = z.object({
  timedPlan: z.object({
    topic: z.string(), title: z.string(), viralAngle: z.string(),
    scenes: z.array(z.object({
      id: z.string(), role: z.string(), durationSeconds: z.number().finite().positive(),
      text: z.string(), visualIntent: z.string(), searchQueries: z.array(z.string()),
    }).passthrough()).min(1),
  }).passthrough(),
  manifest: z.object({
    voiceId: z.string().trim().min(1), language: z.literal('en'),
    scenes: z.array(z.object({
      sceneId: z.string().trim().min(1), localAudioPath: z.string().trim().min(1),
      voiceId: z.string().trim().min(1), audioDurationSeconds: z.number().finite().positive(),
      durationSeconds: z.number().finite().positive(), words: z.array(voiceWordSchema).min(1),
    })).min(1),
  }),
  audioHashes: z.record(z.string(), z.string().trim().min(1)),
  voiceProvider: z.enum(['xai', 'elevenlabs']),
});
const bindingsSchema = z.array(generatedBindingSchema);

export const keyFor = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function v5BriefIdentity(brief: V5Brief): string {
  return keyFor({
    topicId: brief.topicId, topic: brief.topic, visualStyle: brief.visualStyle, facts: brief.facts,
    factBoundaries: brief.factBoundaries, subjectAliases: brief.subjectAliases, creativeBrief: brief.creativeBrief,
    titleSeed: brief.titleSeed, descriptionSeed: brief.descriptionSeed,
  });
}

export function parseV5Resume(value: unknown): V5ResumeState {
  const parsed = v5ResumeSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const engine = value && typeof value === 'object' && 'engineVersion' in value
    ? (value as {engineVersion?: unknown}).engineVersion : undefined;
  if (engine !== 'v5') throw new Error('This run is not a V5 checkpoint. Start a fresh V5 run.');
  throw new Error('Malformed V5 resume checkpoint. Start a fresh run.');
}

function shouldCache(value: unknown): boolean {
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === 'string' && !value.trim()) return false;
  return true;
}

function storyFinalKey(plan: Pick<V5ContentPlan, 'topicId' | 'package' | 'facts' | 'factBoundaries'>): string {
  return keyFor({topicId: plan.topicId, package: plan.package, facts: plan.facts, factBoundaries: plan.factBoundaries});
}

async function readEnvelope<T>(path: string, schema: ZodType<T>): Promise<T | undefined> {
  const saved = await readCheckpoint<unknown>(path);
  if (saved === undefined) return undefined;
  const envelope = checkpointEnvelopeSchema.safeParse(saved);
  if (!envelope.success) return undefined;
  const parsed = schema.safeParse(envelope.data.value);
  return parsed.success ? parsed.data : undefined;
}

async function writeEnvelope(path: string, value: unknown): Promise<void> {
  await writeCheckpoint(path, {engineVersion: 'v5', schemaVersion: V5_CHECKPOINT_SCHEMA_VERSION, value});
}

async function audioStillValid(cached: z.infer<typeof synthesizeCacheSchema>, voiceProvider: 'xai' | 'elevenlabs'): Promise<boolean> {
  if (cached.voiceProvider !== voiceProvider) return false;
  try {
    for (const scene of cached.manifest.scenes) {
      await access(scene.localAudioPath);
      if (await hashFile(scene.localAudioPath) !== cached.audioHashes[scene.sceneId]) return false;
    }
    return cached.manifest.scenes.every(scene => scene.sceneId in cached.audioHashes);
  } catch {
    return false;
  }
}

function keepValidBindings(value: unknown): GeneratedBinding[] {
  if (!Array.isArray(value)) return [];
  const kept: GeneratedBinding[] = [];
  for (const item of value) {
    const parsed = generatedBindingSchema.safeParse(item);
    if (parsed.success) kept.push(parsed.data);
  }
  return kept;
}

// Replay the pipeline, reusing completed operations only for identical accepted inputs.
export function withV5Checkpoints(deps: V5Deps, run: {runId: string; runDir: string}): V5Deps {
  const file = (stage: string, input: unknown) => join(run.runDir, `checkpoint-${stage}-${keyFor(input)}.json`);
  async function cached<T>(stage: string, input: unknown, perform: () => Promise<T>, schema: ZodType<T>,
    valid: (value: T) => Promise<boolean> = async () => true): Promise<T> {
    const path = file(stage, input);
    const saved = await readEnvelope(path, schema);
    if (saved !== undefined && await valid(saved)) return saved;
    const value = await perform();
    if (shouldCache(value)) {
      const parsed = schema.safeParse(value);
      if (parsed.success) await writeEnvelope(path, parsed.data);
    }
    return value;
  }
  const persistRewrite = async () => writeCheckpoint(join(run.runDir, 'rewrite-count.json'), {rewriteCount: 1});
  const readFinalStory = (brief: V5Brief, pack: V5ContentPlan['package']) =>
    readEnvelope(join(run.runDir, `checkpoint-story-final-${storyFinalKey({
      topicId: brief.topicId, package: pack, facts: brief.facts, factBoundaries: brief.factBoundaries,
    })}.json`), v5ContentPlanSchema);

  return {...deps,
    createRunDirectory: async () => run,
    loadBrief: async topic => {
      const brief = await cached('brief', topic, () => deps.loadBrief(topic), v5BriefSchema);
      const resumePath = join(run.runDir, 'resume.json');
      const saved = await readCheckpoint<unknown>(resumePath);
      if (saved === undefined) return brief;
      const resume = parseV5Resume(saved);
      const identity = v5BriefIdentity(brief);
      if (resume.briefIdentity && resume.briefIdentity !== identity)
        throw new Error('Brief or visual style changed. Start a fresh run.');
      if (!resume.briefIdentity) {
        await writeCheckpoint(resumePath, {
          ...resume, briefIdentity: identity, visualStyle: brief.visualStyle, topicId: brief.topicId,
        });
      }
      return brief;
    },
    package: (brief, record) => cached('package', brief, () => deps.package(brief, record), v5SelectedPackageSchema),
    approvePackage: async pack => {
      const saved = await readEnvelope(file('package-approved', pack), z.literal(true));
      if (saved === true) return true;
      const approved = await deps.approvePackage(pack);
      if (approved) await writeEnvelope(file('package-approved', pack), true);
      return approved;
    },
    story: async (brief, pack, revision) => {
      if (revision) await persistRewrite();
      if (!revision) {
        const accepted = await readFinalStory(brief, pack);
        if (accepted) return accepted;
      }
      const result = await cached('story', {brief, pack, revision}, async () => {
        try {return {plan: await deps.story(brief, pack, revision)};}
        catch (error) {
          if (error instanceof V5StoryRevisionNeeded) {
            await persistRewrite();
            return {plan: error.draft, reasons: error.reasons};
          }
          throw error;
        }
      }, storyCacheSchema);
      if (result.reasons?.length) throw new V5StoryRevisionNeeded(result.reasons, result.plan);
      return result.plan;
    },
    approveStory: async plan => {
      const saved = await readEnvelope(file('story-approved', plan), z.literal(true));
      const approved = saved === true ? true : await deps.approveStory(plan);
      if (!approved) return false;
      if (saved !== true) await writeEnvelope(file('story-approved', plan), true);
      await writeEnvelope(join(run.runDir, `checkpoint-story-final-${storyFinalKey(plan)}.json`), plan);
      return true;
    },
    synthesize: async (plan, dir, previous) => {
      const path = file('voice', {plan, voiceProvider: deps.voiceProvider});
      const saved = await readEnvelope(path, synthesizeCacheSchema);
      if (saved && await audioStillValid(saved, deps.voiceProvider))
        return {timedPlan: saved.timedPlan, manifest: saved.manifest} as SynthesizeSceneVoicesResult;
      const value = await deps.synthesize(plan, dir, previous);
      const audioHashes: Record<string, string> = {};
      for (const scene of value.manifest.scenes) audioHashes[scene.sceneId] = await hashFile(scene.localAudioPath);
      await writeEnvelope(path, {
        timedPlan: value.timedPlan, manifest: value.manifest, audioHashes, voiceProvider: deps.voiceProvider,
      });
      return value;
    },
    reviewTiming: async timing => {
      const saved = await readEnvelope(file('timing-approved', timing), z.string().trim().min(1));
      if (saved) return saved;
      const reason = await deps.reviewTiming(timing);
      if (reason?.trim()) await writeEnvelope(file('timing-approved', timing), reason.trim());
      return reason;
    },
    prompts: (brief, plan, timed) => cached('prompts', {brief, plan, timed}, () => deps.prompts(brief, plan, timed), promptPackSchema),
    approvePrompts: async pack => {
      const saved = await readEnvelope(file('prompts-approved', pack), z.literal(true));
      if (saved === true) return true;
      const approved = await deps.approvePrompts(pack);
      if (approved) await writeEnvelope(file('prompts-approved', pack), true);
      return approved;
    },
    assets: async (pack, timed, dir, record, previous) => {
      const path = file('assets', {pack, timed});
      const fromCheckpoint = await readEnvelope(path, bindingsSchema);
      const fromSceneAssets = keepValidBindings(await readCheckpoint<unknown>(join(dir, 'scene-assets.json')));
      const saved = fromCheckpoint ?? (previous?.length ? previous : fromSceneAssets);
      return deps.assets(pack, timed, dir, async values => {
        await writeEnvelope(path, values);
        await record(values);
      }, saved);
    },
    validateAssets: async (pack, timed, bindings) => {
      const parsed = bindingsSchema.parse(bindings);
      const seen = new Set<string>();
      for (const id of VOICED_BEATS) {
        const binding = parsed.find(item => item.sceneId === id);
        if (!binding) throw new ContentHold([`Missing approved generated clip for ${id}`]);
        const valid = await revalidateGeneratedBinding(binding, {
          runDir: run.runDir, prompts: pack, timedPlan: timed,
        }, {probe: deps.probe});
        if (!valid) throw new ContentHold([`${id}: approved media is missing or changed`]);
        if (seen.has(valid.sha256)) throw new ContentHold([`${id}: story clips must use distinct source files`]);
        seen.add(valid.sha256);
      }
      await deps.validateAssets(pack, timed, parsed);
    },
  };
}
