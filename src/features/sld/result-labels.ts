import type {SldResultEntry,SldResultOverlay} from './result-overlay';
export const resultNumber=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.abs(v)>=10000?v.toExponential(1):v.toFixed(1):'—';
/** A valid diagnostic result remains displayable. Uncomputed / stale quantities
 * never borrow numbers from another scenario or a reference drawing. */
export function labelValues(entry:SldResultEntry|undefined){if(!entry||/^(?:NOT_RUN|STALE|BLOCKED|UNSUPPORTED)/.test(entry.status))return {};if(/^(?:UNKNOWN|PARTIAL\b)/.test(entry.status))return entry.validatedQuantities?Object.fromEntries(Object.entries(entry.values).filter(([k])=>entry.validatedQuantities!.includes(k)||k==='fromTerminal'||k==='toTerminal')):{};return entry.values;}
export function portResultRows(overlay:SldResultOverlay|undefined,key:string|undefined,terminal:string){
 const entry=key?overlay?.entries.get(key):undefined,v=labelValues(entry),t=labelValues(overlay?.entries.get('ElmTerm|'+terminal)),side=v.fromTerminal===terminal?'From':v.toTerminal===terminal?'To':null,prefix=overlay?.phase==='CHANGE'?'Δ':'';
 const single=entry&&v.fromTerminal==null&&v.toTerminal==null;
 return [['P',side?v['p'+side+'Mw']:single?v.pMw:null,'MW'],['Q',side?v['q'+side+'Mvar']:single?v.qMvar:null,'MVAr'],['U',t.voltageKv??(side?v[side==='From'?'fromVoltageKv':'toVoltageKv']:null),'kV'],['I',side?v['i'+side+'A']:null,'A']].map(([name,value,unit])=>`${prefix}${name}: ${resultNumber(value)} ${unit}`);
}
