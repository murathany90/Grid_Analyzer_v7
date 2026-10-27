import type {AppContext} from '../../app/contracts';
import type {PsseBus,PsseBranch,PsseBusBranchNetwork} from '../../domain/psse/network';
import type {PsseCalculationResult,PsseBranchResult} from '../../domain/psse/results';
import {isCurrentPsseResult,pssePublicationStatus} from '../../domain/psse/results';
import type {PsseEquipment,PsseModel} from '../../importers/psse/types';
import {effectivePsseNetwork} from '../../analysis/psse/newton';
import {button,element} from '../../ui/components/dom';
import {psseVoltageGroup} from './view-model';

export const SVG_NS='http://www.w3.org/2000/svg';
export const fmt=(value:number|null|undefined,digits=2)=>value==null||!Number.isFinite(value)?'—':value.toLocaleString('tr-TR',{maximumFractionDigits:digits,useGrouping:false});
export const svgNode=<K extends keyof SVGElementTagNameMap>(name:K,attrs:Record<string,string>={})=>{const node=document.createElementNS(SVG_NS,name);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);return node;};
export const sourceText=(value:unknown)=>value===null||value===undefined||value===''?'—':String(value);
export const normalizedKey=(value:unknown)=>String(value??'').trim().toLocaleLowerCase('tr-TR');

export interface PsseDiagramSnapshot {base:PsseBusBranchNetwork;network:PsseBusBranchNetwork;model:PsseModel;scenario:NonNullable<AppContext['psseScenario']>;calculation:PsseCalculationResult|null;lastCalculation:PsseCalculationResult|null}
/** Only a converged result for the currently loaded source, normalized network and scenario can color a calculated layer. */
export function getPsseDiagramSnapshot(ctx:AppContext):PsseDiagramSnapshot|null{
 const base=ctx.psseNetwork,model=ctx.psseInspection,scenario=ctx.psseScenario;if(!base||!model||!scenario)return null;
 if(scenario.networkHash!==base.modelHash)return null;
 const last=ctx.psseCalculation??null;
 try{const network=effectivePsseNetwork(base,scenario),calculation=isCurrentPsseResult(last,{sourceSha256:model.source.sha256,network:base,effectiveNetwork:network,scenario})&&last.status==='CONVERGED'&&last.physicsCoverage!=='BLOCKED'?last:null;return{base,network,model,scenario,calculation,lastCalculation:last};}catch{return null;}
}
export type PsseEquipmentIndex=ReadonlyMap<string,PsseEquipment>;
export function busSourceEquipment(bus:PsseBus,model:PsseModel,index?:PsseEquipmentIndex){if(!bus.sourceEquipmentId)return null;return index?.get(bus.sourceEquipmentId)??model.equipment.find(item=>item.id===bus.sourceEquipmentId)??null;}
export function busName(bus:PsseBus,model:PsseModel,index?:PsseEquipmentIndex){const e=busSourceEquipment(bus,model,index);return String(e?.fields.name??e?.name??bus.id);}
export function busSearchText(bus:PsseBus,model:PsseModel,index?:PsseEquipmentIndex){const e=busSourceEquipment(bus,model,index);return [bus.id,bus.connectionKey,bus.externalNumber,e?.name,e?.fields.name,e?.fields.ibus,e?.fields.packedNumbus].filter(x=>x!==null&&x!==undefined).join(' · ');}
export function fieldText(e:PsseEquipment|undefined|null,key:string){return sourceText(e?.fields[key]);}
export function busArea(bus:PsseBus,model:PsseModel,index?:PsseEquipmentIndex){return fieldText(busSourceEquipment(bus,model,index),'area');}
export function busZone(bus:PsseBus,model:PsseModel,index?:PsseEquipmentIndex){return fieldText(busSourceEquipment(bus,model,index),'zone');}
export function busOwner(bus:PsseBus,model:PsseModel,index?:PsseEquipmentIndex){return fieldText(busSourceEquipment(bus,model,index),'owner');}
export function busVoltage(bus:PsseBus){return Number.isFinite(bus.baseKv)?bus.baseKv:null;}
export function voltageGroupKey(baseKv:number|null){return psseVoltageGroup(baseKv);}
export function voltageLabel(baseKv:number|null,digits=0){return baseKv===null||!Number.isFinite(baseKv)?'kV bilinmiyor':`${fmt(baseKv,digits)} kV`;}
/** Explicit low-voltage group: physical levels at or below 36 kV; unknown is excluded. */
export function isLowVoltageGroup(baseKv:number|null){return baseKv!==null&&Number.isFinite(baseKv)&&baseKv<=36;}
export function busSavedVoltage(bus:PsseBus,model:PsseModel,index?:PsseEquipmentIndex){const e=busSourceEquipment(bus,model,index),raw=e?.operating.vm?.value;return typeof raw==='number'&&Number.isFinite(raw)?raw:bus.initialVm;}
export function busSavedAngle(bus:PsseBus,model:PsseModel,index?:PsseEquipmentIndex){const e=busSourceEquipment(bus,model,index),raw=e?.operating.va?.value;return typeof raw==='number'&&Number.isFinite(raw)?raw:bus.initialVaDeg;}
export function matchesStatus(status:number,filter:'all'|'in'|'out'){return filter==='all'||(filter==='in'?status===1:status===0);}
export function sourceResultLabel(snapshot:PsseDiagramSnapshot){return snapshot.model.source.format==='SAV'?'SOURCE_SAVED':'SOURCE_INPUT';}
export function branchResult(result:PsseCalculationResult|null,branch:PsseBranch):PsseBranchResult|undefined{return result?.branchResults.find(row=>row.id===branch.id&&row.sourceEquipmentId===branch.sourceEquipmentId&&row.terminalFrom===branch.terminalFrom&&row.terminalTo===branch.terminalTo);}
export function resultFreshnessLabel(snapshot:PsseDiagramSnapshot){const last=snapshot.lastCalculation;if(!last)return'GA_PSSE_CALCULATED · hesap yok';if(snapshot.calculation)return`GA_PSSE_CALCULATED · ${last.method} · ${pssePublicationStatus(last)} · fizik kapsamı ${last.physicsCoverage}${last.method==='LOSSLESS_DC'?' · Vm çözülmez':''}`;if(last.status!=='CONVERGED')return`Son hesap ${last.status} (${last.physicsCoverage}) · renk katmanı kullanılamaz`;return`Son hesap başka model veya senaryoya ait (${last.physicsCoverage}) · renk katmanı kullanılamaz`;}
export function voltageColor(value:number|null|undefined){if(value==null||!Number.isFinite(value))return'#64748b';if(value<0.9)return'#a84859';if(value<0.95)return'#d36b5c';if(value<0.98)return'#d9a441';if(value<=1.02)return'#4fbf91';if(value<=1.05)return'#48a9c7';return'#8074d4';}
export function loadingColor(value:number|null|undefined){if(value==null||!Number.isFinite(value))return'#65788b';if(value>=100)return'#e25f66';if(value>=80)return'#e3a944';return'#50b98b';}

export interface Neighborhood {busIndices:number[];depthByBus:Map<number,number>;branches:PsseBranch[];omittedBuses:number;omittedBranches:number}
/** Select a bounded, searchable bus-branch neighborhood. Counts stay explicit when a local graph exceeds limits. */
export function selectNeighborhood(network:PsseBusBranchNetwork,allowedBuses:Set<number>,center:number,depthLimit:number,status:'all'|'in'|'out',busLimit:number,branchLimit:number):Neighborhood{
 const adjacency=Array.from({length:network.buses.length},()=>[] as {bus:number;branch:PsseBranch}[]);
 for(const branch of network.branches){if(!matchesStatus(branch.status,status)||!allowedBuses.has(branch.from)||!allowedBuses.has(branch.to))continue;adjacency[branch.from].push({bus:branch.to,branch});adjacency[branch.to].push({bus:branch.from,branch});}
 const depths=new Map<number,number>([[center,0]]),queue=[center];for(let cursor=0;cursor<queue.length;cursor++){const from=queue[cursor],depth=depths.get(from)!;if(depth>=depthLimit)continue;for(const edge of adjacency[from])if(!depths.has(edge.bus)){depths.set(edge.bus,depth+1);queue.push(edge.bus);}}
 const all=[...depths.keys()].sort((a,b)=>depths.get(a)!-depths.get(b)!||a-b),busIndices=all.slice(0,busLimit),visible=new Set(busIndices),allBranches=network.branches.filter(branch=>matchesStatus(branch.status,status)&&visible.has(branch.from)&&visible.has(branch.to));
 return{busIndices,depthByBus:depths,branches:allBranches.slice(0,branchLimit),omittedBuses:Math.max(0,all.length-busIndices.length),omittedBranches:Math.max(0,allBranches.length-branchLimit)};
}
export function initialFocus(network:PsseBusBranchNetwork,allowed:Set<number>,status:'all'|'in'|'out'){
 const degree=new Uint32Array(network.buses.length);for(const branch of network.branches)if(matchesStatus(branch.status,status)&&allowed.has(branch.from)&&allowed.has(branch.to)){degree[branch.from]++;degree[branch.to]++;}
 let best=-1,bestDegree=-1;for(const index of allowed){const d=degree[index];if(d>bestDegree){best=index;bestDegree=d;}}return best;
}
export function ringLayout(indices:number[],depths:Map<number,number>,center:number,width:number,height:number){
 const byDepth=new Map<number,number[]>();for(const index of indices){const depth=depths.get(index)??1;(byDepth.get(depth)??(byDepth.set(depth,[]),byDepth.get(depth)!)).push(index);}
 const positions=new Map<number,{x:number;y:number}>(),cx=width/2,cy=height/2;positions.set(center,{x:cx,y:cy});
 for(const [depth,items]of byDepth){if(depth===0)continue;const maxRadius=Math.min(width,height)*.43,radial=Math.max(68,maxRadius*(.44+.18*Math.min(depth,3))),start=-Math.PI/2;items.forEach((index,i)=>{const angle=start+(i/items.length)*Math.PI*2;positions.set(index,{x:cx+Math.cos(angle)*radial,y:cy+Math.sin(angle)*radial});});}
 return positions;
}
/** Deterministic, non-geographic feeder lanes for a small SLD neighborhood. */
export function feederLayout(indices:number[],depths:Map<number,number>,network:PsseBusBranchNetwork,width:number,height:number){
 const layers=new Map<number,number[]>();for(const index of indices){const depth=depths.get(index)??0;(layers.get(depth)??(layers.set(depth,[]),layers.get(depth)!)).push(index);}
 const maxDepth=Math.max(0,...layers.keys()),positions=new Map<number,{x:number;y:number}>(),left=180,right=width-165,top=96,bottom=142;
 for(const [depth,items]of layers){items.sort((a,b)=>{const left=network.buses[a],rightBus=network.buses[b];return(left.externalNumber??Number.MAX_SAFE_INTEGER)-(rightBus.externalNumber??Number.MAX_SAFE_INTEGER)||left.id.localeCompare(rightBus.id);});const x=maxDepth===0?width/2:left+(right-left)*depth/maxDepth,spacing=(height-top-bottom)/(items.length+1);items.forEach((index,i)=>positions.set(index,{x,y:top+spacing*(i+1)}));}
 return positions;
}
export function createEquipmentDialog(host:HTMLElement){
 const dialog=element('dialog','ga-psse-diagram-dialog');dialog.setAttribute('aria-label','PSS/E ekipman ayrıntısı');const close=button('Kapat',()=>dialog.close()),head=element('header'),title=element('h3'),subtitle=element('p','ga-muted'),pre=element('pre');head.append(title,close);dialog.append(head,subtitle,pre);host.append(dialog);
 const open=(equipment:PsseEquipment|null,label:string,normalized:Record<string,unknown>={})=>{title.textContent=label;if(!equipment){subtitle.textContent='Kaynak ekipman eşlemesi bulunamadı.';pre.textContent=JSON.stringify(normalized,null,2);}else{subtitle.textContent=`${equipment.kind} · ${equipment.id} · ${equipment.status===1?'serviste':equipment.status===0?'devre dışı':'durum bilinmiyor'}`;pre.textContent=JSON.stringify({name:equipment.name,buses:equipment.buses,nominalKv:equipment.nominalKv,sourceFields:equipment.fields,sourceOperating:equipment.operating,normalized},null,2);}if(!dialog.open)dialog.showModal();};return{dialog,open};
}
export function equipmentById(model:PsseModel,id:string){return model.equipment.find(equipment=>equipment.id===id)??null;}
