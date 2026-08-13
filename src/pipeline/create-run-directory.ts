import {mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {join} from 'node:path';

function formatRunId(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`,
    randomBytes(4).toString('hex'),
  ].join('-');
}

export async function createRunDirectory(
  _topic: string,
  root = 'runs',
): Promise<{runId: string; runDir: string}> {
  await mkdir(root, {recursive: true});

  while (true) {
    const runId = formatRunId(new Date());
    const runDir = join(root, runId);

    try {
      await mkdir(runDir);
      return {runId, runDir};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
}
