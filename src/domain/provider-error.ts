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

function looksLikeSecret(value: string): boolean {
  return /sk-|api[_-]?key|Authorization/i.test(value);
}

export function publicFailureDetail(error: unknown): string | undefined {
  let current: unknown = error;

  while (current) {
    if (current instanceof ProviderError) {
      if (current.diagnostic.detail && !looksLikeSecret(current.diagnostic.detail)) {
        return current.diagnostic.detail;
      }
      current = current.cause;
      continue;
    }

    if (typeof current === 'object' && current !== null && 'issues' in current) {
      const issues = (current as {issues?: Array<{path?: PropertyKey[]; message?: string}>}).issues;
      if (Array.isArray(issues) && issues.length > 0) {
        const detail = issues
          .map((issue) => {
            const path = Array.isArray(issue.path) ? issue.path.filter((part) => part !== '').join('.') : '';
            const message = issue.message ?? '';
            return path ? `${path}: ${message}` : message;
          })
          .filter(Boolean)
          .join('; ');
        if (detail && !looksLikeSecret(detail)) return detail;
      }
    }

    current = current instanceof Error ? current.cause : undefined;
  }

  return undefined;
}
