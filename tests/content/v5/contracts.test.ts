import {expect, it} from 'vitest';
import {
  generatedBindingSchema, mediaInfoSchema, promptPackGenerationSchema, promptPackSchema, scenePromptSchema,
  v5ContentPlanSchema, v5PackageGenerationSchema, v5PackageSchema, v5StoryGenerationSchema, v5StorySchema,
} from '../../../src/content/v5/contracts';
import {contentPlan, generatedPromptScenes, promptContinuity, promptPack, rawPackage} from './fixtures';

it('accepts a V5 package without stock search queries', () => {
  const raw = rawPackage();
  expect(() => v5PackageGenerationSchema.parse(raw)).not.toThrow();
  expect(() => v5PackageSchema.parse(raw)).not.toThrow();
  expect(raw.shots.every(shot => !('searchQueries' in shot))).toBe(true);
});

it('rejects missing, duplicate or unknown package scenes', () => {
  const missing = rawPackage(); missing.shots = missing.shots.slice(0, 4);
  expect(() => v5PackageSchema.parse(missing)).toThrow();
  const duplicate = rawPackage(); duplicate.shots[1] = {...duplicate.shots[0]};
  expect(() => v5PackageSchema.parse(duplicate)).toThrow(/unique|five voiced/i);
  const unknown = rawPackage();
  expect(() => v5PackageSchema.parse({...unknown, shots: unknown.shots.map((s, i) => i ? s : {...s, beatId: 'intro'})})).toThrow();
});

it('maps paradox to contradiction and requires six ordered functions', () => {
  const plan = contentPlan();
  expect(() => v5StorySchema.parse(plan)).not.toThrow();
  expect(() => v5ContentPlanSchema.parse(plan)).not.toThrow();
  plan.beats[0].sceneId = 'clue';
  expect(() => v5StorySchema.parse(plan)).toThrow(/contradiction/);
});

it('rejects unknown or mismatched story fact references', () => {
  const plan = contentPlan();
  plan.beats[2].factIds = ['invented'];
  expect(() => v5ContentPlanSchema.parse(plan)).toThrow();
  const other = contentPlan();
  other.beats[4].factIds = ['mechanism'];
  expect(() => v5ContentPlanSchema.parse(other)).toThrow();
});

it('requires five unique nonempty prompt pairs and shared continuity', () => {
  const pack = promptPack();
  expect(promptPackSchema.parse(pack).scenes).toHaveLength(5);
  expect(new Set(pack.scenes.map(s => s.sceneId)).size).toBe(5);
  expect(new Set(pack.scenes.map(s => s.imagePrompt)).size).toBe(5);
  expect(new Set(pack.scenes.map(s => s.videoPrompt)).size).toBe(5);
  expect(pack.scenes.every(s => s.imagePrompt && s.videoPrompt && s.imagePrompt !== s.videoPrompt)).toBe(true);
  expect(pack.continuity).toBe(promptContinuity());
  expect(() => scenePromptSchema.parse({...pack.scenes[0], imagePrompt: ' '})).toThrow();
  expect(() => scenePromptSchema.parse({...pack.scenes[0], videoPrompt: ''})).toThrow();
});

it('rejects missing, duplicate or unknown prompt scenes and out-of-range frames', () => {
  const pack = promptPack();
  expect(() => promptPackSchema.parse({...pack, scenes: pack.scenes.slice(0, 4)})).toThrow();
  expect(() => promptPackSchema.parse({...pack, scenes: [pack.scenes[1], ...pack.scenes.slice(1)]})).toThrow();
  expect(() => promptPackSchema.parse({...pack, scenes: [...pack.scenes.slice(1), pack.scenes[0]]})).toThrow();
  expect(() => scenePromptSchema.parse({...pack.scenes[0], requiredFrames: 181})).toThrow();
  expect(() => scenePromptSchema.parse({...pack.scenes[0], durationSeconds: 5})).toThrow();
});

it('lets the generation envelope accept a scene-order permutation', () => {
  const scenes = [...generatedPromptScenes().slice(1), generatedPromptScenes()[0]];
  expect(() => promptPackGenerationSchema.parse({continuity: promptContinuity(), scenes})).not.toThrow();
});

it('rejects nonfinite media and requires an approved generated binding', () => {
  expect(() => mediaInfoSchema.parse({durationSec: Infinity, width: 1080, height: 1920, fps: 30})).toThrow();
  expect(() => mediaInfoSchema.parse({durationSec: 6, width: 0, height: 1920, fps: 30})).toThrow();
  expect(() => generatedBindingSchema.parse({
    sceneId: 'payoff', kind: 'generated', provider: 'grok-imagine', fileName: 'payoff.mp4', localPath: '/tmp/payoff.mp4',
    sha256: 'abc', promptHash: 'def', trimStartSec: 0, cropPosition: '50% 50%',
    media: {durationSec: 6, width: 1080, height: 1920, fps: 30}, observedAction: 'Action', approved: false,
  })).toThrow();
});

it('allows an empty action only for a fast-reviewed contradiction binding', () => {
  const base = {
    sceneId: 'contradiction', kind: 'generated', provider: 'google-flow', fileName: 'opening.mp4',
    localPath: '/tmp/opening.mp4', sha256: 'abc', promptHash: 'def', trimStartSec: 0,
    cropPosition: '50% 50%', media: {durationSec: 6, width: 1080, height: 1920, fps: 30},
    observedAction: '', approved: true,
  };
  expect(() => generatedBindingSchema.parse({...base, reviewMode: 'fast'})).not.toThrow();
  expect(() => generatedBindingSchema.parse(base)).toThrow(/Observed action/);
  expect(() => generatedBindingSchema.parse({...base, sceneId: 'clue', reviewMode: 'fast'})).toThrow(/Fast review|Observed action/);
});

it('exports strict provider schemas with explicit emphasis words', async () => {
  const {zodTextFormat} = await import('openai/helpers/zod');
  expect(() => zodTextFormat(v5PackageGenerationSchema, 'v5_package')).not.toThrow();
  expect(() => zodTextFormat(v5StoryGenerationSchema, 'v5_story')).not.toThrow();
  expect(() => zodTextFormat(promptPackGenerationSchema, 'v5_prompts')).not.toThrow();
});
