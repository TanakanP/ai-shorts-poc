import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {selectBestVideo} from '../../src/stock/select-video-file';
import type {PexelsVideo} from '../../src/stock/pexels-client';

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/pexels-search-response.json', import.meta.url), 'utf8'),
) as {videos: PexelsVideo[]};

const copyVideos = (): PexelsVideo[] => structuredClone(fixture.videos);

describe('selectBestVideo', () => {
  it('prefers a 1080x1920-or-larger portrait MP4', () => {
    expect(selectBestVideo(copyVideos(), 6)).toMatchObject({
      videoId: 402,
      downloadUrl: 'https://videos.pexels.com/402-1440.mp4',
      width: 1440,
      height: 2560,
    });
  });

  it('otherwise chooses the highest-resolution portrait MP4', () => {
    const videos = copyVideos().slice(0, 2);
    videos[0].video_files = videos[0].video_files.filter((file) => file.id !== 12);
    videos[1].video_files[0] = {
      ...videos[1].video_files[0],
      width: 700,
      height: 1244,
    };

    expect(selectBestVideo(videos, 6)).toMatchObject({
      videoId: 401,
      downloadUrl: 'https://videos.pexels.com/401-720.mp4',
      width: 720,
      height: 1280,
    });
  });

  it('ignores HLS and m3u8 entries', () => {
    const videos = copyVideos().slice(0, 1);
    videos[0].video_files = [videos[0].video_files[2]];

    expect(selectBestVideo(videos, 6)).toBeNull();
  });

  it('rejects a source video shorter than requiredSeconds', () => {
    expect(selectBestVideo(copyVideos(), 9)).toBeNull();
  });

  it('uses a landscape MP4 only when no portrait MP4 is available', () => {
    const videos = copyVideos().slice(0, 1);
    videos[0].video_files = [
      {...videos[0].video_files[0], width: 1920, height: 1080},
      videos[0].video_files[2],
    ];

    expect(selectBestVideo(videos, 6)).toMatchObject({
      videoId: 401,
      downloadUrl: 'https://videos.pexels.com/401-720.mp4',
    });
  });

  it('returns null when no usable file exists', () => {
    const videos = copyVideos().slice(0, 1);
    videos[0].video_files = [videos[0].video_files[2]];

    expect(selectBestVideo(videos, 6)).toBeNull();
  });

  it('uses video id then file id as stable tie-breakers', () => {
    const videos = copyVideos().slice(0, 2).map((video) => ({
      ...video,
      video_files: [
        {
          ...video.video_files.find((file) => file.file_type === 'video/mp4')!,
          id: video.id === 401 ? 10 : 20,
          width: 1080,
          height: 1920,
        },
      ],
    }));

    expect(selectBestVideo(videos.reverse(), 6)).toMatchObject({videoId: 401});
    videos[0].id = 401;
    videos[0].video_files[0].id = 9;
    expect(selectBestVideo(videos, 6)).toMatchObject({
      videoId: 401,
      downloadUrl: 'https://videos.pexels.com/402-1440.mp4',
    });
  });
});
