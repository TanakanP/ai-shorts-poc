import {readFileSync} from 'node:fs';
import {briefSchema, VOICED_BEATS, type V4Package, type ProofBinding, type V4ContentPlan} from '../../../src/content/v4/contracts';
import {evaluatePackage} from '../../../src/content/v4/rules';
import {videoPlanFromV4} from '../../../src/content/v4/adapter';
import {attachChannelOutro} from '../../../src/pipeline/attach-channel-outro';
import type {SynthesizeSceneVoicesResult} from '../../../src/voice/synthesize-scene-voices';

export const brief = briefSchema.parse(JSON.parse(readFileSync('content/v4/straw-refraction.json', 'utf8')));
export function rawPackage(): V4Package {
  return {contradictionType: 'VISUAL_PARADOX', packagingClaim: 'Straight straw looks bent', firstFrameProof: 'Visible displacement at waterline',
    secondReveal: brief.facts[1].statement, secondRevealFactId: 'consequence',
    rubric: {visibleContradiction: 5, recognizability: 5, familiarity: 5, curiosityGap: 5, secondReveal: 5, payoff: 5, explainable: 5},
    rubricReasons: ['A reviewed refraction demonstration supports the package'],
    hooks: ['This straight straw looks broken in water.', 'Water makes this straight straw look snapped.',
      'This straw stays straight beneath that bend.', 'The straw only seems broken at the surface.',
      'That glass makes a straight straw look crooked.'].map((text, i) => ({
        id: `hook-${i}`, text, displayText: 'Straight. Looks broken.', score: 5 - i / 10, clarity: 5,
        contradictionClear: true, mechanismLeaked: false, reason: 'Visible contradiction', wordCountException: null})),
    shots: VOICED_BEATS.map(beatId => ({beatId, visualIntent: 'A straight straw visibly displaced by water',
      factIds: [beatId === 'second_reveal' || beatId === 'payoff' ? 'consequence' : 'mechanism'],
      searchQueries: ['straw water refraction', 'pencil water glass', 'straight straw waterline']})),
    title: 'Generated title', description: 'Generated description'};
}
export const pack = () => evaluatePackage(rawPackage(), brief);
export function proofs(): ProofBinding[] {
  return pack().shots.map(s => ({id: `proof-${s.beatId}`, beatIds: s.beatId === 'contradiction' ? ['paradox', s.beatId] : [s.beatId],
    factIds: s.factIds, kind: 'local', localPath: `/tmp/${s.beatId}.mp4`, sourcePageUrl: null,
    creatorName: null, creatorUrl: null, licenseNote: 'Owned demonstration', selectedSearchQuery: null, trimStartSec: 2, usableDurationSec: 20,
    cropPosition: '25% 50%', observedAction: 'Actual refraction is visible', approved: true}));
}
export function contentPlan(): V4ContentPlan {
  const p = pack();
  const lines = ['', p.hooks[0].text, 'Look closely at the place where the water meets air.',
    'Light changes direction crossing that boundary, shifting where the underwater section appears.',
    'Lift the same straight straw out, and the apparent break disappears immediately.',
    'The straw stayed straight through the whole demonstration.'];
  const ids = ['paradox', ...VOICED_BEATS] as const;
  const targets = [0, 1, 3, 7, 14, 21, 25];
  return {version: 'v4', topicId: brief.topicId, topic: brief.topic, package: p, facts: brief.facts,
    factBoundaries: brief.factBoundaries, title: p.title, description: p.description,
    editorial: {factsSupported: true, distinctSecondReveal: true, earlyMechanismLeak: false, reasons: ['Distinct visible reversal']},
    beats: ids.map((id, i) => ({id, spokenText: lines[i], displayText: i === 1 ? p.hooks[0].displayText : 'Watch the waterline',
      newInformation: i < 4 ? `Observation ${i}` : `Visible reversal ${i}`,
      factIds: [i >= 4 ? 'consequence' : 'mechanism'], proofIds: [`proof-${id === 'paradox' ? 'contradiction' : id}`],
      targetStartSec: targets[i], targetEndSec: targets[i + 1]}))};
}
export function voiced(durations = [3, 4, 7, 7, 4, 3]): SynthesizeSceneVoicesResult {
  const video = attachChannelOutro(videoPlanFromV4(contentPlan()), 'Tell Me Why', 'Look closer every day.');
  const timedPlan = {...video, scenes: video.scenes.map((s, i) => ({...s, durationSeconds: durations[i]}))};
  return {timedPlan, manifest: {voiceId: 'eve', language: 'en', scenes: timedPlan.scenes.map(s => ({
    sceneId: s.id, localAudioPath: `/tmp/${s.id}.mp3`, voiceId: 'eve', audioDurationSeconds: s.durationSeconds - 0.3,
    durationSeconds: s.durationSeconds, words: [{text: 'Word', startMs: 0, endMs: 100}]}))}};
}
