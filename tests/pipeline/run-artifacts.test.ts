import {access, mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {createRunDirectory} from '../../src/pipeline/create-run-directory';
import {persistJson} from '../../src/pipeline/persist-json';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ai-shorts-runs-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})),
  );
});

describe('run artifacts', () => {
  it('creates a filesystem-safe run id in the required timestamp format', async () => {
    const {runId, runDir} = await createRunDirectory('Cities at night', await createTemporaryDirectory());

    expect(runId).toMatch(/^\d{8}-\d{6}-[a-f0-9]{8}$/);
    await expect(access(runDir)).resolves.toBeUndefined();
  });

  it('creates separate directories for concurrent runs', async () => {
    const root = await createTemporaryDirectory();
    const [first, second] = await Promise.all([
      createRunDirectory('Shared topic', root),
      createRunDirectory('Shared topic', root),
    ]);

    expect(first.runDir).not.toBe(second.runDir);
    await expect(access(first.runDir)).resolves.toBeUndefined();
    await expect(access(second.runDir)).resolves.toBeUndefined();
  });

  it('writes pretty JSON with a trailing newline', async () => {
    const path = join(await createTemporaryDirectory(), 'run.json');

    await persistJson(path, {runId: '20260813-120000-deadbeef', status: 'started'});

    await expect(readFile(path, 'utf8')).resolves.toBe(
      '{\n  "runId": "20260813-120000-deadbeef",\n  "status": "started"\n}\n',
    );
  });

  it('does not use free-form topic text as a path segment', async () => {
    const root = await createTemporaryDirectory();
    const topic = '../../a path with spaces/and/slashes';
    const {runId, runDir} = await createRunDirectory(topic, root);

    expect(runDir).toBe(join(root, runId));
    expect(runDir).not.toContain(topic);
  });
});
