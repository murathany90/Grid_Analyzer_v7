/** Shared five-band voltage grouping for the PSS/E Model/Map/SLD UIs.
 * Band thresholds follow the DGS reference convention; ≤36 kV is a single band
 * that includes 36 kV itself and every lower nominal level. Unknown kV stays a
 * separate category that UIs may show only when all bands are selected. */
export interface PsseVoltageBand {id:string;label:string}
export const PSSE_VOLTAGE_BANDS:readonly PsseVoltageBand[]=[
 {id:'b400',label:'400 kV'},
 {id:'b220',label:'220 kV'},
 {id:'b154',label:'154 kV'},
 {id:'b66',label:'66 kV'},
 {id:'blow',label:'≤36 kV'},
];
export type PsseVoltageBandId=typeof PSSE_VOLTAGE_BANDS[number]['id'];
export function psseVoltageBand(baseKv:number|null|undefined):PsseVoltageBandId|'unknown'{
 if(baseKv===null||baseKv===undefined||!Number.isFinite(baseKv)||baseKv<=0)return'unknown';
 if(baseKv>=300)return'b400';
 if(baseKv>=180)return'b220';
 if(baseKv>=100)return'b154';
 if(baseKv>36)return'b66';
 return'blow';
}
export function psseVoltageBandCounts(baseKvs:Iterable<number|null|undefined>):Record<PsseVoltageBandId|'unknown',number>{
 const counts:Record<PsseVoltageBandId|'unknown',number>={b400:0,b220:0,b154:0,b66:0,blow:0,unknown:0};
 for(const kv of baseKvs){const band=psseVoltageBand(kv);counts[band]++;}
 return counts;
}
