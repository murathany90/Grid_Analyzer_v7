/** Opt-in local acceptance: one import, one base solve and one H2525 outage solve. No model data is exported. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DgsModel} from '../src/importers/dgs/index';
import {mapCanonical} from '../src/importers/dgs/canonical';
import {catalogPage} from '../src/importers/dgs/catalog';
import {prepareModel,type PreparedModel} from '../src/analysis/power-flow/preparation';
import {solveNR} from '../src/analysis/power-flow/js/newton';
import {buildY} from '../src/analysis/power-flow/js/ybus';
import {makeLayout,calcPQ,fillJacobian} from '../src/analysis/power-flow/js/jacobian';
import {ilu0} from '../src/analysis/power-flow/js/linear-solver';
import {emptyScenario,effectiveNetwork} from '../src/domain/scenario/overlay';
import {buildStationTopologyGraph} from '../src/domain/model/station-topology';
import type {PowerFlowResult} from '../src/analysis/power-flow/js/types';
const name='20260923_1200_SN3_TR0.json',started=performance.now(),bytes=await readFile(`control1/${name}`);
const hash=createHash('sha256').update(bytes).digest('hex'),source=new DgsModel(JSON.parse(bytes.toString('utf8')),name,bytes.length);await source.build();
const network=mapCanonical(source,hash),loadMs=performance.now()-started;
function topology(p:PreparedModel){
  const degree=new Uint32Array(p.model.n);for(const b of p.model.branches){degree[b.i]++;degree[b.j]++;}
  const z=p.model.branches.map(b=>Math.hypot(b.r,b.x));
  return {diagnostics:p.diagnostics,slack:p.model.slack,slackBusId:p.buses[p.model.slack]?.id,zeroDegreePV:Array.from(degree).filter((d,i)=>d===0&&p.model.busType[i]===1).length,zeroDegreePQ:Array.from(degree).filter((d,i)=>d===0&&p.model.busType[i]===0).length,minImpedancePu:Math.min(...z),nearZeroImpedanceBelow1eMinus8:z.filter(v=>v<1e-8).length,warnings:p.warnings};
}
function flatStartJacobian(p:PreparedModel){
  const m=p.model,Y=buildY(m),L=makeLayout(Y,m.busType,m.slack),vm=new Float64Array(m.n).fill(1),va=new Float64Array(m.n),P=new Float64Array(m.n),Q=new Float64Array(m.n);
  vm[m.slack]=m.slackVm;for(let i=0;i<m.n;i++)if(m.busType[i]===1)vm[i]=m.vmSet[i]||1;
  calcPQ(Y,vm,va,P,Q);const values=new Float64Array(L.colIdx.length);fillJacobian(Y,L,vm,va,P,Q,values);
  const A={N:L.N,rowPtr:L.rowPtr,colIdx:L.colIdx,values,pos:L.pos,diagPos:L.diagPos},factor=ilu0(A),pivots=Array.from(factor.diag,i=>Math.abs(factor.lu[i]));
  return {state:'initial flat start only; not the failed iterate',size:A.N,nonFiniteEntries:Array.from(values).filter(v=>!Number.isFinite(v)).length,minimumAbsDiagonal:Math.min(...Array.from(L.diagPos,i=>Math.abs(values[i]))),minimumAbsIluPivot:Math.min(...pivots),iluPivotsAtClamp:pivots.filter(v=>v<=1e-10).length,conditionNumber:'NOT_AVAILABLE',failedIteratePivotAndResidual:'NOT_EXPOSED_BY_SOLVER'};
}
function result(r:PowerFlowResult){return {status:r.status,converged:r.converged,iterations:r.iterations,rounds:r.rounds,maxMismatchMW:r.maxMismatchMW,elapsedMs:r.elapsedMs,lastSuccessfulLinear:r.linear?{method:r.linear.method,iterations:r.linear.iterations,residual:r.linear.residual}:null};}
const base=prepareModel(network),baseResult=solveNR(base.model);console.log(JSON.stringify({stage:'base',loadMs,...result(baseResult)}));
if(!network.lines.some(l=>l.id==='H2525'))throw Error('Expected H2525 line is absent; no substitute outage performed');
const scenario={...emptyScenario(),lineStatus:{H2525:false}},outage=prepareModel(effectiveNetwork(network,scenario));
const progress:{stage:string;data?:Record<string,number>}[]=[];
const outageResult=solveNR(outage.model,(stage,data)=>progress.push({stage,data}));
console.log(JSON.stringify({stage:'H2525',...result(outageResult)}));
const site=network.sites.find(s=>s.name.toLocaleUpperCase('tr-TR').includes('TALAS'));
const stationRows=(className:string)=>{if(!site)return[];let page=0;const rows=[];for(;;){const result=catalogPage(source,{className,siteId:site.id,page:page++,pageSize:1000});rows.push(...result.rows);if(rows.length>=result.total||!result.rows.length)return rows;}};
const graph=site?buildStationTopologyGraph(network,site.id,{bays:stationRows('ElmBay'),terminals:stationRows('ElmTerm'),switches:[...stationRows('ElmCoup'),...stationRows('StaSwitch')],cubicles:stationRows('StaCubic'),substats:stationRows('ElmSubstat')}):null;
const report={created:new Date().toISOString(),model:name,bytes:bytes.length,records:network.records,loadMs,solverChanged:false,base:{...result(baseResult),topology:topology(base)},H2525:{...result(outageResult),topology:topology(outage),flatStartJacobian:flatStartJacobian(outage),qLimitUpdates:progress.filter(p=>p.stage==='Q_LIMIT_UPDATE').length,lastIterations:progress.filter(p=>p.stage==='INNER_ITERATION').slice(-6),conclusion:'No proven safe numerical fix from one bounded reproduction. Failure retained as a known limitation.'},sld:graph&&site?{siteName:site.name,siteId:site.id,busSections:graph.busSections.length,sourceFeeders:graph.sourceFeederCount,overviewConnections:graph.feeders.length,terminals:graph.terminals.length,voltageLevels:graph.voltageLevels,unresolvedEndpoints:graph.unresolvedEndpoints}:null,totalMs:performance.now()-started};
await mkdir('docs/validation',{recursive:true});await writeFile('docs/validation/v7.0.1-acceptance.json',JSON.stringify(report,null,2));console.log(JSON.stringify({sld:report.sld,totalMs:report.totalMs}));
