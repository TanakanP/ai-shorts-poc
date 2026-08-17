const STRIPPED_MARKS = /[,.:;?!''\u2018\u2019]+/g;

export function displaySpokenWord(text: string): string {
  return text.replace(STRIPPED_MARKS, '');
}
