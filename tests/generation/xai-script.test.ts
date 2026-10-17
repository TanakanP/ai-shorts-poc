import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {afterEach, expect, it, vi} from 'vitest';
import {z} from 'zod';
import {ProviderError} from '../../src/domain/provider-error';
import {
  createXaiStructuredPlanGenerator,
  XAI_PLAN_TIMEOUT_MS,
  xaiPlanClientOptions,
} from '../../src/generation/generate-video-plan';
afterEach(() => vi.unstubAllGlobals());
it('sends the schema to xAI and validates the returned JSON', async () => {
 const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'r', object:'response', status:'completed',
  output:[{type:'message', role:'assistant', content:[{type:'output_text',text:'{"title":"Popcorn"}', annotations:[]}]}]}),{headers:{'content-type':'application/json'}}));
 vi.stubGlobal('fetch',fetch);
 const generate=createXaiStructuredPlanGenerator('secret',z.object({title:z.string()}),'story','grok-4.3');
 expect(await generate({system:'Write a story',input:'corn'})).toEqual({title:'Popcorn'});
 expect(String(fetch.mock.calls[0][0])).toBe('https://api.x.ai/v1/responses');
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
  model:'grok-4.3',
  reasoning:{effort:'low'},
  text:{format:{name:'story',type:'json_schema'}},
 });
});
it('gives grok plan requests 15 minutes before timing out', async () => {
 expect(XAI_PLAN_TIMEOUT_MS).toBe(15 * 60 * 1000);
 const options = xaiPlanClientOptions('secret');
 expect(options).toMatchObject({
  apiKey: 'secret',
  baseURL: 'https://api.x.ai/v1',
  timeout: 15 * 60 * 1000,
 });
 const dispatcher = options.fetchOptions.dispatcher as object & {close(): Promise<void>};
 const stored = Object.getOwnPropertySymbols(dispatcher)
  .map((symbol) => (dispatcher as Record<symbol, unknown>)[symbol])
  .find((value) => value && typeof value === 'object' && 'headersTimeout' in value);
 expect(stored).toMatchObject({headersTimeout: 15 * 60 * 1000, bodyTimeout: 15 * 60 * 1000});
 await dispatcher.close();
});
it('aborts an idle xAI fetch at the configured timeout instead of Node 5-minute default', async () => {
 const server = createServer(() => {});
 await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
 const {port} = server.address() as AddressInfo;
 const options = xaiPlanClientOptions('secret', 200);
 const started = Date.now();
 await expect(options.fetch(`http://127.0.0.1:${port}/hang`)).rejects.toThrow();
 expect(Date.now() - started).toBeLessThan(3000);
 await (options.fetchOptions.dispatcher as {close(): Promise<void>}).close();
 await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
it('attributes authentication errors to xAI', async () => {
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:401,headers:{'content-type':'application/json'}})));
 await expect(createXaiStructuredPlanGenerator('secret',z.object({title:z.string()}))({system:'s',input:'i'}))
  .rejects.toMatchObject({diagnostic:{provider:'xai',kind:'auth'}});
});
it('records xAI request timeouts as transport diagnostics', async () => {
 vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('The operation was aborted due to timeout'), {name: 'AbortError'})));
 await expect(createXaiStructuredPlanGenerator('secret', z.object({title: z.string()}))({system: 's', input: 'i'}))
  .rejects.toMatchObject({diagnostic: {provider: 'xai', kind: 'transport', code: 'timeout', detail: 'Request timed out.'}});
});

it('exposes nested connection codes and request context without request secrets', async () => {
 const secret = 'xai-test-private-key';
 vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError(`fetch failed: Bearer ${secret}`, {
  cause: Object.assign(new Error('private request and prompt content'), {code: 'ECONNRESET'}),
 })));
 const error = await createXaiStructuredPlanGenerator(secret, z.object({title: z.string()}), 'v5_package', 'grok-4.3')
  ({system: 'private system prompt', input: 'private input'}).catch((error: unknown) => error);
 expect(error).toMatchObject({diagnostic: {
  provider: 'xai', kind: 'transport', code: 'econnreset',
  detail: 'The connection was reset before the request completed.',
  operation: 'plan-generation', endpoint: 'https://api.x.ai/v1/responses',
  model: 'grok-4.3', schema: 'v5_package', elapsedMs: expect.any(Number), timeoutMs: XAI_PLAN_TIMEOUT_MS,
  causes: expect.arrayContaining(['TypeError', 'Error (ECONNRESET)']),
 }});
 expect(JSON.stringify(error)).not.toMatch(/xai-test-private-key|Bearer|private input|private system|private request/);
});

it('retains the fetch cause even when the SDK discards it while wrapping a timeout', async () => {
 vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed', {
  cause: Object.assign(new Error('connect timed out'), {code: 'UND_ERR_CONNECT_TIMEOUT'}),
 })));
 await expect(createXaiStructuredPlanGenerator('secret', z.object({title: z.string()}))({system: 's', input: 'i'}))
  .rejects.toMatchObject({diagnostic: {
   code: 'timeout', detail: 'Timed out establishing the API connection.',
   causes: expect.arrayContaining(['Error (UND_ERR_CONNECT_TIMEOUT)']),
  }});
});

it('keeps transport causes separate across concurrent requests', async () => {
 vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
  const {input} = JSON.parse(init.body as string);
  await Promise.resolve();
  throw new TypeError('fetch failed', {
   cause: Object.assign(new Error('network failed'), {code: input === 'first' ? 'ENOTFOUND' : 'ECONNRESET'}),
  });
 }));
 const generate = createXaiStructuredPlanGenerator('secret', z.object({title: z.string()}));
 const errors = await Promise.all(['first', 'second'].map(input => generate({system: 's', input}).catch(error => error)));
 expect(errors.map(error => error instanceof ProviderError ? error.diagnostic.code : undefined))
  .toEqual(['enotfound', 'econnreset']);
});

it('reports an HTTP failure without logging its raw response body', async () => {
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
  error: {message: 'Bearer xai-private-key and private prompt'},
 }), {status: 503, headers: {'content-type': 'application/json'}})));
 const error = await createXaiStructuredPlanGenerator('xai-private-key', z.object({title: z.string()}))
  ({system: 's', input: 'i'}).catch(error => error);
 expect(error).toMatchObject({diagnostic: {
  provider: 'xai', kind: 'transport', status: 503, detail: 'Provider returned HTTP 503.',
 }});
 expect(JSON.stringify(error)).not.toMatch(/xai-private-key|Bearer|private prompt/);
});
