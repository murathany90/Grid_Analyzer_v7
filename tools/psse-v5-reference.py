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
    # no flat start, immediate Q limits, non-divergent Newton enabled.
    options=[0,0,0,0,0,0,0,1]
    files=[Path(arg).resolve() for arg in sys.argv[1:]]
    if not files:files=sorted((ROOT/'.tmp'/'psse-v5-fixtures').glob('*.rawx'))
    records=[]
    def columns(api,args,fields):
        result={}
        for field in fields:
            ierr,values=getattr(psspy,api)(*args,[field])
            if ierr:raise RuntimeError(f'{api} {field}: {ierr}')
            result[field]=list(values[0])
        return result
    for filename in files:
        digest=hashlib.sha256(filename.read_bytes()).hexdigest()
        ierr=psspy.case(str(filename)) if filename.suffix.lower()=='.sav' else psspy.readrawx(str(filename),'network','new')
        record={'sourceSha256':digest,'fixture':filename.stem,'version':psspy.psseversion(),'loadIerr':ierr,'method':'fnsl','options':options,'initialVoltage':'SOURCE_SAVED','toleranceMva':.0001}
        if ierr:
            record['status']='REFERENCE_LOAD_BLOCKED';records.append(record);print(json.dumps({k:record[k]for k in ['fixture','status','loadIerr']}),flush=True);continue
        ints,reals=[psspy.getdefaultint()]*9,[psspy.getdefaultreal()]*21
        ints[0]=100;ints[1]=100;reals[5]=.0001
        assert psspy.solution_parameters_5(ints,reals)==0
        started=time.perf_counter();record['ierr']=psspy.fnsl(options);record['elapsedMs']=(time.perf_counter()-started)*1000
        record.update(solved=psspy.solved(),iterations=psspy.iterat(),mismatchMva=psspy.sysmsm())
        record['status']='REFERENCE_CONVERGED'if record['solved']==0 else 'REFERENCE_NOT_CONVERGED'
        if record['solved']==0:
            record['buses']={**columns('abusint',[-1,2],['NUMBER','TYPE']),**columns('abusreal',[-1,2],['PU','ANGLED'])}
            record['generators']={**columns('amachint',[-1,4],['NUMBER','STATUS']),**columns('amachchar',[-1,4],['ID']),**columns('amachreal',[-1,4],['PGEN','QGEN','QMAX','QMIN'])}
            args=[-1,1,3,4,2]
            record['branches']={**columns('abrnint',args,['FROMNUMBER','TONUMBER','STATUS']),**columns('abrnchar',args,['ID']),**columns('abrnreal',args,['P','Q','PLOSS','QLOSS'])}
            rawx=OUT/(filename.stem+'-solved.rawx');psspy.writerawx(str(rawx),'network')
        records.append(record);print(json.dumps({k:record[k]for k in ['fixture','status','ierr','solved','iterations','mismatchMva']}),flush=True)
    (OUT/'reference-current.json').write_text(json.dumps(records,indent=2,default=str)+'\n',encoding='utf8')
    psspy.pssehalt_2()

if __name__=='__main__':main()
