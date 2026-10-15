import type {StationTopologyGraph} from '../../domain/model/station-topology';
/** Counts describe the source/projection difference without mislabelling hidden leaves as missing evidence. */
export function stationSummary(source:StationTopologyGraph,drawing:StationTopologyGraph,drawn:number){
 const hidden=source.sourceAudit?.switchDrawing?.filter(s=>s.classification==='HIDE_NONFUNCTIONAL_SOURCE_LEAF').length??0;
 const uncertain=new Set([...source.issues.map(i=>i.sourceClass+'|'+i.sourceId),...(source.sourceAudit?.switchDrawing??[]).filter(s=>s.classification==='REVIEW_UNRESOLVED').map(s=>s.switchId)]);
 const reactors=drawing.equipment.filter(e=>e.reactiveSymbol==='shunt-reactor'||e.reactiveSymbol==='series-reactor').length,capacitors=drawing.equipment.filter(e=>e.reactiveSymbol==='capacitor-bank'||e.reactiveSymbol==='series-capacitor').length;
 const transformers=drawing.equipment.filter(e=>e.kind==='transformer'||e.kind==='transformer3w'),auto=transformers.filter(e=>e.autoTransformer===true).length,breakers=drawing.switches.filter(s=>s.kind==='breaker').length,disconnectors=drawing.switches.filter(s=>s.kind==='isolator'||s.kind==='load-break-disconnector').length;
 return {hidden,uncertain:uncertain.size,bars:drawing.busSections.length,feeders:drawing.feeders.length,transformers:transformers.length-auto,auto,breakers,disconnectors,reactors,capacitors,otherSwitches:drawing.switches.length-breakers-disconnectors,otherEquipment:drawing.equipment.length-transformers.length-reactors-capacitors,drawn,missing:Math.max(0,source.switches.length+source.equipment.length-hidden-drawn)};
}
