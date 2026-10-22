import fs from 'node:fs';
import {processImage as previous} from './engine-v2.mjs';
import {processImage as experimental} from './engine-experimental.mjs';
import {processImage,cielab,deltaE,resample} from '../dist/engine.mjs';
const names=(process.env.PHOTOS||'astronaut,chelsea,coffee,camera,rocket').split(','),sizes=(process.env.SIZES||'29,48,96,128').split(',').map(Number),variants=(process.env.VARIANTS||'v2,v3,noJoint,priority').split(','),ks=(process.env.COLORS||'16,32').split(',').map(Number),tag=process.env.TAG||'v3';
const palette=JSON.parse(fs.readFileSync('dist/palettes.json')).palettes.mard,rows=[];const dir=`validation/${tag}-results`;fs.mkdirSync(dir,{recursive:true});
for(const name of names){const {sw,sh}=JSON.parse(fs.readFileSync(`fixtures/${name}.json`)),data=new Uint8ClampedArray(fs.readFileSync(`fixtures/${name}.rgba`));
 for(const size of sizes)for(const k of ks){const reference=resample(data,sw,sh,size,size,{mode:'photo'}),refLabs=reference.map(c=>c?cielab(c):null);
 for(const style of variants){const opts={data,sw,sh,width:size,height:size,palette,maxColors:k,mode:'photo',photoStyle:'faithful',jointPalette:style!=='noJoint',detailPriority:style==='priority'?.5:0,photoSampling:['adaptive','sharp','sharpLinear','balanced'].includes(style)?style:'area'},t=performance.now(),r=(style==='v2'?previous:['adaptive','sharpLinear','priority'].includes(style)?experimental:processImage)(opts),ms=performance.now()-t;let error=0,n=0,singletons=0;const pixels=new Uint8Array(size*size*4);
 for(let i=0;i<r.indices.length;i++){const p=r.indices[i];if(p>=0){const c=r.palette[p];pixels.set([...c.rgb,255],i*4);error+=deltaE(refLabs[i],c.lab);n++;const x=i%size,y=Math.floor(i/size);if(![[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([xx,yy])=>xx>=0&&xx<size&&yy>=0&&yy<size&&r.indices[yy*size+xx]===p))singletons++}}
 fs.writeFileSync(`${dir}/${name}-${size}-${k}-${style}.rgba`,pixels);rows.push({name,size,k,style,meanDeltaE:error/n,ms,colors:r.counts.filter(Boolean).length,singletons,energy:r.diagnostics?.energy,jointChanges:r.diagnostics?.jointChanges});
 }}console.log(`${name} done`)}
fs.writeFileSync(`validation/${tag}-results.json`,JSON.stringify({rows},null,2));console.log({cases:rows.length/variants.length,variants:variants.length});
