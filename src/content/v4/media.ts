import {resolve} from 'node:path';
import {RenderInternals} from '@remotion/renderer';
import {ContentHold} from './contracts';
import {renderProofPreview} from '../../remotion/render-proof-preview';

const ff = (bin: 'ffmpeg' | 'ffprobe', args: string[]) => RenderInternals.callFf({
  bin, args, indent: false, logLevel: 'error', binariesDirectory: null, cancelSignal: undefined,
});
export async function probeMedia(path: string): Promise<{durationSec: number; width: number; height: number; fps: number}> {
  const result = await ff('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'format=duration:stream=width,height,r_frame_rate', '-of', 'json', resolve(path)]);
  const data = JSON.parse(result.stdout);
  const stream = data.streams?.[0];
  const durationSec = Number(data.format?.duration);
  const [n, d] = String(stream?.r_frame_rate ?? '0/1').split('/').map(Number);
  if (!Number.isFinite(durationSec) || durationSec <= 0 || !stream?.width || !stream?.height)
    throw new ContentHold(['Proof file must be decodable video with positive duration']);
  return {durationSec, width: stream.width, height: stream.height, fps: n / d};
}

export function cropFractions(position: string): [number, number] {
  if (!/^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/u.test(position)) throw new ContentHold(['Crop must be two percentages']);
  const values = position.split(' ').map(v => Number(v.replace('%', '')) / 100);
  if (values.some(v => v < 0 || v > 1)) throw new ContentHold(['Crop percentages must be between 0 and 100']);
  return values as [number, number];
}

export async function previewProof(path: string, start: number, crop: string, outputBase: string, durationSec: number) {
  cropFractions(crop);
  // Bundled FFmpeg omits crop/setsar filters; use the same CSS/video renderer as the final MP4.
  return renderProofPreview(path, start, crop, outputBase, durationSec);
}
