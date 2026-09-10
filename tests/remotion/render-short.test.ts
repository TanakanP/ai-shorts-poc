import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {request} from 'node:http';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {VideoConfig} from 'remotion/no-react';
import {describe, expect, it, vi} from 'vitest';
import type {ResolvedVideo} from '../../src/domain/resolved-video';
import {
  renderShort,
  startAssetServer,
  type RenderDeps,
} from '../../src/remotion/render-short';
import {getVideoSource} from '../../src/remotion/Scene';

const video: ResolvedVideo = {
  runId: 'render-test',
  title: 'Renderer contract',
  fps: 30,
  width: 1080,
  height: 1920,
  scenes: [
    {
      id: 'scene-1',
      role: 'hook',
      durationSeconds: 5,
      text: 'A short test scene',
      visualIntent: 'A short test supermarket scene',
      searchQueries: ['test scene', 'local test clip'],
      selectedSearchQuery: 'test scene',
      sourcePageUrl: 'https://example.com/video',
      creatorName: 'Test Creator',
      creatorUrl: 'https://example.com/creator',
      localVideoPath: '/tmp/test-video.mp4',
      localAudioPath: '/tmp/test-voice.mp3',
      audioDurationSeconds: 5,
      words: [{text: 'Hello', startMs: 0, endMs: 400}],
    },
  ],
};

const composition: VideoConfig = {
  id: 'SilentShort',
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 150,
  defaultProps: {},
  props: {video},
  defaultCodec: null,
  defaultOutName: null,
  defaultVideoImageFormat: null,
  defaultPixelFormat: null,
  defaultProResProfile: null,
  defaultSampleRate: null,
};

const localClassifierPaths = [
  'runs/20260813-180438-638e819a/scene-01.mp4',
  'clips:scene-01.mp4',
  'http:scene.mp4',
  'http:/local.mp4',
  'http://',
  'https://',
  'http:///local.mp4',
  'http:////local.mp4',
  'http:\\local.mp4',
  'http:\\\\local.mp4',
  'http://\\local.mp4',
  'http://example.com\\local.mp4',
  'http://?query',
  'https://#hash',
] as const;

const remoteClassifierUrls = [
  'http://example.com/video.mp4',
  'HTTPS://EXAMPLE.COM/video.mp4',
  'https://user:pass@example.com/video.mp4',
  'http://example.com:8080/video.mp4',
  'https://example.com/video.mp4?q=1#part',
  'http://[::1]:8080/video.mp4',
  'https://例え.テスト/video.mp4',
] as const;

describe('renderShort', () => {
  it('bundles and renders the SilentShort composition as H.264 with the supplied video', async () => {
    const bundle = vi.fn(async () => 'http://localhost:3000');
    let selectedVideo: ResolvedVideo | undefined;
    let renderedVideo: ResolvedVideo | undefined;
    const selectComposition = vi.fn(
      async (options: Parameters<RenderDeps['selectComposition']>[0]) => {
        selectedVideo = options.inputProps.video;
        return composition;
      },
    );
    const renderMedia = vi.fn(async (options: Parameters<RenderDeps['renderMedia']>[0]) => {
      renderedVideo = options.inputProps.video;
    });
    const close = vi.fn(async () => undefined);
    const startAssetServer = vi.fn(async () => ({
      origin: 'http://127.0.0.1:43210',
      close,
    }));
    const extractThumbnail = vi.fn(async () => undefined);
    const deps: RenderDeps = {bundle, selectComposition, renderMedia, startAssetServer, extractThumbnail};

    await renderShort(video, '/tmp/output.mp4', deps);

    expect(bundle).toHaveBeenCalledTimes(1);
    expect(bundle).toHaveBeenCalledWith({
      entryPoint: fileURLToPath(new URL('../../src/remotion/index.ts', import.meta.url)),
    });
    expect(startAssetServer).toHaveBeenCalledWith(['/tmp/test-video.mp4', '/tmp/test-voice.mp3']);
    expect(selectComposition).toHaveBeenCalledWith({
      serveUrl: 'http://localhost:3000',
      id: 'SilentShort',
      inputProps: {
        video,
        assetBaseUrl: 'http://127.0.0.1:43210',
        localAssetPaths: {
          '/tmp/test-video.mp4': '/tmp/test-video.mp4',
          '/tmp/test-voice.mp3': '/tmp/test-voice.mp3',
        },
      },
    });
    expect(renderMedia).toHaveBeenCalledWith({
      serveUrl: 'http://localhost:3000',
      composition,
      codec: 'h264',
      outputLocation: '/tmp/output.mp4',
      inputProps: {
        video,
        assetBaseUrl: 'http://127.0.0.1:43210',
        localAssetPaths: {
          '/tmp/test-video.mp4': '/tmp/test-video.mp4',
          '/tmp/test-voice.mp3': '/tmp/test-voice.mp3',
        },
      },
    });
    expect(extractThumbnail).toHaveBeenCalledWith('/tmp/output.mp4', '/tmp/thumbnail.jpg');
    expect(selectedVideo).toBe(video);
    expect(renderedVideo).toBe(video);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('allowlists the background music bed with the scene assets', async () => {
    const startAssetServer = vi.fn(async (allowed: string[]) => {
      expect(allowed).toContain('/tmp/bed.mp3');
      return {origin: 'http://127.0.0.1:43210', close: vi.fn(async () => undefined)};
    });
    const deps: RenderDeps = {
      extractThumbnail: vi.fn(async () => undefined),
      bundle: vi.fn(async () => 'http://localhost:3000'),
      selectComposition: vi.fn(async () => composition),
      renderMedia: vi.fn(async () => undefined),
      startAssetServer,
    };

    await renderShort({...video, backgroundMusicPath: '/tmp/bed.mp3'}, '/tmp/output.mp4', deps);

    expect(startAssetServer).toHaveBeenCalled();
  });

  it('allowlists relative local paths as absolute without changing the supplied video', async () => {
    const packageRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
    expect(process.cwd()).toBe(packageRoot);
    const expectedLocalAssetPaths = Object.fromEntries(
      localClassifierPaths.flatMap((path) => [
        [path, resolve(packageRoot, path)],
        [video.scenes[0].localAudioPath, resolve(packageRoot, video.scenes[0].localAudioPath)],
      ]),
    );
    const relativeVideo: ResolvedVideo = {
      ...video,
      scenes: localClassifierPaths.map((localVideoPath, index) => ({
        ...video.scenes[0],
        id: `scene-classifier-${index}`,
        localVideoPath,
      })),
    };
    let selectedVideo: ResolvedVideo | undefined;
    let renderedVideo: ResolvedVideo | undefined;
    const startAssetServer = vi.fn(async () => ({
      origin: 'http://127.0.0.1:43210',
      close: vi.fn(async () => undefined),
    }));
    const deps: RenderDeps = {
      extractThumbnail: vi.fn(async () => undefined),
      bundle: vi.fn(async () => 'http://localhost:3000'),
      selectComposition: vi.fn(async (options) => {
        selectedVideo = options.inputProps.video;
        return composition;
      }),
      renderMedia: vi.fn(async (options) => {
        renderedVideo = options.inputProps.video;
      }),
      startAssetServer,
    };

    await renderShort(relativeVideo, '/tmp/output.mp4', deps);

    expect(startAssetServer).toHaveBeenCalledWith(Object.values(expectedLocalAssetPaths));
    expect(deps.selectComposition).toHaveBeenCalledWith(
      expect.objectContaining({
        inputProps: {
          video: relativeVideo,
          assetBaseUrl: 'http://127.0.0.1:43210',
          localAssetPaths: expectedLocalAssetPaths,
        },
      }),
    );
    expect(selectedVideo).toBe(relativeVideo);
    expect(renderedVideo).toBe(relativeVideo);
    expect(relativeVideo.scenes.map((scene) => scene.localVideoPath)).toEqual([
      ...localClassifierPaths,
    ]);
  });

  it.each(remoteClassifierUrls)('rejects remote scene asset %s before starting the asset server', async (localVideoPath) => {
    const startAssetServer = vi.fn();
    const remoteVideo: ResolvedVideo = {
      ...video,
      scenes: [{...video.scenes[0], localVideoPath}],
    };

    await expect(
      renderShort(remoteVideo, '/tmp/output.mp4', {
        extractThumbnail: vi.fn(async () => undefined),
      bundle: vi.fn(),
        selectComposition: vi.fn(),
        renderMedia: vi.fn(),
        startAssetServer,
      }),
    ).rejects.toThrow(/local files/i);
    expect(startAssetServer).not.toHaveBeenCalled();
  });

  it('rejects remote scene audio before starting the asset server', async () => {
    const startAssetServer = vi.fn();
    const remoteAudio: ResolvedVideo = {
      ...video,
      scenes: [{...video.scenes[0], localAudioPath: 'http://example.com/voice.mp3'}],
    };

    await expect(
      renderShort(remoteAudio, '/tmp/output.mp4', {
        extractThumbnail: vi.fn(async () => undefined),
      bundle: vi.fn(),
        selectComposition: vi.fn(),
        renderMedia: vi.fn(),
        startAssetServer,
      }),
    ).rejects.toThrow(/local files/i);
    expect(startAssetServer).not.toHaveBeenCalled();
  });

  it('adds context to renderer failures while preserving the cause', async () => {
    const failure = new Error('Chromium exited');
    const close = vi.fn(async () => undefined);
    const deps: RenderDeps = {
      extractThumbnail: vi.fn(async () => undefined),
      bundle: vi.fn(async () => 'http://localhost:3000'),
      selectComposition: vi.fn(async () => composition),
      renderMedia: vi.fn(async () => {
        throw failure;
      }),
      startAssetServer: vi.fn(async () => ({
        origin: 'http://127.0.0.1:43210',
        close,
      })),
    };

    await expect(renderShort(video, '/tmp/output.mp4', deps)).rejects.toMatchObject({
      message: 'Failed to render short: Chromium exited',
      cause: failure,
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('preserves the renderer failure when asset server cleanup also fails', async () => {
    const renderFailure = new Error('Chromium exited');
    const closeFailure = new Error('Asset server would not close');
    const deps: RenderDeps = {
      extractThumbnail: vi.fn(async () => undefined),
      bundle: vi.fn(async () => 'http://localhost:3000'),
      selectComposition: vi.fn(async () => composition),
      renderMedia: vi.fn(async () => {
        throw renderFailure;
      }),
      startAssetServer: vi.fn(async () => ({
        origin: 'http://127.0.0.1:43210',
        close: vi.fn(async () => {
          throw closeFailure;
        }),
      })),
    };

    await expect(renderShort(video, '/tmp/output.mp4', deps)).rejects.toMatchObject({
      message: 'Failed to render short: Chromium exited',
      cause: renderFailure,
    });
  });

  it('preserves an undefined renderer rejection when cleanup also fails', async () => {
    const deps: RenderDeps = {
      extractThumbnail: vi.fn(async () => undefined),
      bundle: vi.fn(async () => 'http://localhost:3000'),
      selectComposition: vi.fn(async () => composition),
      renderMedia: vi.fn(() => Promise.reject(undefined)),
      startAssetServer: vi.fn(async () => ({
        origin: 'http://127.0.0.1:43210',
        close: vi.fn(async () => {
          throw new Error('Asset server would not close');
        }),
      })),
    };

    await expect(renderShort(video, '/tmp/output.mp4', deps)).rejects.toMatchObject({
      message: 'Failed to render short: undefined',
    });
  });
});

describe('render asset serving', () => {
  it('maps relative paths through the approved loopback origin using their resolved asset path', () => {
    const relativePath = 'runs/20260813-180438-638e819a/scene-01.mp4';
    const absolutePath = resolve(relativePath);

    expect(
      getVideoSource(relativePath, 'http://127.0.0.1:43210', {
        [relativePath]: absolutePath,
      }),
    ).toBe(`http://127.0.0.1:43210/asset?path=${encodeURIComponent(absolutePath)}`);
  });

  it('maps absolute paths to the approved loopback origin only when supplied', () => {
    expect(getVideoSource('/tmp/scene one.mp4', 'http://127.0.0.1:43210')).toBe(
      'http://127.0.0.1:43210/asset?path=%2Ftmp%2Fscene+one.mp4',
    );
    expect(getVideoSource('/tmp/scene one.mp4')).toBe('file:///tmp/scene%20one.mp4');
  });

  it('serves only allowlisted absolute files and closes the listener', async () => {
    const fixturePath = fileURLToPath(new URL('../fixtures/tiny-video.mp4', import.meta.url));
    const fixture = await readFile(fixturePath);
    const server = await startAssetServer([fixturePath]);
    const allowedUrl = new URL('/asset', server.origin);
    allowedUrl.searchParams.set('path', fixturePath);

    try {
      const allowed = await fetch(allowedUrl);
      expect(allowed.status).toBe(200);
      expect(allowed.headers.get('content-type')).toBe('video/mp4');
      expect(Buffer.from(await allowed.arrayBuffer())).toEqual(fixture);

      const unknownUrl = new URL('/asset', server.origin);
      unknownUrl.searchParams.set('path', '/tmp/not-allowed.mp4');
      expect((await fetch(unknownUrl)).status).toBe(404);

      const traversalUrl = new URL('/asset', server.origin);
      traversalUrl.searchParams.set('path', '../tiny-video.mp4');
      expect((await fetch(traversalUrl)).status).toBe(400);
    } finally {
      await server.close();
    }

    await expect(fetch(allowedUrl)).rejects.toThrow();
  });

  it('serves tiny-audio.mp3 as audio/mpeg', async () => {
    const fixturePath = fileURLToPath(new URL('../fixtures/tiny-audio.mp3', import.meta.url));
    const fixture = await readFile(fixturePath);
    const server = await startAssetServer([fixturePath]);
    const allowedUrl = new URL('/asset', server.origin);
    allowedUrl.searchParams.set('path', fixturePath);

    try {
      const allowed = await fetch(allowedUrl);
      expect(allowed.status).toBe(200);
      expect(allowed.headers.get('content-type')).toBe('audio/mpeg');
      expect(Buffer.from(await allowed.arrayBuffer())).toEqual(fixture);
    } finally {
      await server.close();
    }
  });

  it('closes after a client aborts an in-flight asset response', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'render-assets-'));
    const videoPath = join(directory, 'large.mp4');
    await writeFile(videoPath, Buffer.alloc(8 * 1024 * 1024));
    const server = await startAssetServer([videoPath]);
    const assetUrl = new URL('/asset', server.origin);
    assetUrl.searchParams.set('path', videoPath);

    try {
      await new Promise<void>((resolveAbort, reject) => {
        const client = request(assetUrl, (response) => {
          response.once('data', () => {
            response.destroy();
            resolveAbort();
          });
        });
        client.on('error', reject);
        client.end();
      });

      await server.close();
    } finally {
      await server.close().catch(() => undefined);
      await rm(directory, {recursive: true});
    }
  });
});
