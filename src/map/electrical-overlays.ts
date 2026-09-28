import type {BusResult,BranchResult} from '../domain/results/types';
import type {Settings} from '../persistence/settings';
import {voltageMatches,type VoltageBand} from '../domain/model/voltage-band';
export const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function flowMagnitude(row:BranchResult|undefined,metric:'p'|'q'):number|null {
  const values=metric==='p'?[row?.pf,row?.pt]:[row?.qf,row?.qt];
  return values.every(finite)?Math.max(...(values as number[]).map(Math.abs)):null;
}
export function flowScale(rows:readonly (BranchResult|undefined)[],metric:'p'|'q',percentile=95,manualMax=0):number {
  if(manualMax>0)return manualMax;
  const values=rows.map(r=>flowMagnitude(r,metric)).filter(finite).sort((a,b)=>a-b);
  return Math.max(1,values[Math.floor((values.length-1)*percentile/100)]||0);
}
export function branchMapDelta(before:BranchResult|undefined,after:BranchResult|undefined,metric:'p'|'q'|'v'|'loading'):number|null {
  const key=metric==='p'?'pf':metric==='q'?'qf':'loading';if(metric==='v')return null;
  return finite(before?.[key])&&finite(after?.[key])?after![key]!-before![key]!:null;
}
export interface VoltageGroup {kv:number;min:number;max:number;worst:BusResult;buses:BusResult[]}
export interface StationVoltage {groups:VoltageGroup[];worst:BusResult;count:number}
export function aggregateStationVoltages(rows:readonly BusResult[],bands:ReadonlySet<VoltageBand>):Map<string,StationVoltage>{
  const sites=new Map<string,Map<number,BusResult[]>>();
  for(const bus of rows)if(finite(bus.vmPu)&&voltageMatches(bus.vnKv,bands))for(const id of new Set(bus.siteIds)){
    if(!sites.has(id))sites.set(id,new Map());const groups=sites.get(id)!;groups.set(bus.vnKv,[...(groups.get(bus.vnKv)||[]),bus]);
  }
  const worst=(buses:BusResult[])=>buses.reduce((a,b)=>Math.abs(b.vmPu-1)>Math.abs(a.vmPu-1)?b:a);
  return new Map([...sites].map(([id,groups])=>{const all=[...groups.values()].flat();return[id,{count:all.length,worst:worst(all),groups:[...groups].sort(([a],[b])=>b-a).map(([kv,buses])=>({kv,min:Math.min(...buses.map(b=>b.vmPu)),max:Math.max(...buses.map(b=>b.vmPu)),worst:worst(buses),buses}))}];}));
}
/** Compare identical electrical terminal groups; topology changes stay unavailable. */
export function stationVoltageDeltas(before:readonly BusResult[],after:readonly BusResult[],bands:ReadonlySet<VoltageBand>):Map<string,number>{
  const base=new Map(before.filter(b=>finite(b.vmPu)).map(b=>[[...b.terms].sort().join('|'),b]));const values=new Map<string,number>();
  for(const bus of after){const prior=base.get([...bus.terms].sort().join('|'));if(!prior||!finite(bus.vmPu)||!voltageMatches(bus.vnKv,bands))continue;const delta=bus.vmPu-prior.vmPu;for(const site of bus.siteIds)if(!values.has(site)||Math.abs(delta)>Math.abs(values.get(site)!))values.set(site,delta);}
  return values;
}
export function scaleColor(value:number|undefined,min:number,neutral:number,max:number,low:string,mid:string,high:string,noResult:string):string {
  if(!finite(value))return noResult;
  const a=value<neutral?low:mid,b=value<neutral?mid:high,t=Math.max(0,Math.min(1,value<neutral?(value-min)/(neutral-min):(value-neutral)/(max-neutral)));
  const rgb=(c:string)=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));const x=rgb(a),y=rgb(b);
  return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');
}
export function voltageColor(vm:number|undefined,settings:Settings):string {return scaleColor(vm,settings.voltageMin,settings.voltageNeutral,settings.voltageMax,settings.voltageLowColor,settings.voltageNeutralColor,settings.voltageHighColor,settings.colorNoResult);}

export interface StationAngle {count:number;min:number;max:number;median:number;representative:BusResult;groups:number;islandIds:string[]}
/** Median of solved buses in the active voltage filter; never averages unrelated island references. */
export function aggregateStationAngles(rows:readonly BusResult[],bands:ReadonlySet<VoltageBand>):Map<string,StationAngle>{
  const sites=new Map<string,BusResult[]>();for(const bus of rows)if(bus.vnKv>=66&&finite(bus.angleRad)&&finite(bus.vmPu)&&voltageMatches(bus.vnKv,bands))for(const id of new Set(bus.siteIds)){const list=sites.get(id)||[];list.push(bus);sites.set(id,list);}
  const out=new Map<string,StationAngle>();for(const[id,buses]of sites){const byIsland=new Map<string,BusResult[]>();for(const bus of buses){const key=bus.islandId||'default';const list=byIsland.get(key)||[];list.push(bus);byIsland.set(key,list);}
    // A single site may contain electrically isolated islands with arbitrary angle origins.
    const group=[...byIsland].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0]))[0]?.[1]||[];
    const sorted=[...group].sort((a,b)=>a.angleRad-b.angleRad||a.id.localeCompare(b.id)),rep=sorted[Math.floor((sorted.length-1)/2)];if(!rep)continue;
    const middle=Math.floor(sorted.length/2),median=(sorted.length%2?sorted[middle].angleRad:(sorted[middle-1].angleRad+sorted[middle].angleRad)/2)*180/Math.PI;
    out.set(id,{count:group.length,min:sorted[0].angleRad*180/Math.PI,max:sorted.at(-1)!.angleRad*180/Math.PI,median,representative:rep,groups:byIsland.size,islandIds:[...byIsland.keys()]});
  }return out;
}
