import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeRaw,decodeRawx} from '../src/importers/psse/raw';
import {validatePsse,type SourceRow} from '../src/importers/psse/common';
import type {PsseEquipment,PsseModel} from '../src/importers/psse/types';
export const referenceRawPairs=['bench','fault_calc_3wdg_auto_neutral_current','ieee_harmonics_test_case','sample','sample_nb','sample_nb_sec','sample_zils','sample_zils_nb','sample_zils_nb_sec','savnw','savnw_nb'];
const displayFields=new Set(['name','mname','arname','zoname','owname','vecgrp']);
const sourceFields=new Set(['sourceTokens','sourceLines','vmstar','anstar']);
export interface ParityDifference {equipment:string;field:string;left:unknown;right:unknown}
const normalized=(value:unknown):unknown=>value===undefined||value===''?null:value;
function comparisonRows(model:PsseModel):PsseEquipment[]{
 const rows=model.equipment.filter(row=>!['dc','facts','other'].includes(row.kind));
 // Area/zone/owner source rows are part of the preceding SDK's normalized scope.
 for(const [table,id]of [['AREA','iarea'],['ZONE','izone'],['OWNER','iowner']])for(const fields of (model.sourceTables[table]??[]) as SourceRow[])rows.push({id:`${table}:${fields[id]}`,kind:'other',buses:[],name:'',status:null,nominalKv:null,fields,operating:{}});
 return rows;
}
/** Compare a stated scope. Original fields are retained; differing input values are never repaired. */
export function compareRawModels(left:PsseModel,right:PsseModel,tolerance=1e-5){
 const core:ParityDifference[]=[],extended:ParityDifference[]=[],lm=new Map(comparisonRows(left).map(row=>[row.id,row])),rm=new Map(comparisonRows(right).map(row=>[row.id,row]));let compared=0,excluded=0,comparedExtended=0;
 function compare(equipment:string,field:string,a:unknown,b:unknown,additional=false){a=normalized(a);b=normalized(b);if(additional)comparedExtended++;else compared++;const equal=typeof a==='number'&&typeof b==='number'?Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance:JSON.stringify(a)===JSON.stringify(b);if(!equal)(additional?extended:core).push({equipment,field,left:a,right:b});}
 compare('case','baseMva',left.case.baseMva,right.case.baseMva);compare('case','frequencyHz',left.case.frequencyHz,right.case.frequencyHz);
 for(const id of new Set([...lm.keys(),...rm.keys()])){const a=lm.get(id),b=rm.get(id);if(!a||!b){core.push({equipment:id,field:'identity',left:!!a,right:!!b});continue;}compare(id,'buses',a.buses,b.buses);compare(id,'status',a.status,b.status);
  for(const key of new Set([...Object.keys(a.fields),...Object.keys(b.fields)])){if(displayFields.has(key)||sourceFields.has(key)||/^sourceField\d+$/.test(key)){excluded++;continue;}
   // The earlier SDK did not normalize winding line-drop compensation/connection-angle fields.
   compare(id,key,a.fields[key],b.fields[key],/^(?:cr|cx|cnxa)[123]$/.test(key));
  }
 }
 const residue=(model:PsseModel)=>Object.fromEntries(Object.entries(model.sourceTables).filter(([key])=>/DC|FACTS|GNE|INDUCTION|VOLTAGE_DROOP/.test(key)).map(([key,rows])=>[key,Array.isArray(rows)?rows.length:null]));
 return{status:core.length?'FAIL':'PASS_NORMALIZED_FIELDS',coreComparedLeaves:compared,excludedDisplayAndResidueFields:excluded,coreDifferences:core,extendedComparedLeaves:comparedExtended,extendedStatus:extended.length?'SOURCE_INPUT_DIFFERENCES':'PASS_ADDITIONAL_MAPPED_FIELDS',extendedDifferences:extended,counts:{left:lm.size,right:rm.size},sourceResidue:{left:residue(left),right:residue(right),status:'RETAINED_NOT_ELECTRICALLY_COMPARED'},fullElectricalParity:'NOT_CLAIMED_UNSUPPORTED_SOURCE_MODELS_AND_UNVERIFIED_SOLVERS'};
}
export function runRawParity(installation:string){return referenceRawPairs.map(name=>{const a=decodeRaw(fs.readFileSync(path.join(installation,'EXAMPLE',name+'.raw')),name+'.raw'),b=decodeRawx(fs.readFileSync(path.join(installation,'EXAMPLE',name+'.rawx')),name+'.rawx');validatePsse(a);validatePsse(b);return{model:name,raw:a.source,rawx:b.source,completeness:{raw:a.completeness,rawx:b.completeness},...compareRawModels(a,b)};});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const sanitize=(difference:ParityDifference)=>({equipmentSha256:createHash('sha256').update(difference.equipment).digest('hex'),field:difference.field,left:difference.left,right:difference.right});
 const installation=process.argv[2]??process.env.PSSE_TEST_ROOT??'C:/Program Files/PTI/PSSE36/36.5',out=process.argv[3]??'evidence/native-raw-rawx-parity.json',cases=runRawParity(installation).map(row=>({...row,coreDifferences:row.coreDifferences.map(sanitize),extendedDifferences:row.extendedDifferences.map(sanitize)})),report={schema:'ga.psse.raw-parity.v1',tolerance:1e-5,scope:'Oriented identities, endpoints, status, source numerical/control/rating fields and derived winding impedance/ratios for core equipment, plus area/zone/owner. Display labels, star internals and encoded source residue excluded. CR/CX/CNXA winding fields reported separately because preceding normalized scope omitted them. Public evidence hashes equipment identities; it contains no model records.',cases,summary:{passed:cases.filter(c=>c.status==='PASS_NORMALIZED_FIELDS').length,total:cases.length,additionalInputDifferences:cases.reduce((sum,c)=>sum+c.extendedDifferences.length,0)}};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));if(report.summary.passed!==11)process.exitCode=1;
}
