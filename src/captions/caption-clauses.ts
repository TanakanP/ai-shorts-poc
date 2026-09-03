import type {VoiceWord} from '../domain/voice';

export const CLAUSE_MAX_CHARS = 40;

const HARD_STOP = /[.?!—–―]$/u;
const SEMI_OR_COLON = /[;:]$/;

const CLAUSE_STARTERS = new Set([
  'because',
  'so',
  'but',
  'although',
  'though',
  'when',
  'while',
  'if',
  'unless',
  'until',
]);

const SAFE_PREPS = new Set(['for', 'to', 'with', 'from', 'by', 'into']);

const bare = (text: string): string => text.toLowerCase().replace(/[^a-z']/g, '');

const endsHard = (text: string): boolean => HARD_STOP.test(text.trim());

const endsSemiOrColon = (text: string): boolean => SEMI_OR_COLON.test(text.trim());

const endsComma = (text: string): boolean => text.trim().endsWith(',');

const isClauseStarter = (words: readonly VoiceWord[], index: number): boolean => {
  const word = words[index];
  if (!word) return false;
  const token = bare(word.text);
  const next = words[index + 1];
  if (token === 'so' && next && bare(next.text) === 'that') return true;
  return CLAUSE_STARTERS.has(token);
};

const isListComma = (words: readonly VoiceWord[], commaIndex: number): boolean => {
  const after = words[commaIndex + 1];
  const after2 = words[commaIndex + 2];
  if (!after) return false;

  let priorComma = false;
  for (let index = commaIndex - 1; index >= Math.max(0, commaIndex - 5); index -= 1) {
    if (endsComma(words[index]?.text ?? '')) priorComma = true;
  }

  if (after2 && endsComma(after2.text)) return true;
  if (bare(after.text) === 'and' && priorComma) return true;
  if (after2 && bare(after2.text) === 'and' && priorComma) return true;
  return false;
};

const remainingText = (words: readonly VoiceWord[], from: number): string =>
  words.slice(from).map((word) => word.text).join(' ');

export function chunkCaptionClauses(words: readonly VoiceWord[]): VoiceWord[][] {
  if (words.length === 0) return [];

  const chunks: VoiceWord[][] = [];
  let current: VoiceWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current);
    current = [];
  };

  for (const [index, word] of words.entries()) {
    if (current.length === 0) {
      current.push(word);
      continue;
    }

    const previous = current.at(-1);
    if (!previous) {
      current.push(word);
      continue;
    }

    const leftCount = current.length;
    const rightCount = words.length - index;
    const keptLength = `${current.map((item) => item.text).join(' ')} ${remainingText(words, index)}`.length;
    const hard = endsHard(previous.text);
    const clause = isClauseStarter(words, index) && leftCount >= 4;
    const semi = endsSemiOrColon(previous.text) && leftCount >= 2;
    const comma =
      endsComma(previous.text) &&
      !isListComma(words, index - 1) &&
      leftCount >= 4 &&
      rightCount >= 3;
    const andAfterComma =
      bare(word.text) === 'and' &&
      endsComma(previous.text) &&
      leftCount >= 4 &&
      !isListComma(words, index - 1);
    const longPrep =
      keptLength > CLAUSE_MAX_CHARS &&
      SAFE_PREPS.has(bare(word.text)) &&
      leftCount >= 4 &&
      rightCount >= 3;

    if (hard || clause || semi || comma || andAfterComma || longPrep) flush();
    current.push(word);
  }

  flush();
  return chunks;
}

export function activeCaptionClause(
  chunks: readonly VoiceWord[][],
  timeMs: number,
): VoiceWord[] {
  if (chunks.length === 0) return [];
  const started = [...chunks].reverse().find((chunk) => {
    const first = chunk[0];
    return first !== undefined && timeMs >= first.startMs;
  });
  return started ?? chunks[0] ?? [];
}
