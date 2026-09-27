import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import type {AppConfig} from '../../../src/config';
import {createV5ProductionDeps, resumeCommand, runV5Cli} from '../../../src/content/v5/cli';

const settings = {
  scriptProvider: 'openai', scriptModel: 'gpt-5.6', voiceProvider: 'xai', voiceId: 'eve',
  elevenLabsModel: 'eleven_multilingual_v2', channelBrand: 'Tell Me Why', channelSignoff: 'Look closer every day.',
  musicContentHash: 'abc', promptContractVersion: 1,
};

it('prints usage for a missing topic or invalid resume arguments', async () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(await runV5Cli([])).toBe(1);
  expect(await runV5Cli(['--resume'])).toBe(1);
  expect(await runV5Cli(['--resume', 'runs/one', 'extra'])).toBe(1);
  expect(err.mock.calls.flat().join('\n')).toMatch(/Usage/);
  err.mockRestore();
});

it('rejects a missing, V4 or malformed resume checkpoint before any provider work', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'v5-cli-resume-'));
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(await runV5Cli(['--resume', join(dir, 'missing')])).toBe(1);
    await writeFile(join(dir, 'resume.json'), JSON.stringify({topic: 'Straw', research: '', settings: {}}));
    expect(await runV5Cli(['--resume', dir])).toBe(1);
    await writeFile(join(dir, 'resume.json'), JSON.stringify({
      schemaVersion: 1, engineVersion: 'v5', topic: 'Straw', research: '',
    }));
    expect(await runV5Cli(['--resume', dir])).toBe(1);
    expect(err.mock.calls.flat().join('\n')).toMatch(/not a V5 checkpoint|Malformed V5 resume|no resumable V5/);
  } finally {
    err.mockRestore();
    await rm(dir, {recursive: true, force: true});
  }
});

it('does not construct a stock or Pexels client in V5 production setup', async () => {
  const src = await readFile('src/content/v5/cli.ts', 'utf8');
  expect(src).not.toMatch(/PexelsClient|pexels|stock\//);
  const pipeline = await readFile('src/pipeline/create-short-v5.ts', 'utf8');
  expect(pipeline).not.toMatch(/PexelsClient|pexels|stock\//);
  const config: AppConfig = {
    contentEngineVersion: 'v5', fastMode: false, scriptProvider: 'openai', voiceProvider: 'xai',
    xaiScriptModel: 'grok-4.3', elevenLabsApiKey: '', elevenLabsVoiceId: '', elevenLabsModel: 'eleven_multilingual_v2',
    openAiApiKey: 'oa-test', pexelsApiKey: '', xaiApiKey: 'xa-test', xaiVoiceId: 'eve',
    channelBrand: 'Tell Me Why', channelSignoff: 'Look closer every day.',
    backgroundMusicPath: 'assets/music/SOUNDTRACK.mp3',
  };
  const deps = createV5ProductionDeps(config, '', async () => 'y', () => {});
  expect(deps).not.toHaveProperty('proof');
  expect(JSON.stringify(settings)).toContain('promptContractVersion');
});

it('includes the reviewed brief and shell-quotes resume paths', () => {
  expect(resumeCommand('runs/my run', 'content/v5/pen cap.json')).toBe(
    "CONTENT_ENGINE_VERSION=v5 CONTENT_BRIEF_PATH='content/v5/pen cap.json' npm run generate -- --resume 'runs/my run'");
  expect(resumeCommand("runs/it's $(unsafe)", "brief's file.json")).toBe(
    `CONTENT_ENGINE_VERSION=v5 CONTENT_BRIEF_PATH='brief'"'"'s file.json' npm run generate -- --resume 'runs/it'"'"'s $(unsafe)'`);
  expect(resumeCommand('runs/one')).toBe("CONTENT_ENGINE_VERSION=v5 npm run generate -- --resume 'runs/one'");
  expect(resumeCommand('runs/one', 'content/v5/pen-cap-hole.json', true)).toBe(
    "CONTENT_ENGINE_VERSION=v5 CONTENT_BRIEF_PATH='content/v5/pen-cap-hole.json' FAST_MODE=true npm run generate -- --resume 'runs/one'");
});
