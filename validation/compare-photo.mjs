import fs from 'node:fs';import {createRequire} from 'node:module';import {processImage as oldProcess} from './engine-v1.mjs';import {processImage} from '../dist/engine.mjs';const require=createRequire('/Users/darklight/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');const sharp=require('sharp'),palette=JSON.parse(fs.readFileSync('dist/palettes.json')).palettes.mard;
const composites=[],rows=[];let y=0;
for(const name of ['astronaut','chelsea','coffee','camera','rocket']){const {sw,sh}=JSON.parse(fs.readFileSync(`fixtures/${name}.json`)),data=new Uint8ClampedArray(fs.readFileSync(`fixtures/${name}.rgba`));
 const source=await sharp(Buffer.from(data),{raw:{width:sw,height:sh,channels:4}}).resize(192,192,{fit:'contain',background:'#fff'}).png().toBuffer();composites.push({input:source,left:0,top:y});
 for(const [j,style]of ['old','faithful','enhanced'].entries()){const opts={data,sw,sh,width:64,height:64,palette,maxColors:24,mode:'photo',photoStyle:style},r=style==='old'?oldProcess(opts):processImage(opts),pixels=new Uint8Array(64*64*4);r.indices.forEach((p,i)=>{if(p>=0)pixels.set([...r.palette[p].rgb,255],i*4)});const buf=await sharp(Buffer.from(pixels),{raw:{width:64,height:64,channels:4}}).resize(192,192,{kernel:'nearest'}).png().toBuffer();composites.push({input:buf,left:(j+1)*202,top:y});rows.push({name,style,error:r.meanDeltaE,ms:r.elapsed});}
 y+=202;
}
await sharp({create:{width:800,height:y,channels:4,background:'#fff'}}).composite(composites).png().toFile('validation/photo-prototype.png');console.log(rows);
