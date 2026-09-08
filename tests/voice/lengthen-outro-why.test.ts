import {readFile} from 'node:fs/promises';
import {expect, it} from 'vitest';
import {lengthenOutroWhy} from '../../src/voice/lengthen-outro-why';

it('extends why to 1.6s and shifts later words without changing earlier timings', async () => {
  const input = {audio: await readFile('tests/fixtures/tiny-audio.mp3'), durationSeconds: 1,
    words: [{text: 'Tell', startMs: 0, endMs: 150},
      {text: '<slow>why</slow>?', startMs: 200, endMs: 700},
      {text: 'Follow', startMs: 700, endMs: 1000}]};
  const result = await lengthenOutroWhy(input);
  expect(result.words).toEqual([input.words[0],
    {text: '<slow>why</slow>?', startMs: 200, endMs: 1800},
    {text: 'Follow', startMs: 1800, endMs: 2100}]);
  expect(result.durationSeconds).toBeCloseTo(2.1);
  expect(result.audio.equals(input.audio)).toBe(false);
});

it('leaves missing or already long why alone', async () => {
  const input = {audio: Buffer.from('unused'), durationSeconds: 3,
    words: [{text: 'why?', startMs: 200, endMs: 2000}]};
  expect(await lengthenOutroWhy(input)).toBe(input);
  const noWhy = {...input, words: []};
  expect(await lengthenOutroWhy(noWhy)).toBe(noWhy);
});
