const STRIPPED_MARKS = /[,.:;]+/g;

export function displaySpokenWord(text: string): string {
  return text.replace(STRIPPED_MARKS, '');
}
