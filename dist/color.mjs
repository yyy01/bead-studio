// Independently implemented. Color formulas: Ottosson Oklab and Sharma et al. CIEDE2000.
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};
export const LINEAR=Float64Array.from({length:256},(_,i)=>linear(i));
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
