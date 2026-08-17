export type AccumulatedPhraseLayout = {
  fontSize: number;
};

export function layoutAccumulatedPhrase(text: string): AccumulatedPhraseLayout {
  if (!text.trim()) throw new Error('Accumulated phrase cannot be blank');
  if (text.length <= 20) return {fontSize: 72};
  if (text.length <= 40) return {fontSize: 60};
  return {fontSize: 52};
}
