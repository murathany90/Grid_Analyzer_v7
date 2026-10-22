import type {AppContext} from '../../app/contracts';
import {currentScResult} from '../../domain/results/sc-selection';
import {currentHybrid,currentLf,currentStudy} from './presentation-scope';
import {studyEvidence} from './study-evidence';

/** Run counters have their own owner. Selecting a case or PF overlay cannot change them. */
export function runEvidence(ctx:AppContext){
 const family=ctx.analysisTab,study=currentStudy(ctx),h=currentHybrid(ctx),candidate=currentScResult(ctx),sc=ctx.ytmStudy&&(candidate===ctx.ytmStudy.scMax||candidate===ctx.ytmStudy.scMin)&&!study?null:candidate,lf=currentLf(ctx);
 const stale=family==='N1'?!!(ctx.ytmStudy?.n1||ctx.hybridResult)&&!h:family==='SC'?!!ctx.scResult&&!sc:!!ctx.resultStore.active&&!lf;
 const c=h?.counts??{},electrical=new Map(sc?.faults.filter(f=>f.electricalBusId!==null).map(f=>[f.electricalBusId,f])??[]);
 const numerical=family==='N1'?(c.AC_CALCULATED??h?.cases.filter(c=>c.acSolved).length??0):family==='SC'?[...electrical.values()].filter(f=>f.ikssKa!==null&&Number.isFinite(f.ikssKa)).length:lf?.buses.length??0;
 const workflow=stale?'STALE_RESULT':ctx.busy?'RUNNING':family==='LF'?lf?.status??'NOT_STARTED':study?.status??(family==='N1'?h?.status:sc?'COMPLETE':null)??'NOT_STARTED';
 return {family,workflow,stale,numericalAvailable:stale?0:numerical,
  candidateCount:stale?0:study?.catalog.length??h?.catalogCount??0,dcScreened:stale?0:c.DC_SCREENED??0,acAttempted:stale?0:c.AC_ATTEMPTED??0,acCalculated:stale?0:c.AC_CALCULATED??0,acVerified:stale?0:c.AC_VERIFIED??0,distinctNumerical:stale?0:c.N1_NUMERICALLY_COMPUTABLE??0,
  electricalBuses:electrical.size,physicalTerminals:sc?.faults.length??0,elapsedMs:family==='LF'?lf?.elapsedMs??null:study?.elapsedMs??(family==='N1'?h?.elapsedMs:sc?.elapsedMs)??null,
  resultIdentity:family==='LF'?lf?.identity??null:family==='N1'?h?.identity??null:sc?.identity??null,sourceVerified:false,methodVerified:false,pfParityVerified:false,
  label:stale?'Güncel değil':workflow==='NOT_STARTED'?'Henüz çalıştırılmadı':family==='N1'?`İş akışı ${workflow==='COMPLETE'?'tamamlandı':workflow==='RUNNING'?'çalışıyor':'kısmi'} · ${numerical} sayısal AC · tam kontrol doğrulaması ${c.AC_VERIFIED??0}`:family==='SC'?`${numerical} bara için yaklaşık Ikss · IEC doğrulanmadı`:lf?'Sayısal yakınsadı · kontrol kısmi · PF eşdeğerliği doğrulanmadı':'Henüz çalıştırılmadı'};
}
export const selectedCaseEvidence=studyEvidence;
