"""Compare editable geometry against an independent dump from the licensed GUI."""
import argparse,json,math
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);parser.add_argument('names',nargs='+');args=parser.parse_args()
results=[]
for name in args.names:
 expected=json.loads((args.root/(name+'.json')).read_text(encoding='utf-8'))
 actual=json.loads((args.root/(name+'_psse.json')).read_text(encoding='utf-8'))
 source=expected['components']; target=[c for c in actual['components'] if c['t'] in ('Symbol','Link','Label')];byid={c['id']:c for c in target};diff=[];max_delta=0
 def eqpoint(a,b):
  global max_delta
  if a is None or b is None or len(a)!=len(b):return False
  delta=max(abs(x-y) for x,y in zip(a,b));max_delta=max(max_delta,delta);return delta<=1e-4
 counts=lambda items:{t:sum(c['t']==t for c in items) for t in ('Symbol','Link','Label')}
 if counts(source)!=counts(target):diff.append({'field':'counts','expected':counts(source),'actual':counts(target)})
 for c in source:
  r=byid.get(c['id'])
  if not r or r['t']!=c['t']:diff.append({'id':c['id'],'field':'type/missing'});continue
  if c['t']=='Link':
   for k in ('p1','p2'):
    if c[k]['sym']!=r[k]['sym'] or not eqpoint(c[k]['pos'],r[k]['pos']):diff.append({'id':c['id'],'field':k,'expected':c[k],'actual':r[k]})
    if c[k].get('idx') is not None and c[k].get('idx')!=r[k].get('idx'):diff.append({'id':c['id'],'field':k+'.idx','expected':c[k].get('idx'),'actual':r[k].get('idx')})
   ka,kb=c.get('knees',[]),r.get('knees',[])
   if len(ka)!=len(kb) or not all(eqpoint(x,y) for x,y in zip(ka,kb)):diff.append({'id':c['id'],'field':'knees'})
  else:
   if not eqpoint(c['pos'],r.get('pos')):diff.append({'id':c['id'],'field':'position'})
   if c['t']=='Symbol':
    for k in ('len','width','rot'):
     if c.get(k) is not None and (r.get(k) is None or abs(c[k]-r[k])>1e-4):diff.append({'id':c['id'],'field':k,'expected':c.get(k),'actual':r.get(k)})
    if ' '.join(c.get('map','').split())!=' '.join(r.get('map','').split()):diff.append({'id':c['id'],'field':'equipment map','expected':c.get('map'),'actual':r.get('map')})
   if c['t']=='Label' and c.get('text')!=r.get('text'):diff.append({'id':c['id'],'field':'text','expected':c.get('text'),'actual':r.get('text')})
 result={'name':name,'ok':not diff,'expectedCounts':counts(source),'actualCounts':counts(target),'maxCoordinateDelta':max_delta,'differences':diff,'excludedUiImages':sum(c['t']=='Image' for c in actual['components'])};results.append(result)
(args.root/'native_geometry_comparison.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps([{k:v for k,v in r.items() if k!='differences'}|{'differenceCount':len(r['differences']),'firstDifferences':r['differences'][:5]} for r in results],indent=2))
raise SystemExit(0 if all(r['ok'] for r in results) else 1)
