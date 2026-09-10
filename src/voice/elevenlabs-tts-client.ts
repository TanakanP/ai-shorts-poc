import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RenderInternals} from '@remotion/renderer';
import {z} from 'zod';
import {ProviderError} from '../domain/provider-error';
import {stripSpeechTags} from '../captions/speech-tags';
import {charactersToWords} from './characters-to-words';
import type {SpeechSynthesizer} from './xai-tts-client';

export const ELEVENLABS_SPEECH_SPEED = 1;

const alignmentSchema=z.object({
  characters:z.array(z.string()).min(1),
  character_start_times_seconds:z.array(z.number().finite().nonnegative()),
  character_end_times_seconds:z.array(z.number().finite().nonnegative()),
});
const responseSchema=z.object({audio_base64:z.string().min(1),
  alignment:alignmentSchema.nullish(),normalized_alignment:alignmentSchema.nullish()});

// Use actual MP3 duration: the final character timestamp omits trailing audio.
async function audioDuration(audio: Buffer): Promise<number> {
  const dir=await mkdtemp(join(tmpdir(),'elevenlabs-audio-'));
  try {
    const path=join(dir,'voice.mp3');
    await writeFile(path,audio);
    const result=await RenderInternals.callFf({bin:'ffprobe',indent:false,logLevel:'error',
      binariesDirectory:null,cancelSignal:undefined,
      args:['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',path]});
    return z.number().finite().positive().parse(Number(result.stdout.trim()));
  } finally {await rm(dir,{recursive:true,force:true});}
}

export function createElevenLabsSpeechSynthesizer(
  apiKey:string, model='eleven_multilingual_v2', fetchImpl:typeof fetch=fetch,
): SpeechSynthesizer {
  return async ({text,voiceId}) => {
    const fail=(kind:'auth'|'quota'|'transport'|'validation',status?:number,cause?:unknown)=>
      new ProviderError('ElevenLabs speech synthesis failed',{provider:'elevenlabs',kind,...(status?{status}:{})},{cause});
    let response:Response;
    try {
      response=await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,{
        method:'POST',headers:{'xi-api-key':apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({text:stripSpeechTags(text),model_id:model,voice_settings:{speed:ELEVENLABS_SPEECH_SPEED}}),
      });
    } catch(cause) {throw fail('transport',undefined,cause);}
    if(!response.ok) throw fail(response.status===401||response.status===403?'auth':response.status===429?'quota':response.status===400||response.status===422?'validation':'transport',response.status);
    try {
      const data=responseSchema.parse(await response.json());
      const timing=data.normalized_alignment??data.alignment;
      if(!timing || timing.characters.length!==timing.character_start_times_seconds.length || timing.characters.length!==timing.character_end_times_seconds.length) throw new Error('Missing or mismatched alignment');
      const times=timing.characters.map((_,i):readonly[number,number]=>{
        const start=timing.character_start_times_seconds[i]!;
        const end=timing.character_end_times_seconds[i]!;
        if(end<start || (i>0 && start<timing.character_start_times_seconds[i-1]!)) throw new Error('Invalid alignment order');
        return [start,end];
      });
      const audio=Buffer.from(data.audio_base64,'base64');
      const durationSeconds=await audioDuration(audio);
      if(Math.max(...timing.character_end_times_seconds)>durationSeconds+.1) throw new Error('Alignment exceeds audio');
      return {audio,durationSeconds,words:charactersToWords(timing.characters,times)};
    } catch(cause) {throw fail('validation',undefined,cause);}
  };
}
