import type {PsseModel} from '../../importers/psse/types';

/** Human-readable AREA/ZONE/OWNER labels resolved from the source SAV dictionaries
 * (binary arrays Numare/Arnam, Numzon/Zoname, Numown/Owname; 12-char packed names).
 * These are the same dictionaries the independent YTBS mapping audit verified
 * against the 01.06.2026 guide (evidence/psse-v3/mapping-*.json). No name is
 * invented: a code without a source dictionary entry stays numeric. */
export interface PsseNameDictionaries {area:Map<number,string>;zone:Map<number,string>;owner:Map<number,string>}
const cache=new WeakMap<PsseModel,PsseNameDictionaries>();
function packedDictionary(model:PsseModel,codes:string,names:string):Map<number,string>{
 const out=new Map<number,string>();
 const ids=model.binaryArrays?.[codes]?.values??[];
 const text=model.binaryArrays?.[names]?.values??[];
 const joined=Array.isArray(text)?text.join(''):'';
 if(!Array.isArray(ids))return out;
 ids.forEach((code,i)=>{
  const numeric=Number(code);
  if(!Number.isFinite(numeric))return;
  const name=joined.slice(i*12,(i+1)*12).trim();
  if(name)out.set(numeric,name);
 });
 return out;
}
export function psseNameDictionaries(model:PsseModel):PsseNameDictionaries{
 let cached=cache.get(model);
 if(!cached){
  cached={area:packedDictionary(model,'Numare','Arnam'),zone:packedDictionary(model,'Numzon','Zoname'),owner:packedDictionary(model,'Numown','Owname')};
  cache.set(model,cached);
 }
 return cached;
}
/** AREA code → source name (e.g. 4 → 'ORTAANADOLU'). */
export function psseAreaName(model:PsseModel,code:number|string|null|undefined):string|null{
 const numeric=Number(code);
 if(!Number.isFinite(numeric))return null;
 return psseNameDictionaries(model).area.get(numeric)??null;
}
/** OWNER code → source regional-directorate name (e.g. 702 → 'BURSA'). */
export function psseOwnerName(model:PsseModel,code:number|string|null|undefined):string|null{
 const numeric=Number(code);
 if(!Number.isFinite(numeric))return null;
 return psseNameDictionaries(model).owner.get(numeric)??null;
}
/** ZONE code → source voltage-class name (e.g. 2 → '154 KV'). */
export function psseZoneName(model:PsseModel,code:number|string|null|undefined):string|null{
 const numeric=Number(code);
 if(!Number.isFinite(numeric))return null;
 return psseNameDictionaries(model).zone.get(numeric)??null;
}
/** Display label: human-readable name first, raw code in parentheses. */
export function psseNamedCode(name:string|null|undefined,code:number|string|null|undefined):string{
 const readable=name??(code===null||code===undefined||code===''?'':String(code));
 if(!readable)return'—';
 return code===null||code===undefined||code===''?readable:`${readable} (${code})`;
}
