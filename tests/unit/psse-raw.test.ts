import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {decodeRaw,decodeRawx,splitRaw} from '../../src/importers/psse/raw';
import {rawFields} from '../../src/importers/psse/raw-fields';
import {validatePsse} from '../../src/importers/psse/common';
import {compareRawModels,referenceRawPairs} from '../../tools/psse-raw-parity';
const encode=(value:string)=>new TextEncoder().encode(value),bus=(i=1)=>`${i},'BUS ${i}',154,${i===1?3:1},1,1,1,1.02,-3,1.1,.9,1.1,.9`;
const record=(section:string,values:Record<string,unknown>)=>rawFields[section].map(key=>{const value=values[key];return value===undefined?'':typeof value==='string'?"'"+value.replaceAll("'","''")+"'":String(value);}).join(',');
const generator=()=>record('GENERATOR',{ibus:1,machid:'A',pg:10,qg:2,qt:20,qb:-20,vs:1.02,ireg:0,nreg:0,mbase:100,zr:.01,zx:.2,rt:0,xt:0,gtap:1,stat:1,rmpct:100,pt:50,pb:0});
const raw=(sections:Record<string,string[]>)=>encode('0,100,36,0,1,50\nSynthetic public test\nNo proprietary model\n'+Object.entries({BUS:[bus()],GENERATOR:[generator()],...sections}).map(([section,rows])=>'0 / END OF PREVIOUS DATA, BEGIN '+section.replaceAll('_',' ')+' DATA\n'+rows.join('\n')).join('\n')+'\nQ\n');
function validated(bytes:Uint8Array){const model=decodeRaw(bytes,'synthetic.raw');validatePsse(model);return model;}
const rawx=(sections:Record<string,{fields:string[];data:unknown[]}>)=>encode(JSON.stringify({network:{caseid:{fields:['ic','sbase','rev','xfrrat','nxfrat','basfrq','title1','title2'],data:[0,100,36,0,1,50,'Synthetic','Test']},bus:{fields:rawFields.BUS,data:[[1,'BUS 1',154,3,1,1,1,1.02,-3,1.1,.9,1.1,.9]]},...sections}}));

test('RAW tokenizer preserves quoted comma/slash/doubled quotes and rejects unterminated text',()=>{assert.deepEqual(splitRaw("1,'a,b/c''d',2 / note"),['1',"a,b/c'd",'2']);assert.throws(()=>splitRaw("1,'bad"),/Unterminated/);});
test('RAW rejects truncation, unsupported revisions and nonfinite electrical inputs',()=>{assert.throws(()=>decodeRaw(raw({}).subarray(0,20),'bad.raw'),/Truncated|Missing/);assert.throws(()=>decodeRaw(encode(new TextDecoder().decode(raw({})).replace(',36,',',34,')),'old.raw'),/UNSUPPORTED_RAW_REVISION/);assert.throws(()=>validated(raw({BUS:[bus().replace('154','NaN')]})),/Invalid/);assert.throws(()=>validated(encode(new TextDecoder().decode(raw({})).replace(/Q\n$/,''))),/TRUNCATED_RAW/);});
test('RAW rejects duplicate buses, missing line terminals and reversed duplicate circuits',()=>{
 assert.throws(()=>validated(raw({BUS:[bus(),bus()]})),/DUPLICATE/);
 const line=(i:number,j:number)=>record('BRANCH',{ibus:i,jbus:j,ckt:'1',rpu:.01,xpu:.1,bpu:.02,stat:1});
 assert.throws(()=>validated(raw({BRANCH:[line(1,999)]})),/MISSING_TERMINAL_BUS/);assert.throws(()=>validated(raw({BUS:[bus(),bus(2)],BRANCH:[line(1,2),line(2,1)]})),/DUPLICATE_OR_REVERSED/);
});
test('RAW validates remote generator control references',()=>{assert.throws(()=>validated(raw({GENERATOR:[generator().replace(',0,0,100,',',999,0,100,')]})),/MISSING_CONTROL_BUS/);});
test('RAWX rejects duplicate fields, invalid numeric values, absent required fields and missing endpoints',()=>{
 assert.throws(()=>decodeRawx(rawx({bus:{fields:['ibus','IBUS'],data:[[1,2]]}}),'bad.rawx'),/Duplicate/);
 assert.throws(()=>decodeRawx(rawx({bus:{fields:rawFields.BUS,data:[[1,'BUS','Infinity',3,1,1,1,1,0]]}}),'bad.rawx'),/Invalid BUS.baskv/);
 assert.throws(()=>decodeRawx(rawx({bus:{fields:['ibus','name','baskv','ide','vm'],data:[[1,'BUS',154,3,1]]}}),'bad.rawx'),/Missing BUS.va/);
 const bytes=rawx({acline:{fields:['ibus','jbus','ckt','rpu','xpu','bpu','stat'],data:[[1,999,'1',.01,.1,.02,1]]}});assert.throws(()=>{const model=decodeRawx(bytes,'bad.rawx');validatePsse(model);},/MISSING_TERMINAL_BUS/);
});
test('RAW node-breaker variable-length terminal records retain device IDs and omitted endpoint slots',()=>{
 const base=new TextDecoder().decode(raw({})).replace(/Q\n$/,'');const source=base+"0 / END OF PREVIOUS DATA, BEGIN SUBSTATION DATA\n1,'STATION',0,0,0\n1,'NODE',1,1\n0 / END OF SUBSTATION NODE DATA, BEGIN SUBSTATION SWITCHING DEVICE DATA\n0 / END OF SUBSTATION SWITCHING DEVICE DATA, BEGIN SUBSTATION TERMINAL DATA\n1,1,'M','A'\n0 / END OF SUBSTATION TERMINAL DATA\n0 / END OF SUBSTATION DATA\nQ\n";
 const model=validated(encode(source)),terminal=model.equipment.find(row=>row.kind==='terminal')!;assert.equal(terminal.fields.type,'M');assert.equal(terminal.fields.eqid,'A');assert.equal(terminal.fields.jbus,null);assert.equal(terminal.fields.kbus,null);assert.deepEqual(terminal.buses,[1]);
 assert.throws(()=>validated(encode(source.replace("1,1,'M','A'","1,999,'M','A'"))),/MISSING_NODE_TERMINAL/);
 assert.throws(()=>validated(encode(source.replace("1,1,'M','A'","1,1,'M','MISSING'"))),/MISSING_TERMINAL_EQUIPMENT/);
});
test('parity identifies altered source limits without hiding additional winding compensation differences',()=>{
 const a=validated(raw({})),b=structuredClone(a);b.equipment.find(row=>row.kind==='generator')!.fields.qt=999;assert.equal(compareRawModels(a,b).status,'FAIL');b.equipment.find(row=>row.kind==='generator')!.fields.qt=20;a.equipment[0].fields.cx3=.00394;b.equipment[0].fields.cx3=0;const parity=compareRawModels(a,b);assert.equal(parity.status,'PASS_NORMALIZED_FIELDS');assert.equal(parity.extendedStatus,'SOURCE_INPUT_DIFFERENCES');assert.equal(parity.extendedDifferences.length,1);
});
const installation=process.env.PSSE_TEST_ROOT??'C:/Program Files/PTI/PSSE36/36.5';
for(const name of referenceRawPairs){const r=path.join(installation,'EXAMPLE',name+'.raw'),x=path.join(installation,'EXAMPLE',name+'.rawx');test(`native RAW/RAWX normalized parity: ${name}`,{skip:!fs.existsSync(r)||!fs.existsSync(x)},()=>{const a=decodeRaw(fs.readFileSync(r),name+'.raw'),b=decodeRawx(fs.readFileSync(x),name+'.rawx');validatePsse(a);validatePsse(b);const result=compareRawModels(a,b);assert.equal(result.status,'PASS_NORMALIZED_FIELDS',JSON.stringify(result.coreDifferences.slice(0,3)));assert.deepEqual(result.sourceResidue.status,'RETAINED_NOT_ELECTRICALLY_COMPARED');assert.deepEqual(a.analyses,{powerFlow:'BLOCKED',shortCircuit:'BLOCKED',n1:'BLOCKED'});});}
