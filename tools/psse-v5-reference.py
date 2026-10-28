"""Original API harness. Reference model/output files stay in private-re/ only."""
from pathlib import Path
import sys,json,hashlib,time,inspect

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'private-re'/'ac-v5-reference'

def main():
    sys.path.insert(0,r'C:\Program Files\PTI\PSSE36\36.5\PSSPY314')
    import psse36,psspy
    OUT.mkdir(parents=True,exist_ok=True)
    assert psspy.psseinit(20000)==0
    for name in ['report_output','progress_output','alert_output','prompt_output']:
        getattr(psspy,name)(2,str(OUT/('v5-'+name+'.log')),[0,0])
    # Eight FNSL positions verified against installed fnsl.__doc__: fixed tap/area/phase/DC/shunt,
    # no flat start, immediate Q limits, standard Newton (non-divergent limiter disabled).
    options=[0,0,0,0,0,0,0,1 if '--nondivergent' in sys.argv else 0]
    scenarios='--scenarios' in sys.argv[1:]
    files=[Path(arg).resolve() for arg in sys.argv[1:] if not arg.startswith('--')]
    if not files:files=sorted((ROOT/'.tmp'/'psse-v5-fixtures').glob('*.rawx'))
    records=[]
    def columns(api,args,fields):
        result={}
        for field in fields:
            ierr,values=getattr(psspy,api)(*args,[field])
            if ierr:raise RuntimeError(f'{api} {field}: {ierr}')
            result[field]=list(values[0])
        return result
    jobs=[(filename,variant) for filename in files for variant in (['base','load2','load10','lineout','undo'] if scenarios else ['base'])]
    for filename,variant in jobs:
        digest=hashlib.sha256(filename.read_bytes()).hexdigest()
        ierr=psspy.case(str(filename)) if filename.suffix.lower()=='.sav' else psspy.readrawx(str(filename),'network','new')
        record={'sourceSha256':digest,'fixture':filename.stem,'scenario':variant,'version':psspy.psseversion(),'loadIerr':ierr,'method':'fnsl','options':options,'initialVoltage':'SOURCE_SAVED','toleranceMva':.001}
        if ierr:
            record['status']='REFERENCE_LOAD_BLOCKED';records.append(record);print(json.dumps({k:record[k]for k in ['fixture','status','loadIerr']}),flush=True);continue
        if '--rawx-roundtrip' in sys.argv:
            original=OUT/(filename.stem+'-original.rawx');assert psspy.writerawx(str(original),'network')==0
            assert psspy.readrawx(str(original),'network','new')==0
            record['sourceRepresentation']='LICENSED_SAV_TO_RAWX_ROUNDTRIP'
        if variant.startswith('load'):
            original=OUT/(filename.stem+'-original.rawx');assert psspy.writerawx(str(original),'network')==0
            loads=json.loads(original.read_text(encoding='utf-8-sig'))['network']['load']
            factor=1.02 if variant=='load2' else 1.1
            for row in loads['data']:
                load=dict(zip(loads['fields'],row))
                realar=[float(load.get(f) or 0)*factor for f in ['pl','ql','ip','iq','yp','yq']]+[psspy.getdefaultreal()]*2
                assert psspy.load_chng_7(load['ibus'],load['loadid'],[psspy.getdefaultint()]*7,realar)==0
        if variant in ['lineout','undo']:
            assert psspy.branch_chng_3(514510,516112,'1',[0])==0
            if variant=='undo':assert psspy.branch_chng_3(514510,516112,'1',[1])==0
        ints,reals=[psspy.getdefaultint()]*9,[psspy.getdefaultreal()]*21
        ints[0]=100;ints[1]=100;reals[5]=.001;reals[16]=.001;reals[17]=.000001
        assert psspy.solution_parameters_5(ints,reals)==0
        started=time.perf_counter();record['ierr']=psspy.fnsl(options);record['elapsedMs']=(time.perf_counter()-started)*1000
        record.update(solved=psspy.solved(),iterations=psspy.iterat(),mismatchMva=psspy.sysmsm())
        record['status']='REFERENCE_CONVERGED'if record['solved']==0 else 'REFERENCE_NOT_CONVERGED'
        if record['solved']==0:
            if filename.stem.startswith('droop-'):record['droopActual']={field:psspy.voltagedroopint('SYNTH_QV',field) for field in ['STATUS','ACTSTATUS','REGBUS','ACTREGBUS']}
            record['buses']={**columns('abusint',[-1,2],['NUMBER','TYPE']),**columns('abusreal',[-1,2],['PU','ANGLED'])}
            record['generators']={**columns('amachint',[-1,4],['NUMBER','STATUS']),**columns('amachchar',[-1,4],['ID']),**columns('amachreal',[-1,4],['PGEN','QGEN','QMAX','QMIN'])}
            args=[-1,1,3,4,2]
            record['branches']={**columns('abrnint',args,['FROMNUMBER','TONUMBER','STATUS']),**columns('abrnchar',args,['ID']),**columns('abrnreal',args,['P','Q','PLOSS','QLOSS'])}
            rawx=OUT/(filename.stem+'-'+variant+'-solved.rawx');psspy.writerawx(str(rawx),'network')
        records.append(record);print(json.dumps({k:record[k]for k in ['fixture','scenario','status','ierr','solved','iterations','mismatchMva']}),flush=True)
        target='reference-roundtrip.json' if '--rawx-roundtrip' in sys.argv else 'reference-scenarios-nondivergent-001.json' if scenarios and options[-1] else 'reference-scenarios.json' if scenarios else 'reference-current.json'
        (OUT/target).write_text(json.dumps(records,indent=2,default=str)+'\n',encoding='utf8')
    psspy.pssehalt_2()

if __name__=='__main__':main()
