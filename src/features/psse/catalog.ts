import type {PsseEquipment,PsseKind,PsseModel} from '../../importers/psse/types';
export const kindLabels:Record<PsseKind,string>={substation:'TM',bus:'Bara',line:'Hat',transformer:'Trafo',generator:'Jeneratör',load:'Yük',shunt:'Şönt',switch:'Anahtar',node:'Düğüm',terminal:'Terminal',dc:'DC',facts:'FACTS',other:'Diğer'};
export type PsseTab='summary'|'inventory'|'operating'|'quality';
export interface PsseQuery {kind?:PsseKind;search?:string;status?:string;minKv?:number;maxKv?:number;sort?:string;descending?:boolean;page?:number;pageSize?:number;operating?:boolean}
export function equipmentValue(row:PsseEquipment,key:string,operating=false):unknown{if(key==='buses')return row.buses.join(' → ');if(key in row&&key!=='fields'&&key!=='operating')return row[key as keyof PsseEquipment];return operating?row.operating[key]?.value:row.fields[key];}
export function queryPsse(model:PsseModel,query:PsseQuery){
 const needle=(query.search??'').trim().toLocaleLowerCase('tr'),sort=query.sort??'id',collator=new Intl.Collator('tr',{numeric:true,sensitivity:'base'});
 const rows=model.equipment.filter(row=>(!query.kind||row.kind===query.kind)&&(!query.status||(row.status===null?'unknown':String(row.status))===query.status)&&(query.minKv===undefined||row.nominalKv!==null&&row.nominalKv>=query.minKv)&&(query.maxKv===undefined||row.nominalKv!==null&&row.nominalKv<=query.maxKv)&&(!needle||[row.id,row.name,row.buses.join(' '),JSON.stringify(row.fields)].join(' ').toLocaleLowerCase('tr').includes(needle)));
 rows.sort((a,b)=>{const av=equipmentValue(a,sort,query.operating),bv=equipmentValue(b,sort,query.operating);const c=av==null?(bv==null?0:1):bv==null?-1:typeof av==='number'&&typeof bv==='number'?av-bv:collator.compare(String(av),String(bv));return (query.descending?-c:c)||collator.compare(a.id,b.id);});
 const size=Math.max(10,Math.min(100,Math.floor(query.pageSize??40))),pages=Math.max(1,Math.ceil(rows.length/size)),page=Math.min(pages-1,Math.max(0,Math.floor(query.page??0)));
 return{rows:rows.slice(page*size,(page+1)*size),total:rows.length,pages,page,pageSize:size};
}
