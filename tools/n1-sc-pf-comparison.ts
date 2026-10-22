/** Diagnostic comparisons of fresh GA snapshots; never copies PF values into the model. */
import {readFile,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {loadBenchmark} from '../src/importers/powerfactory-benchmark';
import {benchmarkLfReference} from '../src/domain/benchmark/reference';
import {rowObject} from '../src/domain/benchmark/types';
import {comparePowerFactoryReference} from '../src/analysis/validation/powerfactory-reference';
import {defaultAnalysisSettings} from '../src/domain/calculation/analysis-settings';
import {emptyScenario} from '../src/domain/scenario/overlay';
import {runHybridN1} from '../src/analysis/contingency-hybrid';
import {postBranchMetric} from '../src/analysis/contingency-ac/post-results';
import {ytmReferenceRows} from '../src/analysis/ytm-study/export';
import type {CanonicalNetwork} from '../src/domain/model/network';
import type {YtmStudyResult} from '../src/analysis/ytm-study';
import type {CalculationResult} from '../src/domain/results/types';
const [tag,area,referencePath]=process.argv.slice(2),out='local-benchmark-results/n1-sc-20261022';
const {network,study}=JSON.parse(await readFile(`${out}/${tag}-${area}-BALANCED-ui-private.json`,'utf8')) as {network:CanonicalNetwork;study:YtmStudyResult},reference=await loadBenchmark(new File([await readFile(referencePath)],basename(referencePath)));
const statistics=(rows:{fid:string;metric:string;ga:number;pf:number}[])=>[...new Set(rows.map(r=>r.metric))].map(metric=>{const values=rows.filter(r=>r.metric===metric).map(r=>({...r,delta:r.ga-r.pf,absolute:Math.abs(r.ga-r.pf),relative:r.pf===0?null:100*(r.ga-r.pf)/Math.abs(r.pf)})).sort((a,b)=>a.absolute-b.absolute);return {metric,matched:values.length,mae:values.reduce((s,r)=>s+r.absolute,0)/values.length,p95:values[Math.ceil(.95*values.length)-1]?.absolute,max:values.at(-1)?.absolute,worst20:values.slice(-20).reverse()};});
const scRows=ytmReferenceRows(study,network,reference),scPairs=scRows.filter(r=>typeof r.GA_Ikss_kA==='number'&&typeof r.PF_Ikss_kA==='number');
const proof:Record<string,unknown>={tag,studyCase:network.studyCase,classification:'DIAGNOSTIC_ONLY; NO_REFERENCE_VALIDATED_RESULTS',identities:Object.fromEntries(Object.entries(reference.groups).map(([k,g])=>[k,g.identity])),sc:{fidPairs:scPairs.length,fullPartitionMatched:scPairs.filter(r=>r.partitionMatched==='YES').length,unmatched:scRows.length-scPairs.length,statistics:statistics(scPairs.map(r=>({fid:String(r.FID),metric:'Ikss_kA',ga:r.GA_Ikss_kA as number,pf:r.PF_Ikss_kA as number})))}};
try{
 const lf=JSON.parse(await readFile(`${out}/${tag}-lf-private.json`,'utf8')) as CalculationResult,report=comparePowerFactoryReference(benchmarkLfReference(reference),lf,{studyCase:network.studyCase,modelHash:network.modelHash});
 // Preserve the strict gate above. The following FID-only diagnostic ledger cannot certify it.
 const busIndex=new Map(lf.buses.flatMap(b=>[b.id,...b.terms].map(id=>[id,b] as const))),branches=new Map(lf.branches.map(b=>[b.id,b])),generators=new Map(lf.generators.map(g=>[g.id,g]));
 const rows=benchmarkLfReference(reference).records.flatMap(r=>{
  const id=r.fid??'',bus=[id,...r.fids??[],r.calculationBusFid??''].map(id=>busIndex.get(id)).find(Boolean),branch=branches.get(id),g=generators.get(id),pairs:Record<string,number|null>={};
  if(r.kind==='bus'&&bus){pairs.voltagePu=bus.vmPu;pairs.voltageKv=bus.vmPu*bus.vnKv;pairs.angleDeg=bus.angleRad*180/Math.PI;}
  if((r.kind==='line'||r.kind==='transformer')&&branch){Object.assign(pairs,{pFromMw:branch.pf,qFromMvar:branch.qf,pToMw:branch.pt,qToMvar:branch.qt,pHvMw:branch.pf,qHvMvar:branch.qf,pLvMw:branch.pt,qLvMvar:branch.qt,currentFromA:branch.ifA,currentToA:branch.itA,currentHvA:branch.ifA,currentLvA:branch.itA,pLossMw:branch.pLoss,qLossMvar:branch.qLoss});}
  if(r.kind==='generator'&&g){pairs.pMw=g.pMw;pairs.qMvar=g.qMvar;}
  return Object.entries(pairs).flatMap(([metric,ga])=>{const pf=(r as unknown as Record<string,unknown>)[metric];return typeof ga==='number'&&Number.isFinite(ga)&&typeof pf==='number'&&Number.isFinite(pf)?[{fid:id,metric:r.kind+':'+metric,ga,pf}]:[];});
 });
 proof.lf={compatibility:report.compatibility,summary:report.summary,matchMethods:report.matchMethods,angleAlignment:report.angleAlignment,statistics:statistics(rows)};
}catch(e){proof.lf={unavailable:String(e)};}
const t=reference.groups.N1.tables.N1_RecordedExtrema_Raw,extrema=t.rows.map(row=>rowObject(t,row)),catalog=new Map(study.catalog.map(c=>[c.candidateId,c]));
const cases=[...new Set(extrema.map(r=>String(r.caseId)))].filter(id=>{const m=/^N1:(ElmLne|ElmTr2):(.+)$/.exec(id);return m&&catalog.get(m[1]+':'+m[2])?.topology==='NON_ISLANDING';}).slice(0,2);
if(cases.length){
 const ids=cases.map(id=>id.replace(/^N1:/,'')),settings=defaultAnalysisSettings(),observations=extrema.filter(r=>cases.includes(String(r.caseId))).flatMap(r=>['postLoadingPercent','postPmw','postQmvar','postMva','postVoltagePu'].map(metric=>({caseId:String(r.caseId),sourceClass:String(r.affectedClass),fid:String(r.affectedFid),metric,side:String(r.postPowerEndpoint??'')})));
 const h=process.env.GA_REUSE_FRESH_N1==='1'?JSON.parse(await readFile(`${out}/${tag}-${area}-matched-n1-private.json`,'utf8')) as Awaited<ReturnType<typeof runHybridN1>>:await runHybridN1(network,emptyScenario(),{analysisSettings:settings,studyProfile:'NATIVE_PARTIAL_CONTROLS',catalogCandidateIds:ids,selectedCandidateIds:ids,solveAllSelected:true,observations,policy:{acBudgetCases:2,perCaseTimeLimitMs:30000,globalTimeLimitMs:120000}});
 if(h.identity.modelHash!==network.modelHash)throw Error('STALE_LOCAL_N1_SNAPSHOT');
 const pairs:{fid:string;metric:string;ga:number;pf:number}[]=[],missing:unknown[]=[];
 for(const r of extrema.filter(r=>cases.includes(String(r.caseId)))){const c=h.cases.find(c=>c.outage.caseId===r.caseId),branch=c?.mapResults?.branches.find(b=>b.sourceClass===r.affectedClass&&b.fid===r.affectedFid);for(const metric of ['postPmw','postQmvar','postMva','postVoltagePu','postLoadingPercent']){const pf=r[metric],ga=metric==='postVoltagePu'?c?.mapResults?.buses.find(b=>b.terms.includes(String(r.affectedFid)))?.vmPu:branch?postBranchMetric(branch,metric,String(r.postPowerEndpoint??'')):c?.observations.find(o=>o.sourceClass===r.affectedClass&&o.fid===r.affectedFid&&o.metric===metric&&o.side===String(r.postPowerEndpoint??''))?.value;
  const basis=metric!=='postLoadingPercent'||branch&&r.loadingDenominatorBasis===branch.loading.basis&&r.loadingSeason===branch.loading.season&&(branch.loading.basis==='CURRENT_A'?r.ratedCurrentFromA===branch.loading.fromLimitA&&r.ratedCurrentToA===branch.loading.toLimitA:r.ratingMva===branch.loading.ratingMva);
  if(typeof ga==='number'&&Number.isFinite(ga)&&typeof pf==='number'&&Number.isFinite(pf)&&basis)pairs.push({fid:String(r.affectedClass)+':'+String(r.affectedFid)+'@'+String(r.caseId),metric,ga,pf});else if(typeof pf==='number')missing.push({caseId:r.caseId,fid:r.affectedFid,metric,reason:basis?'NO_CALCULATED_OBSERVATION':'CAPACITY_BASIS_MISMATCH'});
 }}
 proof.n1={selectedCases:cases,counts:h.counts,matchedPairs:pairs.length,missing:missing.length,missingExamples:missing.slice(0,20),statistics:statistics(pairs),note:'PF extrema only: no complete post-contingency matrix or solved status available'};
 await writeFile(`${out}/${tag}-${area}-matched-n1-private.json`,JSON.stringify(h));
}else proof.n1={matchedCases:0,reason:'NO_SAME_SCOPE_NON_ISLANDING_REFERENCE_OUTAGE'};
await writeFile(`${out}/${tag}-${area}-pf-comparison-private.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify({tag,lf:(proof.lf as {summary?:unknown}).summary,sc:proof.sc,n1:proof.n1}));
