import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {request} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
      durationSeconds: 5,
      text: 'A short test scene',
      searchQuery: 'test scene',
      sourcePageUrl: 'https://example.com/video',
      creatorName: 'Test Creator',
      creatorUrl: 'https://example.com/creator',
      localVideoPath: '/tmp/test-video.mp4',
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
    const deps: RenderDeps = {bundle, selectComposition, renderMedia, startAssetServer};

    await renderShort(video, '/tmp/output.mp4', deps);

    expect(bundle).toHaveBeenCalledTimes(1);
    expect(bundle).toHaveBeenCalledWith({
      entryPoint: fileURLToPath(new URL('../../src/remotion/index.ts', import.meta.url)),
    });
    expect(startAssetServer).toHaveBeenCalledWith(['/tmp/test-video.mp4']);
    expect(selectComposition).toHaveBeenCalledWith({
      serveUrl: 'http://localhost:3000',
      id: 'SilentShort',
      inputProps: {video, assetBaseUrl: 'http://127.0.0.1:43210'},
    });
    expect(renderMedia).toHaveBeenCalledWith({
      serveUrl: 'http://localhost:3000',
      composition,
      codec: 'h264',
      outputLocation: '/tmp/output.mp4',
      inputProps: {video, assetBaseUrl: 'http://127.0.0.1:43210'},
    });
    expect(selectedVideo).toBe(video);
    expect(renderedVideo).toBe(video);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('adds context to renderer failures while preserving the cause', async () => {
    const failure = new Error('Chromium exited');
    const close = vi.fn(async () => undefined);
    const deps: RenderDeps = {
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
  it('maps absolute paths to the approved loopback origin only when supplied', () => {
    expect(getVideoSource('/tmp/scene one.mp4', 'http://127.0.0.1:43210')).toBe(
      'http://127.0.0.1:43210/asset?path=%2Ftmp%2Fscene+one.mp4',
    );
    expect(getVideoSource('/tmp/scene one.mp4')).toBe('file:///tmp/scene%20one.mp4');
    expect(getVideoSource('https://example.com/video.mp4', 'http://127.0.0.1:43210')).toBe(
      'https://example.com/video.mp4',
    );
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
