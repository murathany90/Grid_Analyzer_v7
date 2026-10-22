import type {AppContext} from '../../app/contracts';
import {currentScResult} from '../../domain/results/sc-selection';
import {currentHybrid,currentLf,currentStudy,studyOwnsSc,scFaultsInScope} from './presentation-scope';
import {studyEvidence} from './study-evidence';
import {studyFamilies} from '../../analysis/ytm-study';

/** Run counters have their own owner. Selecting a case or PF overlay cannot change them. */
export function runEvidence(ctx:AppContext){
 const family=ctx.analysisTab,study=currentStudy(ctx),h=currentHybrid(ctx),candidate=currentScResult(ctx),sc=studyOwnsSc(ctx,candidate)&&!study?null:candidate,lf=currentLf(ctx);
 const stale=family==='N1'?!!(ctx.ytmStudy?.n1||ctx.hybridResult)&&!h:family==='SC'?!!ctx.scResult&&!sc:!!ctx.resultStore.active&&!lf;
 const c=h?.counts??{},electrical=new Map((sc?scFaultsInScope(ctx,sc):[]).filter(f=>f.electricalBusId!==null).map(f=>[f.electricalBusId,f])??[]);
 const numerical=family==='N1'?(c.AC_CALCULATED??h?.cases.filter(c=>c.acSolved).length??0):family==='SC'?[...electrical.values()].filter(f=>f.ikssKa!==null&&Number.isFinite(f.ikssKa)).length:lf?.converged?lf.buses.length:0;
 const ownsBatch=family!=='LF'&&!!study&&studyFamilies(study.options).includes(family),hasResult=family==='LF'?!!lf:family==='N1'?!!h:!!sc,retainedFamily=hasResult&&!!study&&family!=='LF'&&!ownsBatch;
 const working=ctx.busy&&(family==='LF'||(ctx.studyOptions?.families??['N1','SC']).includes(family));
 const workflow=stale?'STALE_RESULT':working?'RUNNING':!hasResult?'NOT_STARTED':family==='LF'?lf!.status:ownsBatch?study!.status:family==='N1'?h!.status:'COMPLETE',n1=family==='N1'&&!stale;
 return {family,workflow,stale,retainedFamily,numericalAvailable:stale?0:numerical,
  candidateCount:n1?study?.catalog.length??h?.catalogCount??0:0,dcScreened:n1?c.DC_SCREENED??0:0,acAttempted:n1?c.AC_ATTEMPTED??0:0,acCalculated:n1?c.AC_CALCULATED??0:0,acVerified:n1?c.AC_VERIFIED??0:0,distinctNumerical:n1?c.N1_NUMERICALLY_COMPUTABLE??0:0,
  electricalBuses:family==='SC'?electrical.size:0,physicalTerminals:family==='SC'&&sc?scFaultsInScope(ctx,sc).length:0,elapsedMs:!hasResult?null:family==='LF'?lf!.elapsedMs:ownsBatch?study!.elapsedMs:family==='N1'?h!.elapsedMs:sc!.elapsedMs,
  resultIdentity:family==='LF'?lf?.identity??null:family==='N1'?h?.identity??null:sc?.identity??null,sourceVerified:false,methodVerified:false,pfParityVerified:false,
  label:stale?'Güncel değil':workflow==='NOT_STARTED'?'Henüz çalıştırılmadı':family==='N1'?`İş akışı ${workflow==='COMPLETE'?'tamamlandı':workflow==='RUNNING'?'çalışıyor':'kısmi'} · ${numerical} sayısal AC · tam kontrol doğrulaması ${c.AC_VERIFIED??0}`:family==='SC'?`${numerical} bara için yaklaşık Ikss · IEC doğrulanmadı`:lf?.converged?'Sayısal yakınsadı · kontrol kısmi · PF eşdeğerliği doğrulanmadı':lf?`Sayısal yakınsamadı · ${lf.status}`:'Henüz çalıştırılmadı'};
}
export const selectedCaseEvidence=studyEvidence;
