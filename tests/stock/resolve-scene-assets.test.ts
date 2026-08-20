import {access, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {VideoPlan, VideoScene} from '../../src/domain/video-plan';
import {DEFAULT_TIMEOUT_MS, downloadFile} from '../../src/stock/download-file';
import {resolveSceneAssets, type ResolveDeps} from '../../src/stock/resolve-scene-assets';
import type {PexelsVideo} from '../../src/stock/pexels-client';

const temporaryDirectories: string[] = [];

async function createRunDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ai-shorts-stock-'));
  temporaryDirectories.push(directory);
  return directory;
}

function scene(id: string, searchQuery = `${id} footage`): VideoScene {
  return {
    id,
    role: id === 'channel-outro' ? 'outro' : 'hook',
    durationSeconds: 6,
    text: `Watch ${id} happen`,
    visualIntent: `Watch ${id} happen on camera`,
    searchQueries: [searchQuery, `${id} backup`],
  };
}

function plan(scenes: VideoScene[]): VideoPlan {
  return {
    topic: 'A test topic',
    title: 'A valid test title',
    viralAngle: 'A test viral angle for stock matching',
    scenes,
  };
}

function video(downloadUrl: string, overrides: Partial<PexelsVideo> = {}): PexelsVideo {
  return {
    id: 101,
    url: 'https://www.pexels.com/video/test-footage-101/',
    duration: 8,
    user: {name: 'Test Creator', url: 'https://www.pexels.com/@test-creator'},
    video_files: [
      {id: 11, file_type: 'video/mp4', width: 1080, height: 1920, link: downloadUrl},
    ],
    ...overrides,
  };
}

function resolverDeps(): {
  searchVideos: ReturnType<typeof vi.fn<ResolveDeps['searchVideos']>>;
  download: ReturnType<typeof vi.fn<ResolveDeps['download']>>;
} {
  return {
    searchVideos: vi.fn<ResolveDeps['searchVideos']>(),
    download: vi.fn<ResolveDeps['download']>().mockResolvedValue(undefined),
  };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})));
});

describe('resolveSceneAssets', () => {
  it('resolves a portrait result and downloads it once', async () => {
    const runDirectory = await createRunDirectory();
    const deps = resolverDeps();
    deps.searchVideos.mockResolvedValueOnce([
      video('https://videos.pexels.com/portrait.mp4', {
        url: 'https://www.pexels.com/video/city-lights-101/',
      }),
    ]);

    await expect(resolveSceneAssets(plan([scene('intro', 'city lights')]), runDirectory, deps)).resolves.toEqual([
      {
        ...scene('intro', 'city lights'),
        selectedSearchQuery: 'city lights',
        sourcePageUrl: 'https://www.pexels.com/video/city-lights-101/',
        creatorName: 'Test Creator',
        creatorUrl: 'https://www.pexels.com/@test-creator',
        localVideoPath: join(runDirectory, 'scene-01.mp4'),
      },
    ]);
    expect(deps.searchVideos).toHaveBeenCalledTimes(1);
    expect(deps.searchVideos).toHaveBeenCalledWith('city lights', {orientation: 'portrait', perPage: 15});
    expect(deps.download).toHaveBeenCalledWith(
      'https://videos.pexels.com/portrait.mp4',
      join(runDirectory, 'scene-01.mp4'),
    );
  });

  it('searches landscape when the best portrait slug match is 0', async () => {
    const runDirectory = await createRunDirectory();
    const deps = resolverDeps();
    deps.searchVideos
      .mockResolvedValueOnce([
        video('https://videos.pexels.com/pepper.mp4', {
          id: 501,
          url: 'https://www.pexels.com/video/a-man-looking-at-a-yellow-bell-pepper-501/',
        }),
      ])
      .mockResolvedValueOnce([
        video('https://videos.pexels.com/milk.mp4', {
          id: 602,
          url: 'https://www.pexels.com/video/supermarket-milk-fridge-602/',
          video_files: [
            {
              id: 62,
              file_type: 'video/mp4',
              width: 1920,
              height: 1080,
              link: 'https://videos.pexels.com/milk.mp4',
            },
          ],
        }),
      ]);

    const resolved = await resolveSceneAssets(
      plan([
        {
          id: 'hook',
          role: 'hook',
          durationSeconds: 6,
          text: 'Why is the milk always at the back?',
          visualIntent: 'Shopper walking toward supermarket dairy refrigerators',
          searchQueries: ['supermarket milk fridge', 'grocery dairy aisle'],
        },
      ]),
      runDirectory,
      deps,
    );

    expect(resolved[0]?.sourcePageUrl).toBe('https://www.pexels.com/video/supermarket-milk-fridge-602/');
    expect(deps.searchVideos).toHaveBeenCalledTimes(2);
    expect(deps.download).toHaveBeenCalledWith(
      'https://videos.pexels.com/milk.mp4',
      join(runDirectory, 'scene-01.mp4'),
    );
  });

  it('retries exactly once with landscape when portrait has no usable result', async () => {
    const runDirectory = await createRunDirectory();
    const deps = resolverDeps();
    deps.searchVideos
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        video('https://videos.pexels.com/landscape.mp4', {
          video_files: [
            {id: 12, file_type: 'video/mp4', width: 1920, height: 1080, link: 'https://videos.pexels.com/landscape.mp4'},
          ],
        }),
      ]);

    await resolveSceneAssets(plan([scene('fallback')]), runDirectory, deps);

    expect(deps.searchVideos).toHaveBeenCalledTimes(2);
    expect(deps.searchVideos).toHaveBeenNthCalledWith(1, 'fallback footage', {orientation: 'portrait', perPage: 15});
    expect(deps.searchVideos).toHaveBeenNthCalledWith(2, 'fallback footage', {orientation: 'landscape', perPage: 15});
    expect(deps.download).toHaveBeenCalledTimes(1);
  });

  it('rejects with the scene id and query when neither search produces a candidate', async () => {
    const deps = resolverDeps();
    deps.searchVideos.mockResolvedValue([]);

    await expect(resolveSceneAssets(plan([scene('missing', 'empty beach')]), await createRunDirectory(), deps))
      .rejects.toThrow(/missing.*empty beach/i);
    expect(deps.download).not.toHaveBeenCalled();
  });

  it('does not reuse a Pexels video already chosen for an earlier scene', async () => {
    const runDirectory = await createRunDirectory();
    const deps = resolverDeps();
    const first = video('https://videos.pexels.com/one.mp4', {id: 101});
    const second = video('https://videos.pexels.com/two.mp4', {
      id: 202,
      url: 'https://www.pexels.com/video/test-202/',
    });
    deps.searchVideos.mockResolvedValue([first, second]);

    const resolved = await resolveSceneAssets(
      plan([scene('one', 'same aisle'), scene('two', 'same aisle')]),
      runDirectory,
      deps,
    );

    expect(resolved.map((item) => item.sourcePageUrl)).toEqual([
      'https://www.pexels.com/video/test-footage-101/',
      'https://www.pexels.com/video/test-202/',
    ]);
    expect(deps.download).toHaveBeenNthCalledWith(
      1,
      'https://videos.pexels.com/one.mp4',
      join(runDirectory, 'scene-01.mp4'),
    );
    expect(deps.download).toHaveBeenNthCalledWith(
      2,
      'https://videos.pexels.com/two.mp4',
      join(runDirectory, 'scene-02.mp4'),
    );
  });

  it('reuses the first clip for the channel outro without another download', async () => {
    const runDirectory = await createRunDirectory();
    const deps = resolverDeps();
    deps.searchVideos.mockResolvedValue([
      video('https://videos.pexels.com/hook.mp4', {
        url: 'https://www.pexels.com/video/milk-supermarket-101/',
      }),
    ]);

    const resolved = await resolveSceneAssets(
      plan([
        scene('hook', 'milk supermarket'),
        {
          id: 'channel-outro',
          role: 'outro',
          durationSeconds: 4,
          text: 'Curious Cart. Follow along.',
          visualIntent: 'Opening supermarket clip looping for the sign-off',
          searchQueries: ['milk supermarket', 'grocery dairy aisle'],
        },
      ]),
      runDirectory,
      deps,
    );

    expect(resolved[1]).toMatchObject({
      id: 'channel-outro',
      localVideoPath: join(runDirectory, 'scene-01.mp4'),
      sourcePageUrl: 'https://www.pexels.com/video/milk-supermarket-101/',
      creatorName: 'Test Creator',
    });
    expect(deps.searchVideos).toHaveBeenCalledTimes(1);
    expect(deps.download).toHaveBeenCalledTimes(1);
  });

  it('uses deterministic filenames for every scene', async () => {
    const runDirectory = await createRunDirectory();
    const deps = resolverDeps();
    deps.searchVideos
      .mockResolvedValueOnce([video('https://videos.pexels.com/one.mp4', {id: 101})])
      .mockResolvedValueOnce([video('https://videos.pexels.com/two.mp4', {id: 202})]);

    const resolved = await resolveSceneAssets(plan([scene('one'), scene('two')]), runDirectory, deps);

    expect(resolved.map((item) => item.localVideoPath)).toEqual([
      join(runDirectory, 'scene-01.mp4'),
      join(runDirectory, 'scene-02.mp4'),
    ]);
  });

  it('stops before resolving later scenes after a scene resolution failure', async () => {
    const runDirectory = await createRunDirectory();
    const deps = resolverDeps();
    deps.searchVideos
      .mockResolvedValueOnce([video('https://videos.pexels.com/first.mp4')])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(resolveSceneAssets(plan([scene('first'), scene('broken'), scene('later')]), runDirectory, deps))
      .rejects.toThrow(/broken/);

    expect(deps.download).toHaveBeenCalledTimes(1);
    expect(deps.searchVideos).toHaveBeenCalledTimes(3);
    expect(deps.searchVideos).not.toHaveBeenCalledWith('later footage', expect.anything());
  });

  it('returns resolved scenes in VideoPlan order', async () => {
    const runDirectory = await createRunDirectory();
    const deps = resolverDeps();
    deps.searchVideos
      .mockResolvedValueOnce([video('https://videos.pexels.com/third.mp4', {id: 301})])
      .mockResolvedValueOnce([video('https://videos.pexels.com/first.mp4', {id: 101})]);

    const resolved = await resolveSceneAssets(plan([scene('third'), scene('first')]), runDirectory, deps);

    expect(resolved.map((item) => item.id)).toEqual(['third', 'first']);
  });

  it('requires nonfirst source clips to cover the six-frame transition overlap', async () => {
    const runDirectory = await createRunDirectory();
    const deps = resolverDeps();
    deps.searchVideos
      .mockResolvedValueOnce([video('https://videos.pexels.com/first.mp4', {id: 101, duration: 6})])
      .mockResolvedValueOnce([
        video('https://videos.pexels.com/too-short.mp4', {id: 202, duration: 6}),
      ])
      .mockResolvedValueOnce([
        video('https://videos.pexels.com/long-enough.mp4', {id: 303, duration: 6.2}),
      ]);

    await resolveSceneAssets(plan([scene('first'), scene('second')]), runDirectory, deps);

    expect(deps.searchVideos).toHaveBeenNthCalledWith(3, 'second footage', {
      orientation: 'landscape',
      perPage: 15,
    });
    expect(deps.download).toHaveBeenLastCalledWith(
      'https://videos.pexels.com/long-enough.mp4',
      join(runDirectory, 'scene-02.mp4'),
    );
  });
});

describe('downloadFile', () => {
  it('rejects non-Pexels media URLs and redirects', async () => {
    const runDirectory = await createRunDirectory();
    const fetch = vi.fn().mockResolvedValue(
      new Response(null, {status: 302, headers: {location: 'https://internal.example/scene.mp4'}}),
    );

    await expect(
      downloadFile('https://example.com/scene.mp4', join(runDirectory, 'initial.mp4'), {fetchImpl: fetch}),
    ).rejects.toThrow(/Pexels media URL/i);
    expect(fetch).not.toHaveBeenCalled();

    await expect(
      downloadFile('https://videos.pexels.com/scene.mp4', join(runDirectory, 'redirect.mp4'), {
        fetchImpl: fetch,
      }),
    ).rejects.toThrow(/Pexels media URL/i);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://videos.pexels.com/scene.mp4',
      expect.objectContaining({redirect: 'manual'}),
    );
  });

  it('aborts downloads after the configured timeout', async () => {
    const runDirectory = await createRunDirectory();
    const fetch = vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
    );

    await expect(
      downloadFile('https://videos.pexels.com/slow.mp4', join(runDirectory, 'slow.mp4'), {
        fetchImpl: fetch as typeof globalThis.fetch,
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({diagnostic: {provider: 'pexels', kind: 'transport', code: 'timeout'}});
  });

  it('gives Pexels downloads two minutes by default', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(120_000);
  });

  it('types download network and malformed redirect failures as provider transport errors', async () => {
    const runDirectory = await createRunDirectory();
    const destination = join(runDirectory, 'network.mp4');
    const networkFetch = vi.fn().mockRejectedValue(new TypeError('secret DNS detail'));
    await expect(
      downloadFile('https://videos.pexels.com/network.mp4', destination, {fetchImpl: networkFetch}),
    ).rejects.toMatchObject({diagnostic: {provider: 'pexels', kind: 'transport'}});

    const redirectFetch = vi.fn().mockResolvedValue(
      new Response(null, {status: 302, headers: {location: 'http://['}}),
    );
    await expect(
      downloadFile('https://videos.pexels.com/redirect.mp4', destination, {fetchImpl: redirectFetch}),
    ).rejects.toMatchObject({diagnostic: {provider: 'pexels', kind: 'transport'}});
  });

  it('removes partial files when the streamed byte ceiling is exceeded', async () => {
    const runDirectory = await createRunDirectory();
    const destination = join(runDirectory, 'large.mp4');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.close();
      },
    });
    const fetch = vi.fn().mockResolvedValue(new Response(stream, {status: 200}));

    await expect(
      downloadFile('https://videos.pexels.com/large.mp4', destination, {fetchImpl: fetch, maxBytes: 5}),
    ).rejects.toThrow(/size limit/i);
    await expect(access(destination)).rejects.toThrow();
    await expect(access(`${destination}.partial`)).rejects.toThrow();
  });

  it('keeps the destination unchanged until a streamed download finishes', async () => {
    const runDirectory = await createRunDirectory();
    const destination = join(runDirectory, 'scene-01.mp4');
    await writeFile(destination, 'previous video');
    let release!: () => void;
    const complete = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode('new video'));
        await complete;
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, {status: 200})));

    const download = downloadFile('https://videos.pexels.com/scene.mp4', destination);
    await vi.waitFor(async () => {
      await expect(readFile(`${destination}.partial`, 'utf8')).resolves.toBe('new video');
    });
    await expect(readFile(destination, 'utf8')).resolves.toBe('previous video');
    release();
    await download;

    await expect(readFile(destination, 'utf8')).resolves.toBe('new video');
    await expect(access(`${destination}.partial`)).rejects.toThrow();
  });

  it('removes partial files after unsuccessful or empty downloads', async () => {
    const runDirectory = await createRunDirectory();
    const failedDestination = join(runDirectory, 'failed.mp4');
    await writeFile(`${failedDestination}.partial`, 'partial');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {status: 500})));

    await expect(downloadFile('https://videos.pexels.com/failed.mp4', failedDestination)).rejects.toThrow(/500/);
    await expect(access(`${failedDestination}.partial`)).rejects.toThrow();

    const emptyDestination = join(runDirectory, 'empty.mp4');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', {status: 200})));
    await expect(downloadFile('https://videos.pexels.com/empty.mp4', emptyDestination)).rejects.toThrow(/zero-byte/i);
    await expect(access(emptyDestination)).rejects.toThrow();
    await expect(access(`${emptyDestination}.partial`)).rejects.toThrow();
  });
});
