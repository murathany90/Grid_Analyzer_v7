import type {BusResult,BranchResult} from '../domain/results/types';
import {voltageMatches,type VoltageBand} from '../domain/model/voltage-band';
export const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function flowMagnitude(row:BranchResult|undefined,metric:'p'|'q'):number|null {
  const values=metric==='p'?[row?.pf,row?.pt]:[row?.qf,row?.qt];
  return values.every(finite)?Math.max(...(values as number[]).map(Math.abs)):null;
}
export function flowScale(rows:readonly (BranchResult|undefined)[],metric:'p'|'q'):number {
  const values=rows.map(r=>flowMagnitude(r,metric)).filter(finite).sort((a,b)=>a-b);
  return Math.max(1,values[Math.floor((values.length-1)*.95)]||0);
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
export function voltageColor(vm:number|undefined,min:number,max:number):string {
  if(!finite(vm))return '#708596';const intensity=Math.min(1,Math.abs(vm-1)/(vm<1?1-min:max-1));
  return `hsl(${vm<1?210:25} ${Math.round(15+intensity*65)}% ${Math.round(74-intensity*25)}%)`;
}
