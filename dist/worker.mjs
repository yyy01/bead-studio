import { processImage } from './engine.mjs?v=3';
self.onmessage=({data:{id,payload}})=>{try{self.postMessage({id,result:processImage(payload)})}catch(e){self.postMessage({id,error:e.message})}};
