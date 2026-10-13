import type {StationTopologyGraph} from '../../domain/model/station-topology';import {voltageMatches,type VoltageBand} from '../../domain/model/voltage-band';import {assignYtbsSlot,type YtbsSlot} from './ytbs-slotting';
export interface FeederTile {slot:YtbsSlot;x:number;y:number;width:number;height:number;representedKeys:string[]}
export interface VoltagePanel {kv:number;x:number;y:number;width:number;height:number;axisY:number;tiles:FeederTile[];barIds:string[];sourceProfile:string}
/** Page graph: source feeder markers and explicit native reference boundaries, no invented electrical edges. */
export function stationOverviewPage(graph:StationTopologyGraph,bands:ReadonlySet<VoltageBand>,width=1200,height=560){
 const levels=graph.voltageLevels.filter(kv=>voltageMatches(kv,bands)),mobile=width<500,cols=width<1000?7:10,gap=mobile?4:8,left=12,availableWidth=width-left*2,panels:VoltagePanel[]=[];
 const representedSwitches=new Set(graph.feeders.filter(f=>voltageMatches(f.voltageKv,bands)).flatMap(f=>f.switchIds)),unassignedSwitches=graph.switches.filter(s=>!representedSwitches.has(s.id)&&graph.terminals.some(t=>(t.id===s.from||t.id===s.to)&&voltageMatches(t.vnKv,bands)));
 const groups=levels.map(kv=>{const slots=assignYtbsSlot(graph,graph.feeders.filter(f=>f.voltageKv===kv)),rows={A:Math.ceil(slots.filter(s=>s.side==='A').length/cols),B:Math.ceil(slots.filter(s=>s.side==='B').length/cols),N:Math.ceil(slots.filter(s=>!s.side).length/cols)};return {kv,slots,rows,weight:Math.max(1,rows.A+rows.B+rows.N)};});
 const weight=groups.reduce((n,g)=>n+g.weight,0),cellHeight=Math.max(mobile?18:24,Math.min(64,(height-42-groups.length*58)/Math.max(1,weight))),tileWidth=(availableWidth-gap*(cols+1))/cols;
 let top=42+Math.ceil(unassignedSwitches.length/cols)*22;
 for(const {kv,slots,rows}of groups){const panelHeight=58+(rows.A+rows.B+rows.N)*cellHeight,axisY=top+25+rows.A*cellHeight,tiles:FeederTile[]=[];
  const place=(side:'A'|'B'|null,start:number)=>{const selected=slots.filter(s=>s.side===side).sort((a,b)=>a.block-b.block||a.column-b.column||a.feeder.id.localeCompare(b.feeder.id));for(const [i,slot]of selected.entries()){const f=slot.feeder,keys=[...f.switchIds.map(id=>{const s=graph.switches.find(s=>s.id===id)!;return s.sourceClass+'|'+s.sourceId;}),...f.equipmentKeys];tiles.push({slot,x:left+gap+(i%cols)*(tileWidth+gap),y:start+Math.floor(i/cols)*cellHeight,width:tileWidth,height:cellHeight-5,representedKeys:keys});}};
  place('A',top+25);place('B',axisY+24);place(null,axisY+24+rows.B*cellHeight);panels.push({kv,x:left,y:top,width:availableWidth,height:panelHeight,axisY,tiles,barIds:graph.busSections.filter(b=>b.voltageKv===kv).map(b=>b.id),sourceProfile:slots.some(s=>s.slot==='UNSPECIFIED_BY_V4')?'UNSPECIFIED_BY_V4':'V4 / SOURCE_GRAPH'});top+=panelHeight+gap;
 }
 return {unassignedSwitches,cols,gap,tileWidth,width,height:Math.max(height,top+15),panels,tiles:panels.flatMap(p=>p.tiles),omitted:0,detailRequired:width<600&&cellHeight<32};
}
