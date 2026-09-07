import {join} from 'node:path';
import {ProviderError} from '../domain/provider-error';
import type {StockScene} from '../domain/resolved-video';
import type {VideoPlan} from '../domain/video-plan';
import type {PexelsVideo, SearchOptions} from './pexels-client';
import {scoreStockMatch} from './score-stock-match';
import {selectBestVideo, type SelectedVideo} from './select-video-file';

export type ResolveDeps = {
  searchVideos: (query: string, options: SearchOptions) => Promise<PexelsVideo[]>;
  download: (url: string, destination: string) => Promise<void>;
  // The interactive CLI supplies this; legacy programmatic callers retain automatic selection.
  reviewClip?: (scene: VideoPlan['scenes'][number], clip: SelectedVideo) => Promise<boolean>;
};

type PickedClip = {
  candidate: SelectedVideo;
  selectedSearchQuery: string;
};

const portraitSearch: SearchOptions = {orientation: 'portrait', perPage: 15};
const landscapeSearch: SearchOptions = {orientation: 'landscape', perPage: 15};
const transitionSeconds = 6 / 30;

async function pickClip(
  scene: VideoPlan['scenes'][number],
  requiredSeconds: number,
  usedVideoIds: ReadonlySet<number>,
  deps: ResolveDeps,
): Promise<PickedClip> {
  if (deps.reviewClip) {
    const excluded = new Set(usedVideoIds);
    for (const options of [portraitSearch, landscapeSearch]) {
      for (const query of scene.searchQueries) {
        const videos = (await deps.searchVideos(query, options)) ?? [];
        while (true) {
          const candidate = selectBestVideo(videos, requiredSeconds, excluded, {
            searchQuery: query, sceneText: scene.text,
          });
          if (!candidate) break;
          excluded.add(candidate.videoId);
          if (await deps.reviewClip(scene, candidate)) {
            return {candidate, selectedSearchQuery: query};
          }
        }
      }
    }
    const detail = `No approved footage for scene ${scene.id}: ${scene.visualIntent}. Required: ${(scene.requiredVisualObjects ?? []).join(', ')}. Revise the shot or search queries before retrying.`;
    throw new ProviderError(detail, {provider: 'pexels', kind: 'validation', detail});
  }

  let fallback: PickedClip | undefined;

  for (const query of scene.searchQueries) {
    const match = {searchQuery: query, sceneText: scene.text};
    let candidate = selectBestVideo(
      (await deps.searchVideos(query, portraitSearch)) ?? [],
      requiredSeconds,
      usedVideoIds,
      match,
    );
    const portraitScore = candidate
      ? scoreStockMatch(candidate.sourcePageUrl, query, scene.text)
      : -1;
    if (!candidate || portraitScore === 0) {
      const landscape = selectBestVideo(
        (await deps.searchVideos(query, landscapeSearch)) ?? [],
        requiredSeconds,
        usedVideoIds,
        match,
      );
      if (!candidate) candidate = landscape;
      else if (landscape) {
        const landscapeScore = scoreStockMatch(landscape.sourcePageUrl, query, scene.text);
        if (landscapeScore > portraitScore) candidate = landscape;
      }
    }
    if (!candidate) continue;
    const score = scoreStockMatch(candidate.sourcePageUrl, query, scene.text);
    if (score > 0) return {candidate, selectedSearchQuery: query};
    fallback ??= {candidate, selectedSearchQuery: query};
  }

  if (!fallback) {
    throw new Error(
      `No usable video for scene ${scene.id}: ${scene.visualIntent}: ${scene.searchQueries.join(' | ')}`,
    );
  }
  return fallback;
}

export async function resolveSceneAssets(
  plan: VideoPlan,
  runDir: string,
  deps: ResolveDeps,
): Promise<StockScene[]> {
  const resolved: StockScene[] = [];
  const usedVideoIds = new Set<number>();

  for (const [index, scene] of plan.scenes.entries()) {
    if (scene.id === 'channel-outro') {
      const first = resolved[0];
      if (!first) throw new Error('Channel outro requires a first scene clip');
      resolved.push({
        ...scene,
        selectedSearchQuery: first.selectedSearchQuery,
        sourcePageUrl: first.sourcePageUrl,
        creatorName: first.creatorName,
        creatorUrl: first.creatorUrl,
        localVideoPath: first.localVideoPath,
      });
      continue;
    }

    const requiredSeconds = scene.durationSeconds + (index === 0 ? 0 : transitionSeconds);
    const picked = await pickClip(scene, requiredSeconds, usedVideoIds, deps);

    const localVideoPath = join(runDir, `scene-${String(index + 1).padStart(2, '0')}.mp4`);
    await deps.download(picked.candidate.downloadUrl, localVideoPath);
    usedVideoIds.add(picked.candidate.videoId);
    resolved.push({
      ...scene,
      selectedSearchQuery: picked.selectedSearchQuery,
      sourcePageUrl: picked.candidate.sourcePageUrl,
      creatorName: picked.candidate.creatorName,
      creatorUrl: picked.candidate.creatorUrl,
      localVideoPath,
    });
  }

  return resolved;
}
