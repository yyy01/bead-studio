import {clamp} from './color.mjs';
// Separable antialiased Lanczos-3, with local range clipping to limit halos.
export function lanczosCells(data,sw,sh,w,h,base,{fit='contain',linearLight=false}={}){
 const scale=fit==='cover'?Math.max(w/sw,h/sh):Math.min(w/sw,h/sh),ox=(w-sw*scale)/2,oy=(h-sh*scale)/2,rate=Math.min(1,scale),radius=3/rate;
 const sinc=x=>Math.abs(x)<1e-10?1:Math.sin(Math.PI*x)/(Math.PI*x),kernel=x=>Math.abs(x)>=3?0:sinc(x)*sinc(x/3);
 function taps(n,source,offset){return Array.from({length:n},(_,p)=>{const center=(p+.5-offset)/scale-.5,list=[];let sum=0;for(let s=Math.max(0,Math.ceil(center-radius));s<=Math.min(source-1,Math.floor(center+radius));s++){const weight=kernel((s-center)*rate);list.push([s,weight]);sum+=weight}return list.map(([s,v])=>[s,Math.abs(sum)>1e-9?v/sum:0])})}
 const tx=taps(w,sw,ox),ty=taps(h,sh,oy),temp=new Float64Array(w*sh*4),encode=v=>linearLight?(v<=.04045?v/12.92:((v+.055)/1.055)**2.4):v,decode=v=>linearLight?(v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055):v;
 for(let y=0;y<sh;y++)for(let x=0;x<w;x++){const at=(y*w+x)*4;for(const [sx,weight]of tx[x]){const k=(y*sw+sx)*4,a=data[k+3]/255;for(let c=0;c<3;c++)temp[at+c]+=encode(data[k+c]/255)*a*weight;temp[at+3]+=a*weight}}
 return base.map((value,i)=>{if(!value)return null;const x=i%w,y=Math.floor(i/w),sum=[0,0,0,0];for(const [sy,weight]of ty[y]){const k=(sy*w+x)*4;for(let c=0;c<4;c++)sum[c]+=temp[k+c]*weight}if(sum[3]<.01)return value;
  const rgb=sum.slice(0,3).map(v=>clamp(decode(v/sum[3])*255,0,255)),centerX=(x+.5-ox)/scale-.5,centerY=(y+.5-oy)/scale-.5,lo=[255,255,255],hi=[0,0,0];
  // Restrict each channel to the original footprint; no newly invented overshoot.
  for(let yy=Math.max(0,Math.floor(centerY-.5/scale));yy<=Math.min(sh-1,Math.ceil(centerY+.5/scale));yy++)for(let xx=Math.max(0,Math.floor(centerX-.5/scale));xx<=Math.min(sw-1,Math.ceil(centerX+.5/scale));xx++){const k=(yy*sw+xx)*4;if(data[k+3]<32)continue;for(let c=0;c<3;c++){lo[c]=Math.min(lo[c],data[k+c]);hi[c]=Math.max(hi[c],data[k+c])}}
  return rgb.map((v,c)=>Math.round(lo[c]<=hi[c]?clamp(v,lo[c],hi[c]):v));
 });
}
