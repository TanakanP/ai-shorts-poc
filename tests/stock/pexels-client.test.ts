import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  PexelsApiError,
  PexelsClient,
  PexelsResponseValidationError,
} from '../../src/stock/pexels-client';

const validPayload = {
  videos: [
    {
      id: 401,
      url: 'https://www.pexels.com/video/city-lights-401/',
      duration: 8,
      user: {name: 'Ari Chen', url: 'https://www.pexels.com/@ari-chen'},
      video_files: [
        {
          id: 12,
          file_type: 'video/mp4',
          width: 1080,
          height: 1920,
          link: 'https://videos.pexels.com/401-1080.mp4',
        },
      ],
    },
  ],
};

describe('PexelsClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the exact portrait-search URL and Authorization header', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(validPayload)));
    vi.stubGlobal('fetch', fetch);

    await new PexelsClient('pexels-test-key').searchVideos('city lights');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.pexels.com/v1/videos/search?query=city+lights&orientation=portrait&size=medium&per_page=15&locale=en-US',
      {headers: {Authorization: 'pexels-test-key'}},
    );
  });

  it('parses the response fields used by the application', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(validPayload)));
    vi.stubGlobal('fetch', fetch);

    await expect(
      new PexelsClient('pexels-test-key').searchVideos('city lights', {
        orientation: 'landscape',
        perPage: 3,
      }),
    ).resolves.toEqual(validPayload.videos);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.pexels.com/v1/videos/search?query=city+lights&orientation=landscape&size=medium&per_page=3&locale=en-US',
      {headers: {Authorization: 'pexels-test-key'}},
    );
  });

  it.each([401, 429])('exposes HTTP %i as a typed status error without the API key', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {status})));

    const request = new PexelsClient('secret-pexels-key').searchVideos('city lights');

    await expect(request).rejects.toMatchObject({
      name: 'PexelsApiError',
      status,
    });
    await expect(request).rejects.not.toThrow('secret-pexels-key');
  });

  it('rejects a malformed response payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({videos: [{}]}))));

    await expect(
      new PexelsClient('pexels-test-key').searchVideos('city lights'),
    ).rejects.toBeInstanceOf(PexelsResponseValidationError);
  });
});
