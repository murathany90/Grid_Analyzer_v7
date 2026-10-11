import type {LfComparisonCell} from '../../domain/results/lf-comparison';
import type {BranchResult,BusResult} from '../../domain/results/types';
import {branchDelta,difference} from '../../domain/results/delta';
import type {PresentedLoading} from '../../map/loading-presentation';

export type ResultKind='line'|'trafo'|'bus';
export type ResultTab='results'|'delta'|'energize';
export interface ResultRow {id:string;name:string;cls:string;vnKv:number;siteIds:readonly string[];source:boolean;on:boolean;terms:string[];state?:string;branch?:BranchResult;bus?:BusResult;baseBranch?:BranchResult;baseBus?:BusResult;validatedLoading?:PresentedLoading|null;loadingComparison?:LfComparisonCell;comparisons?:Record<string,LfComparisonCell|undefined>}
export interface ResultMetric {key:string;label:string;unit?:string}
export interface ResultColumn {width:number;metrics:ResultMetric[];label?:string}
const metric=(key:string,label:string,unit?:string):ResultMetric=>({key,label,unit});
export const busVoltageKv=(bus?:Pick<BusResult,'vnKv'|'vmPu'>):number|null=>bus&&Number.isFinite(bus.vnKv)&&Number.isFinite(bus.vmPu)?bus.vnKv*bus.vmPu:null;
export function resultColumns(kind:ResultKind,tab:ResultTab):ResultColumn[]{
  const bus=kind==='bus',first=[metric('name',bus?'TM · Bara':kind==='line'?'Hat':'Trafo')],kv=[metric('voltage','kV')];
  if(tab==='energize')return[{width:40,metrics:first},{width:10,metrics:kv},{width:30,metrics:[metric('state','Kaynak → Senaryo')]},{width:20,metrics:[],label:'İşlem'}];
  if(tab==='delta')return bus?
    [{width:30,metrics:first},{width:8,metrics:kv},{width:20,metrics:[metric('baseV','Baz V','pu'),metric('baseAngle','Açı','°')]},{width:20,metrics:[metric('v','Senaryo V','pu'),metric('angle','Açı','°')]},{width:22,metrics:[metric('deltaV','ΔV','pu'),metric('deltaAngle','ΔAçı','°')]}]:
    [{width:28,metrics:first},{width:6,metrics:kv},...['base','scenario','delta'].map(prefix=>({width:18,metrics:[metric(prefix+'P',prefix==='base'?'Baz P':prefix==='scenario'?'Senaryo P':'ΔP','MW'),metric(prefix+'Q',prefix==='delta'?'ΔQ':'Q','MVAr'),metric(prefix+'Load',prefix==='delta'?'ΔYük':'Yük',prefix==='delta'?'pp':'%')]})),{width:12,metrics:[metric('deltaPLoss','ΔKayıp P','MW'),metric('deltaQLoss','Q','MVAr')]}];
  return bus?
    [{width:30,metrics:first},{width:7,metrics:kv},{width:11,metrics:[metric('v','V pu')]},{width:12,metrics:[metric('vKv','V kV')]},{width:10,metrics:[metric('angle','Açı °')]},{width:13,metrics:[metric('p','P','MW'),metric('q','Q','MVAr')]},{width:17,metrics:[metric('state','Durum')]}]:
    [{width:29,metrics:first},{width:6,metrics:kv},{width:13,metrics:[metric('p',kind==='trafo'?'YG P':'A P','MW'),metric('q','Q','MVAr')]},{width:13,metrics:[metric('pt',kind==='trafo'?'AG P':'B P','MW'),metric('qt','Q','MVAr')]},{width:13,metrics:[metric('pLoss','Kayıp P','MW'),metric('qLoss','Q','MVAr')]},{width:9,metrics:[metric('loading','Yük %')]},{width:17,metrics:[metric('state','Durum')]}];
}
export function resultSortValue(row:ResultRow,key:string):string|number|null|undefined {
  const d=branchDelta(row.baseBranch,row.branch,row.loadingComparison);
  const values:Record<string,string|number|null|undefined>={name:row.name,voltage:row.vnKv,state:row.state,
    p:row.branch?.pf??row.bus?.pMw,q:row.branch?.qf??row.bus?.qMvar,pt:row.branch?.pt,qt:row.branch?.qt,pLoss:row.branch?.pLoss,qLoss:row.branch?.qLoss,loading:row.validatedLoading===undefined?row.branch?.loading:row.validatedLoading?.maximum,
    v:row.bus?.vmPu,vKv:busVoltageKv(row.bus),baseVKv:busVoltageKv(row.baseBus),deltaVKv:row.baseBus?.vnKv===row.bus?.vnKv?difference(busVoltageKv(row.baseBus),busVoltageKv(row.bus)):null,angle:row.bus?row.bus.angleRad*180/Math.PI:null,baseV:row.baseBus?.vmPu,baseAngle:row.baseBus?row.baseBus.angleRad*180/Math.PI:null,
    deltaV:difference(row.baseBus?.vmPu,row.bus?.vmPu),deltaAngle:row.baseBus&&row.bus?difference(row.baseBus.angleRad,row.bus.angleRad)!*180/Math.PI:null,
    baseP:row.baseBranch?.pf,baseQ:row.baseBranch?.qf,baseLoad:row.baseBranch?.loading,scenarioP:row.branch?.pf,scenarioQ:row.branch?.qf,scenarioLoad:row.branch?.loading,deltaP:d.pMw,deltaQ:d.qMvar,deltaLoad:d.loading,deltaPLoss:d.pLoss,deltaQLoss:d.qLoss};
  const projections:Record<string,[string,'pre'|'post'|'delta']>={baseP:['pFromMw','pre'],baseQ:['qFromMvar','pre'],baseLoad:['loadingPercent','pre'],scenarioP:['pFromMw','post'],scenarioQ:['qFromMvar','post'],scenarioLoad:['loadingPercent','post'],deltaP:['pFromMw','delta'],deltaQ:['qFromMvar','delta'],deltaLoad:['loadingPercent','delta'],deltaPLoss:['pLossMw','delta'],deltaQLoss:['qLossMvar','delta'],baseV:['voltagePu','pre'],v:['voltagePu','post'],deltaV:['voltagePu','delta'],baseVKv:['voltageKv','pre'],vKv:['voltageKv','post'],deltaVKv:['voltageKv','delta'],baseAngle:['angleDeg','pre'],angle:['angleDeg','post'],deltaAngle:['angleDeg','delta']};
  const projection=projections[key];if(row.comparisons&&projection)return row.comparisons[projection[0]]?.[projection[1]]??null;
  return values[key];
}
const absoluteKeys=new Set(['p','q','pt','qt','baseP','baseQ','scenarioP','scenarioQ','deltaP','deltaQ']);
/** Call on the filtered dataset, before pagination. Missing values stay last in either direction. */
export function sortResultRows(rows:readonly ResultRow[],key:string|null,descending:boolean):ResultRow[]{
  return [...rows].sort((a,b)=>{
    const x=resultSortValue(a,key||'name'),y=resultSortValue(b,key||'name');
    const missing=(v:typeof x)=>v==null||(typeof v==='number'&&!Number.isFinite(v));
    if(missing(x)||missing(y))return Number(missing(x))-Number(missing(y))||a.name.localeCompare(b.name,'tr')||a.id.localeCompare(b.id);
    const cmp=typeof x==='string'?x.localeCompare(String(y),'tr'):absoluteKeys.has(key||'')?Math.abs(Number(x))-Math.abs(Number(y)):Number(x)-Number(y);
    return (descending?-cmp:cmp)||a.name.localeCompare(b.name,'tr')||a.id.localeCompare(b.id);
  });
}
