import {expect, it, vi} from 'vitest';
import {chooseProofSearch, reviewProofCandidate} from '../../../src/content/v4/proof-prompts';
import {pack} from './fixtures';

it('defaults to current search terms', async () => {
  const shot = pack().shots[0];
  expect(await chooseProofSearch(shot, async () => '', () => {})).toEqual(shot.searchQueries);
});
it('accepts manual terms, rejects blanks and preserves phrases', async () => {
  const ask = vi.fn().mockResolvedValueOnce('2').mockResolvedValueOnce(' ; ')
    .mockResolvedValueOnce('pencil in glass; water close up; pencil in glass');
  expect(await chooseProofSearch(pack().shots[0], ask, () => {})).toEqual(['pencil in glass', 'water close up']);
});
it('stops search without querying when the user quits', async () => {
  await expect(chooseProofSearch(pack().shots[0], async () => 'q', () => {})).rejects.toThrow(/stopped/);
});
it('shows the original file and source before asking about its object', async () => {
  const events: string[] = [];
  const accepted = await reviewProofCandidate(pack().shots[0], '/tmp/original.mp4', 'https://pexels.com/video/1', 20,
    async question => {events.push(question); return 'n';}, value => events.push(value));
  expect(accepted).toBe(false);
  expect(events[0]).toContain('/tmp/original.mp4');
  expect(events[1]).toContain('required object/action');
});
