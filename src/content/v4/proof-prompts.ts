import {ContentHold, type SelectedPackage} from './contracts';

type Shot = SelectedPackage['shots'][number];
type Ask = (question: string) => Promise<string>;

export async function chooseProofSearch(shot: Shot, ask: Ask, log: (value: string) => void): Promise<string[]> {
  log(`${shot.beatId}: ${shot.visualIntent}\nSuggested searches: ${shot.searchQueries.join('; ')}`);
  for (;;) {
    const choice = (await ask('Pexels search: [1] suggested keywords [2] my keywords [q] stop (default 1): ')).trim().toLowerCase();
    if (choice === 'q') throw new ContentHold(['Proof search stopped']);
    if (!choice || choice === '1') return shot.searchQueries;
    if (choice !== '2') {log('Choose 1, 2 or q.'); continue;}
    for (;;) {
      const input = (await ask('Enter your keywords (separate alternatives with ;), or q to stop: ')).trim();
      if (input.toLowerCase() === 'q') throw new ContentHold(['Proof search stopped']);
      const queries = [...new Set(input.split(';').map(q => q.trim()).filter(Boolean))];
      if (queries.length) return queries;
      log('Enter at least one search phrase.');
    }
  }
}

export async function reviewProofCandidate(shot: Shot, path: string, source: string, duration: number,
  ask: Ask, log: (value: string) => void): Promise<boolean> {
  log(`Watch the original clip: ${path}\nPexels/source: ${source}\nLength: ${duration.toFixed(1)}s\nRequired: ${shot.visualIntent}`);
  for (;;) {
    const answer = (await ask('Does this video contain the required object/action? [y/n/q] ')).trim().toLowerCase();
    if (answer === 'q') throw new ContentHold(['Proof review stopped']);
    if (['y', 'yes'].includes(answer)) return true;
    if (['n', 'no'].includes(answer)) return false;
    log('Choose y, n or q.');
  }
}
