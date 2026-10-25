import type {AppContext,CatalogRow} from '../../app/contracts';
import {effectiveNetwork,scenarioChanged} from '../../domain/scenario/overlay';
import {sldLfCurrent} from '../sld/result-overlay';
import {formatWorkspaceNumber} from '../../domain/dgs-semantics/measurement-format';
import type {SortValue,CatalogSortSnapshot} from '../../domain/dgs-semantics/table-sort';
type Part='source'|'scenario'|'lf';
type Powers={P:number|null;Q:number|null};
interface OperatingValues {source:string;scenario:string;lf:string;display:Record<Part,string>;numeric:Record<Part,Powers>;sort:Record<Part,SortValue>}
interface Entry {refs:unknown[];serial:number;read:(row:CatalogRow,cls:string)=>OperatingValues;keys:readonly {id:string;sourceClass:string}[];snapshots:Map<string,CatalogSortSnapshot>}
const cache=new WeakMap<AppContext,Entry>();let serial=0;
const finite=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
const num=(v:unknown)=>finite(v)==null?'—':String(v);
/** Exact data for exports/sort; localized one-decimal strings are presentation only. */
function prepare(ctx:AppContext):Entry {
 const n=ctx.network,overlay=ctx.scenario.current,role=scenarioChanged(overlay)?'scenario':'base',r=ctx.resultStore.get(role,'powerFlow'),refs=[n,overlay,r,ctx.analysisSettings.value,ctx.powerFactoryControlContextHash],old=cache.get(ctx);
 if(old&&old.refs.every((v,i)=>v===refs[i]))return old;
 const effective=n?effectiveNetwork(n,overlay):null,entities=(net:typeof n)=>net?[...net.loads,...net.generators,...net.transformers,...net.lines,...net.switches,...net.shunts]:[],all=entities(n),sources=new Map(all.map(e=>[e.sourceClass+'|'+e.id,e])),active=new Map(entities(effective).map(e=>[e.sourceClass+'|'+e.id,e])),valid=sldLfCurrent(ctx,r,role);
 type Entity=ReturnType<typeof entities>[number]|undefined;
 const power=(e:Entity):Powers=>({P:e&&'pMw'in e?finite(e.pMw):null,Q:e&&'qMvar'in e?finite(e.qMvar):null});
 const describe=(e:Entity,display=false)=>!e?'—':'pMw'in e?`P ${display?formatWorkspaceNumber(e.pMw,'MW'):num(e.pMw)+' MW'} · Q ${display?formatWorkspaceNumber(e.qMvar,'MVAr'):num(e.qMvar)+' MVAr'}`:'closed'in e?e.closed?'Kapalı':'Açık':'tapPosition'in e?`Kademe ${num(e.tapPosition)} · ${e.inService?'Serviste':'Servis dışı'}`:e.inService?'Serviste':'Servis dışı';
 const order=(e:Entity):SortValue=>!e?null:'pMw'in e?[finite(e.pMw),finite(e.qMvar)]:'closed'in e?Number(e.closed):'tapPosition'in e?[finite(e.tapPosition),Number(e.inService)]:Number(e.inService);
 const loads=new Map(r?.loads?.map(e=>[e.id,e])),gens=new Map(r?.generators.map(e=>[e.id,e])),branches=new Map(r?.branches.map(e=>[e.sourceClass+'|'+e.id,e])),switches=new Map(r?.switchFlows?.map(e=>[e.sourceClass+'|'+e.id,e]));
 const read=(row:CatalogRow,cls:string):OperatingValues=>{const key=cls+'|'+row.id,l=loads.get(row.id),g=gens.get(row.id),b=branches.get(key),s=switches.get(key),p=valid?finite(cls==='ElmLod'?l?.pMw:['ElmSym','ElmGenStat'].includes(cls)?g?.pMw:b?.pf??s?.pf):null,q=valid?finite(cls==='ElmLod'?l?.qMvar:['ElmSym','ElmGenStat'].includes(cls)?g?.qMvar:b?.qf??s?.qf):null,source=sources.get(key),scenario=active.get(key);
 return{source:describe(source),scenario:describe(scenario),lf:valid?`P ${num(p)} MW · Q ${num(q)} MVAr${p==null&&q==null?' · Sonuç kaydı yok':''}`:'NOT_RUN / STALE',display:{source:describe(source,true),scenario:describe(scenario,true),lf:valid?`P ${formatWorkspaceNumber(p,'MW')} · Q ${formatWorkspaceNumber(q,'MVAr')}${p==null&&q==null?' · Sonuç kaydı yok':''}`:'NOT_RUN / STALE'},numeric:{source:power(source),scenario:power(scenario),lf:{P:p,Q:q}},sort:{source:order(source),scenario:order(scenario),lf:p==null&&q==null?null:[p,q]}};};
 const entry={refs,serial:++serial,read,keys:all,snapshots:new Map<string,CatalogSortSnapshot>()};cache.set(ctx,entry);return entry;
}
export const operatingValues=(ctx:AppContext)=>prepare(ctx).read;
export function operatingSortSnapshot(ctx:AppContext,field:string,classes:readonly string[]):CatalogSortSnapshot {
 const entry=prepare(ctx),key=field+'|'+classes.join('|'),old=entry.snapshots.get(key);if(old)return old;
 const part=field.slice('operating.'.length),component=/^(source|scenario|lf)([PQ])$/.exec(part),values:CatalogSortSnapshot['values']=entry.keys.filter(e=>classes.includes(e.sourceClass)).map(e=>{const v=entry.read({id:e.id,name:'',attributes:{},siteIds:[]},e.sourceClass),value=component?v.numeric[component[1] as Part][component[2] as 'P'|'Q']:v.sort[part as Part]??null;return[e.sourceClass,e.id,value];});
 const snapshot={id:String(entry.serial)+'|'+key,field,modelHash:ctx.network?.modelHash??'',values};entry.snapshots.set(key,snapshot);return snapshot;
}
