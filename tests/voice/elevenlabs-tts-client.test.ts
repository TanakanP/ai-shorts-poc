import {readFileSync} from 'node:fs';
import {expect, it, vi} from 'vitest';
import {createElevenLabsSpeechSynthesizer} from '../../src/voice/elevenlabs-tts-client';
const payload={audio_base64:readFileSync('tests/fixtures/tiny-audio.mp3').toString('base64'),
 normalized_alignment:{characters:['w','h','y','?'],character_start_times_seconds:[0,.1,.2,.3],character_end_times_seconds:[.1,.2,.3,.4]}};
it('returns real audio duration and aligned words, removing xAI delivery tags', async () => {
 const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)));
 const result=await createElevenLabsSpeechSynthesizer('secret','eleven_multilingual_v2',fetch)({text:'<slow>why</slow>? [pause]',voiceId:'voice123'});
 expect(result.words).toEqual([{text:'why?',startMs:0,endMs:400}]);
 expect(result.durationSeconds).toBeGreaterThan(.4);
 expect(fetch.mock.calls[0][0]).toContain('/voice123/with-timestamps?output_format=mp3_44100_128');
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({text:'why?',model_id:'eleven_multilingual_v2',voice_settings:{speed:1}});
});
it.each([401,429,500])('reports safe ElevenLabs errors for %s',async status=>{
 const synth=createElevenLabsSpeechSynthesizer('secret','m',vi.fn().mockResolvedValue(new Response('private-provider-body',{status})));
 await expect(synth({text:'hello',voiceId:'v'})).rejects.toMatchObject({message:'ElevenLabs speech synthesis failed',diagnostic:{provider:'elevenlabs',kind:status===401?'auth':status===429?'quota':'transport',status}});
});
it.each([{}, {...payload,normalized_alignment:null}, {...payload,normalized_alignment:{...payload.normalized_alignment,character_end_times_seconds:[.1]}}])('rejects missing or malformed timing',async data=>{
 const synth=createElevenLabsSpeechSynthesizer('secret','m',vi.fn().mockResolvedValue(new Response(JSON.stringify(data))));
 await expect(synth({text:'why?',voiceId:'v'})).rejects.toMatchObject({diagnostic:{provider:'elevenlabs',kind:'validation'}});
});
