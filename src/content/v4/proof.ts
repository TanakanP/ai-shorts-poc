import {join, resolve} from 'node:path';
import type {PexelsVideo, SearchOptions} from '../../stock/pexels-client';
import {selectBestVideo} from '../../stock/select-video-file';
import {ContentHold, proofBindingSchema, VOICED_BEATS, type ProofBinding, type SelectedPackage, type TopicBrief} from './contracts';
import {cropFractions, probeMedia, previewProof} from './media';

type Shot = SelectedPackage['shots'][number];
export type ProofReview = {approved: boolean; observedAction: string};
export type ProofDeps = {
  searchVideos: (query: string, options: SearchOptions) => Promise<PexelsVideo[]>;
  download: (url: string, destination: string) => Promise<void>;
  reviewCandidate?: (shot: Shot, path: string, source: string, durationSec: number) => Promise<boolean>;
  chooseSearch?: (shot: Shot) => Promise<string[]>;
  chooseView: (shot: Shot, path: string, durationSec: number, defaults: {start: number; crop: string}) => Promise<{start: number; crop: string}>;
  review: (shot: Shot, previews: {stillPath: string; previewPath: string}, candidate: {source: string; start: number; crop: string}) => Promise<ProofReview>;
  probe?: typeof probeMedia;
  preview?: typeof previewProof;
  previous?: ProofBinding[];
  record?: (bindings: ProofBinding[]) => Promise<void>;
};

export async function resolveV4Proof(pack: SelectedPackage, brief: TopicBrief, runDir: string, deps: ProofDeps): Promise<ProofBinding[]> {
  const approved: ProofBinding[] = [];
  const used = new Set<number>();
  const usedPaths = new Set<string>();
  const probe = deps.probe ?? probeMedia;
  const preview = deps.preview ?? previewProof;
  for (const beatId of VOICED_BEATS) {
    const shot = pack.shots.find(s => s.beatId === beatId)!;
    const saved = deps.previous?.find(p => p.beatIds.includes(beatId));
    if (saved) {
      const parsed = proofBindingSchema.parse(saved);
      const media = await probe(parsed.localPath).catch(() => undefined);
      if (media && media.durationSec + 0.001 >= parsed.trimStartSec + parsed.usableDurationSec && !usedPaths.has(resolve(parsed.localPath))) {
        approved.push(parsed);
        usedPaths.add(resolve(parsed.localPath));
        const stockId = /stock-(\d+)\.mp4$/.exec(parsed.localPath);
        if (stockId) used.add(Number(stockId[1]));
        await deps.record?.(approved);
        continue;
      }
    }
    const local = brief.localProof.find(p => p.beatId === beatId);
    let binding: ProofBinding | undefined;
    const inspect = async (path: string, source: string, defaults: {start: number; crop: string},
      metadata: Pick<ProofBinding, 'kind' | 'sourcePageUrl' | 'creatorName' | 'creatorUrl' | 'licenseNote' | 'selectedSearchQuery'>) => {
      if (usedPaths.has(resolve(path))) throw new ContentHold(['Story clips must be distinct under the current footage policy']);
      const media = await probe(path);
      if (deps.reviewCandidate && !await deps.reviewCandidate(shot, path, source, media.durationSec)) return;
      const view = await deps.chooseView(shot, path, media.durationSec, defaults);
      cropFractions(view.crop);
      // Render at 30fps; review exactly the frame that the renderer will use.
      const start = Math.round(view.start * 30) / 30;
      if (!Number.isFinite(start) || start < 0 || media.durationSec - start < 1.8)
        throw new ContentHold([`Invalid or too-short proof interval for ${beatId}`]);
      const previews = await preview(path, start, view.crop, join(runDir, `proof-${beatId}`), media.durationSec - start);
      const review = await deps.review(shot, previews, {source, start, crop: view.crop});
      if (!review.approved) return;
      binding = proofBindingSchema.parse({id: `proof-${beatId}`, beatIds: beatId === 'contradiction' ? ['paradox', beatId] : [beatId],
        factIds: shot.factIds, localPath: resolve(path), ...metadata, trimStartSec: start,
        usableDurationSec: media.durationSec - start, cropPosition: view.crop, observedAction: review.observedAction, approved: true});
    };
    if (local) {
      await inspect(local.path, local.path, {start: local.trimStartSec, crop: local.cropPosition}, {
        kind: 'local', sourcePageUrl: null, creatorName: null, creatorUrl: null, licenseNote: local.licenseNote, selectedSearchQuery: null});
    } else {
      const rejected = new Set(used);
      const queries = deps.chooseSearch ? await deps.chooseSearch(shot) : shot.searchQueries;
      if (!queries.length || queries.some(q => !q.trim())) throw new ContentHold(['Search terms cannot be empty']);
      search: for (const query of queries) {
        for (const orientation of ['portrait', 'landscape'] as const) {
          const videos = await deps.searchVideos(query, {orientation, perPage: 15});
          // Bounded candidate review; try the next query if none of its five best shots works.
          for (let i = 0; i < 5; i++) {
            const candidate = selectBestVideo(videos, 1.8, rejected, {searchQuery: query, sceneText: shot.visualIntent});
            if (!candidate) break;
            rejected.add(candidate.videoId);
            const path = join(runDir, `stock-${candidate.videoId}.mp4`);
            await deps.download(candidate.downloadUrl, path);
            await inspect(path, candidate.sourcePageUrl, {start: 0, crop: '50% 50%'}, {
              kind: 'stock', sourcePageUrl: candidate.sourcePageUrl, creatorName: candidate.creatorName,
              creatorUrl: candidate.creatorUrl, licenseNote: 'Pexels stock video; retain source attribution and applicable license.', selectedSearchQuery: query});
            if (binding) {used.add(candidate.videoId); break search;}
          }
        }
      }
    }
    if (!binding) throw new ContentHold([`No approved proof for ${beatId}: ${shot.visualIntent}`]);
    approved.push(binding);
    usedPaths.add(resolve(binding.localPath));
    await deps.record?.(approved);
  }
  return approved;
}
