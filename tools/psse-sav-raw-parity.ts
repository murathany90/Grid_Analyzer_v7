/** Actual bytes through both independent browser decoders. No oracle model embedded. */
import fs from 'node:fs';
import path from 'node:path';
import {decodePsse} from '../src/importers/psse/decode';
import type {PsseEquipment} from '../src/importers/psse/types';
import {rawFields} from '../src/importers/psse/raw-fields';
const root=process.env.PSSE_TEST_ROOT??'C:/Program Files/PTI/PSSE36/36.5';
const cases=process.argv.slice(2).length?process.argv.slice(2):['control1/20261014_1200_SN3_TR0','EXAMPLE/savnw','EXAMPLE/sample','EXAMPLE/bench','EXAMPLE/savnw_nb','EXAMPLE/sample_nb','EXAMPLE/sample_nb_sec'];
const fields:Record<string,string[]>={bus:['baskv','ide','vm','va','area','zone','owner'],generator:['pg','qg','qt','qb','pt','pb','vs','ireg','nreg','mbase','zr','zx','rt','xt','gtap','stat','rmpct'],load:['pl','ql','ip','iq','yp','yq','stat'],line:['rpu','xpu','bpu','gi','bi','gj','bj','stat','len',...Array.from({length:12},(_,i)=>`rate${i+1}`)],transformer:['stat','ratio1Pu','ratio2Pu','r12Pu','x12Pu',...Array.from({length:12},(_,i)=>`wdg1rate${i+1}`)],switch:['stat','xpu'],shunt:['stat','gl','bl','binit'],substation:['lati','long','srg']};
const ordered=(a:unknown,b:unknown)=>[Number(a),Number(b)].sort((x,y)=>x-y).join(':');
function key(e:PsseEquipment){const f=e.fields;switch(e.kind){case'bus':return `${e.kind}:${f.ibus}:${f.section??0}`;case'generator':return `${e.kind}:${f.ibus}:${f.machid}`;case'load':return `${e.kind}:${f.ibus}:${f.loadid}`;case'line':return `${e.kind}:${ordered(f.ibus,f.jbus)}:${f.ckt}`;case'transformer':return `${e.kind}:${f.ibus}:${f.jbus}:${f.kbus??0}:${f.ckt}`;case'switch':return `${e.kind}:${f.isub??''}:${ordered(f.ibus??f.inode,f.jbus??f.jnode)}:${f.ckt??f.swdid}`;case'shunt':return `${e.kind}:${f.ibus}:${f.shntid}:${f.modsw===undefined?'fixed':'switched'}`;case'substation':return `${e.kind}:${f.isub}`;default:return e.id;}}
const report:{generatedAt:string;scope:string;cases:unknown[]}={generatedAt:new Date().toISOString(),scope:'All equipment identities/endpoints in mapped classes; explicit numeric electrical fields. Source variants and uncovered fields reported, never silently filled.',cases:[]};
function tokenTolerance(token:unknown):number{
 if(typeof token!=='string')return 0;const match=/^[+-]?\d*(?:\.(\d*))?(?:[eEdD]([+-]?\d+))?$/.exec(token.trim());
 if(!match||!token.includes('.')&&!/[eEdD]/.test(token))return 0;return Math.pow(10,Number(match[2]??0)-(match[1]?.length??0))*0.5001;
}
function serializationTolerance(e:PsseEquipment,field:string,baseMva:number):number{
 const table=({bus:'BUS',generator:'GENERATOR',load:'LOAD',line:'BRANCH',switch:'SYSTEM_SWITCHING_DEVICE',shunt:e.fields.modsw===undefined?'FIXED_SHUNT':'SWITCHED_SHUNT',substation:'SUBSTATION'} as Record<string,string>)[e.kind];
 let token:unknown;const source=e.fields.sourceTokens;
 if(Array.isArray(source)&&table){const index=rawFields[table]?.indexOf(field)??-1;if(index>=0)token=source[index];}
 const winding=/^wdg([123])rate(\d+)$/.exec(field),lines=e.fields.sourceLines;
 if(winding&&Array.isArray(lines))token=(lines[Number(winding[1])+1] as unknown[]|undefined)?.[Number(winding[2])+2];
 if(e.kind==='transformer'&&['r12Pu','x12Pu'].includes(field)&&Array.isArray(lines)){
  const row=lines[1] as unknown[],r=Number(e.fields.r1_2),x=Number(e.fields.x1_2),mva=Number(e.fields.sbase1_2),cz=Number(e.fields.cz),component=field[0]==='r'?0:1,q=tokenTolerance(row?.[component]);
  if(cz===1)return q;if(cz===2)return q*baseMva/mva;
  if(cz===3){const resistance=r/(mva*1e6),scale=baseMva/mva;if(component===0)return q/(mva*1e6)*scale;const reactance=Math.sqrt(x*x-resistance*resistance);return reactance>0?q*Math.abs(x/reactance)*scale:0;}
 }
 return tokenTolerance(token);
}
for(const stem of cases){
 try{
  const read=async(ext:string)=>{const filename=path.join(root,stem+'.'+ext),bytes=fs.readFileSync(filename);return decodePsse(Uint8Array.from(bytes).buffer,path.basename(filename));};
  const sav=await read('sav'),raw=await read('raw');const left=new Map(sav.equipment.filter(e=>fields[e.kind]).map(e=>[key(e),e])),right=new Map(raw.equipment.filter(e=>fields[e.kind]).map(e=>[key(e),e]));
  const missingFromSav=[...right.keys()].filter(k=>!left.has(k)),missingFromRaw=[...left.keys()].filter(k=>!right.has(k));
  const errors:{key:string;field:string;sav:unknown;raw:unknown;tolerance?:number}[]=[],uncovered:Record<string,number>={};let compared=0;
  const connectionMaps=new Map([sav,raw].map(m=>[m,new Map(m.equipment.filter(x=>x.kind==='bus').map(x=>[Number(x.fields.connectionKey??x.fields.ibus),Number(x.fields.ibus)]))]));
  const connections=(e:PsseEquipment,m:typeof sav)=>{const busMap=connectionMaps.get(m)!;const result=e.buses.map(b=>busMap.get(b)??b);return ['line','switch'].includes(e.kind)?result.sort((a,b)=>a-b):result;};
  for(const [id,a]of left){const b=right.get(id);if(!b)continue;
   const ac=connections(a,sav),bc=connections(b,raw);if(JSON.stringify(ac)!==JSON.stringify(bc))errors.push({key:id,field:'externalTerminals',sav:ac,raw:bc});
   for(const field of fields[a.kind]){const reversed=a.kind==='line'&&a.fields.ibus===b.fields.jbus&&a.fields.jbus===b.fields.ibus,reverseField=({gi:'gj',bi:'bj',gj:'gi',bj:'bi'} as Record<string,string>)[field];const av=a.fields[field],bv=b.fields[reversed&&reverseField?reverseField:field];if(av===undefined||av===null||bv===undefined||bv===null){if(av!==bv)uncovered[`${a.kind}.${field}`]=(uncovered[`${a.kind}.${field}`]??0)+1;continue;}
    compared++;if(typeof av==='number'&&typeof bv==='number'){
     const tolerance=Math.max(serializationTolerance(b,field,raw.case.baseMva),field==='va'?0.00025:field==='vm'?0.000011:/^(pg|qg|qt|qb|pt|pb|pl|ql|ip|iq|yp|yq|rate|wdg|gl|bl|binit)/.test(field)?Math.max(0.0006,Math.abs(bv)*0.000002):Math.max(0.000002,Math.abs(bv)*0.000002));
     const difference=field==='va'?Math.abs(((av-bv+180)%360+360)%360-180):Math.abs(av-bv);
     if(difference>tolerance)errors.push({key:id,field,sav:av,raw:bv,tolerance});
    }else if(av!==bv)errors.push({key:id,field,sav:av,raw:bv});
   }
  }
  const counts=(x:typeof sav)=>Object.fromEntries([...new Set(x.equipment.map(e=>e.kind))].map(k=>[k,x.equipment.filter(e=>e.kind===k).length]));
  const errorFields:Record<string,number>={};for(const error of errors)errorFields[error.field]=(errorFields[error.field]??0)+1;
  const result={stem,status:errors.length||missingFromSav.length||missingFromRaw.length?'DIFFERENCES':'PASS_COMPARED_FIELDS',sav:sav.source,raw:raw.source,counts:{sav:counts(sav),raw:counts(raw)},compared,uncovered,missingFromSav,missingFromRaw,errorCount:errors.length,errorFields,errors:errors.slice(0,100),completeness:{sav:sav.completeness,raw:raw.completeness},findings:{sav:sav.findings.map(f=>f.code),raw:raw.findings.map(f=>f.code)}};report.cases.push(result);console.log(JSON.stringify({stem,status:result.status,compared,uncovered,missingSav:missingFromSav.length,missingRaw:missingFromRaw.length,errorCount:errors.length,errorFields,preview:errors.slice(0,4)}));
 }catch(error){report.cases.push({stem,status:'ERROR',error:String(error)});console.error(stem,String(error));}
}
const privateOutput=process.env.PSSE_SOURCE_PARITY_DETAILS??'local-benchmark-results/psse-sav-raw-parity-details.json';fs.mkdirSync(path.dirname(privateOutput),{recursive:true});fs.writeFileSync(privateOutput,JSON.stringify(report,null,2)+'\n');
const summary={...report,cases:report.cases.map(row=>{const x=row as Record<string,unknown>;const {errors,missingFromSav,missingFromRaw,findings,...rest}=x;return {...rest,missingFromSavCount:Array.isArray(missingFromSav)?missingFromSav.length:undefined,missingFromRawCount:Array.isArray(missingFromRaw)?missingFromRaw.length:undefined,privateDetails:'Retained locally, omitted from public evidence'};})};
const publicOutput=process.env.PSSE_SOURCE_PARITY_OUTPUT??'evidence/sav-raw-parity.json';fs.mkdirSync(path.dirname(publicOutput),{recursive:true});fs.writeFileSync(publicOutput,JSON.stringify(summary,null,2)+'\n');
