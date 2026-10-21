import {describe, expect, it} from 'vitest';
import {lintVoiceover} from '../../../src/content/v5/vo-lint';

const beat = (spokenText: string, id = 'clue') => ({id, spokenText});

describe('lintVoiceover', () => {
  it('passes clean narration and an empty paradox beat', () => {
    expect(lintVoiceover([beat('', 'paradox'), beat('The lid is round so it can never fall through.')], 'Tell me why.')).toEqual([]);
  });
  it.each(['Close-up of the hinge as it swings.', 'Camera pans to the coils.', 'Picture a gloved hand on the glass.',
    'A hand taps the screen and nothing happens.', 'Cut to the plug turning.'])('rejects shot direction: %s', text => {
    expect(lintVoiceover([beat(text)])).toEqual(['clue: spoken text contains a shot/camera direction']);
  });
  it.each(['FHWA describes large steel sign supports.', 'According to engineers, it breaks away.',
    'Researchers found the screen senses charge.'])('rejects agency/source names: %s', text => {
    expect(lintVoiceover([beat(text)])[0]).toMatch(/cites an agency/);
  });
  it('rejects CTAs in beats and in the outro', () => {
    expect(lintVoiceover([beat('Guess in the comments!', 'payoff')], 'Tell me why. Like and subscribe for more.'))
      .toEqual(['payoff: CTA in voiceover', 'outro: CTA in voiceover']);
  });
  it('does not flag ordinary words that merely contain trigger letters', () => {
    expect(lintVoiceover([beat('It says nothing; the panel follows your finger’s charge.')])).toEqual([]);
  });
});
