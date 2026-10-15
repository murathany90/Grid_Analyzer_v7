import type {YtbsSlot} from './ytbs-slotting';
import type {Feeder,StationTopologyGraph} from '../../domain/model/station-topology';
import {feederDrawingPath} from './feeder-drawing-graph';
import {nativeBarCircuit} from './bar-circuit';

export const feederAreaUnits=(kv:number)=>kv>36?4:1;
/** Horizontal pitch between the real busbar attachments of one bay. */
export const ANCHOR_STEP=22;
/** V3.6 bay corridor: every real rail of one bay owns its own vertical lane inside the
 *  bay cell, and every lane leaves the rail band on a collector drawn outside the group. */
export const LANE_STEP=32;
export const LANE_PAD=12;
/** Lane x of one real rail of one bay. `near` is the rail index nearest the bay itself. */
export const barLaneX=(spine:number,index:number,near:number)=>spine+(index-near)*LANE_STEP;
/** Measured source demand of one physical bay. Only real attachments reserve space;
 *  a packing weight, a voltage class or a name never widens a cell. */
export interface FeederCellDemand{barAnchors:number;branchRoots:number;parallelWindings:number;circuitSwitches:number}
export const cellDemand=(p:Partial<FeederCellDemand>={}):FeederCellDemand=>({barAnchors:0,branchRoots:0,parallelWindings:0,circuitSwitches:0,...p});
/** Width of one invisible cell: symbol clearance, the real busbar anchor spread, the
 *  real off-spine branch lanes and the wrapped caption actually drawn for this voltage. */
export function feederCellWidth(slot:YtbsSlot,demand:Partial<FeederCellDemand>={}){const d=cellDemand(demand),hv=slot.feeder.voltageKv>40,spine=40;
 return Math.ceil(Math.max(hv?118:112,Math.max(0,d.barAnchors-1)*LANE_STEP+40,spine+d.branchRoots*46,40+Math.max(0,d.parallelWindings-1)*74,40+d.circuitSwitches*42)/4)*4;}
/** Real source attachments of one bay, measured exactly as the renderer draws them. */
export function feederCellDemandOf(graph:StationTopologyGraph,feeder:Feeder,sections:ReadonlySet<string>):FeederCellDemand{
 const main=feederDrawingPath(graph,feeder),nodes=(main?.terminals??[]).filter(id=>!sections.has(id)),placed=new Set(nodes),internal=graph.switches.filter(s=>feeder.switchIds.includes(s.id)&&s.from!==s.to&&!sections.has(s.from)&&!sections.has(s.to));
 let branchRoots=0;for(const node of nodes)for(const e of internal){const next=e.from===node?e.to:e.to===node?e.from:null;if(next&&!placed.has(next)){branchRoots++;placed.add(next);}}
 return cellDemand({barAnchors:Math.max(graph.switches.filter(s=>feeder.switchIds.includes(s.id)&&sections.has(s.from)!==sections.has(s.to)).length,feeder.busSectionIds.length),branchRoots,parallelWindings:graph.equipment.filter(e=>feeder.equipmentKeys.includes(`${e.sourceClass}|${e.id}`)&&(e.kind==='transformer'||e.kind==='transformer3w')).length,circuitSwitches:nativeBarCircuit(graph,feeder)?.switchIds.length??0});}
export const feederSideOrder=(a:YtbsSlot,b:YtbsSlot)=>Number(isModelFeeder(a))-Number(isModelFeeder(b))||a.block-b.block||a.column-b.column||a.feeder.id.localeCompare(b.feeder.id);
/** A proven function keeps its V4 side. The rest is balanced widest-first so both rows of
 *  one physical rail stay comparable; the drawing order inside a row stays the V4 order. */
export function partitionFeederSides(slots:readonly YtbsSlot[],demand:ReadonlyMap<string,FeederCellDemand>,widthOf:(s:YtbsSlot)=>number=slot=>feederCellWidth(slot,demand.get(slot.feeder.id))){
 const upper:YtbsSlot[]=[],lower:YtbsSlot[]=[];let upperWidth=0,lowerWidth=0;
 if(slots.length&&slots.every(s=>s.feeder.voltageKv>0&&s.feeder.voltageKv<=36)){
  let alternating=0;for(const s of [...slots].sort((a,b)=>a.feeder.name.localeCompare(b.feeder.name,'tr',{numeric:true})||a.feeder.id.localeCompare(b.feeder.id))){const role=s.placementRole??s.role,side=role==='transformer-incoming'?'upper':role==='transformer-primary'||role==='autotransformer'||role==='bank'||role==='coupler'||role==='transfer'?'lower':alternating++%2===0?'upper':'lower';
   if(side==='upper'){upper.push(s);upperWidth+=widthOf(s);}else{lower.push(s);lowerWidth+=widthOf(s);}}
  return {upper,lower,upperWidth,lowerWidth};
 }
 const sideOf=(s:YtbsSlot):'upper'|'lower'|null=>{const role=s.placementRole??s.role;return isModelFeeder(s)||role==='transformer-primary'||role==='autotransformer'||role==='bank'?'lower':role==='transformer-incoming'?'upper':s.feeder.voltageKv>36&&s.side?(s.side==='A'?'upper':'lower'):null;};
 for(const s of [...slots].sort((a,b)=>Number(isModelFeeder(a))-Number(isModelFeeder(b))||widthOf(b)-widthOf(a)||feederSideOrder(a,b))){const side=sideOf(s)??(upperWidth<=lowerWidth?'upper':'lower');
  if(side==='upper'){upper.push(s);upperWidth+=widthOf(s);}else{lower.push(s);lowerWidth+=widthOf(s);}}
 return {upper:upper.sort(feederSideOrder),lower:lower.sort(feederSideOrder),upperWidth,lowerWidth};}
export function packFeederRows(slots:readonly YtbsSlot[],branchCounts:ReadonlyMap<string,number>,maxSpan=1180){
 const rows:{upper:YtbsSlot[];lower:YtbsSlot[];upperWidth:number;lowerWidth:number;upperUnits:number;lowerUnits:number}[]=[];
 const sorted=[...slots].sort((a,b)=>Number(isModelFeeder(a))-Number(isModelFeeder(b))||a.block-b.block||a.column-b.column||a.feeder.id.localeCompare(b.feeder.id));
 const width=(s:YtbsSlot)=>feederCellWidth(s,cellDemand({branchRoots:branchCounts.get(s.feeder.id)??0}));
 for(const s of sorted){const role=s.placementRole??s.role,forced:'upper'|'lower'|null=isModelFeeder(s)||role==='transformer-primary'||role==='autotransformer'||role==='bank'?'lower':role==='transformer-incoming'?'upper':s.feeder.voltageKv>36&&s.side?(s.side==='A'?'upper':'lower'):null;
  let row=rows.at(-1);if(!row)rows.push(row={upper:[],lower:[],upperWidth:0,lowerWidth:0,upperUnits:0,lowerUnits:0});
  let side=forced??(row.upperUnits<=row.lowerUnits?'upper':'lower');
  if(row[side+'Width' as 'upperWidth'|'lowerWidth']+width(s)>maxSpan&&row[side].length){const other=side==='upper'?'lower':'upper';if(!forced&&row[other+'Width' as 'upperWidth'|'lowerWidth']+width(s)<=maxSpan)side=other;else rows.push(row={upper:[],lower:[],upperWidth:0,lowerWidth:0,upperUnits:0,lowerUnits:0});}
  row[side].push(s);row[side+'Width' as 'upperWidth'|'lowerWidth']+=width(s);row[side+'Units' as 'upperUnits'|'lowerUnits']+=feederAreaUnits(s.feeder.voltageKv);
 }
 return rows.length?rows:[{upper:[],lower:[],upperWidth:0,lowerWidth:0,upperUnits:0,lowerUnits:0}];
}
/** Presentation tag for the user-identified source model connections only;
 * never creates, removes or changes any physical device or canonical record. */
export function isModelFeeder(slot:Pick<YtbsSlot,'feeder'>){return slot.feeder.sourceClass!=='ElmBay'&&/\bLSZ\b|TR[ .-]*[\p{L}\d]*[- .]*Y[ÜU]K[ÜU]?/iu.test(slot.feeder.name);}
