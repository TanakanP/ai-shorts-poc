export type ProviderDiagnostic = {
  provider: 'openai' | 'pexels' | 'xai';
  kind: 'auth' | 'quota' | 'transport' | 'validation';
  status?: number;
  code?: string;
  detail?: string;
};

export class ProviderError extends Error {
  readonly diagnostic: ProviderDiagnostic;

  constructor(message: string, diagnostic: ProviderDiagnostic, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProviderError';
    this.diagnostic = diagnostic;
  }
}
