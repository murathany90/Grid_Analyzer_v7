/** Development-only V4 scenario parity harness. Reads private SAVs, writes aggregate evidence only. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {decodeSav} from '../src/importers/psse/sav';
import {validatePsse} from '../src/importers/psse/common';
import {normalizePsseBusBranch} from '../src/domain/psse/network';
import {solvePsseNewton} from '../src/analysis/psse/newton';
import {solvePsseFdns} from '../src/analysis/psse/fdns';
import type {PsseModel} from '../src/importers/psse/types';

type Vector = Record<string, number[]>;
interface ScenarioRun {profile:string;solved:number;iterations:number;sysMismatchMva:number;vmPu?:number[];vaDeg?:number[];busOrder?:number[]}
interface ScenarioCase {source:{name:string;sha256:string};scenarios:{scenario:string;runs:ScenarioRun[]}[]}
interface VendorRef {source:{name:string;sha256:string};scenarios:{scenario:string;runs:ScenarioRun[]}[]}

const quantile=(sorted:number[],q:number)=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(q*sorted.length))]!:0;
const stats=(diffs:number[])=>{const sorted=[...diffs].sort((a,b)=>a-b);return{max:sorted.at(-1)??0,mean:sorted.reduce((s,x)=>s+x,0)/(sorted.length||1),p95:quantile(sorted,.95),count:diffs.length};};

function scenarioModel(model:PsseModel,scenario:'load10'|'load20'|'lineout',openedLine:{ibus:number;jbus:number;ckt:string}|null):PsseModel{
 const clone=structuredClone(model);
 if(scenario==='load10'||scenario==='load20'){
  const factor=scenario==='load10'?1.1:1.2;
  for(const equipment of clone.equipment)if(equipment.kind==='load')for(const field of ['pl','ql','ip','iq','yp','yq']){
   const value=Number(equipment.fields[field]);
   if(Number.isFinite(value))equipment.fields[field]=value*factor;
   const operating=equipment.operating[field];
   if(operating&&typeof operating.value==='number')operating.value*=factor;
  }
 }
 if(scenario==='lineout'&&openedLine){
  let matched=0;
  for(const equipment of clone.equipment)if(equipment.kind==='line'&&Number(equipment.fields.ibus)===openedLine.ibus&&Number(equipment.fields.jbus)===openedLine.jbus&&String(equipment.fields.ckt??'1')===openedLine.ckt){equipment.status=0;matched++;}
  if(!matched)throw Error(`opened line ${openedLine.ibus}-${openedLine.jbus}-${openedLine.ckt} not found in model`);
 }
 return clone;
}

function main(){
 const repo=fileURLToPath(new URL('..',import.meta.url));
 const cases=[
  {sav:`${repo}private-re/ac-v3-reference/20261026_1600_SN1_TR0.sav`},
  {sav:'C:/Program Files/PTI/PSSE36/36.5/control1/20261014_1200_SN3_TR0.sav'},
 ];
 const vendor:VendorRef[]=JSON.parse(readFileSync(`${repo}private-re/ac-v4-reference/scenario-reference.json`,'utf8'));
 const logPath=`${repo}private-re/ac-v4-reference/scenario-opened-lines.json`;
 const opened:Record<string,{ibus:number;jbus:number;ckt:string}>=existsSync(logPath)?JSON.parse(readFileSync(logPath,'utf8')):{};
 const report:Record<string,unknown>[]=[];
 for(const {sav} of cases){
  const bytes=readFileSync(sav),model=decodeSav(bytes,sav.split('/').pop()!);
  validatePsse(model);
  const sha=vendor.find(v=>v.source.name===model.source.name)?.source.sha256;
  if(!sha)throw Error(`no vendor reference for ${model.source.name}`);
  const network=normalizePsseBusBranch(model);
  const fdns=solvePsseFdns({model,network,options:{tolerancePu:0.001,maxIterations:80,maxQLimitRounds:12,initialVoltagePolicy:'SOURCE_SAVED'}});
  const fdnsStrict=solvePsseFdns({model,network,options:process.env.GA_PSSE_REMOTE==='1'?{tolerancePu:1e-5,maxIterations:80,maxQLimitRounds:12,initialVoltagePolicy:'SOURCE_SAVED',remoteRegulation:true,automaticAdjustments:true}:{tolerancePu:1e-5,maxIterations:80,maxQLimitRounds:12,initialVoltagePolicy:'SOURCE_SAVED'}});
  const fdnsRow={profile:'fdns-operational-0.001pu',status:fdns.status,classification:fdns.classification,maxMismatchPu:Math.max(fdns.maxPMismatchPu??0,fdns.maxQMismatchPu??0),
   strictStatus:fdnsStrict.status,strictMaxMismatchPu:Math.max(fdnsStrict.maxPMismatchPu??0,fdnsStrict.maxQMismatchPu??0)};
  const rows:Record<string,unknown>[]=[];
  for(const scenarioRun of vendor.find(v=>v.source.sha256===sha)!.scenarios){
   const vendorSolved=scenarioRun.runs.filter(r=>r.solved===0&&r.vmPu);
   if(!vendorSolved.length){rows.push({scenario:scenarioRun.scenario,gaStatus:'SKIPPED_NO_VENDOR_SOLUTION'});continue;}
   const openedLine=scenarioRun.scenario==='lineout'?opened[sha]??null:null;
   const modified=scenarioModel(model,scenarioRun.scenario as 'load10'|'load20'|'lineout',openedLine);
   const modifiedNetwork=normalizePsseBusBranch(modified);
   const ga=solvePsseNewton({model:modified,network:modifiedNetwork,options:process.env.GA_PSSE_REMOTE==='1'?{tolerancePu:1e-5,maxIterations:80,maxQLimitRounds:12,initialVoltagePolicy:'SOURCE_SAVED',remoteRegulation:true,automaticAdjustments:true}:{tolerancePu:1e-5,maxIterations:80,maxQLimitRounds:12,initialVoltagePolicy:'SOURCE_SAVED'}});
   const gaVm=new Map<string,{vm:number;va:number}>();
   modifiedNetwork.buses.forEach((bus,index)=>{const result=ga.busResults.find(b=>b.connectionKey===bus.connectionKey);if(result?.vmPu!==null&&result?.vmPu!==undefined&&bus.externalNumber!==null)gaVm.set(String(bus.externalNumber),{vm:result.vmPu,va:result.vaDeg??0});});
   for(const run of vendorSolved){
    const vmDiff:number[]=[],vaDiff:number[]=[];let unmatched=0;
    const order=run.busOrder??[];
    order.forEach((busNumber,index)=>{
     const gaValue=gaVm.get(String(busNumber));
     const vendorVm=run.vmPu?.[index];
     if(!gaValue||vendorVm===undefined||!Number.isFinite(vendorVm)){unmatched++;return;}
     vmDiff.push(Math.abs(gaValue.vm-vendorVm));
     const vendorVa=run.vaDeg?.[index]??0;
     const wrap=(x:number)=>(x+180)%360-180;
     vaDiff.push(Math.abs(wrap(gaValue.va-vendorVa)));
    });
    rows.push({scenario:scenarioRun.scenario,vendorProfile:run.profile,vendorIterations:run.iterations,gaStatus:ga.status,gaClassification:ga.classification,
     gaMaxMismatchPu:Math.max(ga.maxPMismatchPu??0,ga.maxQMismatchPu??0),comparedBuses:vmDiff.length,unmatchedBuses:unmatched,
     vm:stats(vmDiff),vaDeg:stats(vaDiff)});
   }
  }
  report.push({source:{name:model.source.name,sha256:model.source.sha256},fdns:fdnsRow,scenarios:rows});
  console.log(JSON.stringify({source:model.source.name,fdns:fdnsRow,scenarios:rows},null,1));
 }
 writeFileSync(`${repo}evidence/psse-v4/${process.env.GA_PSSE_REMOTE==='1'?'scenario-parity-remote-wip.json':'scenario-parity.json'}`,JSON.stringify({schema:'ga.psse.v4-scenario-parity.v1',generatedAt:new Date().toISOString(),toleranceNote:'GA NR tolerance 1e-5 pu (0.001 MVA at 100 MVA base); vendor profiles at 0.001 MVA.',cases:report},null,2)+'\n');
 console.log('wrote evidence/psse-v4/scenario-parity.json');
}
main();
