import type {PsseModel,PsseEquipment,PsseKind} from './types';
import {n,s,integer,optional,addEquipment,value,type SourceRow} from './common';
export type SourceTables=Record<string,SourceRow[]>;
export function transformerImpedance(r:number,x:number,mva:number,cz:number,base:number):[number,number]{
 if(cz===1)return[r,x];if(![2,3].includes(cz)||mva<=0)throw Error('Unsupported CZ / invalid transformer MVA base');
 const scale=base/mva;if(cz===2)return[r*scale,x*scale];const resistance=r/(mva*1e6);
 if(x<0||x*x<resistance*resistance)throw Error('Invalid CZ=3 impedance magnitude');return[resistance*scale,Math.sqrt(x*x-resistance*resistance)*scale];
}
export function windingRatio(windv:number,nominal:number,kv:number,cw:number):number{
 if(windv<=0)throw Error('Invalid winding ratio');if(cw===1)return windv;
 if(kv<=0)throw Error('Missing winding voltage base');if(cw===2)return windv/kv;if(cw===3)return windv*(nominal||kv)/kv;throw Error('Unsupported CW');
}
const required:Record<string,string[]>={BUS:['ibus','name','baskv','ide','vm','va'],LOAD:['ibus','loadid','stat','pl','ql','ip','iq','yp','yq'],GENERATOR:['ibus','machid','pg','qg','qt','qb','vs','mbase','zr','zx','stat','pt','pb'],BRANCH:['ibus','jbus','ckt','rpu','xpu','bpu','stat'],FIXED_SHUNT:['ibus','shntid','stat','gl','bl'],SYSTEM_SWITCHING_DEVICE:['ibus','jbus','ckt','xpu','stat'],TRANSFORMER:['ibus','jbus','kbus','ckt','cw','cz','cm','mag1','mag2','stat','r1_2','x1_2','sbase1_2','windv1','windv2']};
/** Map named source fields. Every original record remains in sourceTables. */
export function normalizeRawTables(model:PsseModel,tables:SourceTables):void{
 model.sourceTables=tables;
 for(const [table,rows]of Object.entries(tables))for(const row of rows)for(const key of required[table]??[])if(row[key]===null||row[key]===undefined||row[key]==='')throw Error(`Missing ${table}.${key}`);
 const undirected=new Set<string>();
 for(const table of ['BRANCH','TRANSFORMER','SYSTEM_SWITCHING_DEVICE','SUBSTATION_SWITCHING_DEVICE'])for(const row of tables[table]??[]){const node=table==='SUBSTATION_SWITCHING_DEVICE',ends=(node?[row.inode,row.jnode]:table==='TRANSFORMER'?[row.ibus,row.jbus,row.kbus]:[row.ibus,row.jbus]).filter(x=>x!==null&&x!==undefined&&integer(x)!==0).map(x=>Math.abs(integer(x))).sort((a,b)=>a-b),key=table+':'+(node?integer(row.isub)+':':'')+ends.join(':')+':'+s(node?row.swdid:row.ckt);if(undirected.has(key))throw Error(`DUPLICATE_OR_REVERSED_EQUIPMENT: ${key}`);undirected.add(key);}
 const buses=new Map<number,SourceRow>();for(const row of tables.BUS??[]){const b=integer(row.ibus);buses.set(b,row);addEquipment(model,'bus',String(b),row,[b],integer(row.ide)===4?0:1,s(row.name),{vm:value(n(row.vm),'BUS.vm','pu'),va:value(n(row.va),'BUS.va','deg')});}
 for(const [table,keys]of [['GENERATOR',['ireg']],['SWITCHED_SHUNT',['swreg']],['TRANSFORMER',['cont1','cont2','cont3']],['VOLTAGE_DROOP_CONTROL',['regbus']]] as const)for(const row of tables[table]??[])for(const key of keys){const b=optional(row[key]);if(b!==null&&b!==0&&!buses.has(Math.abs(integer(b))))throw Error(`MISSING_CONTROL_BUS: ${table}.${key}=${b}`);}
 const single=(kind:PsseKind,table:string,idKey:string,statusKey='stat',prefix='')=>{
  for(const row of tables[table]??[]){const bus=integer(row.ibus);const op:PsseEquipment['operating']={};
   for(const key of kind==='generator'?['pg','qg','vs']:kind==='load'?['pl','ql','ip','iq','yp','yq']:['gl','bl','binit'])if(row[key]!==null&&row[key]!==undefined)op[key]=value(n(row[key]),`${table}.${key}`,key==='vs'?'pu':/[pq]g$|[pq]l$|^ip$|^yp$|^gl$/.test(key)?'MW':'Mvar');
   addEquipment(model,kind,`${prefix}${bus}:${s(row[idKey])}`,row,[bus],integer(row[statusKey]),s(row.name),op);
  }
 };
 single('generator','GENERATOR','machid');single('load','LOAD','loadid');single('shunt','FIXED_SHUNT','shntid','stat','fixed:');single('shunt','SWITCHED_SHUNT','shntid','stat','switched:');
 for(const row of tables.BRANCH??[]){const i=Math.abs(integer(row.ibus)),j=Math.abs(integer(row.jbus));addEquipment(model,'line',`${i}:${j}:${s(row.ckt)}`,row,[i,j],integer(row.stat),s(row.name));}
 for(const row of tables.SYSTEM_SWITCHING_DEVICE??[]){const i=integer(row.ibus),j=integer(row.jbus);addEquipment(model,'switch',`system:${i}:${j}:${s(row.ckt)}`,row,[i,j],integer(row.stat),s(row.name),{status:value(integer(row.stat),'SYSTEM_SWITCHING_DEVICE.stat')});}
 for(const row of tables.TRANSFORMER??[]){
  const bs=[integer(row.ibus),integer(row.jbus)];const k=integer(row.kbus);if(k)bs.push(k);
  const fields:SourceRow={...row};const op:PsseEquipment['operating']={};
  for(const [a,b]of k?[[1,2],[2,3],[3,1]]:[[1,2]]){const [r,x]=transformerImpedance(n(row[`r${a}_${b}`]),n(row[`x${a}_${b}`]),n(row[`sbase${a}_${b}`]),integer(row.cz),model.case.baseMva);fields[`r${a}${b}Pu`]=r;fields[`x${a}${b}Pu`]=x;}
  for(let w=1;w<=bs.length;w++){const bus=buses.get(bs[w-1]);if(!bus)throw Error('Missing transformer terminal bus');fields[`ratio${w}Pu`]=windingRatio(n(row[`windv${w}`]),n(row[`nomv${w}`]),n(bus.baskv),integer(row.cw));op[`tap${w}`]=value(n(row[`windv${w}`]),`TRANSFORMER.windv${w}`);if(optional(row[`ang${w}`])!==null)op[`angle${w}`]=value(n(row[`ang${w}`]),`TRANSFORMER.ang${w}`,'deg');}
  addEquipment(model,'transformer',`${bs.join(':')}:${s(row.ckt)}`,fields,bs,integer(row.stat),s(row.name),op);
 }
 for(const row of tables.SUBSTATION??[])addEquipment(model,'substation',String(integer(row.isub)),row,[],null,s(row.name));
 const substations=new Set((tables.SUBSTATION??[]).map(row=>integer(row.isub)));
 const nodes=new Map<string,SourceRow>();for(const row of tables.SUBSTATION_NODE??[]){const isub=integer(row.isub),inode=integer(row.inode),bus=integer(row.ibus);if(!substations.has(isub))throw Error(`MISSING_NODE_SUBSTATION: ${isub}:${inode}`);nodes.set(`${isub}:${inode}`,row);addEquipment(model,'node',`${isub}:${inode}`,row,bus?[bus]:[],integer(row.stat),s(row.name),{vm:value(optional(row.vm),'SUBSTATION_NODE.vm','pu'),va:value(optional(row.va),'SUBSTATION_NODE.va','deg')});}
 for(const row of tables.SUBSTATION_SWITCHING_DEVICE??[]){const isub=integer(row.isub),i=integer(row.inode),j=integer(row.jnode);const bs=[nodes.get(`${isub}:${i}`)?.ibus,nodes.get(`${isub}:${j}`)?.ibus].filter(x=>x!==undefined&&integer(x)!==0).map(x=>integer(x));addEquipment(model,'switch',`node:${isub}:${i}:${j}:${s(row.swdid)}`,row,bs,integer(row.stat),s(row.name));}
 for(const row of tables.SUBSTATION_TERMINAL??[]){const bs=[row.ibus,row.jbus,row.kbus].filter(x=>x!==null&&x!==undefined&&integer(x)!==0).map(x=>integer(x)),type=s(row.type).toUpperCase(),node=nodes.get(`${row.isub}:${row.inode}`);if(node&&integer(node.ibus)!==0&&integer(node.ibus)!==bs[0])throw Error(`TERMINAL_NODE_BUS_MISMATCH: ${row.isub}:${row.inode}`);
  const map:Record<string,[PsseKind,string]>={M:['generator','machid'],L:['load','loadid'],F:['shunt','shntid'],S:['shunt','shntid'],B:['line','ckt'],'2':['transformer','ckt'],'3':['transformer','ckt']};
  const target=map[type];if(target){const match=model.equipment.find(e=>(e.kind===target[0]||type==='B'&&e.id.startsWith('switch:system:'))&&s(e.fields[target[1]])===s(row.eqid)&&e.buses.length===bs.length&&e.buses.every(b=>bs.includes(b))&&(type!=='F'||e.id.startsWith('shunt:fixed:'))&&(type!=='S'||e.id.startsWith('shunt:switched:')));if(!match)throw Error(`MISSING_TERMINAL_EQUIPMENT: ${row.isub}:${row.inode}:${type}:${s(row.eqid)}`);row.connectedEquipmentId=match.id;}
  else if(!['D','V','N','A','I'].includes(type))model.findings.push({severity:'WARNING',code:'UNSUPPORTED_SOURCE_MODEL',message:`SUBSTATION_TERMINAL type ${type}: kaynak ilişkisi korunuyor; ekipman eşlemesi bilinmiyor.`});
  addEquipment(model,'terminal',`${row.isub}:${row.inode}:${row.type}:${bs.join(':')}:${s(row.eqid)}`,row,bs,null);
 }
 const mapped=new Set(['BUS','LOAD','FIXED_SHUNT','GENERATOR','BRANCH','SYSTEM_SWITCHING_DEVICE','TRANSFORMER','SWITCHED_SHUNT','SUBSTATION','SUBSTATION_NODE','SUBSTATION_SWITCHING_DEVICE','SUBSTATION_TERMINAL']);
 for(const [table,rows]of Object.entries(tables))if(!mapped.has(table)&&rows.length){
  const electrical=/DC|FACTS|GNE|INDUCTION|VOLTAGE_DROOP/.test(table);
  if(electrical)model.findings.push({severity:'WARNING',code:'UNSUPPORTED_SOURCE_MODEL',message:`${table}: ${rows.length} kaynak kaydı korunuyor; elektriksel yorumun kapsamı sınırlı.`});
  if(electrical)rows.forEach((row,i)=>{const kind:PsseKind=/DC/.test(table)?'dc':/FACTS/.test(table)?'facts':'other';const bs=['ibus','jbus','regbus'].flatMap(key=>optional(row[key])?[Math.abs(integer(row[key]))]:[]);addEquipment(model,kind,`${table}:${s(row.name)}:${i}`,{sourceTable:table,...row},bs,optional(row.stat??row.status??row.mode),s(row.name));});
 }
}
