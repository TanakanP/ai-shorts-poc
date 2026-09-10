import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {afterEach, expect, it, vi} from 'vitest';
import {z} from 'zod';
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
