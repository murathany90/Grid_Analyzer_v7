import type {AppContext} from '../../app/contracts';
import {scenarioChanged} from '../../domain/scenario/overlay';
import {element,button} from './dom';
import {calculationConvergenceLabel} from '../../domain/results/diagnostics';
export const requestedRole=(ctx:AppContext):'base'|'scenario'=>ctx.resultStore.role==='base'?'base':'scenario';
export const calculationLabel=(ctx:AppContext)=>requestedRole(ctx)==='base'?'Baz Hesapla':'Senaryoyu Hesapla';
export const calculationEngineLabel=(ctx:AppContext):string=>({powerFlow:'Tam AC',fastAc:'Hızlı AC',dc:'DC'}[ctx.resultStore.analysisType]);
export function calculationSessionStatus(ctx:AppContext){
  const host=element('p','ga-notice');
  return{element:host,render(){
    const role=requestedRole(ctx),result=ctx.resultStore.get(role,ctx.resultStore.analysisType);
    const last=result?`${calculationConvergenceLabel(result)} · ${(result.elapsedMs/1000).toFixed(2)} sn`:'Sonuç yok';
    host.textContent=`Hesap motoru: ${calculationEngineLabel(ctx)} · Kapsam: ${role==='base'?'Baz':'Senaryo'} · Son sonuç: ${last}`;
  }};
}
export function baseResultNotice(ctx:AppContext){
  const host=element('div','ga-base-notice'),label=element('span','','Senaryo farkı için baz sonucu bulunmuyor.'),action=button('Bazı Hesapla',()=>void ctx.run(ctx.resultStore.analysisType,'base'));host.append(label,action);
  return{element:host,render(){host.hidden=!ctx.network||!scenarioChanged(ctx.scenario.current)||!!ctx.resultStore.get('base');action.disabled=ctx.busy;}};
}
