import type {VoiceWord} from '../domain/voice';

export function charactersToWords(
  chars: string[],
  times: Array<readonly [number, number]>,
): VoiceWord[] {
  if (chars.length !== times.length) {
    throw new Error('Timestamp length mismatch');
  }

  const words: VoiceWord[] = [];
  let current = '';
  let startMs = 0;
  let endMs = 0;

  const flush = () => {
    if (current.length > 0) {
      words.push({text: current, startMs, endMs});
    }
    current = '';
  };

  for (const [index, char] of chars.entries()) {
    const pair = times[index];
    if (!pair) throw new Error('Timestamp length mismatch');
    if (!char || /\s/u.test(char)) {
      flush();
      continue;
    }
    if (current.length === 0) startMs = Math.round(pair[0] * 1000);
    current += char;
    endMs = Math.round(pair[1] * 1000);
  }
  flush();
  return words;
}
