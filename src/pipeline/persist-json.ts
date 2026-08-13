import {writeFile} from 'node:fs/promises';

export async function persistJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
