import {join} from 'node:path';
import type {StockScene} from '../domain/resolved-video';
import type {VideoPlan} from '../domain/video-plan';
import type {PexelsVideo, SearchOptions} from './pexels-client';
import {scoreStockMatch} from './score-stock-match';
import {selectBestVideo} from './select-video-file';

export type ResolveDeps = {
  searchVideos: (query: string, options: SearchOptions) => Promise<PexelsVideo[]>;
  download: (url: string, destination: string) => Promise<void>;
};

const portraitSearch: SearchOptions = {orientation: 'portrait', perPage: 15};
const landscapeSearch: SearchOptions = {orientation: 'landscape', perPage: 15};
const transitionSeconds = 6 / 30;

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

    const query = scene.searchQueries[0] ?? '';
    const requiredSeconds = scene.durationSeconds + (index === 0 ? 0 : transitionSeconds);
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
      if (!candidate) {
        candidate = landscape;
      } else if (landscape) {
        const landscapeScore = scoreStockMatch(
          landscape.sourcePageUrl,
          query,
          scene.text,
        );
        if (landscapeScore > portraitScore) candidate = landscape;
      }
    }
    if (!candidate) throw new Error(`No usable video for scene ${scene.id}: ${query}`);

    const localVideoPath = join(runDir, `scene-${String(index + 1).padStart(2, '0')}.mp4`);
    await deps.download(candidate.downloadUrl, localVideoPath);
    usedVideoIds.add(candidate.videoId);
    resolved.push({
      ...scene,
      selectedSearchQuery: query,
      sourcePageUrl: candidate.sourcePageUrl,
      creatorName: candidate.creatorName,
      creatorUrl: candidate.creatorUrl,
      localVideoPath,
    });
  }

  return resolved;
}
