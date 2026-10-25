#!/usr/bin/env python3
"""Independent, read-only regression checks for GA_PSSE_IMPORT_SDK(2).

Usage (from anywhere):
 python audit_sdk_v3.py --sdk PATH_TO_UNZIP_SDK --examples PATH_TO_PSSE_EXAMPLE --output PATH_TO_RESULTS_JSON
Requires only Python stdlib; original SDK modules are imported from --sdk.
Does NOT modify the SDK or proprietary sample files.
"""
import argparse,copy,csv,hashlib,json,os,sys,collections
from pathlib import Path


def run(sdk:Path, examples:Path):
 sys.path.insert(0,str(sdk.resolve()))
 from ga_psse_sdk.raw_parser import RawParser
 from ga_psse_sdk.rawx_parser import RawxParser
 from ga_psse_sdk.canonical_mapper import map_bridge_to_canonical
 from ga_psse_sdk.validator import ModelValidator
 results=[]
 def add(code,level,expected,observed,ok,detail):
  results.append({'id':code,'priority':level,'expected':expected,'observed':observed,'passed':bool(ok),'detail':detail})

 val=ModelValidator()
 pairs=[]
 for fp in sorted(examples.glob('*.raw')):
  xp=fp.with_suffix('.rawx')
  if xp.is_file():
   try:
    left=RawParser(str(fp)).to_bridge_dict();right=RawxParser(str(xp)).to_bridge_dict()
    z=val.compare_networks(fp.stem,right,left)
    pairs.append({'name':fp.stem,'validatorPass':bool(z['all_passed']),'reasonCount':len(z['failure_reasons']),
                  'rawBuses':len(left['network']['buses']),'rawxBuses':len(right['network']['buses'])})
   except Exception as e:pairs.append({'name':fp.stem,'exception':type(e).__name__+': '+str(e)})
 add('BASE-PAIRS','baseline','11/11 paired checks as claimed',f'{sum(x.get("validatorPass",False) for x in pairs)}/{len(pairs)} passed',
     len(pairs)==11 and all(x.get('validatorPass',False) for x in pairs),'These pass only the SDK validator field subset; not full model identity or GA solver parity.')

 def rawx(stem):
  return RawxParser(str(examples/(stem+'.rawx'))).to_bridge_dict()
 src=rawx('savnw')

 c=copy.deepcopy(src)
 for g in c['network']['generators']:
  if any(b['ibus']==g['ibus'] and b.get('ide')==3 for b in c['network']['buses']):g['inService']=False
 cm=map_bridge_to_canonical(c)
 live_slack=any(g['inService'] for g in cm['externalGrids'])
 add('P0-INACTIVE-SLACK','P0','BLOCKED (no live slack)',cm['capabilities']['powerFlow']['state'],
     cm['capabilities']['powerFlow']['state']=='BLOCKED',f'active externalGrids={live_slack}; total={len(cm["externalGrids"])}')

 for typ,item,suffix in [('generators', 'generators','orphan'),('loads','loads','orphan')]:
  c=copy.deepcopy(src)
  r=copy.deepcopy(c['network'][typ][0]);r['ibus']=999999
  if typ=='generators':r['machid']='ORPHAN'
  else:r['loadid']='ORPHAN'
  c['network'][typ].append(r)
  cm=map_bridge_to_canonical(c)
  dangling=any(e['bus']=='bus_999999' for e in cm[item])
  add('P0-DANGLING-'+typ.upper(),'P0','BLOCKED / rejected missing bus',cm['capabilities']['powerFlow']['state'],
      cm['capabilities']['powerFlow']['state']=='BLOCKED' and not dangling,f'dangling references={dangling}')

 c=copy.deepcopy(src);c['network']['buses'].insert(0,copy.deepcopy(c['network']['buses'][0]))
 res=val.compare_networks('duplicate_bus',src,c)
 cm=map_bridge_to_canonical(c)
 ids=[b['id'] for b in cm['buses']]
 add('P0-DUPLICATE-IDENTITY','P0','reject duplicate / BLOCKED',
     f'validator_pass={res["all_passed"]}, network={cm["capabilities"]["powerFlow"]["state"]}',
     not res['all_passed'] and cm['capabilities']['powerFlow']['state']=='BLOCKED',
     f'canonical_buses={len(ids)},unique_ids={len(set(ids))}')

 sample=rawx('sample')
 cm=map_bridge_to_canonical(sample)
 unsupported=sample['metadata'].get('unsupportedEquipment',[])
 impactful=[u for u in unsupported if u.get('sourceClass') in
            ('TwoTerminalDcLine','VscDcLine','MultiTerminalDcLine','FactsDevice','InductionMachine')]
 add('P0-UNSUPPORTED-AC-PHYSICS','P0','PARTIAL/BLOCKED with scoped reasons (not full LF READY)',
     cm['capabilities']['powerFlow']['state'],cm['capabilities']['powerFlow']['state']!='READY',
     f'uncoupled electrical classes={[(u["sourceClass"],u["count"]) for u in impactful]}')

 nb=rawx('sample_nb'); nc=map_bridge_to_canonical(nb)
 edges=collections.defaultdict(set)
 for typ in ('lines','transformers','switches'):
  for e in nc[typ]:
   if typ=='switches' and not e.get('closed',False):continue
   if not e.get('inService',True):continue
   u,v=e.get('from'),e.get('to')
   edges[u].add(v);edges[v].add(u)
 physical={x['id'] for x in nc['buses'] if x['id'].startswith('bus_')}
 nodes={x['id'] for x in nc['buses'] if x['id'].startswith('node_')}
 visited=set(physical);q=collections.deque(physical)
 while q:
  u=q.popleft()
  for v in edges[u]:
   if v not in visited:visited.add(v);q.append(v)
 reachable=len(visited&nodes)
 add('P0-NODE-ELECTRICAL-GRAPH','P0','physical node graph connected by proven terminal/cubicle relations OR LF blocked',
     f'physical_reachable_nodes={reachable}/{len(nodes)}, LF={nc["capabilities"]["powerFlow"]["state"]}',
     reachable==len(nodes) or nc['capabilities']['powerFlow']['state']!='READY',
     'Only line/transformer/switch edges were evaluated; parentId and sourceRefs are metadata, not explicit electrical edges.')

 def negative(code,modify):
  tam=copy.deepcopy(src);modify(tam)
  out=val.compare_networks(code,src,tam)
  add(code,'P1','validator FAIL on altered electrical field','PASS' if out['all_passed'] else 'FAIL',
      not out['all_passed'],f'{len(out["failure_reasons"])} reasons; {out["failure_reasons"][:2]}')

 negative('P1-RATE-SET-SECOND',lambda d:d['network']['branches'][0]['rateSet'].__setitem__(1,1234567.0))
 negative('P1-TX-SECOND-TAP',lambda d:d['network']['transformers'][0]['winding2'].__setitem__('ratioPu',1.88))
 negative('P1-LOAD-ZIP',lambda d:d['network']['loads'][0].update({'pCurrentMw':99999.0,'qCurrentMvar':9999.0}))
 negative('P1-GEN-MBASE',lambda d:d['network']['generators'][0].update({'mbaseMva':99999.0}))

 ga_handoff=(sdk/'GA_IMPORT_HANDOFF.md').read_text(encoding='utf-8',errors='replace')
 typeref='sourceRefs: { psseBus: b.ibus }' in ga_handoff
 add('P1-TS-SOURCEREFS','P1','sourceRefs: Record<string, readonly SourceRef[]>',
     'raw scalar value emitted' if typeref else 'known scalar pattern not found', not typeref,
     'GA source ref contract expects arrays of {sourceClass,sourceId,field,unit?}; do not use any casting.')

 src_raw_parser=(sdk/'ga_psse_sdk'/'raw_parser.py').read_text(encoding='utf-8')
 src_rawx_parser=(sdk/'ga_psse_sdk'/'rawx_parser.py').read_text(encoding='utf-8')
 solved_fabricated=('"solutionStatus": {"isSolved": True' in src_raw_parser and
                    '"solutionStatus": {"isSolved": True' in src_rawx_parser)
 add('P1-SOLVED-ASSUMED','P1','unknown unless verified source solution state',
     'both parsers hard-code True' if solved_fabricated else 'pattern absent', not solved_fabricated,
     'RAW/RAWX solved state must not be claimed from a parsed field that is not present.')

 return {'sdk_path':str(sdk),'example_path':str(examples),'paired_models':pairs,
         'checks':results,'summary':{'paired_pass':sum(x.get('validatorPass',False) for x in pairs),
                                     'paired_total':len(pairs),'additional_pass':sum(x['passed'] for x in results[1:]),
                                     'additional_failed':sum(not x['passed'] for x in results[1:])}}


def main():
 ap=argparse.ArgumentParser();ap.add_argument('--sdk',required=True);ap.add_argument('--examples',required=True);ap.add_argument('--output',required=True); args=ap.parse_args()
 data=run(Path(args.sdk),Path(args.examples)); p=Path(args.output);p.parent.mkdir(parents=True,exist_ok=True)
 p.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 for r in data['checks']:
  print(f'{r["id"]:31} {"PASS" if r["passed"] else "FAIL"} :: {r["observed"]}')
 print('SUMMARY',data['summary'])
 return 0 if all(x['passed'] for x in data['checks']) else 2
if __name__=='__main__':sys.exit(main())
