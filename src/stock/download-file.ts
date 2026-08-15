import {createWriteStream} from 'node:fs';
import {rename, rm, stat} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {ProviderError} from '../domain/provider-error';

export const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BYTES = 250 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export type DownloadOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
};

export class VideoDownloadError extends ProviderError {
  constructor(
    kind: 'transport' | 'validation',
    details: {status?: number; code?: string} = {},
    options?: ErrorOptions,
  ) {
    const message = details.status
      ? `Video download failed with status ${details.status}`
      : details.code === 'invalid_media_url'
        ? 'Video download requires an HTTPS Pexels media URL'
        : details.code === 'timeout'
          ? 'Pexels video download timed out'
          : 'Pexels video download failed';
    super(message, {provider: 'pexels', kind, ...details}, options);
    this.name = 'VideoDownloadError';
  }
}

function requirePexelsMediaUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'videos.pexels.com') {
    throw new VideoDownloadError('validation', {code: 'invalid_media_url'});
  }
  return url;
}

async function fetchPexelsMedia(
  initialUrl: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<Response> {
  let url = requirePexelsMediaUrl(initialUrl);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response: Response;
    try {
      response = await fetchImpl(url.href, {redirect: 'manual', signal});
    } catch (cause) {
      if (cause instanceof ProviderError) throw cause;
      throw new VideoDownloadError('transport', {}, {cause});
    }
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    if (!location || redirects === MAX_REDIRECTS) {
      throw new VideoDownloadError('transport', {code: 'redirect_failed'});
    }
    try {
      url = requirePexelsMediaUrl(new URL(location, url).href);
    } catch (cause) {
      if (cause instanceof ProviderError) throw cause;
      throw new VideoDownloadError('transport', {code: 'redirect_failed'}, {cause});
    }
  }
  throw new VideoDownloadError('transport', {code: 'redirect_failed'});
}

export async function downloadFile(
  url: string,
  destination: string,
  {
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
  }: DownloadOptions = {},
): Promise<void> {
  const partialPath = `${destination}.partial`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchPexelsMedia(url, fetchImpl, controller.signal);
    if (!response.ok) throw new VideoDownloadError('transport', {status: response.status});
    if (!response.body) throw new VideoDownloadError('transport', {code: 'empty_body'});

    let receivedBytes = 0;
    const enforceSize = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        receivedBytes += chunk.length;
        callback(
          receivedBytes > maxBytes ? new Error('Video download exceeded size limit') : null,
          chunk,
        );
      },
    });
    await pipeline(
      Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream),
      enforceSize,
      createWriteStream(partialPath),
    );
    if ((await stat(partialPath)).size === 0) throw new Error('Video download produced a zero-byte file');

    await rename(partialPath, destination);
  } catch (error) {
    await rm(partialPath, {force: true});
    if (controller.signal.aborted) {
      throw new VideoDownloadError('transport', {code: 'timeout'}, {cause: error});
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
