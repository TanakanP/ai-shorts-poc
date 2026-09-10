import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {expect, it} from 'vitest';
import {extractThumbnail} from '../../src/remotion/extract-thumbnail';

it('extracts a JPEG from a real MP4 and can replace it on rerun', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'thumbnail-'));
  const output = join(dir, 'thumbnail.jpg');
  try {
    await extractThumbnail(resolve('tests/fixtures/tiny-video.mp4'), output);
    const first = await readFile(output);
    expect(first.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(first.length).toBeGreaterThan(100);
    await extractThumbnail(resolve('tests/fixtures/tiny-video.mp4'), output);
    expect(await readFile(output)).toEqual(first);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
