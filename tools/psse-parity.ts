/** Independent licensed-reference comparison; publishes aggregates only. */
import fs from 'node:fs';
import path from 'node:path';
import {decodePsse} from '../src/importers/psse/decode';
import {normalizePsseBusBranch} from '../src/domain/psse/network';
import {solvePsseNewton,type PsseSolveInput} from '../src/analysis/psse/newton';
import type {PsseCalculationResult} from '../src/domain/psse/results';
import type {PsseEquipment} from '../src/importers/psse/types';

type Columns=Record<string,(number|string)[]>;
interface Reference {source:{name:string;sha256:string};optionsHash:string;spec:{method:string;options:number[];toleranceMva:number;harnessVersion:number;profile?:string};ierr:number;solved:number;iterations:number;buses:Columns;generators:Columns;branches:Columns;windings:Columns;threeWinding:Columns;exportErrors:unknown[];dcReport?:{flowResolutionMw:number;flows:{from:number;to:number|null;circuit:string;pMw:number;winding?:number;transformerName?:string}[];unparsedRows:string[]}}
const args=process.argv.slice(2),method=args.includes('--fdns')?'FDNS_XB':args.includes('--dc')?'LOSSLESS_DC':'NR_POLAR',qLimits=args.includes('--q-limits'),warm=args.includes('--warm');
const label=args.find(x=>x.startsWith('--label='))?.slice(8)??'';
if(label&&!/^[a-z0-9-]+$/.test(label))throw Error('Invalid evidence label');
const files=args.filter(x=>!x.startsWith('--'));
const defaultNames=['basic','zip','q-limits','tap','phase','three-winding','cm2','shunt'];
if(!files.length)files.push(...defaultNames.map(name=>`.tmp/psse-synthetic/${name}.rawx`));
const referenceMethod=method==='FDNS_XB'?'fdns':method==='LOSSLESS_DC'?'dclf_2':'fnsl';
const referenceFiles=fs.readdirSync('private-re/solver-reference',{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>path.join('private-re/solver-reference',e.name,'reference.json')).filter(f=>fs.existsSync(f));
const references=referenceFiles.map(file=>({file,data:JSON.parse(fs.readFileSync(file,'utf8')) as Reference}));
const metrics=(values:number[])=>{const sorted=values.map(Math.abs).sort((a,b)=>a-b);return {count:sorted.length,max:sorted.length?sorted.at(-1)!:null,mean:sorted.length?sorted.reduce((a,b)=>a+b,0)/sorted.length:null,p95:sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]:null};};
const angle=(a:number,b:number)=>((a-b+180)%360+360)%360-180;
const numeric=(c:Columns,k:string,i:number)=>Number(c[k]?.[i]);
const text=(c:Columns,k:string,i:number)=>String(c[k]?.[i]??'').trim();
const reports:Record<string,unknown>[]=[];
const privateReports:unknown[]=[];
const started=performance.now();
let solver:(input:PsseSolveInput)=>PsseCalculationResult=solvePsseNewton;
if(method!=='NR_POLAR'){
 const moduleName=method==='FDNS_XB'?'fdns':'dc';
 const module=await import('../src/analysis/psse/'+moduleName+'.ts');
 solver=(module[method==='FDNS_XB'?'solvePsseFdns':'solvePsseDc']) as typeof solver;
 if(typeof solver!=='function')throw Error('Missing independent solver export: '+method);
}
for(const file of files){
 const bytes=fs.readFileSync(file),model=await decodePsse(Uint8Array.from(bytes).buffer,path.basename(file)),network=normalizePsseBusBranch(model);
 const initial=warm?'SOURCE_SAVED':'FLAT',requestedQFlag=qLimits?0:-1;
 const matching=references.filter(({data:r})=>r.source.sha256===model.source.sha256&&r.spec.method===referenceMethod&&r.spec.harnessVersion>=2&&(method==='LOSSLESS_DC'?r.spec.options[0]===0&&r.spec.options[1]===0:r.spec.options.slice(0,5).every(value=>value===0)&&r.spec.options[5]===(warm?0:1)&&r.spec.options[6]===requestedQFlag));
 matching.sort((a,b)=>a.data.spec.toleranceMva-b.data.spec.toleranceMva);
 const reference=matching[0]?.data;
 const result=solver({model,network,options:{reactiveLimitsEnabled:qLimits,initialVoltagePolicy:initial,tolerancePu:1e-8,maxIterations:150}});
 const header={name:path.basename(file),sha256:model.source.sha256,normalizedHash:network.modelHash,method,initial,qLimits,gaStatus:result.status,gaPhysicsCoverage:result.physicsCoverage,gaSource:result.source,engineVersion:result.identity.engineVersion,gaIterations:result.iterations,gaElapsedMs:result.elapsedMs,gaMaxPMismatchPu:result.maxPMismatchPu,gaMaxQMismatchPu:result.maxQMismatchPu,networkCounts:{buses:network.buses.length,branches:network.branches.length},reference:reference?{method:reference.spec.method,options:reference.spec.options,profile:reference.spec.profile,toleranceMva:reference.spec.toleranceMva,optionsHash:reference.optionsHash,ierr:reference.ierr,solved:reference.solved,iterations:reference.iterations}:null};
 if(result.status!=='CONVERGED'||!reference||reference.ierr!==0||method!=='LOSSLESS_DC'&&reference.solved!==0){const report={...header,status:result.status==='BLOCKED'?'BLOCKED':!reference?'NO_REFERENCE':reference.solved!==0&&method!=='LOSSLESS_DC'?'REFERENCE_NOT_CONVERGED':'GA_NOT_CONVERGED',findingCounts:Object.fromEntries([...new Set(result.findings.map(f=>f.code))].map(code=>[code,result.findings.filter(f=>f.code===code).length]))};reports.push(report);privateReports.push({file,report,result});console.log(JSON.stringify(report));continue;}
 const vm:number[]=[],va:number[]=[],pg:number[]=[],qg:number[]=[],pflow:number[]=[],qflow:number[]=[],ploss:number[]=[],qloss:number[]=[],tap:number[]=[],missing:string[]=[],detail:unknown[]=[];
 const equipment=new Map(model.equipment.map(e=>[e.id,e]));
 const external=(key:string)=>network.buses.find(b=>b.connectionKey===key)?.externalNumber;
 const busIndices=new Map<number,number>();for(let i=0;i<reference.buses.NUMBER.length;i++){const n=numeric(reference.buses,'NUMBER',i);if(busIndices.has(n))throw Error('Ambiguous external bus number in reference');busIndices.set(n,i);}
 const refBus=network.buses.find(b=>b.type===3&&b.source),gaRef=result.busResults.find(b=>b.connectionKey===refBus?.connectionKey),refIndex=refBus?.externalNumber===null?undefined:busIndices.get(refBus?.externalNumber??-1),offset=gaRef?.vaDeg!==null&&gaRef?.vaDeg!==undefined&&refIndex!==undefined?gaRef.vaDeg-numeric(reference.buses,'ANGLE',refIndex)*180/Math.PI:0;
 for(const b of result.busResults){const source=network.buses.find(x=>x.connectionKey===b.connectionKey);if(!source?.source||source.status!==1)continue;const i=busIndices.get(source.externalNumber??-1);if(i===undefined){missing.push('bus:'+b.id);continue;}const rv=numeric(reference.buses,'PU',i),ra=numeric(reference.buses,'ANGLE',i)*180/Math.PI;if(method!=='LOSSLESS_DC'&&b.vmPu!==null)vm.push(b.vmPu-rv);if(b.vaDeg!==null)va.push(angle(b.vaDeg-offset,ra));}
 for(const g of result.generatorResults){if(method==='LOSSLESS_DC')continue;const e=equipment.get(g.sourceEquipmentId);if(!e||e.status!==1)continue;const n=Number(e.fields.ibus),id=String(e.fields.machid).trim(),i=reference.generators.NUMBER.findIndex((number,j)=>Number(number)===n&&text(reference.generators,'ID',j)===id);if(i<0){missing.push('generator:'+g.id);continue;}if(g.pMw!==null)pg.push(g.pMw-numeric(reference.generators,'PGEN',i));if(g.qMvar!==null)qg.push(g.qMvar-numeric(reference.generators,'QGEN',i));}
 function recordFlow(br:PsseCalculationResult['branchResults'][number],from:number,to:number|undefined,circuit:string,source:PsseEquipment,winding?:number){
  if(method==='LOSSLESS_DC'){
   const rows=reference!.dcReport?.flows??[],i=rows.findIndex(x=>x.from===from&&x.circuit===circuit&&(winding!==undefined?x.winding===winding:x.to===to));
   if(i<0||br.pFromMw===null){missing.push('dc-flow:'+br.id);return;}pflow.push(br.pFromMw-rows[i].pMw);
   if(winding===undefined){const j=rows.findIndex(x=>x.from===to&&x.to===from&&x.circuit===circuit);if(j<0||br.pToMw===null)missing.push('dc-to-flow:'+br.id);else pflow.push(br.pToMw-rows[j].pMw);}
   return;
  }
  if(winding!==undefined){const c=reference!.windings,i=c.WNDNUM.findIndex((w,j)=>Number(w)===winding&&numeric(c,'WIND1NUMBER',j)===Number(source.fields.ibus)&&numeric(c,'WIND2NUMBER',j)===Number(source.fields.jbus)&&numeric(c,'WIND3NUMBER',j)===Number(source.fields.kbus)&&text(c,'ID',j)===circuit);if(i<0){missing.push('winding:'+br.id);return;}if(br.pFromMw!==null)pflow.push(br.pFromMw-numeric(c,'P',i));if(br.qFromMvar!==null)qflow.push(br.qFromMvar-numeric(c,'Q',i));const physical=network.branches.find(x=>x.id===br.id);if(physical&&c.RATIO)tap.push(physical.tapFrom-numeric(c,'RATIO',i));return;}
  const c=reference!.branches,find=(f:number,t:number|undefined)=>c.FROMNUMBER.findIndex((v,j)=>Number(v)===f&&numeric(c,'TONUMBER',j)===t&&text(c,'ID',j)===circuit),i=find(from,to),j=find(to!,from);
  if(i<0||j<0){missing.push('branch:'+br.id);return;}
  if(br.pFromMw!==null)pflow.push(br.pFromMw-numeric(c,'P',i));if(br.pToMw!==null)pflow.push(br.pToMw-numeric(c,'P',j));if(br.qFromMvar!==null)qflow.push(br.qFromMvar-numeric(c,'Q',i));if(br.qToMvar!==null)qflow.push(br.qToMvar-numeric(c,'Q',j));
  if(br.pLossMw!==null)ploss.push(br.pLossMw-(numeric(c,'P',i)+numeric(c,'P',j)));if(br.qLossMvar!==null)qloss.push(br.qLossMvar-(numeric(c,'Q',i)+numeric(c,'Q',j)));
 }
 for(const br of result.branchResults){const physical=network.branches.find(x=>x.id===br.id),source=equipment.get(br.sourceEquipmentId);if(!physical||physical.status!==1||!source)continue;const from=external(br.terminalFrom),to=external(br.terminalTo);if(from===null||from===undefined){missing.push('branch-terminal:'+br.id);continue;}const circuit=String(source.fields.ckt??'1').trim();recordFlow(br,from,to??undefined,circuit,source,physical.kind==='three-winding-leg'?Number(physical.windingId):undefined);}
 if(method!=='LOSSLESS_DC')for(const source of model.equipment.filter(e=>e.kind==='transformer'&&e.buses.length===3&&e.status===1)){
  const c=reference.windings,indices=c.WNDNUM.map((_,i)=>i).filter(i=>numeric(c,'WIND1NUMBER',i)===Number(source.fields.ibus)&&numeric(c,'WIND2NUMBER',i)===Number(source.fields.jbus)&&numeric(c,'WIND3NUMBER',i)===Number(source.fields.kbus)&&text(c,'ID',i)===String(source.fields.ckt).trim()),legs=result.branchResults.filter(b=>b.sourceEquipmentId===source.id);
  if(indices.length===3&&legs.length===3){ploss.push(legs.reduce((sum,b)=>sum+(b.pFromMw??0),0)-indices.reduce((sum,i)=>sum+numeric(c,'P',i),0));qloss.push(legs.reduce((sum,b)=>sum+(b.qFromMvar??0),0)-indices.reduce((sum,i)=>sum+numeric(c,'Q',i),0));}else missing.push('three-winding-loss:'+source.id);
 }
 const statistics={vmPu:metrics(vm),vaDeg:metrics(va),pgMw:metrics(pg),qgMvar:metrics(qg),terminalPMw:metrics(pflow),terminalQMvar:metrics(qflow),branchLossMw:metrics(ploss),branchLossMvar:metrics(qloss),tapPu:metrics(tap)};
 const limits={vmPu:1e-4,vaDeg:.05,pgMw:.5,qgMvar:.5,terminalPMw:method==='LOSSLESS_DC'?.051:.5,terminalQMvar:.5,branchLossMw:.5,branchLossMvar:.5,tapPu:1e-5};
 const violations=Object.entries(statistics).filter(([k,v])=>v.max!==null&&v.max>limits[k as keyof typeof limits]).map(([k])=>k),required=va.length>0&&pflow.length>0&&(method==='LOSSLESS_DC'||vm.length>0&&qg.length>0&&qflow.length>0);
 const report={...header,status:!required||missing.length?'INCOMPLETE_COMPARISON':violations.length?'DIFFERENCES':'PASS',statistics,limits,violations,missingCount:missing.length,referenceExportErrors:reference.exportErrors.length,dcUnparsedRows:reference.dcReport?.unparsedRows.length??null};
 reports.push(report);privateReports.push({file,report,result,missing,detail,differences:{vmPu:vm,vaDeg:va,pgMw:pg,qgMvar:qg,terminalPMw:pflow,terminalQMvar:qflow,branchLossMw:ploss,branchLossMvar:qloss,tapPu:tap}});console.log(JSON.stringify(report));
}
fs.mkdirSync('evidence/psse-ac-dc',{recursive:true});fs.mkdirSync('private-re/parity',{recursive:true});
const suffix=method.toLowerCase()+(qLimits?'-q-limits':'')+(warm?'-warm':'')+(label?'-'+label:'');
fs.writeFileSync('evidence/psse-ac-dc/parity-'+suffix+'.json',JSON.stringify({schema:'ga.psse.parity.v1',elapsedMs:performance.now()-started,reports},null,2)+'\n');
fs.writeFileSync('private-re/parity/'+suffix+'.json',JSON.stringify(privateReports,null,2)+'\n');
if(reports.some(r=>['DIFFERENCES','GA_NOT_CONVERGED','INCOMPLETE_COMPARISON'].includes(String(r.status))))process.exitCode=1;
