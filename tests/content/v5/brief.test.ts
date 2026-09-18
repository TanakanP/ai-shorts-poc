import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {v5BriefSchema} from '../../../src/content/v5/contracts';
import {DEFAULT_V5_VISUAL_STYLE, loadV5Brief} from '../../../src/content/v5/brief';
import {brief} from './fixtures';

it('parses the reviewed V5 sample and preserves its metadata', async () => {
  const raw = JSON.parse(await readFile('content/v5/pen-cap-hole.json', 'utf8'));
  expect(v5BriefSchema.parse(raw)).toMatchObject({
    topicId: 'pen-cap-hole', titleSeed: raw.titleSeed, descriptionSeed: raw.descriptionSeed,
    visualStyle: 'Clean 3D educational animation',
  });
  expect(raw).not.toHaveProperty('localProof');
});

it('loads a V4 JSON brief as V5, discards localProof and defaults style', async () => {
  const loaded = await loadV5Brief(
    'A Pen-Cap Hole Is an Airway Safety Feature', '', 'content/v4/pen-cap-hole.json');
  expect(loaded).not.toHaveProperty('localProof');
  expect(loaded.visualStyle).toBe(DEFAULT_V5_VISUAL_STYLE);
  expect(loaded.facts.map(f => f.id)).toEqual(['mechanism', 'consequence']);
  expect(loaded.titleSeed).toBe('The Pen-Cap Hole Has an Airway Safety Job');
});

it('keeps an explicit V5 visual style and rejects a mismatched topic', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-brief-'));
  try {
    const path = join(dir, 'brief.json');
    await writeFile(path, JSON.stringify({
      ...brief, visualStyle: 'Paper-cut collage', localProof: [{beatId: 'contradiction', path: 'proof.mp4', licenseNote: 'Owned'}],
    }));
    const loaded = await loadV5Brief(brief.topic, '', path);
    expect(loaded.visualStyle).toBe('Paper-cut collage');
    expect(loaded).not.toHaveProperty('localProof');
    await expect(loadV5Brief('Other topic', '', path)).rejects.toThrow(/match/);
  } finally {await rm(dir, {recursive: true});}
});

it('does not treat an invented source as a reviewed brief', async () => {
  const confirmFacts = vi.fn(async () => true);
  await expect(loadV5Brief('Straw', 'See https://example.org/original', undefined,
    {interpret: async () => brief, confirmFacts})).rejects.toThrow(/not supplied/);
  expect(confirmFacts).not.toHaveBeenCalled();
});

it('requires explicit factual review for interpreted free text', async () => {
  await expect(loadV5Brief(brief.topic, brief.facts[0].sourceUrls[0], undefined,
    {interpret: async () => ({
      subjectAliases: brief.subjectAliases, facts: brief.facts, factBoundaries: brief.factBoundaries,
      titleSeed: brief.titleSeed, descriptionSeed: brief.descriptionSeed,
    }), confirmFacts: async () => false})).rejects.toThrow(/not confirmed/);
});
