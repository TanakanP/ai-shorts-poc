import {z} from 'zod';

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

export class PexelsApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Pexels API request failed with status ${status}`);
    this.name = 'PexelsApiError';
    this.status = status;
  }
}

export class PexelsResponseValidationError extends Error {
  constructor() {
    super('Pexels API returned an invalid response payload');
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
    const response = await this.fetchImpl(
      `https://api.pexels.com/v1/videos/search?${params}`,
      {headers: {Authorization: this.apiKey}},
    );

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
