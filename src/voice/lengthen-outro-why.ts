import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RenderInternals} from '@remotion/renderer';
import {stripSpeechTags} from '../captions/speech-tags';
import type {SynthesizeSpeechResult} from './xai-tts-client';

const WHY_DURATION_MS = 1600;

/** Keep the word's onset and ending; stretch its middle without lowering pitch. */
export async function lengthenOutroWhy(spoken: SynthesizeSpeechResult): Promise<SynthesizeSpeechResult> {
  const index = spoken.words.findIndex(word => /^why[?.!]*$/i.test(stripSpeechTags(word.text)));
  const why = spoken.words[index];
  if (!why) return spoken;
  const length = why.endMs - why.startMs;
  if (length <= 0 || length >= WHY_DURATION_MS) return spoken;
  const extra = WHY_DURATION_MS - length;
  const start = (why.startMs + length * 0.15) / 1000;
  const end = (why.endMs - length * 0.15) / 1000;
  let tempo = (end - start) / (end - start + extra / 1000);
  const filters: string[] = [];
  while (tempo < 0.5) {
    filters.push('atempo=0.5');
    tempo /= 0.5;
  }
  filters.push(`atempo=${tempo}`);
  const dir = await mkdtemp(join(tmpdir(), 'outro-why-'));
  try {
    const input = join(dir, 'input.mp3');
    const output = join(dir, 'output.mp3');
    await writeFile(input, spoken.audio);
    await RenderInternals.callFf({bin: 'ffmpeg', indent: false, logLevel: 'error',
      binariesDirectory: null, cancelSignal: undefined,
      args: ['-y', '-i', input, '-filter_complex',
        `[0:a]atrim=end=${start},asetpts=PTS-STARTPTS[a];` +
        `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,${filters.join(',')}[b];` +
        `[0:a]atrim=start=${end},asetpts=PTS-STARTPTS[c];` +
        '[a][b][c]concat=n=3:v=0:a=1[out]',
        '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '192k', output],
    });
    return {...spoken, audio: await readFile(output),
      durationSeconds: spoken.durationSeconds + extra / 1000,
      words: spoken.words.map((word, i) => i < index ? word : i === index
        ? {...word, endMs: word.endMs + extra}
        : {...word, startMs: word.startMs + extra, endMs: word.endMs + extra}),
    };
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
}
