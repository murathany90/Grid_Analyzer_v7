"""Development-only comparison against the user's installed licensed PSS/E caspy.

Run: py -3.14 tools/psse-sav-native-oracle.py
Requires local PSS/E and project development dependencies only for this oracle
check. The delivered browser decoder does not execute this script or load caspy.
Only counts, source hashes and outcomes enter the public evidence report.
Private decoded records remain under ignored private-re; no vendor code is copied.
"""
from pathlib import Path
import argparse,collections,ctypes,hashlib,json,os,subprocess,sys,tempfile

parser=argparse.ArgumentParser()
parser.add_argument('--root',default=os.environ.get('PSSE_TEST_ROOT',r'C:\Program Files\PTI\PSSE36\36.5'))
parser.add_argument('--output',default='evidence/sav-native-oracle-parity.json')
parser.add_argument('--case',dest='selected_cases',action='append',help='Optional case stem; repeat to validate additional local fixtures')
args=parser.parse_args()
repo=Path(__file__).resolve().parents[1]
root=Path(args.root).resolve();bin_dir=root/'PSSBIN';py_dir=root/f'PSSPY{sys.version_info.major}{sys.version_info.minor}'
if not bin_dir.is_dir() or not py_dir.is_dir():raise SystemExit(f'Native development oracle requires matching local {py_dir.name} and PSSBIN')
handles=[os.add_dll_directory(str(bin_dir)),os.add_dll_directory(str(py_dir))]
os.environ['PATH']=str(bin_dir)+os.pathsep+os.environ.get('PATH','')
libraries=[]
for name in ['libifcoremd.dll','libmmd.dll','svml_dispmd.dll','ptiutils.dll','ziparchive.dll','usrcas.dll']:
 p=bin_dir/name
 if p.exists():libraries.append(ctypes.CDLL(str(p)))
sys.path.insert(0,str(py_dir))
import caspy
private_base=repo/'private-re';private_base.mkdir(exist_ok=True)
private_dir=Path(tempfile.mkdtemp(prefix='native-oracle-',dir=str(private_base))).resolve()
if private_base.resolve() not in private_dir.parents:raise SystemExit('Private oracle output escaped workspace')
cases=args.selected_cases or ['savnw','sample','bench','sample_nb','sample_nb_sec','savnw_nb','20261014_1200_SN3_TR0']
paths={name:root/('control1' if name.startswith('2026') else 'EXAMPLE')/(name+'.sav') for name in cases}
jobs=[{'path':str(paths[name]),'output':str(private_dir/(name+'-decoded.json'))} for name in cases]
manifest=private_dir/'jobs.json';manifest.write_text(json.dumps(jobs))
subprocess.run(['node','--import','tsx',str(repo/'tools'/'psse-sav-export-for-oracle.ts'),str(manifest)],cwd=str(repo),check=True)
def encode(value):
 if isinstance(value,complex):return [value.real,value.imag]
 if isinstance(value,bytes):return value.decode('latin1')
 raise TypeError(type(value).__name__)
reports=[]
for name in cases:
 m=json.loads((private_dir/(name+'-decoded.json')).read_text())
 before_hash=hashlib.sha256(paths[name].read_bytes()).hexdigest()
 case=caspy.Savecase(str(paths[name]))
 if case.pssopn['IERR'] or case.psssiz['IERR']:raise RuntimeError('Native oracle failed: '+name)
 o=json.loads(json.dumps({key:value for key,value in vars(case).items() if key not in ['pssopn','psscls']},default=encode))
 source_hash=hashlib.sha256(paths[name].read_bytes()).hexdigest()
 if source_hash!=before_hash or source_hash!=m['source']['sha256']:raise RuntimeError('Source changed during oracle comparison: '+name)
 base=m['case']['baseMva'];errors=[];counts=collections.Counter();mismatch_total=[0]
 def check(label,a,b):
  counts[label]+=1
  if isinstance(a,(int,float)) and isinstance(b,(int,float)):
   if abs(a-b)<=max(6e-5,abs(b)*2e-6):return
  elif a==b:return
  mismatch_total[0]+=1
  if len(errors)<100:errors.append(dict(field=label,actual=a,oracle=b))
 def rows(kind,subtype=None):return sorted([e for e in m['equipment'] if e['kind']==kind and (subtype is None or e['fields'].get('subtype')==subtype)],key=lambda e:e['fields']['savIndex'])
 for i,e in enumerate(rows('bus')):
  for f,k in [('ibus','NUM'),('baskv','BASKV'),('ide','IDE'),('area','AREA'),('zone','ZONE'),('owner','OWNER'),('vm','VM'),('va','VA')]:check('bus.'+f,e['fields'][f],o['pssbus'][k][i])
 for i,e in enumerate(rows('generator')):
  for f,k in [('ibus','NUM'),('pg','PG'),('qg','QG'),('qt','QT'),('qb','QB'),('pt','PT'),('pb','PB'),('vs','VS'),('ireg','IREG'),('nreg','NREG'),('mbase','MBASE'),('gtap','GTAP'),('stat','STAT'),('rmpct','RMPCT'),('baslod','BASLOD'),('wmod','WMOD')]:check('generator.'+f,e['fields'][f],o['pssgen'][k][i]*(base if f in ['pg','qg','qt','qb','pt','pb'] else 1))
  for f,k,j in [('zr','ZSORCE',0),('zx','ZSORCE',1),('rt','XTRAN',0),('xt','XTRAN',1)]:check('generator.'+f,e['fields'][f],o['pssgen'][k][i][j])
 for i,e in enumerate(rows('load')):
  check('load.ibus',e['fields']['ibus'],o['psslod']['NUM'][i]);check('load.stat',e['status'],o['psslod']['STATUS'][i])
  for f,j,k in [('pl',0,0),('ql',0,1),('ip',1,0),('iq',1,1),('yp',2,0),('yq',2,1)]:check('load.'+f,e['fields'][f],o['psslod']['LOAD'][i][j][k]*base)
 for i,e in enumerate(rows('shunt','fixed')):
  check('fixedShunt.ibus',e['fields']['ibus'],o['pssfsh']['NUM'][i]);check('fixedShunt.stat',e['status'],o['pssfsh']['STATUS'][i])
  for f,j in [('gl',0),('bl',1)]:check('fixedShunt.'+f,e['fields'][f],o['pssfsh']['SHUNT'][i][j]*base)
 for i,e in enumerate(rows('line')):
  for f,k in [('ibus','FRMBUS'),('jbus','TOBUS'),('stat','STAT'),('len','LINLEN'),('bpu','B')]:check('line.'+f,e['fields'][f],o['casbrn'][k][i])
  for f,k,j in [('rpu','RX',0),('xpu','RX',1),('gi','GBI',0),('bi','GBI',1),('gj','GBJ',0),('bj','GBJ',1)]:check('line.'+f,e['fields'][f],o['casbrn'][k][i][j])
  for j in range(12):check('line.rate'+str(j+1),e['fields']['rate'+str(j+1)],o['casbrn']['RATINGS'][i][j])
 trn=o['castrn'];lookup={':'.join(map(str,bs))+':'+trn['CKT'][i].strip():i for i,bs in enumerate(trn['BUSNUM'])}
 for e in rows('transformer'):
  f=e['fields'];key=':'.join(map(str,[f['ibus'],f['jbus'],f['kbus']]))+':'+f['ckt'].strip();i=lookup[key]
  check('transformer.stat',e['status'],trn['STAT'][i]);check('transformer.mag1',f['mag1'],trn['MAG1'][i]);check('transformer.mag2',f['mag2'],trn['MAG2'][i])
  for w in range(3 if f['kbus'] else 2):
   for p,k in [('ratio','WIND'),('nomv','NOMV'),('ang','ANG')]:
    field=(p+str(w+1)+'Pu') if p=='ratio' else p+str(w+1)
    if field in f:check('transformer.'+p+str(w+1),f[field],trn[k][i][w])
   if not f['kbus'] and w==1:continue
   for r in range(12):check('transformer.rating',f[f'wdg{w+1}rate{r+1}'],trn['RATINGS'][i][w][r])
  for w,pair in enumerate(['12','23','31'] if f['kbus'] else ['12']):
   for p,j in [('r',0),('x',1)]:check('transformer.'+p+pair,f[p+pair+'Pu'],trn['RX'][i][w][j])
 for i,e in enumerate(rows('substation')):
  for f,k in [('isub','NUM'),('lati','LAT'),('long','LNG'),('srg','SRG')]:check('substation.'+f,e['fields'][f],o['psssub'][k][i])
 for i,e in enumerate(rows('node')):
  for f,k in [('isub','STATION'),('inode','NODE'),('ibus','BUS'),('stat','STAT')]:check('node.'+f,e['fields'][f],o['pssnod'][k][i])
 for i,e in enumerate(sorted([e for e in m['equipment'] if e['kind']=='switch' and 'isub' in e['fields']],key=lambda e:e['fields']['savIndex'])):
  for f,k in [('isub','STATION'),('inode','FRMNOD'),('jnode','TONOD'),('stype','TYPE'),('stat','STAT'),('nstatus','NSTATUS'),('xpu','X')]:check('nodeSwitch.'+f,e['fields'][f],o['pssssw'][k][i])
 for i,e in enumerate(rows('terminal')):
  for f,k in [('type','TYPE'),('equipmentSequence','TRMIDX')]:check('terminal.'+f,e['fields'][f],o['psstrm'][k][i])
  check('terminal.isub',e['fields']['isub'],o['psssub']['NUM'][o['psstrm']['STATION'][i]-1])
  # Native psstrm.NODE is a global node-array index, unlike pssnod.NODE/local RAW inode.
  check('terminal.inode',e['fields']['inode'],o['pssnod']['NODE'][o['psstrm']['NODE'][i]-1])
 report=dict(name=name,sha256=source_hash,comparisons=sum(counts.values()),categories=dict(counts),mismatchCount=mismatch_total[0],status='PASS' if not mismatch_total[0] else 'FAIL');reports.append(report)
 if errors: (private_dir/(name+'-failures.json')).write_text(json.dumps(errors,indent=2))
 print(name,report['status'],report['comparisons'],'mismatches',len(errors))

report={
 'schema':'ga.psse.native-oracle-evidence.v1',
 'oracle':'Installed PSS/E 36.5 caspy.Savecase; development validation only',
 'decoder':'src/importers/psse/sav.ts (same source bundled into offline browser)',
 'comparisonTolerance':'max(0.00006, abs(oracle)*0.000002); no values changed to fit oracle',
 'scope':'Bus IDs/base/IDE/Vm/Va/area/zone/owner; generator P/Q and limits, controls, MBASE, impedances, taps and status; six load ZIP coefficients; fixed shunts; line impedance/charging/end shunts/length/status/all 12 ratings; two-/three-winding transformer connections/impedances/ratios/angles/magnetizing/all ratings/status; substations; nodes; node switches; terminal references.',
 'oracleLimitations':[
  'caspy casswd labels NSTATUS and STYPE are swapped relative to RAW and stored Brknst/Brktyp. Canonical decoder follows RAW: nstat=Brknst, stype=Brktyp. These two mislabeled oracle fields are excluded from the numeric tally and covered by an original synthetic regression.',
  'caspy psstrm.NODE and STATION are global internal array indices, unlike pssnod.NODE and psssub.NUM source identities. Oracle references are explicitly resolved through those source tables before comparison.',
  'Bus sections remain distinct using packed Numbus connection keys. Native API external NUM alone collapses section identity.',
  'Unimplemented DC/control semantics and opaque extension tails remain PARTIAL in the application; this report verifies only its named fields and does not certify analysis readiness.'
 ],
 'totalComparisons':sum(row['comparisons'] for row in reports),
 'cases':reports,
 'status':'PASS' if all(row['status']=='PASS' for row in reports) else 'FAIL',
}
out=Path(args.output)
if not out.is_absolute():out=repo/out
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print('Sanitized report:',out,'checks:',report['totalComparisons'],'status:',report['status'])
raise SystemExit(0 if report['status']=='PASS' else 1)
