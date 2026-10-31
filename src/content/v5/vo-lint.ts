import {plainSpeech} from '../v4/rules';

// Voiceover lint, run before TTS: spoken text must never carry shot directions,
// source/agency attributions or CTAs. visualIntent is for the camera only.
const DIRECTION = /\b(close[- ]?up|wide shot|shot of|camera|cut to|zoom(?:s|ing)?(?: in| into| out)?|pan(?:s)? (?:to|across)|in frame|b-roll|on[- ]screen|overlay|cross[- ]section view|cutaway)\b/iu;
const STAGE = /^\s*(picture|imagine|we see|show|cut)\b|\b(a|the) (?:gloved )?hand (?:points|holds|reaches|taps)\b/iu;
const AGENCY = /\b(FHWA|FAA|NHTSA|FDA|USDA|EPA|NASA|CDC|OSHA|ASTM|ANSI|ISO|NFPA|DOT|MIT|PBS|Wikipedia|HowStuffWorks)\b|\b[A-Z]{2,}[\w-]* (?:says|describes|states|reports)\b/u;
const ATTRIBUTION = /\baccording to\b|\b(?:researchers|scientists|engineers|experts|studies) (?:say|says|found|describe|describes|state|states)\b/iu;
const CTA = /\b(like and subscribe|subscribe|follow (?:me|us|for)|hit the bell|comment below|in the comments|smash (?:that|the) like)\b/iu;

export function lintVoiceover(beats: readonly {id: string; spokenText: string}[], outro = ''): string[] {
  const issues: string[] = [];
  const lines: [string, string][] = [...beats.map(b => [b.id, b.spokenText] as [string, string]), ['outro', outro]];
  for (const [id, raw] of lines) {
    const text = plainSpeech(raw);
    if (!text) continue;
    if (DIRECTION.test(text) || STAGE.test(text)) issues.push(`${id}: spoken text contains a shot/camera direction`);
    if (AGENCY.test(text) || ATTRIBUTION.test(text)) issues.push(`${id}: spoken text cites an agency/source; keep sources in sourceUrls and the description`);
    if (CTA.test(text)) issues.push(`${id}: CTA in voiceover`);
  }
  return issues;
}
