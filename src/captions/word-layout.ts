export type SpokenWordLayout = {
  fontSize: number;
};

export function layoutSpokenWord(text: string): SpokenWordLayout {
  if (!text.trim()) throw new Error('Spoken word cannot be blank');
  if (text.length <= 10) return {fontSize: 120};
  if (text.length <= 16) return {fontSize: 96};
  return {fontSize: 72};
}
