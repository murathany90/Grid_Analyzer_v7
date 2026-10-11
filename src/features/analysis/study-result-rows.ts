import type {AppContext} from '../../app/contracts';
import type {BenchmarkMapSelection,BenchmarkMapData} from '../../domain/benchmark/map-layer';
import {rowObject} from '../../domain/benchmark/types';
import {buildMapPresentationData,mapCaseOptions,selectedN1Presentation,selectedScPresentation,mapReferenceRows} from '../../map/layer-policy';
import {modelPresentationIndex} from '../../map/presentation-index';

export interface StudyRow {id:string;cls:string;fid:string;name:string;pre:number|null;post:number|null;delta:number|null;unit:string;status:string;reason:string;ikss:number|null;skss:number|null;metadata:boolean}
const finite=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
/** The catalog exists independently of the gated numerical projection. */
export function studyResultRows(ctx:AppContext,selection:BenchmarkMapSelection){
  const n=ctx.network,options=selection.analysis==='LF'?[]:mapCaseOptions(ctx,selection.analysis),data=buildMapPresentationData(ctx,selection),rows:StudyRow[]=[];
  const equipment=n?modelPresentationIndex(n).equipmentByKey:null,terms=n?modelPresentationIndex(n).physicalTerminalById:null,sites=n?modelPresentationIndex(n).siteById:null;
  const entity=(cls:string,fid:string)=>equipment?.get(cls+':'+fid)??(n?modelPresentationIndex(n).equipmentByFid.get(cls+':'+fid):null)??sites?.get(fid)??terms?.get(fid);
  const row=(cls:string,fid:string,name?:string):StudyRow=>({id:cls+':'+fid,cls,fid:entity(cls,fid)?.id??fid,name:name??entity(cls,fid)?.name??fid,pre:null,post:null,delta:null,unit:'—',status:'NOT_RUN',reason:'',ikss:null,skss:null,metadata:true});
  const cell=(d:BenchmarkMapData,cls:string,fid:string)=>cls==='ElmSite'?d.sites.get(fid):d.branches.get(cls+':'+fid);
  if(selection.analysis==='SC'){
    const selected=ctx.resultView.faultId,sc=selectedScPresentation(ctx);
    for(const [fid,label] of options.filter(([id])=>!selected||id===selected)){
      const term=terms?.get(fid),r=row('ElmTerm',fid,term?.name??label),fault=selected===fid?sc.fault:sc.sc?.faults.find(f=>f.physicalTerminalFid===fid);
      r.status=selection.source==='PF'?'PF_REFERENCE_ONLY':fault?.status??(selected===fid?sc.status:'NOT_RUN');r.reason=fault?.reasons.join('; ')??sc.reason;
      if(selected===fid&&data.enabled){
        if(selection.source==='GA'&&fault?.status==='CALCULATED_NETWORK_APPROXIMATION'&&sc.sc?.profile.faultType==='3PH'){
          r.ikss=finite(fault.ikssKa);r.skss=finite(fault.skssMva);
        }else if(selection.source==='PF'){
          const read=(metric:string)=>{const cells=mapReferenceRows(ctx,{...selection,metric}).filter(c=>c.fid===fid&&c.nominalKv===term?.vnKv&&c.pf.availability!=='INVALID'&&!c.pf.qualityFlags.includes('SENTINEL_CANDIDATE'));return cells.length===1?finite(cells[0].pf.value):null;};
          r.ikss=read('ikssKa');r.skss=read('skssMva');
        }
      }
      r.metadata=r.ikss===null&&r.skss===null;rows.push(r);
    }
    // A selected native partition may use an alias terminal absent from the catalog.
    if(selected&&!rows.length&&terms?.has(selected)){const r=row('ElmTerm',selected);r.status=sc.status;r.reason=sc.reason;rows.push(r);}
  }else{
    const n1=selection.analysis==='N1'?selectedN1Presentation(ctx):null,before=n1?buildMapPresentationData(ctx,{...selection,n1Layer:'BASE'}):data,after=n1?buildMapPresentationData(ctx,{...selection,n1Layer:'POST'}):data,change=n1?buildMapPresentationData(ctx,{...selection,n1Layer:'CHANGE'}):data;
    const keys=new Set([...before.branches.keys(),...after.branches.keys(),...change.branches.keys()]);for(const key of keys){const [cls,...parts]=key.split(':'),fid=parts.join(':'),r=row(cls,fid),v=cell(after,cls,fid)??cell(before,cls,fid)??cell(change,cls,fid);r.pre=n1?finite(cell(before,cls,fid)?.value):null;r.post=finite(cell(after,cls,fid)?.value);r.delta=n1?finite(cell(change,cls,fid)?.value):null;r.unit=v?.unit??'—';r.status=n1?(selection.source==='PF'?'PF_REFERENCE_ONLY':n1.method+' · '+n1.status):v?.status??'NOT_RUN';r.reason=v?.details.join('; ')??'';r.metadata=r.pre===null&&r.post===null&&r.delta===null;rows.push(r);}
    const siteKeys=new Set(['voltageKv','postVoltagePu','voltagePu','angleDeg'].includes(selection.metric)?[...before.sites.keys(),...after.sites.keys(),...change.sites.keys()]:[]);for(const fid of siteKeys){const r=row('ElmSite',fid),v=after.sites.get(fid)??before.sites.get(fid);r.pre=n1?finite(before.sites.get(fid)?.value):null;r.post=finite(after.sites.get(fid)?.value);r.delta=n1?finite(change.sites.get(fid)?.value):null;r.unit=v?.unit??'—';r.status=n1?(selection.source==='PF'?'PF_REFERENCE_ONLY':n1.method+' · '+n1.status):v?.status??'NOT_RUN';r.metadata=r.pre===null&&r.post===null&&r.delta===null;rows.push(r);}
    if(n1&&!rows.length){
      const table=ctx.benchmark?.groups.N1.tables.N1_Cases_Raw;
      for(const [id,label] of options.filter(([id])=>!selection.caseId||id===selection.caseId)){
        const raw=table?.rows.map(values=>rowObject(table,values)).find(r=>r.caseId===id),[,cls,...parts]=id.split(':'),fid=String(raw?.outageFid??parts.join(':')),r=row(String(raw?.outageClass??cls??'ElmLne'),fid,String(raw?.outageName??label));r.id=id;
        r.status=selection.source==='PF'?'PF_REFERENCE_ONLY':selection.caseId===id?n1.status+' · AC POST: NOT_RUN':'NOT_RUN · AC POST: NOT_RUN';r.reason=n1.recorded?.reason??n1.hybrid?.reason??data.reason;rows.push(r);
      }
    }
  }
  return {rows,catalogCount:options.length,numericCount:rows.filter(r=>!r.metadata).length,data};
}
export function sortStudyRows(rows:readonly StudyRow[],key:'name'|'pre'|'post'|'delta'|'ikss'|'skss'|'status',descending:boolean){return [...rows].sort((a,b)=>{const x=a[key],y=b[key],missing=(v:typeof x)=>v===null||(typeof v==='number'&&!Number.isFinite(v)),tie=()=>a.name.localeCompare(b.name,'tr')||a.id.localeCompare(b.id);if(missing(x)||missing(y))return Number(missing(x))-Number(missing(y))||tie();const cmp=typeof x==='string'?x.localeCompare(String(y),'tr'):Number(x)-Number(y);return (descending?-cmp:cmp)||tie();});}
