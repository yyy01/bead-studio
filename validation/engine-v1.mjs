// Independently implemented. Color formulas: Ottosson Oklab and Sharma et al. CIEDE2000.
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};
const LINEAR=Float64Array.from({length:256},(_,i)=>linear(i));
export const gamma=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055);
export function oklab(rgb){const [r,g,b]=rgb.map(linear),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s]}
export function cielab(rgb){const [r,g,b]=rgb.map(linear),f=t=>t>216/24389?Math.cbrt(t):t*841/108+4/29;const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047),y=f(.2126729*r+.7151522*g+.072175*b),z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);return [116*y-16,500*(x-y),200*(y-z)]}
export const dist2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
export function deltaE(a,b){
 const rad=Math.PI/180,deg=180/Math.PI,[L1,a1,b1]=a,[L2,a2,b2]=b,C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),C=(C1+C2)/2,G=.5*(1-Math.sqrt(C**7/(C**7+25**7))),ap1=(1+G)*a1,ap2=(1+G)*a2,cp1=Math.hypot(ap1,b1),cp2=Math.hypot(ap2,b2),h=(x,y)=>{const t=Math.atan2(y,x)*deg;return t<0?t+360:t},h1=cp1===0?0:h(ap1,b1),h2=cp2===0?0:h(ap2,b2),dL=L2-L1,dC=cp2-cp1;
 let dh=h2-h1;if(cp1*cp2===0)dh=0;else if(dh>180)dh-=360;else if(dh< -180)dh+=360;
 const dH=2*Math.sqrt(cp1*cp2)*Math.sin(dh*rad/2),lb=(L1+L2)/2,cb=(cp1+cp2)/2;
 let hb=h1+h2;if(cp1*cp2===0)hb=h1+h2;else if(Math.abs(h1-h2)<=180)hb/=2;else if(hb<360)hb=(hb+360)/2;else hb=(hb-360)/2;
 const T=1-.17*Math.cos((hb-30)*rad)+.24*Math.cos(2*hb*rad)+.32*Math.cos((3*hb+6)*rad)-.20*Math.cos((4*hb-63)*rad),sl=1+.015*(lb-50)**2/Math.sqrt(20+(lb-50)**2),sc=1+.045*cb,sh=1+.015*cb*T,rt=-2*Math.sqrt(cb**7/(cb**7+25**7))*Math.sin(60*Math.exp(-(((hb-275)/25)**2))*rad);
 return Math.sqrt(Math.max(0,(dL/sl)**2+(dC/sc)**2+(dH/sh)**2+rt*(dC/sc)*(dH/sh)));
}
export const hexRGB=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export function preparePalette(p){return p.map(c=>({...c,rgb:hexRGB(c.hex),ok:oklab(hexRGB(c.hex)),lab:cielab(hexRGB(c.hex))}))}
export function detectMode(data,w,h){const bins=new Set();let same=0,total=0;const step=Math.max(1,Math.floor(w*h/4096));for(let i=0;i<w*h;i+=step){const k=i*4;if(data[k+3]<128)continue;bins.add((data[k]>>3)*1024+(data[k+1]>>3)*32+(data[k+2]>>3));if(i%w&&k>=4){total++;if(Math.abs(data[k]-data[k-4])+Math.abs(data[k+1]-data[k-3])+Math.abs(data[k+2]-data[k-2])<10)same++}}return bins.size<96||same/Math.max(1,total)>.72?'illustration':'photo'}
export function resample(data,sw,sh,w,h,{mode='photo',fit='contain',alpha=.25}={}){
 const scale=fit==='cover'?Math.max(w/sw,h/sh):Math.min(w/sw,h/sh),ox=(w-sw*scale)/2,oy=(h-sh*scale)/2,out=new Array(w*h).fill(null);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const x0=(x-ox)/scale,x1=(x+1-ox)/scale,y0=(y-oy)/scale,y1=(y+1-oy)/scale;
  if(mode==='pixel'){const sx=Math.floor((x+.5-ox)/scale),sy=Math.floor((y+.5-oy)/scale);if(sx<0||sy<0||sx>=sw||sy>=sh)continue;const k=(sy*sw+sx)*4;if(data[k+3]/255>=alpha)out[y*w+x]=[data[k],data[k+1],data[k+2]];continue}
  let sums=[0,0,0],weight=0;const bins=mode==='illustration'?new Map():null;
  for(let sy=Math.max(0,Math.floor(y0));sy<Math.min(sh,Math.ceil(y1));sy++)for(let sx=Math.max(0,Math.floor(x0));sx<Math.min(sw,Math.ceil(x1));sx++){
   const k=(sy*sw+sx)*4,a=data[k+3]/255,area=Math.max(0,Math.min(x1,sx+1)-Math.max(x0,sx))*Math.max(0,Math.min(y1,sy+1)-Math.max(y0,sy)),wt=a*area;if(!wt)continue;weight+=wt;
   for(let c=0;c<3;c++)sums[c]+=LINEAR[data[k+c]]*wt;
   if(bins){const key=(data[k]>>4)*256+(data[k+1]>>4)*16+(data[k+2]>>4);let b=bins.get(key);if(!b){b=[0,0,0,0];bins.set(key,b)}b[0]+=wt;for(let c=0;c<3;c++)b[c+1]+=LINEAR[data[k+c]]*wt;}
  }
  if(weight/((x1-x0)*(y1-y0))<alpha||weight===0)continue;
  if(bins){let best=null;for(const b of bins.values())if(!best||b[0]>best[0])best=b;sums=best.slice(1);weight=best[0]}
  out[y*w+x]=sums.map(v=>clamp(Math.round(gamma(v/weight)),0,255));
 }return out;
}
export function removeEdgeBackground(data,w,h,tolerance=28){
 const out=new Uint8ClampedArray(data),corners=[0,w-1,(h-1)*w,w*h-1],rgb=corners.map(i=>Array.from(data.slice(i*4,i*4+3))),base=rgb.find(c=>rgb.filter(d=>dist2(c,d)<tolerance*tolerance).length>=3);if(!base)return out;
 const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let start=0,end=0;
 const add=i=>{if(seen[i])return;seen[i]=1;const k=i*4;if(data[k+3]<32||dist2(base,[data[k],data[k+1],data[k+2]])<=tolerance*tolerance){queue[end++]=i;out[k+3]=0}};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x)}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1)}
 while(start<end){const i=queue[start++],x=i%w,y=Math.floor(i/w);if(x) add(i-1);if(x<w-1)add(i+1);if(y)add(i-w);if(y<h-1)add(i+w)}return out;
}
function histogram(cells){const bins=new Map();for(const rgb of cells){if(!rgb)continue;const key=(rgb[0]>>4)*256+(rgb[1]>>4)*16+(rgb[2]>>4);let b=bins.get(key);if(!b){b={weight:0,sum:[0,0,0]};bins.set(key,b)}b.weight++;const v=oklab(rgb);for(let c=0;c<3;c++)b.sum[c]+=v[c]}return [...bins.values()].map(b=>({weight:b.weight,ok:b.sum.map(v=>v/b.weight)}))}
export function chooseColors(cells,palette,maxColors,iterations=4,returnCandidates=false){
 const hist=histogram(cells),H=hist.length,C=palette.length,k=Math.max(1,Math.min(C,Math.floor(maxColors)));if(!H)return returnCandidates?{initial:[],refined:[]}:[];
 const D=new Float32Array(H*C);for(let c=0;c<C;c++)for(let i=0;i<H;i++)D[c*H+i]=dist2(hist[i].ok,palette[c].ok);
 const selected=[],best=new Float32Array(H).fill(Infinity);
 for(let n=0;n<k;n++){let chosen=-1,minCost=Infinity;for(let c=0;c<C;c++){if(selected.includes(c))continue;let cost=0;for(let i=0;i<H;i++)cost+=hist[i].weight*Math.min(best[i],D[c*H+i]);if(cost<minCost){chosen=c;minCost=cost}}if(chosen<0)break;let gain=0;for(let i=0;i<H;i++){gain+=hist[i].weight*(best[i]-Math.min(best[i],D[chosen*H+i]));best[i]=Math.min(best[i],D[chosen*H+i])}selected.push(chosen);if(n&&gain<1e-9)break;}
 const initial=selected.map(i=>palette[i]);
 // Constrained Lloyd refinement: every centroid snaps to a real bead color.
 for(let it=0;it<iterations;it++){
  const sums=selected.map(()=>[0,0,0,0]);for(let i=0;i<H;i++){let win=0,d=Infinity;for(let j=0;j<selected.length;j++){const z=D[selected[j]*H+i];if(z<d){d=z;win=j}}const s=sums[win],wt=hist[i].weight;s[3]+=wt;for(let c=0;c<3;c++)s[c]+=hist[i].ok[c]*wt}
  const next=selected.map((old,j)=>{const s=sums[j];if(!s[3])return old;const mean=s.slice(0,3).map(v=>v/s[3]);let win=old,min=Infinity;for(let c=0;c<C;c++){const d=dist2(mean,palette[c].ok);if(d<min){min=d;win=c}}return win});const unique=[...new Set(next)];if(unique.join()===selected.join())break;selected.splice(0,selected.length,...unique);
 }
 const refined=selected.map(i=>palette[i]);return returnCandidates?{initial,refined}:refined;
}
export function mapCells(cells,palette,w,h,{metric='deltaE',dither=0,cleanup=false}={}){
 const out=new Int16Array(cells.length).fill(-1),err=new Float32Array(cells.length*3),cache=new Map();if(!palette.length)return out;
 for(let y=0;y<h;y++){const dir=y%2?-1:1;for(let xx=0;xx<w;xx++){const x=dir===1?xx:w-1-xx,i=y*w+x,src=cells[i];if(!src)continue;
  const rgb=dither?src.map((v,c)=>clamp(v+err[i*3+c],0,255)):src,key=rgb.join(',');let win=cache.get(key);
  if(win===undefined){const value=metric==='rgb'?rgb:metric==='oklab'?oklab(rgb):cielab(rgb);let min=Infinity;win=0;for(let j=0;j<palette.length;j++){const d=metric==='deltaE'?deltaE(value,palette[j].lab):dist2(value,metric==='rgb'?palette[j].rgb:palette[j].ok);if(d<min){min=d;win=j}}if(!dither)cache.set(key,win)}out[i]=win;
  if(dither){const dif=rgb.map((v,c)=>clamp(v-palette[win].rgb[c],-64,64)*dither),neighbors=[[x+dir,y,7],[x-dir,y+1,3],[x,y+1,5],[x+dir,y+1,1]];for(const [nx,ny,wt]of neighbors){if(nx<0||nx>=w||ny>=h)continue;const ni=ny*w+nx;if(!cells[ni])continue;for(let c=0;c<3;c++)err[ni*3+c]+=dif[c]*wt/16}}
 }}
 if(cleanup){const copy=out.slice();for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,current=copy[i];if(current<0)continue;const counts=new Map();let matching=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const v=copy[(y+dy)*w+x+dx];if(v===current)matching++;if(v>=0)counts.set(v,(counts.get(v)||0)+1)}if(matching)continue;for(const [v,n]of counts)if(n>=6&&dist2(palette[v].ok,oklab(cells[i]))-dist2(palette[current].ok,oklab(cells[i]))<.0015){out[i]=v;break}}}return out;
}
export function processImage({data,sw,sh,width,height,palette,mode='auto',maxColors=24,metric='deltaE',fit='contain',dither=0,cleanup=false,removeBackground=false,iterations=4}){
 const begin=performance.now();if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>256||height>256)throw Error('图纸尺寸需为 1–256 的整数');
 if(!sw||!sh||data.length!==sw*sh*4)throw Error('图片数据不完整');if(!palette?.length)throw Error('色卡不能为空');
 const p=preparePalette(palette),resolvedMode=mode==='auto'?detectMode(data,sw,sh):mode,input=removeBackground?removeEdgeBackground(data,sw,sh):data,cells=resample(input,sw,sh,width,height,{mode:resolvedMode,fit}),candidates=chooseColors(cells,p,maxColors,iterations,true);
 const score=(indices,colors)=>{let sum=0;const cache=new Map();for(let i=0;i<indices.length;i++){const j=indices[i];if(j<0)continue;const key=cells[i].join(',')+':'+j;let e=cache.get(key);if(e===undefined){e=deltaE(cielab(cells[i]),colors[j].lab);cache.set(key,e)}sum+=e}return sum};
 let chosen=candidates.refined,indices=mapCells(cells,chosen,width,height,{metric}),refinementAccepted=true;
 // Lloyd optimizes squared Oklab, not final DeltaE00. Keep it only if the
 // actual sampled image's DeltaE00 does not regress. No proxy-only acceptance.
 if(candidates.initial.map(c=>c.code).join('|')!==chosen.map(c=>c.code).join('|')){const oldIndices=mapCells(cells,candidates.initial,width,height,{metric});if(score(oldIndices,candidates.initial)<score(indices,chosen)){chosen=candidates.initial;indices=oldIndices;refinementAccepted=false}}
 if(dither||cleanup)indices=mapCells(cells,chosen,width,height,{metric,dither,cleanup});
 const counts=new Array(chosen.length).fill(0);let total=0;for(const i of indices)if(i>=0){counts[i]++;total++}const error=score(indices,chosen);
 return {width,height,palette:chosen,indices,counts,total,mode:resolvedMode,refinementAccepted,meanDeltaE:total?error/total:0,elapsed:performance.now()-begin};
}
