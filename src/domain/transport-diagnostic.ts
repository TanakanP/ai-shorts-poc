import type {ProviderDiagnostic} from './provider-error';

// Only known error identifiers and fixed descriptions are public. Error messages,
// stacks, request objects and response bodies can contain credentials or prompts.
const networkErrors: Record<string, string> = {
  ENOTFOUND: 'DNS lookup failed: the API hostname could not be resolved.',
  EAI_AGAIN: 'DNS lookup failed temporarily.',
  ECONNREFUSED: 'The connection to the API was refused.',
  ECONNRESET: 'The connection was reset before the request completed.',
  ENETUNREACH: 'The network route to the API is unreachable.',
  EHOSTUNREACH: 'The API host is unreachable.',
  ETIMEDOUT: 'The network connection timed out.',
  ESOCKETTIMEDOUT: 'The network socket timed out.',
  UND_ERR_CONNECT_TIMEOUT: 'Timed out establishing the API connection.',
  UND_ERR_HEADERS_TIMEOUT: 'Timed out waiting for API response headers.',
  UND_ERR_BODY_TIMEOUT: 'Timed out reading the API response body.',
  UND_ERR_SOCKET: 'The network socket closed before the request completed.',
  UND_ERR_ABORTED: 'The network request was aborted.',
  ERR_TLS_CERT_ALTNAME_INVALID: 'TLS verification failed: the certificate does not match the API hostname.',
  CERT_HAS_EXPIRED: 'TLS verification failed: a certificate has expired.',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'TLS verification failed: the certificate is self-signed.',
  SELF_SIGNED_CERT_IN_CHAIN: 'TLS verification failed: the certificate chain contains a self-signed certificate.',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'TLS verification failed: the certificate chain could not be verified.',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'TLS verification failed: a trusted issuer certificate is unavailable.',
  EPROTO: 'The connection failed during a protocol or TLS handshake.',
  ERR_SSL_WRONG_VERSION_NUMBER: 'TLS negotiation failed: the peer used an unexpected protocol version.',
};

const errorNames = new Set([
  'Error', 'TypeError', 'AggregateError', 'AbortError', 'TimeoutError', 'SystemError',
  'APIConnectionError', 'APIConnectionTimeoutError', 'APIUserAbortError',
  'ConnectTimeoutError', 'HeadersTimeoutError', 'BodyTimeoutError', 'SocketError',
]);

export function transportFailureDiagnostic(
  ...errors: unknown[]
): Pick<ProviderDiagnostic, 'code' | 'detail' | 'causes'> {
  const queue = errors.map(error => ({error, depth: 0}));
  const seen = new Set<object>();
  const causes = new Set<string>();
  const codes = new Set<string>();
  let timedOut = false;

  for (let visited = 0; queue.length && visited < 32; visited++) {
    const {error, depth} = queue.shift()!;
    if (!error || typeof error !== 'object' || seen.has(error)) continue;
    seen.add(error);
    const value = error as {name?: unknown; code?: unknown; cause?: unknown; errors?: unknown};
    const name = typeof value.name === 'string' && errorNames.has(value.name) ? value.name : undefined;
    const rawCode = typeof value.code === 'string' ? value.code.toUpperCase() : '';
    const code = Object.hasOwn(networkErrors, rawCode) ? rawCode : undefined;
    if (code) codes.add(code);
    if (name === 'APIConnectionTimeoutError' || name === 'TimeoutError') timedOut = true;
    if (name || code) causes.add(code ? `${name ?? 'Error'} (${code})` : name!);
    if (depth >= 8) continue;
    if (value.cause) queue.push({error: value.cause, depth: depth + 1});
    if (Array.isArray(value.errors)) {
      for (const child of value.errors.slice(0, 8)) queue.push({error: child, depth: depth + 1});
    }
  }

  const [code, ...otherCodes] = [...codes];
  return {
    ...(code ? {code: code.toLowerCase()} : timedOut ? {code: 'timeout'} : {}),
    detail: code
      ? `${networkErrors[code]}${otherCodes.length ? ` Other network errors: ${otherCodes.join(', ')}.` : ''}`
      : timedOut ? 'Request timed out.'
        : 'Request failed before an HTTP response; no recognized network error code was available.',
    ...(causes.size ? {causes: [...causes].slice(0, 12)} : {}),
  };
}
