import {createWriteStream} from 'node:fs';
import {rename, rm, stat} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export async function downloadFile(url: string, destination: string): Promise<void> {
  const partialPath = `${destination}.partial`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Video download failed with status ${response.status}`);
    if (!response.body) throw new Error('Video download returned no response body');

    await pipeline(
      Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream),
      createWriteStream(partialPath),
    );
    if ((await stat(partialPath)).size === 0) throw new Error('Video download produced a zero-byte file');

    await rename(partialPath, destination);
  } catch (error) {
    await rm(partialPath, {force: true});
    throw error;
  }
}
