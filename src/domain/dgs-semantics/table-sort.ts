export type SortKind='auto'|'number'|'text';
export type SortAtom=number|string|null;
export type SortValue=SortAtom|readonly SortAtom[];
export interface CatalogSortSnapshot {id:string;field:string;modelHash:string;values:readonly (readonly [string,string,SortValue])[]}
const text=new Intl.Collator('tr',{numeric:true,sensitivity:'variant'});
const identifier=new Intl.Collator('tr',{numeric:true});
export function sortAtom(value:unknown,kind:SortKind='auto'):SortAtom {
 if(value==null||value===''||value==='—')return null;
 if(typeof value==='number')return Number.isFinite(value)?kind==='text'?String(value):value:null;
 if(typeof value==='boolean')return kind==='text'?String(value):Number(value);
 const s=typeof value==='object'?JSON.stringify(value):String(value);
 if(!s?.trim())return null;
 const number=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s.trim())?Number(s):NaN;
 return kind==='text'?s:Number.isFinite(number)?number:kind==='number'?null:s;
}
/** Missing values remain last in either direction. FID/class ties are always
 * ascending, so page boundaries and mixed classes have one deterministic order. */
export function compareTableValues(a:unknown,b:unknown,descending=false,kind:SortKind='auto'):number {
 const aa=Array.isArray(a)?a:[a],bb=Array.isArray(b)?b:[b];
 for(let i=0;i<Math.max(aa.length,bb.length);i++){
  const av=sortAtom(aa[i],kind),bv=sortAtom(bb[i],kind);if(av==null||bv==null){if(av==null&&bv==null)continue;return av==null?1:-1;}
  const n=typeof av==='number'&&typeof bv==='number'?av-bv:typeof av!==typeof bv?(typeof av==='number'?-1:1):text.compare(String(av),String(bv));if(n)return n*(descending?-1:1);
 }return 0;
}
export function compareTableRows(a:unknown,b:unknown,aId:string,bId:string,descending=false,kind:SortKind='auto',aClass='',bClass=''){
 return compareTableValues(a,b,descending,kind)||identifier.compare(aId,bId)||(aId===bId?0:aId<bId?-1:1)||identifier.compare(aClass,bClass)||(aClass===bClass?0:aClass<bClass?-1:1);
}
