import fs from 'node:fs';import {processImage as previous} from './engine-v1.mjs';import {processImage,cielab,deltaE,resample} from '../dist/engine.mjs';
const palette=JSON.parse(fs.readFileSync('dist/palettes.json')).palettes.mard,rows=[];fs.mkdirSync('validation/photo-results',{recursive:true});
for(const name of ['astronaut','chelsea','coffee','camera','rocket']){
 const {sw,sh}=JSON.parse(fs.readFileSync(`fixtures/${name}.json`)),data=new Uint8ClampedArray(fs.readFileSync(`fixtures/${name}.rgba`));
 for(const size of [29,48,96,128])for(const k of [16,32]){
  const reference=resample(data,sw,sh,size,size,{mode:'photo'}),refLabs=reference.map(c=>c?cielab(c):null);
  for(const style of ['previous','faithful','enhanced']){
   const t=performance.now(),r=(style==='previous'?previous:processImage)({data,sw,sh,width:size,height:size,palette,maxColors:k,mode:'photo',photoStyle:style});let error=0,n=0;const pixels=new Uint8Array(size*size*4);
   for(let i=0;i<r.indices.length;i++){const p=r.indices[i];if(p>=0){const c=r.palette[p];pixels.set([...c.rgb,255],i*4);error+=deltaE(refLabs[i],c.lab);n++}}
   const ms=performance.now()-t;fs.writeFileSync(`validation/photo-results/${name}-${size}-${k}-${style}.rgba`,pixels);rows.push({name,size,k,style,meanDeltaE:error/n,ms,colors:r.counts.filter(Boolean).length});
  }
 }
}
fs.writeFileSync('validation/photo-results.json',JSON.stringify({rows},null,2));console.log({cases:rows.length/3,variants:3});
