import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {inspectModelFile,isDgsModelJson} from '../../src/importers/model-file';
import {hashPsseSidecars} from '../../src/importers/psse/attachments';
import {queryPsse} from '../../src/features/psse/catalog';
import type {PsseEquipment,PsseModel} from '../../src/importers/psse/types';
const equipment=(id:string,p:number):PsseEquipment=>({id,kind:'generator',name:'Ünite '+id,buses:[Number(id)],status:1,nominalKv:154,fields:{P:p},operating:{P:{value:p,field:'PG',provenance:'SOURCE_SAVED',unit:'MW'}}});
const model={equipment:[equipment('2',10),equipment('10',-8),equipment('1',100)]} as PsseModel;
test('native archive extension selection preserves the default DGS JSON reader',async()=>{
 const file=new File([zipSync({'model.json':strToU8('{"ElmTerm":{"Attributes":["FID"],"Values":[]}}'),'one.sav':new Uint8Array([1,2,3]),'folder/two.RAW':strToU8('RAW'),'three.rawx':strToU8('{}')})],'models.zip');
 const dgs=await inspectModelFile(file);assert.deepEqual(dgs.entries.map(entry=>entry.name),['model.json']);
 const psse=await inspectModelFile(file,{extensions:['sav','raw','rawx']});assert.deepEqual(psse.entries.map(entry=>entry.name),['one.sav','folder/two.RAW','three.rawx']);assert.deepEqual(new Uint8Array(await(await psse.extract(psse.entries[0])).arrayBuffer()),new Uint8Array([1,2,3]));assert.equal((await psse.extract(psse.entries[1])).name,'two.RAW');
});
test('native model selection rejects JSON caches and unsafe paths',async()=>{
 const options={extensions:['sav','raw','rawx']};await assert.rejects(inspectModelFile(new File(['{}'],'converted.json'),options),/Desteklenen/);await assert.rejects(inspectModelFile(new File([zipSync({'converted.json':strToU8('{}')})],'converted.zip'),options),/bulunamadı/);await assert.rejects(inspectModelFile(new File([zipSync({'../model.sav':new Uint8Array([1])})],'unsafe.zip'),options),/güvensiz/);
});
test('native SAV ZIP corruption cannot become a model',async()=>{
 const payload=zipSync({'real.sav':new Uint8Array([1,2,3,4])},{level:0});payload[30+'real.sav'.length]^=1;const archive=await inspectModelFile(new File([payload],'bad.zip'),{extensions:['sav']});await assert.rejects(archive.extract(archive.entries[0]),/CRC/);
});
test('PSS/E ZIP companion files remain opaque attachments and inventory JSON is not mistaken for DGS or RAWX',async()=>{
 const inventory=JSON.stringify({bus:[{number:1}],load:[],transformer:[],contingency:[],generator:[],acline:[],sysswd:[]}),zip=new File([zipSync({'source.sav':new Uint8Array([1,2,3]),'source.iec':new Uint8Array([0,1,2]),'source.gcp':strToU8('GCP'),'source.mon':strToU8('MON'),'source.con':strToU8('CON'),'source.json':strToU8(inventory)})],'source.zip'),archive=await inspectModelFile(zip,{extensions:['json','sav','raw','rawx']});assert.deepEqual(archive.entries.map(entry=>entry.name),['source.sav']);assert.deepEqual(archive.attachments.map(entry=>entry.name),['source.iec','source.gcp','source.mon','source.con','source.json']);for(const entry of archive.attachments){const extracted=await archive.extract(entry);assert.equal(extracted.size,entry.size);const expected=entry.name==='source.iec'?new Uint8Array([0,1,2]):entry.name==='source.json'?strToU8(inventory):strToU8(entry.name.split('.').at(-1)!.toUpperCase());assert.deepEqual(new Uint8Array(await extracted.arrayBuffer()),expected);}assert.equal(await isDgsModelJson(await archive.extract(archive.attachments[4])),false);assert.equal(await isDgsModelJson(new File([JSON.stringify({ElmTerm:{Attributes:['FID'],Values:[]}})],'small-dgs.json')),true);assert.equal(await isDgsModelJson(new File(['{}'],'empty.json')),false);
 const bundle=await hashPsseSidecars('a'.repeat(64),await Promise.all(archive.attachments.map(async entry=>({archiveName:entry.name,file:await archive.extract(entry)}))));assert.equal(bundle.sourceSha256,'a'.repeat(64));assert.equal(bundle.items.length,5);assert.equal(bundle.items.find(item=>item.format==='INVENTORY_JSON')?.archiveName,'source.json');assert.ok(bundle.items.every(item=>item.sha256.length===64&&item.byteLength===item.file.size));
});
test('source operating numbers sort numerically and preserve negative values and provenance',()=>{
 const before=JSON.stringify(model),result=queryPsse(model,{kind:'generator',operating:true,sort:'P'});assert.deepEqual(result.rows.map(row=>row.id),['10','2','1']);assert.equal(result.rows[0].operating.P.value,-8);assert.equal(result.rows[0].operating.P.provenance,'SOURCE_SAVED');assert.equal(JSON.stringify(model),before);
});
test('native inventory query applies source IDs, voltage and status without inventing missing values',()=>{
 assert.deepEqual(queryPsse(model,{sort:'id'}).rows.map(row=>row.id),['1','2','10']);assert.equal(queryPsse(model,{search:'ÜNİTE 10'}).total,1);assert.equal(queryPsse(model,{status:'0'}).total,0);assert.equal(queryPsse(model,{minKv:220}).total,0);
 const unknown={equipment:[{...equipment('3',0),nominalKv:null,status:null}]} as PsseModel;assert.equal(queryPsse(unknown,{status:'unknown'}).total,1);assert.equal(queryPsse(unknown,{minKv:0}).total,0);
});
test('native inventory pagination clamps pages and limits transfers to 100 rows',()=>{
 const large={equipment:Array.from({length:251},(_,i)=>equipment(String(i),i))}as PsseModel;const result=queryPsse(large,{page:999,pageSize:999,sort:'id'});assert.equal(result.total,251);assert.equal(result.pageSize,100);assert.equal(result.page,2);assert.equal(result.rows.length,51);assert.equal(result.rows[0].id,'200');
});
