import {expect, it} from 'vitest';
import {z} from 'zod';
import {ContentHold} from '../../../src/content/v5/contracts';
import {bindV5Scenes, videoPlanFromV5} from '../../../src/content/v5/adapter';
import {contentPlan, promptPack, voiced, writeBindings} from './fixtures';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

it('maps six functions to five voiced scenes with empty stock queries and a visible hook card', () => {
  const plan = videoPlanFromV5(contentPlan());
  expect(plan.scenes.map(s => s.role)).toEqual(['hook', 'context', 'mechanism', 'curiosity-reset', 'payoff']);
  expect(plan.scenes[0]).toMatchObject({durationSeconds: 3, displayText: 'Straight. Looks broken.'});
  expect(plan.scenes.every(s => s.searchQueries.length === 0)).toBe(true);
  expect(plan.scenes.every(s => Boolean(s.spokenText))).toBe(true);
});

it('binds by scene ID, reuses opening for outro, and keeps payoff on its own asset', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-bind-'));
  try {
    const voice = voiced();
    const prompts = promptPack(contentPlan(), voice.timedPlan);
    const approved = await writeBindings(dir, prompts, {
      contradiction: 'opening.mp4', clue: 'clue-late.mp4', mechanism: 'Ptko4.mp4',
      second_reveal: 'reveal.mp4', payoff: 'payoff-own.mp4',
    });
    const shuffled = [approved[2], approved[4], approved[0], approved[3], approved[1]];
    const scenes = bindV5Scenes(voice.timedPlan, voice.manifest, prompts, shuffled);
    expect(scenes[0].localVideoPath).toContain('opening.mp4');
    expect(scenes[2].localVideoPath).toContain('Ptko4.mp4');
    expect(scenes[4].localVideoPath).toContain('payoff-own.mp4');
    expect(scenes[5].localVideoPath).toBe(scenes[0].localVideoPath);
    expect(scenes[5].text).toContain('Tell Me Why');
    expect(scenes.every(s => s.words.length)).toBe(true);
    expect(scenes.every(s => s.disableVideoZoom === true)).toBe(true);
    expect(scenes.every(s => s.proofAssetId === undefined)).toBe(true);
    expect(scenes[0]).toMatchObject({
      creatorName: 'Owner-generated animation', sourcePageUrl: '', selectedSearchQuery: '', creatorUrl: '',
    });
    expect(JSON.stringify(scenes)).not.toMatch(/pexels/i);
    expect(scenes[2].generatedAsset).toMatchObject({provider: 'grok-imagine', sceneId: 'mechanism'});
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('holds invalid prompt packs and bindings instead of throwing a schema dump', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-bind-hold-'));
  try {
    const voice = voiced();
    const prompts = promptPack(contentPlan(), voice.timedPlan);
    const approved = await writeBindings(dir, prompts);
    const invalid = [{...approved[0], approved: false}, ...approved.slice(1)];
    expect(() => bindV5Scenes(voice.timedPlan, voice.manifest, prompts, invalid as never)).toThrow(ContentHold);
    try {
      bindV5Scenes(voice.timedPlan, voice.manifest, prompts, invalid as never);
    } catch (error) {
      expect(error).toBeInstanceOf(ContentHold);
      expect(error).not.toBeInstanceOf(z.ZodError);
      expect((error as ContentHold).decision).toBe('hold');
    }
    expect(() => bindV5Scenes(voice.timedPlan, voice.manifest, {...prompts, scenes: []}, approved))
      .toThrow(ContentHold);
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('rejects footage too short for the rewritten scene plus transition', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-short-'));
  try {
    const voice = voiced();
    const prompts = promptPack(contentPlan(), voice.timedPlan);
    const approved = await writeBindings(dir, prompts);
    approved[2] = {...approved[2], media: {...approved[2].media, durationSec: 4}};
    expect(() => bindV5Scenes(voice.timedPlan, voice.manifest, prompts, approved)).toThrow(/cover the reviewed scene interval/);
  } finally {await rm(dir, {recursive: true, force: true});}
});

it('restores yellow opening emphasis for old plans and preserves explicit keywords', () => {
  const draft = contentPlan();
  expect(videoPlanFromV5(draft).scenes[0].emphasisWords).toEqual(['broken']);
  draft.beats[1].emphasisWords = ['Straight', 'broken'];
  expect(videoPlanFromV5(draft).scenes[0].emphasisWords).toEqual(['Straight']);
});
