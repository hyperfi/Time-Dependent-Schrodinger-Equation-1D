import { checkpoint, createRuntime, type Detectors, type Runtime } from './experiment';
import { renderPosition, type PlotView } from './plot-renderer';

export function download(blob: Blob, name: string) {
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export const canvasBlob=(canvas:HTMLCanvasElement)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not encode the image.')),'image/png'));
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export function isolatedRuntimes(a:Runtime,b:Runtime|null) {
  const savedA=checkpoint(a),savedB=b?checkpoint(b):null;
  return {a:createRuntime(savedA.config,savedA),b:savedB?createRuntime(savedB.config,savedB):null};
}

export async function exportSequence(input:{a:Runtime;b:Runtime|null;detectors:Detectors;view:PlotView;duration:number;fps:number;format:'video'|'zip';signal:AbortSignal;onProgress:(p:number)=>void}) {
  const {a,b}=isolatedRuntimes(input.a,input.b),start=a.state.time,canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
  const ctx=canvas.getContext('2d')!,count=Math.ceil(input.duration*input.fps),times:number[]=[];
  if(count<1||count>600)throw new Error('Choose an export of 1–600 frames.');
  const frame=(time:number)=>{
    a.solver.advanceTo(a.state,time);if(b)b.solver.advanceTo(b.state,time);
    ctx.fillStyle='#fff';ctx.fillRect(0,0,1280,720);ctx.fillStyle='#233c33';ctx.font='600 22px system-ui';ctx.fillText('Quantum TDSE · Experiment snapshot',49,38);
    ctx.font='14px monospace';ctx.fillStyle='#657b6e';ctx.fillText(`t = ${time.toFixed(4)}    ℏ = m = 1${b?'    A: teal · B: coral':''}`,49,65);
    ctx.save();ctx.translate(0,80);renderPosition(ctx,1280,620,a,b,input.detectors,input.view);ctx.restore();times.push(time);
  };
  let recorder:MediaRecorder|null=null,stream:MediaStream|null=null;
  try {
    if(input.format==='zip') {
      const {default:JSZip}=await import('jszip'),zip=new JSZip();
      for(let i=0;i<count;i++) {
        if(input.signal.aborted)throw new DOMException('Export cancelled','AbortError');
        frame(start+i/input.fps);zip.file(`frame-${String(i).padStart(4,'0')}.png`,await canvasBlob(canvas));input.onProgress((i+1)/count*.9);await wait(0);
      }
      zip.file('manifest.json',JSON.stringify({units:'hbar=mass=1',fps:input.fps,timestamps:times,a:checkpoint(input.a),b:input.b?checkpoint(input.b):null},null,2));
      const result=await zip.generateAsync({type:'blob'},metadata=>input.onProgress(.9+metadata.percent/100*.1));
      if(input.signal.aborted)throw new DOMException('Export cancelled','AbortError');
      download(result,'quantum-tdse-frames.zip');return 'PNG frames and exact timestamps exported.';
    }
    if(typeof MediaRecorder==='undefined')throw new Error('This browser cannot record video. Export PNG frames instead.');
    const mimeType=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
    if(!mimeType)throw new Error('No supported recording codec. Export PNG frames instead.');
    stream=canvas.captureStream(input.fps);recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:8_000_000});
    const chunks:Blob[]=[];
    const stopped=new Promise<Blob>((resolve,reject)=>{recorder!.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder!.onstop=()=>resolve(new Blob(chunks,{type:mimeType}));recorder!.onerror=()=>reject(new Error('Video encoder failed. Try PNG frames.'));});
    frame(start);recorder.start();
    for(let i=0;i<count;i++) {
      if(input.signal.aborted)throw new DOMException('Export cancelled','AbortError');
      if(i>0)frame(start+i/input.fps);input.onProgress((i+1)/count);await wait(1000/input.fps);
    }
    recorder.stop();const result=await stopped;if(!result.size)throw new Error('The browser produced an empty recording. Try PNG frames.');
    download(result,`quantum-tdse.${mimeType.includes('mp4')?'mp4':'webm'}`);
    return 'Video exported from this checkpoint. Browser encoding may vary in frame pacing; use PNG frames for exact frame samples.';
  } finally { if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop()); }
}
