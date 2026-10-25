"""Reproduce source/schema/projection evidence without shipping licensed models."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import jsonschema
from ga_psse_sdk.raw_parser import RawParser
from ga_psse_sdk.rawx_parser import RawxParser
from ga_psse_sdk.canonical_mapper import map_bridge_to_canonical
from ga_psse_sdk.validator import ModelValidator
from source_field_matrix import matrix


def leaves(v):
    if isinstance(v,dict): return sum(leaves(x) for x in v.values())
    if isinstance(v,list): return sum(leaves(x) for x in v)
    return 1


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--examples',default=r'C:\Program Files\PTI\PSSE36\36.5\EXAMPLE');ap.add_argument('--output',default='evidence');a=ap.parse_args()
    root=Path(__file__).resolve().parents[1];out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
    schema=jsonschema.Draft202012Validator(json.loads((root/'schemas/ga-psse-bridge-v1.schema.json').read_text()))
    parity=[];fidelity=[];coverage=[];field_matrix=[];schema_checks=0
    pairs=[p for p in sorted(Path(a.examples).glob('*.raw')) if p.with_suffix('.rawx').is_file()]
    if len(pairs)!=11: raise ValueError(f'Expected 11 installed paired cases, found {len(pairs)}')
    for p in pairs:
        left=RawParser(str(p)).to_bridge_dict();right=RawxParser(str(p.with_suffix('.rawx'))).to_bridge_dict()
        for b in (left,right):schema.validate(b);schema_checks+=1
        r=ModelValidator().compare_networks(p.stem,right,left)
        if not r['all_passed']:raise AssertionError(r['failure_reasons'])
        parity.append(dict(model=p.stem,status='PASS_NORMALIZED_FIELDS',raw_sha256=left['metadata']['sourceSha256'],rawx_sha256=right['metadata']['sourceSha256'],compared_leaves=r['fieldCoverage']['comparedLeaves'],excluded_labels=r['fieldCoverage']['notComparableLeaves'],source_residue='RETAINED_NOT_ELECTRICALLY_COMPARED'))
        fields=matrix(p.stem,right['network']['sourceTables']);field_matrix.extend(fields)
        compared=sum(x['status']=='NORMALIZED_COMPARED' for x in fields)
        coverage.append(dict(model=p.stem,active_source_columns=len(fields),normalized_compared_columns=compared,
                             not_comparable_columns=len(fields)-compared,normalized_comparison_coverage_percent=round(100*compared/len(fields),2),
                             unverified_columns_percent=round(100*(len(fields)-compared)/len(fields),2),
                             note='Active source columns, not solver coverage; see v3_source_field_matrix.csv'))
        for fmt,b in (('RAW',left),('RAWX',right)):
            c=map_bridge_to_canonical(b);ids={x['id'] for x in c['buses']}
            dangling=sum(e[k] not in ids for table in ('lines','transformers','switches') for e in c[table] for k in ('from','to'))
            dangling+=sum(e['bus'] not in ids for table in ('loads','generators','shunts','externalGrids') for e in c[table])
            if dangling:raise AssertionError('Dangling canonical endpoints')
            if len(ids)!=len(c['buses']):raise AssertionError('Duplicate canonical bus IDs')
            for table in ('buses','lines','transformers','shunts','loads','generators','externalGrids'):
                for e in c[table]:
                    if not all(isinstance(refs,list) for refs in e['sourceRefs'].values()):raise AssertionError('scalar SourceRef')
            checked=0
            for line in c['lines']:
                source=next(e for e in b['network']['branches'] if f"line_{e['fromBus']}_{e['toBus']}_{e['circuitId']}"==line['id'])
                z=line['vnKv']**2/c['baseMva']
                for actual,expected in ((line['rOhm']/z,source['rPu']),(line['xOhm']/z,source['xPu']),(line['bSiemens']*z,source['bPu'])):
                    if abs(actual-expected)>1e-10:raise AssertionError('line engineering-unit parity')
                    checked+=1
            for table,field in (('loads','loadid'),('generators','machid')):
                for source in b['network'][table]:
                    target=c['loads'] if table=='loads' else c['generators']+c['externalGrids']
                    prefix='load_' if table=='loads' else ('extgrid_' if any(x['id']==f"extgrid_{source['ibus']}_{source[field]}" for x in c['externalGrids']) else 'gen_')
                    row=next((r for r in target if r['id']==prefix+f"{source['ibus']}_{source[field]}"),None)
                    if row:
                        if row['pMw']!=source['pMw'] or row['qMvar']!=source['qMvar']:raise AssertionError('dispatch changed')
                        checked+=2
            fidelity.append(dict(model=p.stem,format=fmt,projection_status=c['capabilities']['powerFlow']['state'],n1=c['capabilities']['n1']['state'],short_circuit=c['capabilities']['shortCircuit3Phase']['state'],source_buses=len(b['network']['buses']),projected_buses=len(ids),dangling_endpoints=dangling,physical_nodes_in_solver=sum(x.startswith('node_') for x in ids),dropped_equipment=c['sourceFidelity']['droppedEquipmentCount'],diagnostic_count=len(c['diagnostics']),projection_field_checks=checked,ybus='SYNTHETIC_PRIMITIVES_TESTED_REAL_MODEL_PARITY_NOT_VERIFIED'))
    for filename,rows in (('v3_raw_rawx_parity.csv',parity),('v3_canonical_fidelity.csv',fidelity),('v3_field_coverage.csv',coverage),('v3_source_field_matrix.csv',field_matrix)):
        with (out/filename).open('w',newline='',encoding='utf-8') as f:
            w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
    summary={'paired_pass':len(parity),'schema_validated_bridges':schema_checks,'projection_integrity_checks':len(fidelity),'scope':'Normalized source parity and endpoint integrity only; real-model Ybus/solver parity not certified'}
    (out/'v3_schema_and_fidelity.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8');print(summary)
    return 0


if __name__=='__main__':sys.exit(main())
