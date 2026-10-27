/** Development-only, cached-result export. Licensed values stay in ignored private-re. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decodePsse} from '../src/importers/psse/decode';
import {normalizePsseBusBranch} from '../src/domain/psse/network';
import type {PsseCalculationResult} from '../src/domain/psse/results';

type Row=(string|number|null)[];
type Columns=Record<string,(number|string)[]>;
interface Reference {source:{sha256:string};optionsHash:string;spec:{method:string;options:number[]};ierr:number;solved:number;iterations:number;buses:Columns;generators:Columns;branches:Columns;dcReport?:{flows:{from:number;to:number|null;circuit:string;pMw:number;winding?:number}[]}}
interface Cached {file:string;report:{name:string;sha256:string;statistics:Record<string,{count:number;max:number|null;mean:number|null;p95:number|null}>;reference:{optionsHash:string};status:string};result:PsseCalculationResult}
const out=path.resolve('private-re/v2-parity-export');fs.mkdirSync(out,{recursive:true});
const refs=fs.readdirSync('private-re/solver-reference').map(x=>path.join('private-re/solver-reference',x,'reference.json')).filter(x=>fs.existsSync(x)).map(x=>JSON.parse(fs.readFileSync(x,'utf8')) as Reference);
const records=JSON.parse(fs.readFileSync('private-re/parity/lossless_dc-v2-real.json','utf8')) as Cached[];
const csvFiles:{file:string;rows:number;sha256:string}[]=[];
const csv=(name:string,headers:string[],rows:Row[])=>{
 const quote=(v:string|number|null)=>v===null?'':typeof v==='number'?String(v):'"'+v.replaceAll('"','""')+'"';
 const content='\ufeff'+[headers,...rows].map(r=>r.map(quote).join(',')).join('\r\n')+'\r\n';
 fs.writeFileSync(path.join(out,name+'.csv'),content);csvFiles.push({file:name+'.csv',rows:rows.length,sha256:createHash('sha256').update(content).digest('hex')});
};
const n=(c:Columns,k:string,i:number)=>{const x=Number(c[k]?.[i]);return Number.isFinite(x)?x:null;};
const t=(c:Columns,k:string,i:number)=>String(c[k]?.[i]??'').trim();
const wrap=(x:number)=>((x+180)%360+360)%360-180;
const book:{summary:Row[];buses:Row[];branches:Row[];generators:Row[];experiments:Row[];notes:string[]}={summary:[],buses:[],branches:[],generators:[],experiments:[],notes:[
 'DC compares angle and directed terminal MW only. Vm, Q, current and AC losses are not DC solutions.',
 'DC Dal contains the worst 200 directed terminal differences per model; the CSVs contain every matched terminal. Summary statistics use every matched quantity, not the worksheet sample.',
 'Üretim compares SOURCE_SAVED with converged PSSE_REFERENCE FNSL. GA AC fields are blank because the real-model AC profile is BLOCKED; no GA AC delta is claimed.',
 'Source files and licensed derived inventories are local-only. This workbook does not certify strict PSS/E equivalence. DC strict threshold remains 0.051 MW.'
]};
for(const record of records){
 const {report,result}=record;
 if(result.identity.engineVersion!=='GA_PSSE_ENGINE_2')throw Error('Refresh Engine2 cached parity first');
 const model=await decodePsse(Uint8Array.from(fs.readFileSync(record.file)).buffer,path.basename(record.file)),network=normalizePsseBusBranch(model);
 if(model.source.sha256!==report.sha256||network.modelHash!==result.identity.modelHash)throw Error('Cached source/model identity mismatch');
 const reference=refs.find(r=>r.source.sha256===report.sha256&&r.spec.method==='dclf_2'&&r.optionsHash===report.reference.optionsHash);
 const ac=refs.find(r=>r.source.sha256===report.sha256&&r.spec.method==='fnsl'&&r.spec.options.slice(0,6).every(v=>v===0)&&r.spec.options[6]===0&&r.ierr===0&&r.solved===0);
 if(!reference||reference.ierr!==0||!ac)throw Error('Missing cached oracle');
 const tag=report.name.replace(/\.sav$/i,''),id=result.identity;
 const meta=[tag,report.sha256,id.modelHash,id.topologyHash,id.scenarioHash,id.optionsHash,id.engineVersion];
 const metaHeader=['case','source_sha256','model_hash','topology_hash','scenario_hash','ga_options_hash','engine_version'];
 const busIndex=new Map(reference.buses.NUMBER.map((v,i)=>[Number(v),i]));
 const sourceBuses=new Map(network.buses.map(b=>[b.connectionKey,b]));
 const slack=network.buses.find(b=>b.type===3&&b.source),gaSlack=result.busResults.find(b=>b.connectionKey===slack?.connectionKey),slackI=busIndex.get(slack?.externalNumber??-1);
 if(!gaSlack||gaSlack.vaDeg===null||slackI===undefined)throw Error('Missing reference angle origin');
 const offset=gaSlack.vaDeg-Number(reference.buses.ANGLE[slackI])*180/Math.PI;
 const savedBus:Row[]=[],gaBus:Row[]=[],refBus:Row[]=[],acBus:Row[]=[],busCompare:Row[]=[];
 for(const b of network.buses){if(!b.source)continue;
  savedBus.push([...meta,'SOURCE_SAVED',b.externalNumber,b.status,b.type,b.baseKv,b.initialVm,b.initialVaDeg]);
 }
 for(const b of result.busResults){const s=sourceBuses.get(b.connectionKey);if(!s?.source)continue;
  gaBus.push([...meta,'GA_PSSE_CALCULATED','LOSSLESS_DC',result.status,'LIMITED_PROFILE',s.externalNumber,s.status,b.vmPu,b.vaDeg,b.pGenerationMw,b.qGenerationMvar]);
  const i=busIndex.get(s.externalNumber??-1);if(s.status!==1||i===undefined||b.vaDeg===null)continue;
  const ra=Number(reference.buses.ANGLE[i])*180/Math.PI,aligned=ra+offset,delta=wrap(b.vaDeg-aligned);
  busCompare.push([tag,s.externalNumber,s.baseKv,s.type,s.initialVm,s.initialVaDeg,b.vaDeg,aligned,delta,Math.abs(delta)]);
 }
 for(let i=0;i<reference.buses.NUMBER.length;i++)refBus.push([tag,report.sha256,'PSSE_REFERENCE','DCLF_2',reference.optionsHash,n(reference.buses,'NUMBER',i),n(reference.buses,'TYPE',i),null,n(reference.buses,'TYPE',i)===4?null:Number(reference.buses.ANGLE[i])*180/Math.PI,null]);
 for(let i=0;i<ac.buses.NUMBER.length;i++)acBus.push([tag,report.sha256,'PSSE_REFERENCE','FNSL',ac.optionsHash,ac.solved,n(ac.buses,'NUMBER',i),n(ac.buses,'TYPE',i),n(ac.buses,'TYPE',i)===4?null:n(ac.buses,'PU',i),n(ac.buses,'TYPE',i)===4?null:Number(ac.buses.ANGLE[i])*180/Math.PI]);
 csv(tag+'-SOURCE_SAVED-BUS',[...metaHeader,'source_category','bus','status','ide','base_kv','vm_pu','va_deg'],savedBus);
 csv(tag+'-GA_DC-BUS',[...metaHeader,'source_category','method','numerical_status','publication_status','bus','status','vm_pu_not_solved','va_deg','p_generation_mw','q_mvar_not_solved'],gaBus);
 csv(tag+'-PSSE_REFERENCE_DC-BUS',['case','source_sha256','source_category','method','reference_options_hash','bus','type','vm_pu_not_solved','va_deg','q_mvar_not_solved'],refBus);
 csv(tag+'-PSSE_REFERENCE_FNSL-BUS',['case','source_sha256','source_category','method','reference_options_hash','solved','bus','type','vm_pu','va_deg'],acBus);
 csv(tag+'-DC_BUS-COMPARISON',['case','bus','base_kv','ide','source_vm_pu','source_va_deg','ga_dc_va_deg','reference_dc_va_aligned_deg','delta_deg','absolute_delta_deg'],busCompare);
 book.buses.push(...busCompare);
 const flows=new Map((reference.dcReport?.flows??[]).map(f=>[[f.from,f.to,f.circuit].join('|'),f]));
 const equipment=new Map(model.equipment.map(e=>[e.id,e])),physical=new Map(network.branches.map(b=>[b.id,b]));
 const gaBranch:Row[]=[],branchCompare:Row[]=[];
 csv(tag+'-SOURCE_DERIVED-BRANCH',[...metaHeader,'source_category','branch_id','kind','status','from_bus','to_bus','x_pu','tap_from_pu','tap_to_pu','phase_deg','provenance'],network.branches.map(b=>[...meta,'SOURCE_SAVED',b.id,b.kind,b.status,b.fromKey,b.toKey,b.xPu,b.tapFrom,b.tapTo,b.phaseDeg,'source fields normalized on system/bus bases; fixed input, not a solved control']));
 for(const br of result.branchResults){const p=physical.get(br.id),s=equipment.get(br.sourceEquipmentId);if(!p||!s)throw Error('Missing branch identity');
  gaBranch.push([...meta,'GA_PSSE_CALCULATED',br.id,p.kind,p.status,p.fromKey,p.toKey,br.pFromMw,br.pToMw,null,null,null,'DC_LOSSLESS_APPROXIMATION']);
  if(p.status!==1)continue;
  for(const [from,to,pMw,end] of [[p.fromKey,p.toKey,br.pFromMw,'FROM'],[p.toKey,p.fromKey,br.pToMw,'TO']] as const){
   if(pMw===null)continue;const f=flows.get([Number(from),Number(to),String(s.fields.ckt??'1').trim()].join('|'));if(!f)throw Error('Missing directed DC identity '+br.id+end);
   branchCompare.push([tag,br.id,p.kind,Number(from),Number(to),String(s.fields.ckt??'1').trim(),end,pMw,f.pMw,pMw-f.pMw,Math.abs(pMw-f.pMw),p.xPu]);
  }
 }
 csv(tag+'-GA_DC-BRANCH',[...metaHeader,'source_category','branch_id','kind','status','from_bus','to_bus','p_from_mw','p_to_mw','q_not_solved','ac_loss_not_solved','ac_current_not_solved','profile'],gaBranch);
 csv(tag+'-PSSE_REFERENCE_DC-BRANCH',['case','source_sha256','source_category','reference_options_hash','from_bus','to_bus','circuit','p_mw'],(reference.dcReport?.flows??[]).map(f=>[tag,report.sha256,'PSSE_REFERENCE',reference.optionsHash,f.from,f.to,f.circuit,f.pMw]));
 csv(tag+'-DC_BRANCH-COMPARISON',['case','branch_id','kind','from_bus','to_bus','circuit','end','ga_p_mw','reference_p_mw','delta_mw','absolute_delta_mw','source_x_pu'],branchCompare);
 book.branches.push(...[...branchCompare].sort((a,b)=>Number(b[10])-Number(a[10])).slice(0,200));
 const savedGen:Row[]=[],gaGen:Row[]=[],refGen:Row[]=[],genCompare:Row[]=[];
 const acGenIndex=new Map(ac.generators.NUMBER.map((v,i)=>[[Number(v),t(ac.generators,'ID',i)].join('|'),i]));
 for(const g of network.generators){const e=equipment.get(g.id)!;const bus=network.buses[g.bus].externalNumber,gi=acGenIndex.get([bus,String(e.fields.machid??'1').trim()].join('|'));
  savedGen.push([...meta,'SOURCE_SAVED',g.id,bus,g.status,g.pMw,g.qMvar]);
  genCompare.push([tag,g.id,bus,g.status,g.pMw,g.qMvar,gi===undefined?null:n(ac.generators,'PGEN',gi),gi===undefined?null:n(ac.generators,'QGEN',gi),null,null,'GA_AC_BLOCKED']);
 }
 for(const g of result.generatorResults)gaGen.push([...meta,'GA_PSSE_CALCULATED','LOSSLESS_DC',g.id,g.pMw,null,g.limitState]);
 for(let i=0;i<ac.generators.NUMBER.length;i++)refGen.push([tag,report.sha256,'PSSE_REFERENCE','FNSL',ac.optionsHash,ac.solved,n(ac.generators,'NUMBER',i),t(ac.generators,'ID',i),n(ac.generators,'STATUS',i),n(ac.generators,'PGEN',i),n(ac.generators,'QGEN',i)]);
 csv(tag+'-SOURCE_SAVED-GENERATOR',[...metaHeader,'source_category','generator_id','bus','status','pg_mw','qg_mvar'],savedGen);
 csv(tag+'-GA_DC-GENERATOR',[...metaHeader,'source_category','method','generator_id','pg_mw','qg_not_solved','individual_dispatch_state'],gaGen);
 csv(tag+'-PSSE_REFERENCE_FNSL-GENERATOR',['case','source_sha256','source_category','method','reference_options_hash','solved','bus','id','status','pg_mw','qg_mvar'],refGen);
 csv(tag+'-PSSE_REFERENCE_FNSL-BRANCH',['case','source_sha256','source_category','method','reference_options_hash','solved','from_bus','to_bus','circuit','status','p_mw','q_mvar','p_loss_mw','q_loss_mvar'],ac.branches.FROMNUMBER.map((v,i)=>[tag,report.sha256,'PSSE_REFERENCE','FNSL',ac.optionsHash,ac.solved,Number(v),n(ac.branches,'TONUMBER',i),t(ac.branches,'ID',i),n(ac.branches,'STATUS',i),n(ac.branches,'P',i),n(ac.branches,'Q',i),n(ac.branches,'PLOSS',i),n(ac.branches,'QLOSS',i)]));
 csv(tag+'-GENERATOR-COMPARISON',['case','generator_id','bus','status','source_pg_mw','source_qg_mvar','psse_fnsl_pg_mw','psse_fnsl_qg_mvar','ga_ac_pg_unavailable','ga_ac_qg_unavailable','ga_ac_status'],genCompare);book.generators.push(...genCompare);
 for(const [metric,stats]of Object.entries(report.statistics))book.summary.push([tag,'LOSSLESS_DC',metric,stats.count,stats.max,stats.mean,stats.p95,metric==='terminalPMw'?.051:metric==='vaDeg'?.05:null,report.status,'LIMITED_PROFILE']);
 book.experiments.push([tag,report.sha256,id.modelHash,id.optionsHash,id.engineVersion,'DCLF_2',JSON.stringify(reference.spec.options),reference.optionsHash,reference.ierr,reference.solved,reference.iterations,report.status]);
 book.experiments.push([tag,report.sha256,id.modelHash,null,id.engineVersion,'FNSL',JSON.stringify(ac.spec.options),ac.optionsHash,ac.ierr,ac.solved,ac.iterations,'GA_AC_BLOCKED']);
 if(busCompare.length!==report.statistics.vaDeg.count||branchCompare.length!==report.statistics.terminalPMw.count)throw Error('Export count differs from authoritative comparison');
 // FNSL source data is separate; it is never substituted for blocked GA AC.
}
fs.writeFileSync(path.join(out,'workbook-data.json'),JSON.stringify(book));
const manifest={schema:'ga.psse.v2.local-comparison-export.v1',source:'cached production Engine2 + licensed API reference; no solver rerun',files:csvFiles,workbookRows:Object.fromEntries(Object.entries(book).filter(([k])=>k!=='notes').map(([k,v])=>[k,v.length]))};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output:out,...manifest.workbookRows,files:csvFiles.length}));
