import type {YtbsSlot} from './ytbs-slotting';

export const feederAreaUnits=(kv:number)=>kv>36?4:1;
/** An invisible cell reserves actual branch lanes plus caption space. Units are
 * packing weights; minimum symbol clearance never shrinks with voltage. */
export function feederCellWidth(slot:YtbsSlot,branchCount=0){return Math.max(feederAreaUnits(slot.feeder.voltageKv)*44,88+Math.min(branchCount,4)*24,slot.role==='coupler'||slot.role==='transfer'?72+slot.feeder.switchIds.length*44:0,['autotransformer','transformer-primary','bank'].includes(slot.placementRole??slot.role)?240*Math.max(1,slot.feeder.equipmentKeys.filter(k=>k.startsWith('ElmTr')).length):0);}
export function packFeederRows(slots:readonly YtbsSlot[],branchCounts:ReadonlyMap<string,number>,maxSpan=1180){
 const rows:{upper:YtbsSlot[];lower:YtbsSlot[];upperWidth:number;lowerWidth:number;upperUnits:number;lowerUnits:number}[]=[];
 const sorted=[...slots].sort((a,b)=>Number(isModelFeeder(a))-Number(isModelFeeder(b))||a.block-b.block||a.column-b.column||a.feeder.id.localeCompare(b.feeder.id));
 const width=(s:YtbsSlot)=>feederCellWidth(s,branchCounts.get(s.feeder.id)??0);
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
