import {describe, expect, it} from 'vitest';
import {scoreStockMatch} from '../../src/stock/score-stock-match';

describe('scoreStockMatch', () => {
  it('scores 0 when the Pexels slug shares no nouns with the line', () => {
    expect(
      scoreStockMatch(
        'https://www.pexels.com/video/a-man-looking-at-a-yellow-bell-pepper-7126552/',
        'person walking supermarket aisle shopping basket',
        'Milk is often at the back | because stores want your whole trip.',
      ),
    ).toBe(0);
  });

  it('counts query and spoken nouns that appear in the slug', () => {
    expect(
      scoreStockMatch(
        'https://www.pexels.com/video/supermarket-milk-fridge-aisle-101/',
        'supermarket milk fridge',
        'Milk is at the back of the store.',
      ),
    ).toBeGreaterThan(0);
  });

  it('ranks a milk-aisle slug above a pepper slug for a milk line', () => {
    const query = 'supermarket milk fridge';
    const text = 'Why is the milk always at the back?';
    const milk = scoreStockMatch(
      'https://www.pexels.com/video/supermarket-dairy-milk-fridge-202/',
      query,
      text,
    );
    const pepper = scoreStockMatch(
      'https://www.pexels.com/video/a-man-looking-at-a-yellow-bell-pepper-7126552/',
      query,
      text,
    );
    expect(milk).toBeGreaterThan(pepper);
  });
});
