import type {PexelsVideo, PexelsVideoFile} from './pexels-client';

export type SelectedVideo = {
  videoId: number;
  sourcePageUrl: string;
  creatorName: string;
  creatorUrl: string;
  duration: number;
  downloadUrl: string;
  width: number;
  height: number;
};

type Candidate = {
  video: PexelsVideo;
  file: PexelsVideoFile;
};

function isMp4(file: PexelsVideoFile): boolean {
  return file.file_type.toLowerCase() === 'video/mp4' && !file.link.toLowerCase().includes('.m3u8');
}

function compareCandidates(left: Candidate, right: Candidate): number {
  const leftPortrait = left.file.height > left.file.width;
  const rightPortrait = right.file.height > right.file.width;
  if (leftPortrait !== rightPortrait) return Number(rightPortrait) - Number(leftPortrait);

  const leftPreferred = left.file.width >= 1080 && left.file.height >= 1920;
  const rightPreferred = right.file.width >= 1080 && right.file.height >= 1920;
  if (leftPreferred !== rightPreferred) return Number(rightPreferred) - Number(leftPreferred);

  const leftArea = left.file.width * left.file.height;
  const rightArea = right.file.width * right.file.height;
  if (leftArea !== rightArea) return rightArea - leftArea;

  if (left.video.id !== right.video.id) return left.video.id - right.video.id;
  return left.file.id - right.file.id;
}

export function selectBestVideo(
  videos: PexelsVideo[],
  requiredSeconds: number,
): SelectedVideo | null {
  const candidates = videos
    .filter((video) => video.duration >= requiredSeconds)
    .flatMap((video) =>
      video.video_files.filter(isMp4).map((file) => ({video, file})),
    )
    .sort(compareCandidates);
  const candidate = candidates[0];
  if (!candidate) return null;

  return {
    videoId: candidate.video.id,
    sourcePageUrl: candidate.video.url,
    creatorName: candidate.video.user.name,
    creatorUrl: candidate.video.user.url,
    duration: candidate.video.duration,
    downloadUrl: candidate.file.link,
    width: candidate.file.width,
    height: candidate.file.height,
  };
}
