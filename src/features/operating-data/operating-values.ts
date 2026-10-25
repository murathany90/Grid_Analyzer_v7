import type {AppContext,CatalogRow} from '../../app/contracts';
import {effectiveNetwork,scenarioChanged} from '../../domain/scenario/overlay';
import {sldLfCurrent} from '../sld/result-overlay';
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('tr-TR',{maximumFractionDigits:3}):'—';
const cache=new WeakMap<AppContext,{refs:unknown[];read:(row:CatalogRow,cls:string)=>{source:string;scenario:string;lf:string}}>();
/** One set of indexes per source/scenario/result identity; no per-row network scan. */
export function operatingValues(ctx:AppContext){
 const n=ctx.network,overlay=ctx.scenario.current,role=scenarioChanged(overlay)?'scenario':'base',r=ctx.resultStore.get(role,'powerFlow'),refs=[n,overlay,r,ctx.analysisSettings.value,ctx.powerFactoryControlContextHash],old=cache.get(ctx);
 if(old&&old.refs.every((v,i)=>v===refs[i]))return old.read;
 const effective=n?effectiveNetwork(n,overlay):null,entities=(net:typeof n)=>net?[...net.loads,...net.generators,...net.transformers,...net.lines,...net.switches,...net.shunts]:[],sources=new Map(entities(n).map(e=>[e.sourceClass+'|'+e.id,e])),active=new Map(entities(effective).map(e=>[e.sourceClass+'|'+e.id,e])),valid=sldLfCurrent(ctx,r,role);
 const describe=(e:ReturnType<typeof entities>[number]|undefined)=>!e?'—':'pMw'in e?`P ${num(e.pMw)} MW · Q ${num(e.qMvar)} MVAr`:'closed'in e?e.closed?'Kapalı':'Açık':'tapPosition'in e?`Kademe ${num(e.tapPosition)} · ${e.inService?'Serviste':'Servis dışı'}`:e.inService?'Serviste':'Servis dışı';
 const loads=new Map(r?.loads?.map(e=>[e.id,e])),gens=new Map(r?.generators.map(e=>[e.id,e])),branches=new Map(r?.branches.map(e=>[e.sourceClass+'|'+e.id,e])),switches=new Map(r?.switchFlows?.map(e=>[e.sourceClass+'|'+e.id,e]));
 const read=(row:CatalogRow,cls:string)=>{const key=cls+'|'+row.id,l=loads.get(row.id),g=gens.get(row.id),b=branches.get(key),s=switches.get(key),p=cls==='ElmLod'?l?.pMw:['ElmSym','ElmGenStat'].includes(cls)?g?.pMw:b?.pf??s?.pf,q=cls==='ElmLod'?l?.qMvar:['ElmSym','ElmGenStat'].includes(cls)?g?.qMvar:b?.qf??s?.qf;return{source:describe(sources.get(key)),scenario:describe(active.get(key)),lf:valid?`P ${num(p)} MW · Q ${num(q)} MVAr${p==null&&q==null?' · Sonuç kaydı yok':''}`:'NOT_RUN / STALE'};};
 cache.set(ctx,{refs,read});return read;
}
