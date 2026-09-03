import {describe, expect, it} from 'vitest';
import {liveCaptionLines} from '../../src/captions/caption-segments';
import type {ResolvedScene, ResolvedVideo} from '../../src/domain/resolved-video';
import {
  CHANNEL_OUTRO_DURATION_SECONDS,
  maxStoryDurationSeconds,
  narrationSource,
  parseStoryBeats,
  type StoryBeat,
  type VideoPlan,
} from '../../src/domain/video-plan';
import {attachChannelOutro} from '../../src/pipeline/attach-channel-outro';
import * as composition from '../../src/remotion/ShortComposition';
import {createSceneTimeline, createVoiceTimeline} from '../../src/remotion/ShortComposition';
import {
  DISPLAY_CARD_JUSTIFY,
  DISPLAY_CARD_PADDING,
  displayFontSizeForRole,
  isDisplayEmphasis,
  primaryDisplayText,
  shouldRenderDisplayCard,
} from '../../src/remotion/Scene';
import {WORD_CAPTION_JUSTIFY, WORD_CAPTION_PADDING} from '../../src/remotion/WordCaption';

const hookSpoken = 'A runway can change its number without moving.';
const hookDisplay = 'SAME RUNWAY. NEW NUMBER.';

const resolvedScene = (scene: Partial<ResolvedScene> & Pick<ResolvedScene, 'id' | 'role'>): ResolvedScene => ({
  durationSeconds: 5,
  text: scene.spokenText ?? scene.text ?? 'Scene narration.',
  visualIntent: 'A concrete visible shot of the subject',
  searchQueries: ['scene query one', 'scene query two'],
  selectedSearchQuery: 'scene query one',
  sourcePageUrl: 'https://example.com/video',
  creatorName: 'Creator',
  creatorUrl: 'https://example.com/creator',
  localVideoPath: `/tmp/${scene.id}.mp4`,
  localAudioPath: `/tmp/${scene.id}.mp3`,
  audioDurationSeconds: 4.7,
  words: [
    {text: 'Spoken', startMs: 0, endMs: 400},
    {text: 'words', startMs: 400, endMs: 800},
  ],
  ...scene,
});

const v3Video: ResolvedVideo = {
  runId: 'v3-mapping',
  title: 'Runways Can Change Numbers',
  fps: 30,
  width: 1080,
  height: 1920,
  scenes: [
    resolvedScene({
      id: 'hook',
      role: 'hook',
      durationSeconds: 3,
      spokenText: hookSpoken,
      text: hookSpoken,
      displayText: hookDisplay,
      emphasisWords: ['NUMBER'],
    }),
    resolvedScene({
      id: 'context',
      role: 'context',
      durationSeconds: 5,
      spokenText: 'That number is a magnetic heading, not a permanent name.',
      text: 'That number is a magnetic heading, not a permanent name.',
      displayText: 'HEADING, NOT A NAME',
      emphasisWords: ['HEADING'],
    }),
    resolvedScene({
      id: 'curiosity-reset',
      role: 'curiosity-reset',
      durationSeconds: 5,
      spokenText: 'Magnetic north itself keeps drifting, so the heading can go stale.',
      text: 'Magnetic north itself keeps drifting, so the heading can go stale.',
      displayText: 'NORTH KEEPS DRIFTING',
      emphasisWords: ['DRIFTING'],
    }),
    resolvedScene({
      id: 'mechanism',
      role: 'mechanism',
      durationSeconds: 6,
      spokenText: 'Airports then repaint the digits after a heading shift of about ten degrees.',
      text: 'Airports then repaint the digits after a heading shift of about ten degrees.',
      displayText: 'REPAINT AFTER TEN DEGREES',
      emphasisWords: ['REPAINT'],
    }),
    resolvedScene({
      id: 'payoff',
      role: 'payoff',
      durationSeconds: 5,
      spokenText: 'The concrete never moved. The planet magnetic field did.',
      text: 'The concrete never moved. The planet magnetic field did.',
      displayText: 'THE FIELD MOVED',
      emphasisWords: ['FIELD'],
    }),
    resolvedScene({
      id: 'channel-outro',
      role: 'outro',
      durationSeconds: 4,
      text: 'Tell Me Whyyyyyy. | Follow along.',
    }),
  ],
};

const hookScene = v3Video.scenes[0]!;
const resetScene = v3Video.scenes[2]!;
const payoffScene = v3Video.scenes[4]!;
const outroScene = v3Video.scenes[5]!;

const plan: VideoPlan = {
  topic: 'Why runway numbers change',
  title: 'Runways Can Change Numbers',
  viralAngle: 'The number is a heading that can go stale when magnetic north drifts.',
  scenes: v3Video.scenes.slice(0, 5).map(({id, role, durationSeconds, text, visualIntent, searchQueries}) => ({
    id,
    role,
    durationSeconds,
    text,
    visualIntent,
    searchQueries,
  })),
};

const storyBeat = (beat: StoryBeat): StoryBeat => beat;

const validBeats = (): StoryBeat[] => [
  storyBeat({
    id: 'hook',
    role: 'hook',
    durationSeconds: 3,
    spokenText: hookSpoken,
    displayText: hookDisplay,
    emphasisWords: ['NUMBER'],
    beatPurpose: 'Create an impossible-sounding contradiction.',
    newInformation: 'Runway numbers can change while the runway stays fixed.',
    curiosityTarget: 'How can a fixed runway need a different number?',
    visualIntent: 'Airport runway threshold with large runway numbers visible',
    requiredVisualObjects: ['runway number marking'],
    searchQueries: ['airport runway number', 'runway threshold marking'],
  }),
  storyBeat({
    id: 'context',
    role: 'context',
    durationSeconds: 5,
    spokenText: 'That number is a magnetic heading, not a permanent name.',
    displayText: 'HEADING, NOT A NAME',
    emphasisWords: ['HEADING'],
    beatPurpose: 'Orient the viewer to what runway numbers actually mean.',
    newInformation: 'Runway numbers come from magnetic heading rather than a fixed label.',
    visualIntent: 'Compass heading overlay on an airport runway',
    requiredVisualObjects: ['runway heading sign'],
    searchQueries: ['airport runway heading sign', 'runway compass marking'],
  }),
  storyBeat({
    id: 'curiosity-reset',
    role: 'curiosity-reset',
    durationSeconds: 5,
    spokenText: 'Magnetic north itself keeps drifting, so the heading can go stale.',
    displayText: 'NORTH KEEPS DRIFTING',
    emphasisWords: ['DRIFTING'],
    beatPurpose: 'Open a second gap by showing the heading can become wrong.',
    newInformation: 'Magnetic north drift can make a correct runway number outdated.',
    curiosityTarget: 'What happens when the painted heading no longer matches magnetic north?',
    visualIntent: 'Airport workers painting a new runway number on asphalt',
    requiredVisualObjects: ['runway painting crew'],
    searchQueries: ['runway number painting', 'airport runway repaint'],
  }),
  storyBeat({
    id: 'mechanism',
    role: 'mechanism',
    durationSeconds: 6,
    spokenText: 'Airports then repaint the digits after a heading shift of about ten degrees.',
    displayText: 'REPAINT AFTER TEN DEGREES',
    emphasisWords: ['REPAINT'],
    beatPurpose: 'Explain the threshold that forces a new runway number.',
    newInformation: 'A roughly ten-degree magnetic shift triggers a runway number change.',
    visualIntent: 'Close-up of freshly painted runway digits on asphalt',
    requiredVisualObjects: ['fresh runway digits'],
    searchQueries: ['fresh runway numbers', 'painted runway threshold'],
  }),
  storyBeat({
    id: 'payoff',
    role: 'payoff',
    durationSeconds: 5,
    spokenText: 'The concrete never moved. The planet magnetic field did.',
    displayText: 'THE FIELD MOVED',
    emphasisWords: ['FIELD'],
    beatPurpose: 'Reframe the contradiction as a planetary change, not a construction trick.',
    newInformation: 'The runway stays put while Earth magnetic field shifts the heading.',
    visualIntent: 'Long still shot of an unchanged runway under open sky',
    requiredVisualObjects: ['unchanged runway'],
    searchQueries: ['empty airport runway', 'runway vanishing point'],
  }),
];

describe('V3 spoken and display mapping', () => {
  it('uses spokenText as narration/TTS source', () => {
    expect(narrationSource(hookScene)).toBe(hookSpoken);
    expect(narrationSource({text: 'legacy caption bars', spokenText: hookSpoken})).toBe(hookSpoken);
    expect(narrationSource({text: 'legacy caption bars'})).toBe('legacy caption bars');
    expect(narrationSource(hookScene)).not.toBe(hookDisplay);
  });

  it('uses displayText as the large primary visual copy', () => {
    expect(primaryDisplayText(hookScene)).toBe(hookDisplay);
    expect(shouldRenderDisplayCard(hookScene)).toBe(true);
    expect(DISPLAY_CARD_JUSTIFY).not.toBe(WORD_CAPTION_JUSTIFY);
    expect(DISPLAY_CARD_PADDING).not.toBe(WORD_CAPTION_PADDING);
  });

  it('does not render full spokenText as the primary text card when displayText is shorter', () => {
    expect(hookDisplay.length).toBeLessThan(hookSpoken.length);
    expect(primaryDisplayText(hookScene)).toBe(hookDisplay);
    expect(primaryDisplayText(hookScene)).not.toBe(hookSpoken);
    expect(primaryDisplayText(hookScene)).not.toBe(hookScene.text);
    expect(shouldRenderDisplayCard({role: 'hook'})).toBe(false);

    const karaoke = liveCaptionLines(hookScene, 0)
      .flat()
      .map((word) => word.text)
      .join(' ');
    expect(karaoke).not.toBe(hookDisplay);
    expect(hookScene.words.map((word) => word.text).join(' ')).not.toBe(hookDisplay);
  });

  it('preserves emphasisWords against displayText', () => {
    const displayWords = primaryDisplayText(hookScene).split(/\s+/);
    expect(hookScene.emphasisWords).toEqual(['NUMBER']);
    expect(displayWords.some((word) => isDisplayEmphasis(word, hookScene.emphasisWords ?? []))).toBe(true);
    expect(isDisplayEmphasis('NUMBER.', ['NUMBER'])).toBe(true);
    expect(isDisplayEmphasis('RUNWAY.', ['NUMBER'])).toBe(false);
    expect(primaryDisplayText(hookScene)).toContain('NUMBER');
    expect(hookSpoken.includes('NUMBER')).toBe(false);
  });

  it('renders hook with the strongest existing text hierarchy', () => {
    const hookSize = displayFontSizeForRole('hook');
    for (const role of ['context', 'curiosity-reset', 'mechanism', 'payoff', 'outro'] as const) {
      expect(hookSize).toBeGreaterThan(displayFontSizeForRole(role));
    }
  });

  it('renders curiosity-reset as a normal story beat, not an outro', () => {
    expect(resetScene.role).toBe('curiosity-reset');
    expect(resetScene.role).not.toBe('outro');
    expect(displayFontSizeForRole('curiosity-reset')).toBe(displayFontSizeForRole('context'));
    expect(displayFontSizeForRole('curiosity-reset')).toBe(displayFontSizeForRole('payoff'));
    expect(displayFontSizeForRole('curiosity-reset')).not.toBe(displayFontSizeForRole('outro'));
    expect(shouldRenderDisplayCard(resetScene)).toBe(true);
    expect(shouldRenderDisplayCard(outroScene)).toBe(false);
    expect(primaryDisplayText(outroScene)).toBe('');
  });

  it('keeps the channel outro separate after the payoff', () => {
    const timeline = createSceneTimeline(v3Video);
    const voices = createVoiceTimeline(v3Video);
    expect(timeline.map((item) => item.scene.role).slice(-2)).toEqual(['payoff', 'outro']);
    expect(voices.map((item) => item.scene.role).slice(-2)).toEqual(['payoff', 'outro']);
    expect(timeline.at(-1)?.scene.id).toBe('channel-outro');
    expect(timeline.at(-2)?.scene.id).toBe(payoffScene.id);
    expect(timeline.filter((item) => item.scene.role === 'outro')).toHaveLength(1);
  });

  it('does not add a logo intro before the hook', () => {
    const timeline = createSceneTimeline(v3Video);
    expect(timeline[0]?.from).toBe(0);
    expect(timeline[0]?.scene.role).toBe('hook');
    expect(timeline.map((item) => item.scene.role)).not.toContain('intro');
    expect(timeline.some((item) => /logo|intro/i.test(item.scene.id))).toBe(false);
    expect(composition).not.toHaveProperty('LogoIntro');
  });
});

describe('V3 duration with channel outro', () => {
  it('uses the current 4 second channel outro duration', () => {
    expect(CHANNEL_OUTRO_DURATION_SECONDS).toBe(4);
    const withOutro = attachChannelOutro(plan, 'Tell Me Whyyyyyy', 'Follow along.');
    expect(withOutro.scenes.at(-1)).toMatchObject({
      id: 'channel-outro',
      role: 'outro',
      durationSeconds: CHANNEL_OUTRO_DURATION_SECONDS,
    });
    expect(outroScene.durationSeconds).toBe(CHANNEL_OUTRO_DURATION_SECONDS);
  });

  it('caps story duration so story + outro is at most 30 seconds', () => {
    const maxStory = maxStoryDurationSeconds(CHANNEL_OUTRO_DURATION_SECONDS);
    expect(maxStory).toBe(Math.min(28, 30 - CHANNEL_OUTRO_DURATION_SECONDS));
    expect(maxStory).toBe(26);
    expect(maxStory + CHANNEL_OUTRO_DURATION_SECONDS).toBeLessThanOrEqual(30);

    const accepted = validBeats();
    const acceptedDurations = [4, 5, 5, 6, 6];
    for (const [index, duration] of acceptedDurations.entries()) {
      accepted[index]!.durationSeconds = duration;
    }
    expect(parseStoryBeats(accepted).reduce((total, beat) => total + beat.durationSeconds, 0)).toBe(26);

    const tooLong = validBeats();
    const tooLongDurations = [4, 6, 6, 6, 6];
    for (const [index, duration] of tooLongDurations.entries()) {
      tooLong[index]!.durationSeconds = duration;
    }
    expect(tooLong.reduce((total, beat) => total + beat.durationSeconds, 0)).toBe(28);
    expect(() => parseStoryBeats(tooLong)).toThrow();
  });
});
