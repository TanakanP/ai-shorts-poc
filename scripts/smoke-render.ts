import {mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {ResolvedVideo} from '../src/domain/resolved-video.js';
import {renderShort} from '../src/remotion/render-short.js';

const outputPath = fileURLToPath(new URL('../runs/smoke/output.mp4', import.meta.url));
const fixturePath = fileURLToPath(new URL('../tests/fixtures/tiny-video.mp4', import.meta.url));

const video: ResolvedVideo = {
  runId: 'smoke',
  title: 'Smoke render',
  fps: 30,
  width: 1080,
  height: 1920,
  scenes: [
    {
      id: 'smoke-scene',
      role: 'hook',
      durationSeconds: 5,
      text: 'A five-second local smoke render.',
      visualIntent: 'A five-second local smoke render.',
      searchQueries: ['smoke render fixture', 'local test clip'],
      selectedSearchQuery: 'smoke render fixture',
      sourcePageUrl: 'https://www.pexels.com/',
      creatorName: 'Fixture footage',
      creatorUrl: 'https://www.pexels.com/',
      localVideoPath: fixturePath,
      localAudioPath: fileURLToPath(new URL('../tests/fixtures/tiny-audio.mp3', import.meta.url)),
      audioDurationSeconds: 1,
      words: [
        {text: 'A', startMs: 0, endMs: 200},
        {text: 'five-second', startMs: 400, endMs: 1200},
        {text: 'smoke', startMs: 1400, endMs: 2000},
        {text: 'render.', startMs: 2200, endMs: 3000},
      ],
    },
  ],
};

await mkdir(dirname(outputPath), {recursive: true});
await renderShort(video, outputPath);
console.log(`Rendered ${outputPath}`);
