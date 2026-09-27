import type {AppContext} from '../../app/contracts';
import {scenarioChanged} from '../../domain/scenario/overlay';
import {element,button} from './dom';
export const requestedRole=(ctx:AppContext):'base'|'scenario'=>ctx.resultStore.role==='base'?'base':'scenario';
export const calculationLabel=(ctx:AppContext)=>requestedRole(ctx)==='base'?'Baz Hesapla':'Senaryoyu Hesapla';
export function baseResultNotice(ctx:AppContext){
  const host=element('div','ga-base-notice'),label=element('span','','Senaryo farkı için baz sonucu bulunmuyor.'),action=button('Bazı Hesapla',()=>void ctx.run(ctx.resultStore.analysisType,'base'));host.append(label,action);
  return{element:host,render(){host.hidden=!ctx.network||!scenarioChanged(ctx.scenario.current)||!!ctx.resultStore.get('base');action.disabled=ctx.busy;}};
}
