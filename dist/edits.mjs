import {preparePalette} from './engine.mjs?v=3';
export function clonePattern(pattern){return{...pattern,palette:pattern.palette.map(c=>({...c,rgb:c.rgb?.slice(),ok:c.ok?.slice(),lab:c.lab?.slice()})),indices:Int16Array.from(pattern.indices),counts:[...pattern.counts]}}
export function replacePatternColor(pattern,sourceIndex,target){
 if(!Number.isInteger(sourceIndex)||sourceIndex<0||sourceIndex>=pattern.palette.length)throw Error('待替换色不存在');
 if(!target||typeof target.code!=='string'||!target.code.trim()||!/^#[a-f\d]{6}$/i.test(target.hex))throw Error('目标颜色无效');
 const out=clonePattern(pattern),from=out.palette[sourceIndex];let targetIndex=out.palette.findIndex(c=>c.code===target.code);
 if(targetIndex>=0&&out.palette[targetIndex].hex.toLowerCase()!==target.hex.toLowerCase())throw Error('相同色号对应了不同颜色，请检查色卡');
 if(targetIndex<0){targetIndex=out.palette.length;out.palette.push(preparePalette([target])[0])}
 let affected=0;for(let i=0;i<out.indices.length;i++)if(out.indices[i]===sourceIndex&&sourceIndex!==targetIndex){out.indices[i]=targetIndex;affected++}
 const counts=out.palette.map(()=>0);for(const i of out.indices)if(i>=0)counts[i]++;
 const keep=counts.map((n,i)=>n?i:-1).filter(i=>i>=0),remap=new Map(keep.map((old,i)=>[old,i]));out.palette=keep.map(i=>out.palette[i]);out.counts=keep.map(i=>counts[i]);out.indices=Int16Array.from(out.indices,i=>i<0?-1:remap.get(i));out.total=out.counts.reduce((a,b)=>a+b,0);out.meanDeltaE=null;out.modified=true;return{pattern:out,affected};
}
