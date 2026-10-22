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
export function detectMode(data,w,h){
 const exact=new Set();let flat=0,total=0;const step=Math.max(1,Math.floor(w*h/4096));
 for(let i=0;i<w*h;i+=step){const k=i*4;if(data[k+3]<128)continue;exact.add(data[k]*65536+data[k+1]*256+data[k+2]);
  for(const j of [i%w?i-1:-1,i>=w?i-w:-1]){if(j<0||data[j*4+3]<128)continue;total++;if(Math.abs(data[k]-data[j*4])+Math.abs(data[k+1]-data[j*4+1])+Math.abs(data[k+2]-data[j*4+2])<=2)flat++}}
 return exact.size<=128&&(exact.size<=32||flat/Math.max(1,total)>.8)?'illustration':'photo';
}
export function fromOklab([L,a,b]){
 const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
 return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s].map(v=>clamp(gamma(Math.max(0,v)),0,255));
}
// A bounded bilateral / local-contrast pipeline, inspired by edge-aware image
// abstraction research. This is not a reproduction of the cited paper's EM solver.
export function preparePhoto(cells,w,h,{detail=.65,smoothing=.45,contrast=1.04,saturation=1.05}={}){
 detail=clamp(detail,0,1.5);smoothing=clamp(smoothing);contrast=clamp(contrast,.6,1.6);saturation=clamp(saturation,0,1.8);
 const lab=cells.map(c=>c?oklab(c):null),smooth=lab.map((v,i)=>{
  if(!v)return null;const x=i%w,y=Math.floor(i/w),sum=[0,0,0];let wt=0;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const n=lab[yy*w+xx];if(!n)continue;
   const weight=Math.exp(-(dx*dx+dy*dy)/2.8-dist2(v,n)/(.075*.075*2));wt+=weight;for(let c=0;c<3;c++)sum[c]+=n[c]*weight}
  return sum.map((c,j)=>v[j]*(1-smoothing)+c/wt*smoothing);
 });
 return smooth.map((v,i)=>{if(!v)return null;const x=i%w,y=Math.floor(i/w);let blur=0,wt=0,min=1,max=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const n=smooth[yy*w+xx];if(!n)continue;const weight=(dx===0?2:1)*(dy===0?2:1);blur+=n[0]*weight;wt+=weight;min=Math.min(min,n[0]);max=Math.max(max,n[0])}
  const high=v[0]-blur/wt,threshold=.006,amount=Math.sign(high)*Math.max(0,Math.abs(high)-threshold),L=clamp((clamp(v[0]+amount*detail,min-.015,max+.015)-.5)*contrast+.5);
  return fromOklab([L,v[1]*saturation,v[2]*saturation]).map(Math.round);
 });
}
export function structureWeights(cells,w,h){const lab=cells.map(c=>c?oklab(c):null);return lab.map((v,i)=>{if(!v)return 0;const x=i%w,y=Math.floor(i/w);let g=0,n=0;for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&lab[j]){g+=Math.sqrt(dist2(v,lab[j]));n++}return 1+Math.min(1.5,g/Math.max(1,n)*8)})}
export function smoothPhotoLabels(cells,palette,indices,w,h,amount=.45){
 const out=indices.slice();if(!amount||!palette.length)return out;const ok=cells.map(c=>c?oklab(c):null),labs=cells.map(c=>c?cielab(c):null),cache=new Map();
 const cost=(i,j)=>{const key=cells[i].join(',')+':'+j;let d=cache.get(key);if(d===undefined){d=deltaE(labs[i],palette[j].lab)**2;cache.set(key,d)}return d};
 for(let pass=0;pass<2;pass++)for(let q=0;q<out.length;q++){const i=pass%2?out.length-1-q:q;if(out[i]<0)continue;const x=i%w,y=Math.floor(i/w),neighbors=[];
  for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&out[j]>=0)neighbors.push([j,Math.exp(-dist2(ok[i],ok[j])/(2*.035**2))]);
  const candidates=new Set([out[i],...neighbors.map(([j])=>out[j])]);let win=out[i],best=Infinity;
  for(const c of candidates){let e=cost(i,c);for(const [j,weight]of neighbors)if(c!==out[j])e+=amount*14*weight;if(e<best){best=e;win=c}}out[i]=win;
 }return out;
}
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
function histogram(cells,weights=null){const bins=new Map();for(let i=0;i<cells.length;i++){const rgb=cells[i];if(!rgb)continue;const key=(rgb[0]>>4)*256+(rgb[1]>>4)*16+(rgb[2]>>4);let b=bins.get(key);if(!b){b={weight:0,sum:[0,0,0]};bins.set(key,b)}const weight=weights?weights[i]:1;b.weight+=weight;const v=oklab(rgb);for(let c=0;c<3;c++)b.sum[c]+=v[c]*weight}return [...bins.values()].map(b=>({weight:b.weight,ok:b.sum.map(v=>v/b.weight)}))}
export function chooseColors(cells,palette,maxColors,iterations=4,returnCandidates=false,weights=null){
 const hist=histogram(cells,weights),H=hist.length,C=palette.length,k=Math.max(1,Math.min(C,Math.floor(maxColors)));if(!H)return returnCandidates?{initial:[],refined:[]}:[];
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
export function choosePhotoColors(cells,palette,maxColors,weights=null){
 const histogramAt=shift=>{const bins=new Map();for(let i=0;i<cells.length;i++){const rgb=cells[i];if(!rgb)continue;const key=rgb.map(c=>c>>shift).join(','),weight=weights?weights[i]:1;let b=bins.get(key);if(!b){b={weight:0,sum:[0,0,0]};bins.set(key,b)}b.weight+=weight;const lab=cielab(rgb);for(let j=0;j<3;j++)b.sum[j]+=lab[j]*weight}return [...bins.values()].map(b=>({weight:b.weight,lab:b.sum.map(v=>v/b.weight)}))};
 let hist=histogramAt(3);if(hist.length>4096)hist=histogramAt(4);if(!hist.length)return{initial:[],refined:[]};
 const monochrome=cells.filter(Boolean).every(c=>Math.max(...c)-Math.min(...c)<=3),neutral=palette.filter(c=>Math.hypot(c.lab[1],c.lab[2])<7);if(monochrome&&neutral.length>=2)palette=neutral;
 const H=hist.length,C=palette.length,k=Math.max(1,Math.min(C,Math.floor(maxColors))),D=new Float32Array(H*C);
 for(let c=0;c<C;c++)for(let i=0;i<H;i++)D[c*H+i]=deltaE(hist[i].lab,palette[c].lab)**2;
 const selected=[],best=new Float32Array(H).fill(Infinity);
 for(let n=0;n<k;n++){let win=-1,min=Infinity;for(let c=0;c<C;c++){if(selected.includes(c))continue;let cost=0;for(let i=0;i<H;i++)cost+=hist[i].weight*Math.min(best[i],D[c*H+i]);if(cost<min){min=cost;win=c}}if(win<0)break;let gain=0;for(let i=0;i<H;i++){gain+=hist[i].weight*(best[i]-Math.min(best[i],D[win*H+i]));best[i]=Math.min(best[i],D[win*H+i])}selected.push(win);if(n&&gain<1e-6)break}
 const initial=selected.map(i=>palette[i]);
 for(let pass=0;pass<3;pass++){const groups=selected.map(()=>[]);for(let i=0;i<H;i++){let win=0,min=Infinity;for(let j=0;j<selected.length;j++){const d=D[selected[j]*H+i];if(d<min){min=d;win=j}}groups[win].push(i)}
  const next=selected.map((old,j)=>{if(!groups[j].length)return old;let win=old,min=Infinity;for(let c=0;c<C;c++){let cost=0;for(const i of groups[j])cost+=hist[i].weight*D[c*H+i];if(cost<min){min=cost;win=c}}return win});const unique=[...new Set(next)];if(unique.join()===selected.join())break;selected.splice(0,selected.length,...unique);
 }return{initial,refined:selected.map(i=>palette[i])};
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
export function processImage({data,sw,sh,width,height,palette,mode='auto',maxColors=24,metric='deltaE',fit='contain',dither=0,cleanup=false,removeBackground=false,iterations=4,photoStyle='enhanced',detail=.65,smoothing=.45,contrast=1.04,saturation=1.05}){
 const begin=performance.now();if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>256||height>256)throw Error('图纸尺寸需为 1–256 的整数');
 if(!sw||!sh||data.length!==sw*sh*4)throw Error('图片数据不完整');if(!palette?.length)throw Error('色卡不能为空');
 const p=preparePalette(palette),resolvedMode=mode==='auto'?detectMode(data,sw,sh):mode,input=removeBackground?removeEdgeBackground(data,sw,sh):data,reference=resample(input,sw,sh,width,height,{mode:resolvedMode,fit}),enhanced=resolvedMode==='photo'&&photoStyle==='enhanced',cells=enhanced?preparePhoto(reference,width,height,{detail,smoothing,contrast,saturation}):reference,weights=enhanced?structureWeights(cells,width,height):null,candidates=resolvedMode==='photo'?choosePhotoColors(cells,p,maxColors,weights):chooseColors(cells,p,maxColors,iterations,true,weights);
 const score=(indices,colors)=>{let sum=0;const cache=new Map();for(let i=0;i<indices.length;i++){const j=indices[i];if(j<0)continue;const key=cells[i].join(',')+':'+j;let e=cache.get(key);if(e===undefined){e=deltaE(cielab(cells[i]),colors[j].lab);cache.set(key,e)}sum+=e}return sum};
 let chosen=candidates.refined,indices=mapCells(cells,chosen,width,height,{metric}),refinementAccepted=true;
 // Lloyd optimizes squared Oklab, not final DeltaE00. Keep it only if the
 // actual sampled image's DeltaE00 does not regress. No proxy-only acceptance.
 if(candidates.initial.map(c=>c.code).join('|')!==chosen.map(c=>c.code).join('|')){const oldIndices=mapCells(cells,candidates.initial,width,height,{metric});if(score(oldIndices,candidates.initial)<score(indices,chosen)){chosen=candidates.initial;indices=oldIndices;refinementAccepted=false}}
 if(dither||cleanup)indices=mapCells(cells,chosen,width,height,{metric,dither,cleanup});
 if(enhanced&&!dither)indices=smoothPhotoLabels(cells,chosen,indices,width,height,smoothing);
 const counts=new Array(chosen.length).fill(0);let total=0;for(const i of indices)if(i>=0){counts[i]++;total++}const error=score(indices,chosen);
 return {width,height,palette:chosen,indices,counts,total,mode:resolvedMode,photoStyle:enhanced?'enhanced':'faithful',refinementAccepted,meanDeltaE:total?error/total:0,elapsed:performance.now()-begin};
}
