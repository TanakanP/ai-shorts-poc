import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {isAbsolute, resolve} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import type {VideoConfig} from 'remotion/no-react';
import type {ResolvedVideo} from '../domain/resolved-video.js';

type InputProps = {video: ResolvedVideo; assetBaseUrl: string};

export type AssetServer = {
  origin: string;
  close: () => Promise<void>;
};

export const startAssetServer = async (allowedPaths: string[]): Promise<AssetServer> => {
  const allowed = new Set(allowedPaths.filter(isAbsolute).map((path) => resolve(path)));
  const server = createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }

    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const path = url.searchParams.get('path');
    if (url.pathname !== '/asset' || !path || !isAbsolute(path) || resolve(path) !== path) {
      response.writeHead(400).end();
      return;
    }
    if (!allowed.has(path)) {
      response.writeHead(404).end();
      return;
    }

    void stat(path)
      .then((file) => {
        if (!file.isFile()) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          'Content-Length': file.size,
          'Content-Type': 'video/mp4',
        });
        if (request.method === 'HEAD') {
          response.end();
          return;
        }
        void pipeline(createReadStream(path), response).catch(() => response.destroy());
      })
      .catch(() => response.writeHead(404).end());
  });

  await new Promise<void>((resolveListening, reject) => {
    const onError = (error: Error) => reject(error);
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError);
      resolveListening();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Asset server did not bind to a TCP port');
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolveClose, reject) => {
        server.close((error) => (error ? reject(error) : resolveClose()));
      }),
  };
};

export type RenderDeps = {
  bundle: (options: {entryPoint: string}) => Promise<string>;
  selectComposition: (options: {
    serveUrl: string;
    id: string;
    inputProps: InputProps;
  }) => Promise<VideoConfig>;
  renderMedia: (options: {
    serveUrl: string;
    composition: VideoConfig;
    codec: 'h264';
    outputLocation: string;
    inputProps: InputProps;
  }) => Promise<unknown>;
  startAssetServer: (allowedPaths: string[]) => Promise<AssetServer>;
};

const defaultDeps: RenderDeps = {
  bundle: (options) => bundle(options),
  selectComposition: (options) => selectComposition(options),
  renderMedia: (options) => renderMedia(options),
  startAssetServer,
};

export const renderShort = async (
  video: ResolvedVideo,
  outputPath: string,
  deps: RenderDeps = defaultDeps,
): Promise<void> => {
  try {
    const assetServer = await deps.startAssetServer(
      video.scenes.map((scene) => scene.localVideoPath).filter(isAbsolute),
    );
    let operationFailed = false;
    let operationError: unknown;
    try {
      const inputProps = {video, assetBaseUrl: assetServer.origin};
      const serveUrl = await deps.bundle({
        entryPoint: fileURLToPath(new URL('./index.ts', import.meta.url)),
      });
      const composition = await deps.selectComposition({
        serveUrl,
        id: 'SilentShort',
        inputProps,
      });

      await deps.renderMedia({
        serveUrl,
        composition,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps,
      });
    } catch (error) {
      operationFailed = true;
      operationError = error;
    }
    try {
      await assetServer.close();
    } catch (error) {
      if (!operationFailed) throw error;
    }
    if (operationFailed) throw operationError;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to render short: ${message}`, {cause: error});
  }
};
