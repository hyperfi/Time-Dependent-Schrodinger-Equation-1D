import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Runtime, Detectors } from '../lib/experiment';

export type PlotView = 'density' | 'components' | 'phase';
export interface HistoryRow { time: number; density: Float32Array }
import { renderPosition, potentialBounds, PLOT_COLORS } from '../lib/plot-renderer';
const font = '11px Consolas, monospace';
const margin = { left:49, right:49, top:32, bottom:39 };
const nice = (v:number) => Number(v.toFixed(2)).toString();

export function WavePlot({ a,b,editRuntime=a,detectors,view,version,onDraw,canvasRef,showDetectors }: { a:Runtime;b:Runtime|null;editRuntime?:Runtime;detectors:Detectors;view:PlotView;version:number;onDraw?:(v:Float64Array)=>void;canvasRef?:(canvas:HTMLCanvasElement)=>void;showDetectors:boolean }) {
  const ref=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null),last=useRef<{x:number;y:number}|null>(null);
  const [size,setSize]=useState({width:600,height:360});
  useEffect(()=>{const observer=new ResizeObserver(entries=>{const rect=entries[0].contentRect;setSize({width:rect.width,height:rect.height});});observer.observe(container.current!);return()=>observer.disconnect();},[]);
  useEffect(()=>{const canvas=ref.current;if(!canvas)return;const ratio=window.devicePixelRatio||1;canvas.width=Math.round(size.width*ratio);canvas.height=Math.round(size.height*ratio);const ctx=canvas.getContext('2d')!;ctx.scale(ratio,ratio);renderPosition(ctx,size.width,size.height,a,b,detectors,view,showDetectors);canvasRef?.(canvas);},[a,b,detectors,view,version,size,canvasRef,showDetectors]);
  const draw=(event:PointerEvent<HTMLCanvasElement>)=>{
    if(!onDraw||editRuntime.config.potentialType!=='custom-draw'||!last.current)return;
    const rect=event.currentTarget.getBoundingClientRect(),point={x:event.clientX-rect.left,y:event.clientY-rect.top};
    const toWorld=(p:{x:number;y:number})=>({x:editRuntime.config.plotXMin+(p.x-margin.left)/(size.width-margin.left-margin.right)*(editRuntime.config.plotXMax-editRuntime.config.plotXMin),y:potentialBounds(editRuntime).max-(p.y-margin.top)/(size.height-margin.top-margin.bottom)*(potentialBounds(editRuntime).max-potentialBounds(editRuntime).min)});
    const from=toWorld(last.current),to=toWorld(point),v=new Float64Array(editRuntime.potential);
    editRuntime.solver.x.forEach((x,i)=>{if(x>=Math.min(from.x,to.x)-editRuntime.solver.dx&&x<=Math.max(from.x,to.x)+editRuntime.solver.dx){const f=Math.abs(to.x-from.x)<1e-9?1:Math.max(0,Math.min(1,(x-from.x)/(to.x-from.x)));v[i]=Math.max(-30,Math.min(30,from.y+(to.y-from.y)*f));}});
    onDraw(v);last.current=point;
  };
  return <div ref={container} className={`wave-canvas ${onDraw&&editRuntime.config.potentialType==='custom-draw'?'is-drawing':''}`}><canvas ref={ref} role="img" aria-label={`Position distribution at time ${a.state.time.toFixed(3)}. Numerical measurements are available in the measurements panel.`}
    onPointerDown={event=>{if(!onDraw||editRuntime.config.potentialType!=='custom-draw')return;event.currentTarget.setPointerCapture(event.pointerId);const rect=event.currentTarget.getBoundingClientRect();last.current={x:event.clientX-rect.left,y:event.clientY-rect.top};draw(event);}}
    onPointerMove={draw} onPointerUp={()=>{last.current=null;}} onPointerCancel={()=>{last.current=null;}} /></div>;
}

export function MomentumPlot({a,b,version}:{a:Runtime;b:Runtime|null;version:number}) {
  const ref=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:600,height:150});
  useEffect(()=>{const observer=new ResizeObserver(e=>setSize({width:e[0].contentRect.width,height:e[0].contentRect.height}));observer.observe(container.current!);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;const ratio=window.devicePixelRatio||1;canvas.width=size.width*ratio;canvas.height=size.height*ratio;const ctx=canvas.getContext('2d')!;ctx.scale(ratio,ratio);
    const w=size.width-98,h=size.height-50,left=49,top=12,distributions=[a,b].filter(Boolean).map(r=>r!.solver.getMomentumDistribution(r!.state));
    const limit=Math.min(Math.PI/a.solver.dx,Math.max(8,Math.abs(a.config.wavefunctionK0)+5)),peak=Math.max(.1,...distributions.flatMap(d=>Array.from(d.density)))*1.15;
    const mx=(p:number)=>left+(p+limit)/(2*limit)*w,my=(v:number)=>top+h-v/peak*h;
    ctx.clearRect(0,0,size.width,size.height);ctx.font=font;
    for(let j=0;j<=4;j++){const p=-limit+2*limit*j/4;ctx.strokeStyle='#edf1ee';ctx.beginPath();ctx.moveTo(mx(p),top);ctx.lineTo(mx(p),top+h);ctx.stroke();ctx.fillStyle='#76847c';ctx.textAlign='center';ctx.fillText(nice(p),mx(p),size.height-15);}
    ctx.save();ctx.beginPath();ctx.rect(left,top,w,h);ctx.clip();
    distributions.forEach((d,index)=>{ctx.beginPath();d.p.forEach((p,i)=>i===0?ctx.moveTo(mx(p),my(d.density[i])):ctx.lineTo(mx(p),my(d.density[i])));ctx.strokeStyle=index?PLOT_COLORS.b:PLOT_COLORS.a;ctx.lineWidth=2;ctx.setLineDash(index?[5,4]:[]);ctx.stroke();ctx.setLineDash([]);ctx.lineTo(mx(limit),my(0));ctx.lineTo(mx(-limit),my(0));ctx.fillStyle=index?'rgba(186,103,71,.06)':'rgba(22,133,119,.08)';ctx.fill();});ctx.restore();
    ctx.fillStyle='#76847c';ctx.textAlign='left';ctx.fillText('Momentum density',left,12);ctx.textAlign='center';ctx.fillText('Momentum p',size.width/2,size.height-1);
  },[a,b,version,size]);
  return <div ref={container} className="momentum-canvas"><canvas ref={ref} role="img" aria-label="Momentum probability density. Mean momentum and uncertainty are listed in the measurements panel."/></div>;
}

export function SpaceTimePlot({rows,a,version}:{rows:HistoryRow[];a:Runtime;version:number}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const canvas=ref.current;if(!canvas)return;canvas.width=800;canvas.height=170;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f7faf8';ctx.fillRect(0,0,800,170);
    let peak=.1;for(const row of rows)for(const value of row.density)peak=Math.max(peak,value);const left=49,w=702,h=126;
    rows.forEach((row,j)=>{for(let i=0;i<row.density.length;i++){const alpha=Math.pow(row.density[i]/peak,.55);ctx.fillStyle=`rgba(22,133,119,${alpha})`;ctx.fillRect(left+i/row.density.length*w,12+j/Math.max(1,rows.length)*h,w/row.density.length+1,h/Math.max(1,rows.length)+1);}});
    ctx.font=font;ctx.fillStyle='#76847c';ctx.textAlign='left';ctx.fillText(rows.length?`t ${rows[0].time.toFixed(2)}`:'Run to record density',left,157);ctx.textAlign='right';ctx.fillText(`→ ${a.state.time.toFixed(2)} · latest 180 samples`,751,157);
  },[rows,a,version]);
  return <div className="history-canvas"><canvas ref={ref} role="img" aria-label="Rolling position-time map. Earlier samples at top, current samples at bottom. Color intensity represents probability density."/></div>;
}
