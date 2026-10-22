from pathlib import Path
from PIL import Image
import numpy as np,json,csv
p=Path('validation/photo-results.json');data=json.loads(p.read_text());rows=data['rows']
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
 reference,(ox,oy,w,h)=references[key];rgba=np.frombuffer(Path(f'validation/photo-results/{name}-{size}-{k}-{style}.rgba').read_bytes(),dtype=np.uint8).reshape(size,size,4).astype(float)/255;rgb=rgba[:,:,:3]*rgba[:,:,3:]+(1-rgba[:,:,3:]);a=(reference*np.array([.299,.587,.114])).sum(2)[oy:oy+h,ox:ox+w];b=(rgb*np.array([.299,.587,.114])).sum(2)[oy:oy+h,ox:ox+w];r['ssim']=ssim(a,b);r['edgeCorrelation']=edge_corr(a,b)
summary={style:{metric:float(np.mean([r[metric] for r in rows if r['style']==style])) for metric in ['meanDeltaE','ssim','edgeCorrelation','ms']} for style in ['previous','faithful','enhanced']}
comparisons={}
for style in ['faithful','enhanced']:
 for metric in ['meanDeltaE','ssim','edgeCorrelation']:
  wins=0;ties=0
  for r in rows:
   if r['style']!=style:continue
   old=next(o for o in rows if o['style']=='previous' and all(o[t]==r[t] for t in ['name','size','k']));delta=r[metric]-old[metric];wins+=int(delta< -1e-8 if metric=='meanDeltaE' else delta>1e-8);ties+=int(abs(delta)<=1e-8)
  comparisons[style+'_'+metric]={'wins':wins,'ties':ties,'cases':40}
data.update(summary=summary,comparisons=comparisons);p.write_text(json.dumps(data,indent=2))
with open('validation/photo-results.csv','w') as f:
 w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
print(json.dumps({'summary':summary,'comparisons':comparisons},indent=2))
