import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {startAssetServer} from './render-short';

let bundled: Promise<string> | undefined;
export async function renderProofPreview(path: string, start: number, crop: string, outputBase: string, durationSec: number) {
  const server = await startAssetServer([resolve(path)]);
  try {
    bundled ??= bundle({entryPoint: fileURLToPath(new URL('./proof-preview-entry.tsx', import.meta.url))})
      .catch(error => {bundled = undefined; throw error;});
    const serveUrl = await bundled;
    const source = new URL('/asset', server.origin);
    source.searchParams.set('path', resolve(path));
    const inputProps = {source: source.href, trimStartSec: start, cropPosition: crop, durationSec: Math.min(8, durationSec)};
    const composition = await selectComposition({serveUrl, id: 'ProofPreview', inputProps});
    const stillPath = resolve(`${outputBase}.jpg`);
    const previewPath = resolve(`${outputBase}.mp4`);
    await renderStill({serveUrl, composition, inputProps, output: stillPath, imageFormat: 'jpeg', frame: 0});
    await renderMedia({serveUrl, composition, inputProps, outputLocation: previewPath, codec: 'h264'});
    return {stillPath, previewPath};
  } finally {await server.close();}
}
