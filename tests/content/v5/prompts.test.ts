import {expect, it, vi} from 'vitest';
import {createHash} from 'node:crypto';
import {promptPackGenerationSchema, VOICED_BEATS} from '../../../src/content/v5/contracts';
import {formatGrokPrompts, generateGrokPrompts, formatVisualPrompts, promptFileBase} from '../../../src/content/v5/prompts';
import {requiredSourceFrames} from '../../../src/content/v5/timing';
import {brief, contentPlan, generatedPromptScenes, promptContinuity, voiced} from './fixtures';

const keyFor = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

it('fills five unique prompt pairs, hashes, facts and shared continuity from the finalized story', async () => {
  const plan = contentPlan();
  const voice = voiced(undefined, plan);
  const generate = vi.fn(async () => ({continuity: promptContinuity(), scenes: generatedPromptScenes()}));
  const pack = await generateGrokPrompts(brief, plan, voice.timedPlan, generate);
  expect(pack.scenes.map(s => s.sceneId)).toEqual([...VOICED_BEATS]);
  expect(new Set(pack.scenes.map(s => s.imagePrompt)).size).toBe(5);
  expect(new Set(pack.scenes.map(s => s.videoPrompt)).size).toBe(5);
  expect(pack.continuity).toBe(promptContinuity());
  expect(pack.visualStyle).toBe(brief.visualStyle);
  expect(pack.schemaVersion).toBe(1);
  expect(pack.engineVersion).toBe('v5');
  expect(pack.workflow).toBe('gemini-flow');
  expect(pack.planHash).toBe(keyFor(plan));
  expect(pack.scenes[0].requiredFrames).toBe(requiredSourceFrames(3, 0));
  expect(pack.scenes[1].requiredFrames).toBe(requiredSourceFrames(5.2, 1));
  expect(pack.scenes[2].factIds).toEqual(['mechanism']);
  expect(pack.scenes[3].factIds).toEqual(['consequence']);
  expect(pack.scenes[0].promptHash).toBe(keyFor({
    sceneId: 'contradiction', imagePrompt: pack.scenes[0].imagePrompt, videoPrompt: pack.scenes[0].videoPrompt,
    visualStyle: brief.visualStyle, continuity: pack.continuity, factIds: pack.scenes[0].factIds,
    visualIntent: pack.scenes[0].visualIntent, requiredFrames: pack.scenes[0].requiredFrames,
    durationSeconds: 6, aspectRatio: '9:16',
  }));
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({system: expect.stringMatching(/first six frames/)}));
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({system: expect.stringMatching(/Google Flow Frames to Video/)}));
  expect(promptFileBase(pack)).toBe('flow-prompts');
  expect(formatVisualPrompts(pack, plan)).toContain('Gemini first-frame and Google Flow animation prompts');
});

it('retries a scene-order permutation once then holds, while the generation schema accepts it', async () => {
  const permuted = {continuity: promptContinuity(), scenes: [...generatedPromptScenes().slice(1), generatedPromptScenes()[0]]};
  expect(() => promptPackGenerationSchema.parse(permuted)).not.toThrow();
  const generate = vi.fn(async () => permuted);
  const record = vi.fn(async () => {});
  await expect(generateGrokPrompts(brief, contentPlan(), voiced().timedPlan, generate, record))
    .rejects.toThrow(/in order/);
  expect(generate).toHaveBeenCalledTimes(2);
  expect(record).toHaveBeenCalled();
});

it('retries empty or unknown scenes then holds without exporting the invalid pack', async () => {
  const generate = vi.fn()
    .mockResolvedValueOnce({continuity: promptContinuity(), scenes: generatedPromptScenes().map(s => ({...s, imagePrompt: ' '}))})
    .mockResolvedValueOnce({continuity: promptContinuity(), scenes: generatedPromptScenes().map((s, i) => i ? s : {...s, sceneId: 'intro'})});
  const record = vi.fn(async () => {});
  await expect(generateGrokPrompts(brief, contentPlan(), voiced().timedPlan, generate, record)).rejects.toThrow();
  expect(generate).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(record.mock.calls)).not.toMatch(/"pack"/);
});

it('holds an oversized outro before calling the generator', async () => {
  const generate = vi.fn(async () => ({continuity: promptContinuity(), scenes: generatedPromptScenes()}));
  await expect(generateGrokPrompts(brief, contentPlan(), voiced([3, 5.2, 5.8, 5.5, 4.5, 6]).timedPlan, generate))
    .rejects.toThrow(/sign-off/);
  expect(generate).not.toHaveBeenCalled();
});

it('formats copyable image and video blocks without filenames or fabricated proof', () => {
  const plan = contentPlan();
  const pack = {
    schemaVersion: 1 as const, engineVersion: 'v5' as const, planHash: 'abc', visualStyle: brief.visualStyle,
    continuity: promptContinuity(), scenes: generatedPromptScenes().map((scene, index) => ({
      ...scene, factIds: index >= 3 ? ['consequence'] : ['mechanism'], visualIntent: 'Visible displacement',
      durationSeconds: 6 as const, aspectRatio: '9:16' as const, requiredFrames: index === 0 ? 90 : 162, promptHash: `hash-${index}`,
    })),
  };
  const md = formatGrokPrompts(pack, plan);
  expect(promptFileBase(pack)).toBe('grok-prompts');
  expect(md).toMatch(/Visual style: Clean 3D educational animation/);
  expect(md).toContain(promptContinuity());
  expect(md).toMatch(/Generate the still image/);
  expect(md).toMatch(/Use that image with the matching video prompt/);
  expect(md).toMatch(/Download the MP4/);
  expect(md).toMatch(/Copy it into the printed run directory/);
  expect(md).toMatch(/Resume this run/);
  expect(md).not.toMatch(/Ptko4|\.mp4|scene-assets|promptHash/);
  expect(md).toMatch(/## Scene 3 — mechanism/);
  expect(md).toMatch(/Fact IDs: mechanism/);
  expect(md).toMatch(/Used duration:/);
  expect(md).toMatch(/```\nStill first frame for contradiction/);
  expect(md).toMatch(/```\nFrom that still, animate payoff/);
});
