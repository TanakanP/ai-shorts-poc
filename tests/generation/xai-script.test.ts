import {afterEach, expect, it, vi} from 'vitest';
import {z} from 'zod';
import {createXaiStructuredPlanGenerator} from '../../src/generation/generate-video-plan';
afterEach(() => vi.unstubAllGlobals());
it('sends the schema to xAI and validates the returned JSON', async () => {
 const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'r', object:'response', status:'completed',
  output:[{type:'message', role:'assistant', content:[{type:'output_text',text:'{"title":"Popcorn"}', annotations:[]}]}]}),{headers:{'content-type':'application/json'}}));
 vi.stubGlobal('fetch',fetch);
 const generate=createXaiStructuredPlanGenerator('secret',z.object({title:z.string()}),'story','grok-4.3');
 expect(await generate({system:'Write a story',input:'corn'})).toEqual({title:'Popcorn'});
 expect(String(fetch.mock.calls[0][0])).toBe('https://api.x.ai/v1/responses');
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({model:'grok-4.3',text:{format:{name:'story',type:'json_schema'}}});
});
it('attributes authentication errors to xAI', async () => {
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:401,headers:{'content-type':'application/json'}})));
 await expect(createXaiStructuredPlanGenerator('secret',z.object({title:z.string()}))({system:'s',input:'i'}))
  .rejects.toMatchObject({diagnostic:{provider:'xai',kind:'auth'}});
});
