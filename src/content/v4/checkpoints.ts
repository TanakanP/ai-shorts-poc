import {createHash} from 'node:crypto';
import {readFile, writeFile, rename, access} from 'node:fs/promises';
import {join} from 'node:path';
import type {V4Deps} from '../../pipeline/create-short-v4';
import {StoryRevisionNeeded, type ProofBinding} from './contracts';

export async function readCheckpoint<T>(path: string): Promise<T | undefined> {
  try {return JSON.parse(await readFile(path, 'utf8')) as T;}
  catch (error) {if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error;}
}
export async function writeCheckpoint(path: string, value: unknown): Promise<void> {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${path}.tmp`, path);
}
const keyFor = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Replay the pipeline, reusing completed operations only for identical inputs.
// Save each approval immediately so a later provider/render failure cannot erase it.
export function withV4Checkpoints(deps: V4Deps, run: {runId: string; runDir: string}): V4Deps {
  async function cached<T>(stage: string, input: unknown, perform: () => Promise<T>, valid: (value: T) => Promise<boolean> = async () => true): Promise<T> {
    const path = join(run.runDir, `checkpoint-${stage}-${keyFor(input)}.json`);
    const saved = await readCheckpoint<{value: T}>(path);
    if (saved && await valid(saved.value)) return saved.value;
    const value = await perform();
    if (value !== false && value !== null) await writeCheckpoint(path, {value});
    return value;
  }
  return {...deps,
    createRunDirectory: async () => run,
    loadBrief: topic => cached('brief', topic, () => deps.loadBrief(topic)),
    package: (brief, record) => cached('package', brief, () => deps.package(brief, record)),
    approvePackage: pack => cached('package-approved', pack, () => deps.approvePackage(pack)),
    proof: async (pack, brief, dir, record) => {
      const path = join(dir, `checkpoint-proof-${keyFor({pack, brief})}.json`);
      const previous = await readCheckpoint<ProofBinding[]>(path) ?? [];
      return deps.proof(pack, brief, dir, async values => {
        await writeCheckpoint(path, values);
        await record(values);
      }, previous);
    },
    story: async (brief, pack, proofs, revision) => {
      const result = await cached('story', {brief, pack, proofs, revision}, async () => {
        try {return {plan: await deps.story(brief, pack, proofs, revision)};}
        catch (error) {
          if (error instanceof StoryRevisionNeeded) return {plan: error.draft, reasons: error.reasons};
          throw error;
        }
      });
      if ('reasons' in result && result.reasons) throw new StoryRevisionNeeded(result.reasons, result.plan);
      return result.plan;
    },
    approveStory: plan => cached('story-approved', plan, () => deps.approveStory(plan)),
    synthesize: (plan, dir, previous) => cached('voice', plan, () => deps.synthesize(plan, dir, previous), async value => {
      try {await Promise.all(value.manifest.scenes.map(s => access(s.localAudioPath))); return true;}
      catch {return false;}
    }),
    reviewTiming: timing => cached('timing-approved', timing, () => deps.reviewTiming(timing)),
  };
}
