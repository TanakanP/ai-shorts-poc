import {join} from 'node:path';
import type {StockScene} from '../domain/resolved-video';
import type {VideoPlan} from '../domain/video-plan';
import type {PexelsVideo, SearchOptions} from './pexels-client';
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

  for (const [index, scene] of plan.scenes.entries()) {
    const requiredSeconds = scene.durationSeconds + (index === 0 ? 0 : transitionSeconds);
    let candidate = selectBestVideo(
      await deps.searchVideos(scene.searchQuery, portraitSearch),
      requiredSeconds,
    );
    if (!candidate) {
      candidate = selectBestVideo(
        await deps.searchVideos(scene.searchQuery, landscapeSearch),
        requiredSeconds,
      );
    }
    if (!candidate) throw new Error(`No usable video for scene ${scene.id}: ${scene.searchQuery}`);

    const localVideoPath = join(runDir, `scene-${String(index + 1).padStart(2, '0')}.mp4`);
    await deps.download(candidate.downloadUrl, localVideoPath);
    resolved.push({
      ...scene,
      sourcePageUrl: candidate.sourcePageUrl,
      creatorName: candidate.creatorName,
      creatorUrl: candidate.creatorUrl,
      localVideoPath,
    });
  }

  return resolved;
}
