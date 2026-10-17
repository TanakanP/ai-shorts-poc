import {expect, it} from 'vitest';
import {transportFailureDiagnostic} from '../../src/domain/transport-diagnostic';

it.each([
  ['ECONNRESET', 'connection was reset'],
  ['ENOTFOUND', 'hostname could not be resolved'],
  ['CERT_HAS_EXPIRED', 'certificate has expired'],
  ['UND_ERR_HEADERS_TIMEOUT', 'response headers'],
])('finds %s inside wrapped fetch failures', (code, detail) => {
  const root = Object.assign(new Error('private server message'), {code});
  const error = new Error('Connection error.', {cause: new TypeError('fetch failed', {cause: root})});
  expect(transportFailureDiagnostic(error)).toMatchObject({
    code: code.toLowerCase(), detail: expect.stringContaining(detail),
    causes: expect.arrayContaining([`Error (${code})`]),
  });
});

it('reports the individual errors in an aggregate connection failure', () => {
  const failure = new AggregateError([
    Object.assign(new Error('private IPv6 address'), {code: 'ENETUNREACH'}),
    Object.assign(new Error('private IPv4 address'), {code: 'ETIMEDOUT'}),
  ]);
  expect(transportFailureDiagnostic(failure)).toMatchObject({
    code: 'enetunreach',
    detail: expect.stringContaining('Other network errors: ETIMEDOUT.'),
    causes: ['AggregateError', 'Error (ENETUNREACH)', 'Error (ETIMEDOUT)'],
  });
});

it('never copies arbitrary names, messages, codes, stacks, headers or body content', () => {
  const secret = 'Bearer xai-private-credential';
  const error = {
    name: secret, code: secret, message: secret, stack: secret,
    headers: {Authorization: secret}, body: {prompt: secret},
    cause: Object.assign(new Error(secret), {code: 'ECONNRESET'}),
  };
  const result = transportFailureDiagnostic(error);
  expect(result.code).toBe('econnreset');
  expect(JSON.stringify(result)).not.toMatch(/Bearer|credential|Authorization|prompt|private/);
});

it('bounds cyclic cause and aggregate graphs', () => {
  const failure: {name: string; cause?: unknown; errors: unknown[]} = {name: 'Error', errors: []};
  failure.cause = failure;
  failure.errors = [failure];
  expect(transportFailureDiagnostic(failure)).toEqual({
    detail: 'Request failed before an HTTP response; no recognized network error code was available.',
    causes: ['Error'],
  });
});
