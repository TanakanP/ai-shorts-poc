import {RenderInternals} from '@remotion/renderer';

/** Decode frame zero from the finished video, preserving its dimensions. */
export async function extractThumbnail(videoPath: string, imagePath: string): Promise<void> {
  await RenderInternals.callFf({
    bin: 'ffmpeg',
    indent: false,
    logLevel: 'error',
    binariesDirectory: null,
    cancelSignal: undefined,
    args: ['-y', '-i', videoPath, '-map', '0:v:0', '-frames:v', '1',
      '-q:v', '2', '-update', '1', imagePath],
  });
}
