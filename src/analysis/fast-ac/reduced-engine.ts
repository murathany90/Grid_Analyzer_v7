import type { AnalysisRequest,Progress } from '../api/engine';
import { effectiveNetwork } from '../../domain/scenario/overlay';
import type { CalculationResult } from '../../domain/results/types';
import { prepareReduced } from './reduced-model';
import { solveIslandV52 } from './js/index';
import { solveIslandDC } from '../dc/js/index';
import { activeAnalysisSettings, analysisSettingsHash, defaultAnalysisSettings } from '../../domain/calculation/analysis-settings';
export async function runReduced(request:AnalysisRequest,kind:'fastAc'|'dc',progress:Progress):Promise<CalculationResult>{
  const start=performance.now(),n=effectiveNetwork(request.network,request.scenario),settings=request.analysisSettings||defaultAnalysisSettings(),minVoltageKv=kind==='dc'?settings.dc.minVoltageKv:settings.fastAc.minVoltageKv;progress('TOPOLOGY');const net=prepareReduced(n,minVoltageKv);
  const output:CalculationResult={identity:request.identity,status:'NO_SOLVED_ISLAND',converged:false,iterations:0,rounds:1,maxMismatchMw:null,elapsedMs:0,buses:[],branches:[],generators:[],diagnostics:net.diagnostics,warnings:[...net.warnings],quality:{numericalStatus:'NOT_CONVERGED',controlFidelity:'PARTIAL',referenceValidation:'NOT_AVAILABLE'}};
  const equipment=new Map([...n.lines,...n.transformers].map(e=>[e.id,e]));let solved=0,maxMismatch=0;const islandStatuses:unknown[]=[];
  for(const island of net.islands){
    progress('INNER_NR',{island:solved+1,total:net.islands.length});
    if(kind==='dc'){
      const r=solveIslandDC(island,settings.dc);islandStatuses.push({status:r.status,iterations:r.iterations,residualPU:r.residualPU});output.iterations+=r.iterations||0;if(r.status!=='CONVERGED_DC'||!r.angles||!r.branches)continue;solved++;
      maxMismatch=Math.max(maxMismatch,(r.residualPU||0)*100);
      for(const b of r.angles){const m=net.buses.get(b.id)!;output.buses.push({id:b.id,name:m.name,terms:m.terms,siteIds:m.siteIds,vnKv:m.vnKv,vmPu:NaN,angleRad:b.angleRad,pMw:NaN,qMvar:NaN});}
      for(const b of r.branches){const e=equipment.get(b.id);if(!e)continue;output.branches.push({id:b.id,name:e.name,sourceClass:e.sourceClass,from:e.from,to:e.to,siteIds:[...e.siteIds],vnKv:e.vnKv,pf:b.pMW,qf:NaN,pt:-b.pMW,qt:NaN,ifA:NaN,itA:NaN,loading:null,pLoss:NaN,qLoss:NaN});}
    }else{
      const r=solveIslandV52(island,settings.fastAc);islandStatuses.push({status:r.status,reason:r.reason,nrReason:r.nrReason,nrFallback:r.nrFallback});output.iterations+=r.nrIterations||Number(r.iterations)||0;
      if(!r.status.startsWith('CONVERGED')||!r.voltages||!r.branches)continue;solved++;maxMismatch=Math.max(maxMismatch,r.misMW||0);
      const vm=new Map(r.voltages.map(b=>[b.id,b.pu]));
      for(const b of r.voltages){const m=net.buses.get(b.id)!;output.buses.push({id:b.id,name:m.name,terms:m.terms,siteIds:m.siteIds,vnKv:m.vnKv,vmPu:b.pu,angleRad:b.angle,pMw:NaN,qMvar:NaN});}
      for(const b of r.branches){const e=equipment.get(b.id);if(!e)continue;const sf=Math.hypot(b.pf,b.qf),st=Math.hypot(b.pt,b.qt),vf=(vm.get(b.a)||1)*(net.buses.get(b.a)?.vnKv||e.vnKv),vt=(vm.get(b.b)||1)*(net.buses.get(b.b)?.vnKv||e.vnKv);output.branches.push({id:e.id,name:e.name,sourceClass:e.sourceClass,from:e.from,to:e.to,siteIds:[...e.siteIds],vnKv:e.vnKv,pf:b.pf,qf:b.qf,pt:b.pt,qt:b.qt,ifA:sf*1000/(Math.sqrt(3)*vf),itA:st*1000/(Math.sqrt(3)*vt),loading:e.ratingMva?Math.max(sf,st)/e.ratingMva*100:null,pLoss:b.pf+b.pt,qLoss:b.qf+b.qt});}
      const generators=new Map(n.generators.map(g=>[g.id,g]));for(const q of r.unitQ||[]){const g=generators.get(q.id);if(g)output.generators.push({id:g.id,name:g.name,pMw:g.pMw,qMvar:q.value,qState:q.limitHit?'LIMIT':'ESTIMATED',bus:g.bus});}
      if(r.nrFallback)output.warnings.push('İndirgenmiş Newton yakınsamadı; Hızlı AC-PQ geri dönüş sonucu açık etiketle korunuyor.');
    }
  }
  const caseName=n.studyCase||'',timeMatch=/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(?:_|$)/.exec(caseName);
  const studyDateTime=timeMatch?`${timeMatch[1]}-${timeMatch[2]}-${timeMatch[3]} ${timeMatch[4]}:${timeMatch[5]}:00`:null;
  output.diagnostics={...output.diagnostics,solvedIslands:solved,islandStatuses,calculationProvenance:{analysisProfile:kind==='fastAc'?'REDUCED_FAST_AC':'DC_PARAMETRIC',analysisSettingsHash:analysisSettingsHash(settings,kind),analysisSettings:activeAnalysisSettings(settings,kind),engine:request.identity.engine,engineVersion:request.identity.engineVersion,modelHash:request.identity.modelHash,scenarioHash:request.identity.scenarioHash,studyCase:caseName,studyDateTime,studyDateTimeSource:timeMatch?'STUDY_CASE_NAME':'UNAVAILABLE',controlFidelity:'PARTIAL'}};output.converged=net.islands.length>0&&solved===net.islands.length;output.status=output.converged?(kind==='dc'?'CONVERGED_DC':'CONVERGED_REDUCED_AC'):solved?'PARTIAL_ISLAND_RESULTS':'NO_SOLVED_ISLAND';output.maxMismatchMw=solved?maxMismatch:null;output.elapsedMs=performance.now()-start;output.quality.numericalStatus=output.status;output.warnings.push('66 kV+ indirgenmiş ağ; Full AC sonucu değildir.');progress('RESULT');return output;
}
