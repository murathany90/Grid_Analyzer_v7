/** Local, opt-in benchmark. Reads ignored source files once and writes only aggregate metrics. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';
import {DgsModel} from '../src/importers/dgs/index';
import {mapCanonical} from '../src/importers/dgs/canonical';
import {BrowserJsPowerFlowEngine} from '../src/analysis/api/browser-js-engine';
import {emptyScenario} from '../src/domain/scenario/overlay';
import {identity} from '../src/domain/calculation/identity';
import type {BranchResult,BusResult} from '../src/domain/results/types';

type Row=Record<string,string|number|null>;
const root='kontrol1/',modelName='20260928_0900_SN1_TR0.zip',referenceName='GridAnalyzer_YTBS_FullNR_Karsilastirma_Raporu_20260928 (1).xlsx';
function cells(xml:string):Row[]{
  const rows:Row[]=[];for(const match of xml.matchAll(/<x:row\b[^>]*>([\s\S]*?)<\/x:row>/g)){
    const row:Row={};for(const cell of match[1].matchAll(/<x:c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/x:c>)/g)){
      const address=/\br="([A-Z]+)\d+"/.exec(cell[1])?.[1];if(!address)continue;
      const text=/<x:v>([\s\S]*?)<\/x:v>/.exec(cell[2]||'')?.[1];if(text==null){row[address]=null;continue;}
      const decoded=text.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
      row[address]=/\bt="n"/.test(cell[1])?Number(decoded):decoded;
    }rows.push(row);
  }return rows.slice(1);
}
const number=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;
function stats(differences:number[]){if(!differences.length)return{count:0,bias:null,mae:null,p95:null};const sorted=differences.map(Math.abs).sort((a,b)=>a-b),k=(sorted.length-1)*.95,lo=Math.floor(k),hi=Math.ceil(k);return{count:differences.length,bias:differences.reduce((a,b)=>a+b,0)/differences.length,mae:sorted.reduce((a,b)=>a+b,0)/sorted.length,p95:sorted[lo]+(sorted[hi]-sorted[lo])*(k-lo)};}
function median(values:number[]):number|null{if(!values.length)return null;const s=[...values].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;}
function baseline(lines:Row[],trafos:Row[],buses:Row[]){const line=lines.filter(r=>r.R==='Eşleşti'&&number(r.E)!=null&&number(r.I)!=null),trafo=trafos.filter(r=>r.U==='Eşleşti'&&number(r.G)!=null&&number(r.K)!=null),bus=buses.filter(r=>r.P==='Eşleşti'&&number(r.F)!=null&&number(r.I)!=null);
  const signed=(rows:Row[],actual:string,reference:string)=>stats(rows.map(r=>number(r[actual])!-number(r[reference])!));
  const q=(rows:Row[],p:string,s:string,actual:string)=>stats(rows.filter(r=>number(r[p])!=null&&number(r[s])!=null&&number(r[actual])!=null).map(r=>Math.abs(number(r[actual])!)-Math.sqrt(Math.max(0,number(r[s])!**2-number(r[p])!**2))));
  const rawAngles=bus.filter(r=>number(r.G)!=null&&number(r.J)!=null).map(r=>number(r.J)!-number(r.G)!),offset=median(rawAngles)||0;
  return{lineP:signed(line,'I','E'),line154P:signed(line.filter(r=>r.C===154),'I','E'),line400P:signed(line.filter(r=>r.C===400),'I','E'),transformerP:signed(trafo,'K','G'),lineQMagnitude:q(line,'E','F','J'),transformerQMagnitude:q(trafo,'G','H','L'),busVpu:signed(bus,'I','F'),angle:{offsetDeg:offset,...stats(rawAngles.map(v=>v-offset))}};
}
function after(lines:Row[],trafos:Row[],buses:Row[],branchRows:BranchResult[],busRows:BusResult[],referenceBusId:unknown){
  const lineById=new Map(branchRows.filter(r=>r.sourceClass==='ElmLne').map(r=>[r.id,r])),trafoById=new Map(branchRows.filter(r=>r.sourceClass==='ElmTr2').map(r=>[r.id,r]));
  const busByTerm=new Map<string,BusResult>();for(const b of busRows)for(const id of [b.id,...b.terms])busByTerm.set(id,b);
  const branchMetric=(rows:Row[],prefix:string,p:string,s:string,map:Map<string,BranchResult>)=>{
    const compared=rows.map(r=>({reference:r,actual:map.get(prefix+String(r.A))})).filter((r):r is {reference:Row;actual:BranchResult}=>!!r.actual&&number(r.reference[p])!=null);
    return{p:stats(compared.map(({reference,actual})=>actual.pf-number(reference[p])!)),qMagnitude:stats(compared.filter(({reference})=>number(reference[s])!=null).map(({reference,actual})=>Math.abs(actual.qf)-Math.sqrt(Math.max(0,number(reference[s])!**2-number(reference[p])!**2))))};
  };
  const line=branchMetric(lines,'H','E','F',lineById),tr=branchMetric(trafos,'T','G','H',trafoById);
  const subset=(kv:number)=>branchMetric(lines.filter(r=>r.C===kv),'H','E','F',lineById).p;
  const matchedBuses=buses.map(r=>({reference:r,actual:busByTerm.get('B'+String(r.A))})).filter((r):r is {reference:Row;actual:BusResult}=>!!r.actual&&number(r.reference.F)!=null);
  const anglePairs=matchedBuses.filter(r=>number(r.reference.G)!=null).map(r=>({id:'B'+String(r.reference.A),raw:r.actual.angleRad*180/Math.PI-number(r.reference.G)!}));
  const slackPair=anglePairs.find(r=>r.id===referenceBusId),offset=slackPair?.raw??median(anglePairs.map(r=>r.raw))??0;
  return{lineP:line.p,line154P:subset(154),line400P:subset(400),transformerP:tr.p,lineQMagnitude:line.qMagnitude,transformerQMagnitude:tr.qMagnitude,busVpu:stats(matchedBuses.map(r=>r.actual.vmPu-number(r.reference.F)!)),angle:{method:slackPair?'REFERENCE_BUS':'MEDIAN',offsetDeg:offset,...stats(anglePairs.map(r=>r.raw-offset))}};
}
const referenceBytes=await readFile(root+referenceName),book=unzipSync(referenceBytes),summaryRows=cells(strFromU8(book['xl/worksheets/sheet1.xml'])),lineRows=cells(strFromU8(book['xl/worksheets/sheet2.xml'])),transformerRows=cells(strFromU8(book['xl/worksheets/sheet3.xml'])),busRows=cells(strFromU8(book['xl/worksheets/sheet4.xml']));
const before=baseline(lineRows,transformerRows,busRows);
if(process.argv.includes('--baseline-only')){console.log(JSON.stringify({rows:{lines:lineRows.length,transformers:transformerRows.length,buses:busRows.length},before},null,2));process.exit(0);}
const archive=unzipSync(await readFile(root+modelName));const jsonEntries=Object.keys(archive).filter(name=>name.toLowerCase().endsWith('.json'));
if(jsonEntries.length!==1)throw new Error(`Expected one DGS JSON in ZIP; got ${jsonEntries.length}`);
const bytes=archive[jsonEntries[0]],hash=createHash('sha256').update(bytes).digest('hex'),started=performance.now();
const dgs=new DgsModel(JSON.parse(strFromU8(bytes)),modelName,bytes.length);await dgs.build();const network=mapCanonical(dgs,hash),scenario=emptyScenario();
const result=await new BrowserJsPowerFlowEngine().runPowerFlow({network,scenario,identity:identity(hash,scenario,'powerFlow')});
const afterMetrics=result.converged?after(lineRows,transformerRows,busRows,result.branches,result.buses,result.diagnostics.referenceBusId):null;
const targets={line154P:{mae:2,p95:8},line400P:{mae:10,p95:30},busVpu:{mae:.005,p95:.015},angle:{mae:.5,p95:1.5}};
const targetMet=afterMetrics?Object.fromEntries(Object.entries(targets).map(([key,limit])=>{const metric=afterMetrics[key as keyof typeof targets];return[key,metric.mae!=null&&metric.p95!=null&&metric.mae<limit.mae&&metric.p95<limit.p95];})):null;
const report={source:{model:modelName,sha256:hash,reference:referenceName,referenceWorkbookCommit:summaryRows.find(r=>r.A==='GitHub commit')?.B??null,note:'Workbook baseline may have been produced at a different commit; row-level metrics recomputed from this file.'},run:{status:result.status,converged:result.converged,iterations:result.iterations,qLimitRounds:result.rounds,outerControlRounds:result.diagnostics.outerControlRounds,elapsedMs:performance.now()-started,pvToPq:(result.diagnostics.pvToPq as unknown[]|undefined)?.length??0,stationControllerSummary:result.diagnostics.stationControllerSummary,islands:result.diagnostics.islands,referenceBusId:result.diagnostics.referenceBusId},before,after:afterMetrics,targets,targetMet,validationQuality:'BENCHMARKED_PARTIAL' as const,qComparison:'magnitude-only: |Grid Q_from| - sqrt(max(0,YTBS S²-YTBS P²))'};
const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice('--output='.length)||'docs/validation/20260928-benchmark.json';
if(!/^docs\/validation\/[a-zA-Z0-9._-]+\.json$/.test(output))throw new Error('Output must be a JSON file in docs/validation.');
await mkdir('docs/validation',{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({run:report.run,before,after:afterMetrics},null,2));
