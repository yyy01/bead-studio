import {cielab,deltaE,clamp,oklab} from './color.mjs';
const EPS=1e-6;
export const photoUnary=(a,b,luma=.5)=>deltaE(a,b)**2+luma*(a[0]-b[0])**2;

export function photoSource(cells,w,h){
 const ids=new Int32Array(cells.length).fill(-1),colors=[],labs=[],lookup=new Map();
 for(let i=0;i<cells.length;i++){const c=cells[i];if(!c)continue;const key=c.join(',');let id=lookup.get(key);if(id===undefined){id=colors.length;lookup.set(key,id);colors.push(c);labs.push(cielab(c))}ids[i]=id}
 const L=new Float64Array(cells.length);for(let i=0;i<L.length;i++)if(ids[i]>=0)L[i]=labs[ids[i]][0];
 return {cells,ids,colors,labs,L,w,h};
}
export function buildPhotoField(cells,palette,w,h,{lumaWeight=.5,weights=null,source=null}={}){
 source??=photoSource(cells,w,h);const k=palette.length,table=new Float64Array(source.colors.length*k),PL=Float64Array.from(palette,c=>c.lab[0]);
 for(let id=0;id<source.labs.length;id++)for(let c=0;c<k;c++)table[id*k+c]=photoUnary(source.labs[id],palette[c].lab,lumaWeight);
 const W=weights?Float64Array.from(weights):new Float64Array(cells.length).fill(1),edgeScale=lumaWeight*.35;
 return {...source,palette,k,table,PL,W,lumaWeight,edgeScale};
}
const unary=(f,i,c)=>f.table[f.ids[i]*f.k+c]*f.W[i];
const pair=(f,i,j,a,b)=>{const d=(f.PL[a]-f.PL[b])-(f.L[i]-f.L[j]);return f.edgeScale*(f.W[i]+f.W[j])*.5*d*d};
function neighbors(f,i){const x=i%f.w,y=Math.floor(i/f.w);return [x?i-1:-1,x<f.w-1?i+1:-1,y?i-f.w:-1,y<f.h-1?i+f.w:-1].filter(j=>j>=0&&f.ids[j]>=0)}
export function localPhotoEnergy(f,indices,i,c){let cost=unary(f,i,c);for(const j of neighbors(f,i))if(indices[j]>=0)cost+=pair(f,i,j,c,indices[j]);return cost}
export function photoEnergy(f,indices){
 let sum=0;for(let i=0;i<indices.length;i++){const a=indices[i];if(a<0)continue;sum+=unary(f,i,a);if(i%f.w<f.w-1&&indices[i+1]>=0)sum+=pair(f,i,i+1,a,indices[i+1]);if(i+f.w<indices.length&&indices[i+f.w]>=0)sum+=pair(f,i,i+f.w,a,indices[i+f.w])}return sum;
}
export function solvePhotoField(f,{seed=null,maxPasses=6}={}){
 const indices=seed?Int16Array.from(seed):new Int16Array(f.ids.length).fill(-1);
 if(!seed)for(let i=0;i<indices.length;i++){if(f.ids[i]<0)continue;let win=0,best=Infinity;for(let c=0;c<f.k;c++){const v=unary(f,i,c);if(v<best){best=v;win=c}}indices[i]=win}
 const energyTrace=[photoEnergy(f,indices)];let passes=0;
 for(let pass=0;pass<maxPasses;pass++){
  let changed=0;for(let q=0;q<indices.length;q++){const i=pass%2?indices.length-1-q:q;if(indices[i]<0)continue;
   const ns=neighbors(f,i);let a=0,b=0;for(const j of ns){const wt=f.edgeScale*(f.W[i]+f.W[j])*.5,target=f.PL[indices[j]]+(f.L[i]-f.L[j]);a+=wt;b+=wt*target}
   let win=indices[i],best=unary(f,i,win)+a*f.PL[win]**2-2*b*f.PL[win];
   for(let c=0;c<f.k;c++){if(c===indices[i])continue;const cost=unary(f,i,c)+a*f.PL[c]**2-2*b*f.PL[c];if(cost<best-EPS){best=cost;win=c}}
   if(win!==indices[i]){indices[i]=win;changed++}
  }
  passes++;const energy=photoEnergy(f,indices);energyTrace.push(energy);if(!changed)break;
  if(energyTrace.at(-2)-energy<Math.max(EPS,energy*1e-9))break;
 }
 return {indices,energy:energyTrace.at(-1),energyTrace,passes};
}

function compact(palette,indices){
 const unique=[],lookup=new Map(),remap=[];
 palette.forEach((c,i)=>{const key=c.code+'|'+c.hex;let j=lookup.get(key);if(j===undefined){j=unique.length;unique.push(c);lookup.set(key,j)}remap[i]=j});
 return {palette:unique,indices:Int16Array.from(indices,i=>i<0?-1:remap[i])};
}
export function refinePhotoPalette(f,indices,brandPalette){
 const palette=f.palette.map(c=>({...c}));let changes=0;
 for(let c=0;c<f.k;c++){
  const histogram=new Map(),sum=[0,0,0];let total=0,a=0,b=0;
  for(let i=0;i<indices.length;i++)if(indices[i]===c){const id=f.ids[i],weight=f.W[i];histogram.set(id,(histogram.get(id)||0)+weight);total+=weight;for(let d=0;d<3;d++)sum[d]+=f.labs[id][d]*weight;
   for(const j of neighbors(f,i))if(indices[j]!==c){const wt=f.edgeScale*(f.W[i]+f.W[j])*.5,target=palette[indices[j]].lab[0]+f.L[i]-f.L[j];a+=wt;b+=wt*target}
  }
  if(!total)continue;const mean=sum.map(v=>v/total),ranked=brandPalette.map(p=>({p,cost:photoUnary(mean,p.lab,f.lumaWeight)})).sort((x,y)=>x.cost-y.cost).slice(0,8).map(x=>x.p),options=[palette[c],...ranked];
  const cost=p=>{let value=a*p.lab[0]**2-2*b*p.lab[0];for(const [id,wt]of histogram)value+=wt*photoUnary(f.labs[id],p.lab,f.lumaWeight);return value};
  let win=palette[c],best=cost(win);for(const p of options){const v=cost(p);if(v<best-EPS){best=v;win=p}}
  if(win.code!==palette[c].code||win.hex!==palette[c].hex){palette[c]=win;changes++}
 }
 return {...compact(palette,indices),changes};
}
export function optimizePhoto(cells,palette,w,h,{lumaWeight=.5,weights=null,jointPalette=true,maxPasses=6,brandPalette=palette}={}){
 if(!palette.length)return {palette:[],indices:new Int16Array(cells.length).fill(-1),energy:0,energyTrace:[0],passes:0,jointChanges:0};
 let field=buildPhotoField(cells,palette,w,h,{lumaWeight,weights}),solved=solvePhotoField(field,{maxPasses}),jointChanges=0;
 if(jointPalette){const refined=refinePhotoPalette(field,solved.indices,brandPalette);if(refined.changes){const nextField=buildPhotoField(cells,refined.palette,w,h,{lumaWeight,weights,source:field}),next=solvePhotoField(nextField,{seed:refined.indices,maxPasses});if(next.energy<=solved.energy+EPS){jointChanges=refined.changes;solved={...next,energyTrace:[...solved.energyTrace,...next.energyTrace],passes:solved.passes+next.passes};field=nextField}}}
 return {...solved,palette:field.palette,jointChanges};
}
export function ditherPhoto(f,base,strength=.7){
 strength=clamp(strength);const indices=base.slice(),errors=new Float64Array(base.length*3);
 for(let y=0;y<f.h;y++){const direction=y%2?-1:1;for(let xx=0;xx<f.w;xx++){const x=direction===1?xx:f.w-1-xx,i=y*f.w+x;if(f.ids[i]<0)continue;
  const rgb=f.cells[i].map((v,c)=>clamp(v+errors[i*3+c],0,255)),lab=cielab(rgb),ns=neighbors(f,i);let win=base[i],best=Infinity;
  for(let c=0;c<f.k;c++){let cost=photoUnary(lab,f.palette[c].lab,f.lumaWeight)*f.W[i];for(const j of ns)cost+=pair(f,i,j,c,base[j]);if(cost<best){best=cost;win=c}}
  indices[i]=win;const error=rgb.map((v,c)=>clamp(v-f.palette[win].rgb[c],-64,64)*strength);
  for(const [nx,ny,weight]of [[x+direction,y,7],[x-direction,y+1,3],[x,y+1,5],[x+direction,y+1,1]]){if(nx<0||nx>=f.w||ny>=f.h)continue;const j=ny*f.w+nx;if(f.ids[j]<0)continue;for(let c=0;c<3;c++)errors[j*3+c]+=error[c]*weight/16}
 }}return indices;
}
export function cleanupPhoto(f,input){
 const out=input.slice(),copy=input.slice();for(let y=1;y<f.h-1;y++)for(let x=1;x<f.w-1;x++){const i=y*f.w+x,c=copy[i];if(c<0)continue;let same=0;const counts=new Map();
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const j=copy[(y+dy)*f.w+x+dx];if(j===c)same++;if(j>=0)counts.set(j,(counts.get(j)||0)+1)}if(same)continue;
  for(const [target,n]of counts)if(n>=6&&localPhotoEnergy(f,out,i,target)<=localPhotoEnergy(f,out,i,c)+EPS){out[i]=target;break}
 }return out;
}
export function importanceWeights(cells,w,h,strength=.4){
 strength=clamp(strength);const colors=cells.map(c=>c?oklab(c):null),out=new Float64Array(cells.length).fill(1);
 for(let i=0;i<cells.length;i++){const v=colors[i];if(!v){out[i]=0;continue}const x=i%w,y=Math.floor(i/w);let sum=[0,0,0],n=0;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const c=colors[yy*w+xx];if(!c)continue;for(let d=0;d<3;d++)sum[d]+=c[d];n++}
  const contrast=Math.hypot(...sum.map((c,d)=>c/n-v[d]));out[i]=1+strength*Math.min(1.5,contrast*8);
 }return out;
}
