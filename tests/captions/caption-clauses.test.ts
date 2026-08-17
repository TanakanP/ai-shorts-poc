import {describe, expect, it} from 'vitest';
import {activeCaptionClause, chunkCaptionClauses} from '../../src/captions/caption-clauses';
import type {VoiceWord} from '../../src/domain/voice';

const timed = (texts: string[]): VoiceWord[] =>
  texts.map((text, index) => ({
    text,
    startMs: index * 200,
    endMs: index * 200 + 150,
  }));

const textsOf = (chunks: VoiceWord[][]): string[][] =>
  chunks.map((chunk) => chunk.map((word) => word.text));

describe('chunkCaptionClauses', () => {
  it('returns no clauses for no words', () => {
    expect(chunkCaptionClauses([])).toEqual([]);
  });

  it('keeps a short single thought as one clause', () => {
    expect(textsOf(chunkCaptionClauses(timed(['Keep', 'milk', 'cold.'])))).toEqual([
      ['Keep', 'milk', 'cold.'],
    ]);
  });

  it('hard-stops after . ? or !', () => {
    expect(textsOf(chunkCaptionClauses(timed(['Wait.', 'Did', 'you', 'see', 'that?'])))).toEqual([
      ['Wait.'],
      ['Did', 'you', 'see', 'that?'],
    ]);
  });

  it('splits the screenshot sentence on because and keeps the reason intact', () => {
    expect(
      textsOf(
        chunkCaptionClauses(
          timed([
            'Milk',
            'is',
            'at',
            'the',
            'back',
            'of',
            'the',
            'store',
            'because',
            'your',
            'walk',
            'is',
            'valuable.',
          ]),
        ),
      ),
    ).toEqual([
      ['Milk', 'is', 'at', 'the', 'back', 'of', 'the', 'store'],
      ['because', 'your', 'walk', 'is', 'valuable.'],
    ]);
  });

  it('splits so as a result clause, not as the first word of a scene', () => {
    expect(
      textsOf(
        chunkCaptionClauses(
          timed([
            'Most',
            'shoppers',
            'buy',
            'milk',
            'often,',
            'so',
            'it',
            'becomes',
            'a',
            'reliable',
            'destination.',
          ]),
        ),
      ),
    ).toEqual([
      ['Most', 'shoppers', 'buy', 'milk', 'often,'],
      ['so', 'it', 'becomes', 'a', 'reliable', 'destination.'],
    ]);
  });

  it('does not split a grocery list on its commas or and', () => {
    expect(
      textsOf(
        chunkCaptionClauses(
          timed([
            'To',
            'reach',
            'it,',
            'you',
            'pass',
            'bread,',
            'snacks,',
            'fruit,',
            'and',
            'weekly',
            'deals.',
          ]),
        ),
      ),
    ).toEqual([
      ['To', 'reach', 'it,', 'you', 'pass', 'bread,', 'snacks,', 'fruit,', 'and', 'weekly', 'deals.'],
    ]);
  });

  it('does not split a noun-pair and', () => {
    expect(
      textsOf(
        chunkCaptionClauses(
          timed([
            'The',
            'back',
            'wall',
            'also',
            'suits',
            'big',
            'cold',
            'rooms',
            'and',
            'frequent',
            'deliveries.',
          ]),
        ),
      ),
    ).toEqual([
      ['The', 'back', 'wall', 'also', 'suits', 'big', 'cold', 'rooms', 'and', 'frequent', 'deliveries.'],
    ]);
  });

  it('splits a semicolon into two balanced thoughts', () => {
    expect(
      textsOf(
        chunkCaptionClauses(
          timed([
            'So',
            'milk',
            'is',
            'not',
            'hidden;',
            'it',
            'is',
            'placed',
            'where',
            'habit',
            'meets',
            'opportunity.',
          ]),
        ),
      ),
    ).toEqual([
      ['So', 'milk', 'is', 'not', 'hidden;'],
      ['it', 'is', 'placed', 'where', 'habit', 'meets', 'opportunity.'],
    ]);
  });

  it('splits a long clause at a safe preposition instead of of/the', () => {
    expect(
      textsOf(
        chunkCaptionClauses(
          timed([
            'That',
            'path',
            'creates',
            'chances',
            'for',
            'extra',
            'items',
            'to',
            'catch',
            'your',
            'eye.',
          ]),
        ),
      ),
    ).toEqual([
      ['That', 'path', 'creates', 'chances'],
      ['for', 'extra', 'items', 'to', 'catch', 'your', 'eye.'],
    ]);
  });

  it('splits a clause and after a comma when it is not a list', () => {
    expect(
      textsOf(
        chunkCaptionClauses(
          timed(['You', 'walk', 'the', 'aisle,', 'and', 'extras', 'catch', 'your', 'eye.']),
        ),
      ),
    ).toEqual([
      ['You', 'walk', 'the', 'aisle,'],
      ['and', 'extras', 'catch', 'your', 'eye.'],
    ]);
  });

  it('does not start a clause with a leftover of', () => {
    expect(
      textsOf(chunkCaptionClauses(timed(['Milk', 'is', 'at', 'the', 'back', 'of', 'the', 'store']))),
    ).toEqual([['Milk', 'is', 'at', 'the', 'back', 'of', 'the', 'store']]);
  });
});

describe('activeCaptionClause', () => {
  const chunks = chunkCaptionClauses(
    timed([
      'Milk',
      'is',
      'at',
      'the',
      'back',
      'of',
      'the',
      'store',
      'because',
      'your',
      'walk',
      'is',
      'valuable.',
    ]),
  );

  it('shows the first full clause before any word starts', () => {
    expect(activeCaptionClause(chunks, -1).map((word) => word.text)).toEqual([
      'Milk',
      'is',
      'at',
      'the',
      'back',
      'of',
      'the',
      'store',
    ]);
  });

  it('keeps the whole first clause while it is being spoken', () => {
    expect(activeCaptionClause(chunks, 600).map((word) => word.text)).toEqual([
      'Milk',
      'is',
      'at',
      'the',
      'back',
      'of',
      'the',
      'store',
    ]);
  });

  it('replaces with the next clause when that clause starts', () => {
    expect(activeCaptionClause(chunks, 1600).map((word) => word.text)).toEqual([
      'because',
      'your',
      'walk',
      'is',
      'valuable.',
    ]);
  });

  it('returns no words for no clauses', () => {
    expect(activeCaptionClause([], 0)).toEqual([]);
  });
});
