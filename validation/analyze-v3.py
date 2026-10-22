from pathlib import Path
from PIL import Image
import numpy as np,json,csv,sys
base=sys.argv[1] if len(sys.argv)>1 else 'v3'
p=Path('validation/'+base+'-results.json');data=json.loads(p.read_text());rows=data['rows']
g=np.exp(-np.arange(-5,6,dtype=float)**2/(2*1.5**2));g/=g.sum()
def blur(a):
 a=np.tensordot(np.lib.stride_tricks.sliding_window_view(np.pad(a,((0,0),(5,5)),mode='reflect'),11,axis=1),g,axes=([-1],[0]))
 return np.tensordot(np.lib.stride_tricks.sliding_window_view(np.pad(a,((5,5),(0,0)),mode='reflect'),11,axis=0),g,axes=([-1],[0]))
def ssim(x,y):
 ux,uy=blur(x),blur(y);vx=np.maximum(0,blur(x*x)-ux*ux);vy=np.maximum(0,blur(y*y)-uy*uy);cov=blur(x*y)-ux*uy
 value=((2*ux*uy+.01**2)*(2*cov+.03**2))/((ux*ux+uy*uy+.01**2)*(vx+vy+.03**2))
 return float(value[5:-5,5:-5].mean())
def edge_corr(x,y):
 gx,gy=np.gradient(x);hx,hy=np.gradient(y);return float((gx*hx+gy*hy).sum()/max(1e-12,np.sqrt((gx*gx+gy*gy).sum()*(hx*hx+hy*hy).sum())))
references={}
for r in rows:
 name,size,k,style=[r[t] for t in ['name','size','k','style']];key=(name,size)
 if key not in references:
  source=next(p for p in Path('fixtures').glob(name+'.*') if p.suffix in ['.png','.jpg']);im=Image.open(source).convert('RGB');im.thumbnail((size,size),Image.Resampling.LANCZOS);canvas=Image.new('RGB',(size,size),'white');canvas.paste(im,((size-im.width)//2,(size-im.height)//2));reference=np.asarray(canvas).astype(float)/255
  ox=(size-im.width)//2;oy=(size-im.height)//2;references[key]=(reference,(ox,oy,im.width,im.height))
 reference,(ox,oy,w,h)=references[key];rgba=np.frombuffer(Path(f'validation/{base}-results/{name}-{size}-{k}-{style}.rgba').read_bytes(),dtype=np.uint8).reshape(size,size,4).astype(float)/255;rgb=rgba[:,:,:3]*rgba[:,:,3:]+(1-rgba[:,:,3:]);a=(reference*np.array([.299,.587,.114])).sum(2)[oy:oy+h,ox:ox+w];b=(rgb*np.array([.299,.587,.114])).sum(2)[oy:oy+h,ox:ox+w];r['ssim']=ssim(a,b);r['edgeCorrelation']=edge_corr(a,b)
 area=Path(f'validation/{base}-results/{name}-{size}-reference.rgba')
 if area.exists():
  z=np.frombuffer(area.read_bytes(),dtype=np.uint8).reshape(size,size,4).astype(float)/255;z=z[:,:,:3]*z[:,:,3:]+1-z[:,:,3:];z=(z*np.array([.299,.587,.114])).sum(2)[oy:oy+h,ox:ox+w];r['ssimArea']=ssim(z,b)
 im=Image.open(next(p for p in Path('fixtures').glob(name+'.*') if p.suffix in ['.png','.jpg'])).convert('RGB');im.thumbnail((size,size),Image.Resampling.BICUBIC);z=np.asarray(im).astype(float)/255;z=(z*np.array([.299,.587,.114])).sum(2);r['ssimBicubic']=ssim(z,b)
styles=list(dict.fromkeys(r['style'] for r in rows));metrics=['meanDeltaE','ssim','edgeCorrelation','ms','singletons','ssimBicubic']+(['ssimArea'] if 'ssimArea' in rows[0] else []);summary={style:{m:float(np.mean([r[m] for r in rows if r['style']==style])) for m in metrics} for style in styles};comparisons={}
for style in styles[1:]:
 comparisons[style]={}
 for metric in metrics:
  deltas=[]
  for r in rows:
   if r['style']!=style:continue
   old=next(o for o in rows if o['style']==styles[0] and all(o[t]==r[t] for t in ['name','size','k']));deltas.append(r[metric]-old[metric])
  wins=sum(d < -1e-8 if metric in ['meanDeltaE','ms','singletons'] else d>1e-8 for d in deltas);ties=sum(abs(d)<=1e-8 for d in deltas);comparisons[style][metric]={'wins':wins,'ties':ties,'losses':len(deltas)-wins-ties,'cases':len(deltas),'worstDelta':float(max(deltas) if metric in ['meanDeltaE','ms','singletons'] else min(deltas))}
data.update(summary=summary,comparisons=comparisons);p.write_text(json.dumps(data,indent=2))
with open('validation/'+base+'-results.csv','w') as f:
 w=csv.DictWriter(f,fieldnames=list(dict.fromkeys(k for r in rows for k in r)));w.writeheader();w.writerows(rows)
print(json.dumps({'summary':summary,'comparisons':comparisons},indent=2))
