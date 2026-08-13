import {z} from 'zod';
import {ProviderError} from '../domain/provider-error';

export type SearchOptions = {
  orientation: 'portrait' | 'landscape';
  perPage: number;
};

export type PexelsVideoFile = {
  id: number;
  file_type: string;
  width: number;
  height: number;
  link: string;
};

export type PexelsVideo = {
  id: number;
  url: string;
  duration: number;
  user: {
    name: string;
    url: string;
  };
  video_files: PexelsVideoFile[];
};

const searchResponseSchema = z.object({
  videos: z.array(
    z.object({
      id: z.number(),
      url: z.string().url(),
      duration: z.number(),
      user: z.object({name: z.string(), url: z.string().url()}),
      video_files: z.array(
        z.object({
          id: z.number(),
          file_type: z.string(),
          width: z.number(),
          height: z.number(),
          link: z.string().url(),
        }),
      ),
    }),
  ),
});

export class PexelsApiError extends ProviderError {
  readonly status: number;

  constructor(status: number) {
    super(`Pexels API request failed with status ${status}`, {
      provider: 'pexels',
      kind: status === 401 || status === 403 ? 'auth' : status === 429 ? 'quota' : 'transport',
      status,
    });
    this.name = 'PexelsApiError';
    this.status = status;
  }
}

export class PexelsResponseValidationError extends ProviderError {
  constructor() {
    super('Pexels API returned an invalid response payload', {
      provider: 'pexels',
      kind: 'validation',
    });
    this.name = 'PexelsResponseValidationError';
  }
}

export class PexelsClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async searchVideos(
    query: string,
    {orientation, perPage}: SearchOptions = {orientation: 'portrait', perPage: 15},
  ): Promise<PexelsVideo[]> {
    const params = new URLSearchParams({
      query,
      orientation,
      size: 'medium',
      per_page: String(perPage),
      locale: 'en-US',
    });
    let response: Response;
    try {
      response = await this.fetchImpl(
        `https://api.pexels.com/v1/videos/search?${params}`,
        {headers: {Authorization: this.apiKey}},
      );
    } catch (cause) {
      if (cause instanceof ProviderError) throw cause;
      throw new ProviderError(
        'Pexels API transport failed',
        {provider: 'pexels', kind: 'transport'},
        {cause},
      );
    }

    if (!response.ok) throw new PexelsApiError(response.status);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new PexelsResponseValidationError();
    }

    const parsed = searchResponseSchema.safeParse(payload);
    if (!parsed.success) throw new PexelsResponseValidationError();

    return parsed.data.videos;
  }
}
