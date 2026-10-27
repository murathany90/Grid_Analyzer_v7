import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '@noble/hashes/sha2.js';
import {strToU8} from 'fflate';
import {hashPsseSidecars,parsePsseInventoryCatalog,PSSE_INVENTORY_PREVIEW_LIMIT,type PsseSidecarInput} from '../../src/importers/psse/attachments';
import {psseAttachmentStatus,shaPreview} from '../../src/features/psse/attachment-view';
const hex=(bytes:Uint8Array)=>Array.from(sha256(bytes),value=>value.toString(16).padStart(2,'0')).join('');
const inventory={
 bus:[{tur:'İLETİM',ad:'Çorlu Merkez 154 kV',ibus:1,id:154},{tur:'İLETİM',ad:'Babaeski TM 31,5 kV',ibus:'2',id:'BBS-31.5'}],
 acline:[{tur:'HAT',ad:'Çorlu-Babaeski 154 kV hattı',ibus:1,jbus:2,id:9001,ckt:1}],
 transformer:{T1:{tur:'TR',ad:'Çorlu T1 154/31,5 kV',ibus:1,jbus:3,id:77,ckt:'T1'}},
 generator:[{tur:'ÜNİTE',machid:1,ad:'Çorlu Gaz Türbini',ibus:3,id:'G1'}],
 load:['bozuk-satır'],
 fixshunt:[],sysswd:[],
 contingency:[{ad:'N-1 Çorlu-Babaeski hattı',ibus:1,jbus:2,id:9001,ckt:1}]
};
const sidecar=(archiveName:string,content:string|Uint8Array<ArrayBuffer>):PsseSidecarInput=>({archiveName,file:new File([typeof content==='string'?strToU8(content):content],archiveName)});
test('YTBS inventory sidecar is cataloged with record counts, malformed rows and identity label lookup',async()=>{
 const bundle=await hashPsseSidecars('b'.repeat(64),[sidecar('envanter.json',JSON.stringify(inventory))]),item=bundle.items[0];
 assert.equal(item.format,'INVENTORY_JSON');assert.ok(item.catalog);const catalog=item.catalog;
 assert.deepEqual(catalog.tables.map(table=>[table.table,table.recordCount,table.malformedCount]),[['bus',2,0],['acline',1,0],['transformer',1,0],['generator',1,0],['load',0,1],['fixshunt',0,0],['sysswd',0,0],['contingency',1,0]]);
 assert.equal(catalog.lookup('acline',{ibus:1,ckt:1}),'Çorlu-Babaeski 154 kV hattı');assert.equal(catalog.lookup('acline',{ibus:'1',ckt:'1'}),'Çorlu-Babaeski 154 kV hattı');
 assert.equal(catalog.lookup('bus',{ibus:2}),'Babaeski TM 31,5 kV');assert.equal(catalog.lookup('bus',{ibus:'1',id:154}),'Çorlu Merkez 154 kV');
 assert.equal(catalog.lookup('generator',{ibus:3,machid:'1'}),'Çorlu Gaz Türbini');assert.equal(catalog.lookup('transformer',{ibus:'1',ckt:'T1'}),'Çorlu T1 154/31,5 kV');
 assert.equal(catalog.lookup('bus',{ibus:1,ckt:'yok'}),'Çorlu Merkez 154 kV');assert.equal(catalog.lookup('bus',{ibus:9}),null);assert.equal(catalog.lookup('load',{ibus:1}),null);
 assert.equal(catalog.preview('bus').length,2);assert.equal(catalog.preview('bus',1).length,1);assert.equal(catalog.preview('load').length,0);
});
test('contingency table stays a future N-1 input candidate and never becomes a result payload',async()=>{
 const bundle=await hashPsseSidecars('b'.repeat(64),[sidecar('envanter.json',JSON.stringify(inventory))]),item=bundle.items[0],catalog=item.catalog!;
 assert.equal(catalog.contingencyCount,1);assert.equal(catalog.tables.find(table=>table.table==='contingency')?.recordCount,1);
 assert.equal(catalog.preview('contingency')[0]?.ad,'N-1 Çorlu-Babaeski hattı');assert.equal(catalog.lookup('contingency',{ibus:1,ckt:1}),'N-1 Çorlu-Babaeski hattı');
 assert.deepEqual(Object.keys(bundle),['sourceSha256','items']);assert.deepEqual(Object.keys(item).sort(),['archiveName','byteLength','catalog','file','format','sha256']);
});
test('inventory row previews cap at 50 rows while record counts and label index stay complete',async()=>{
 const rows=Array.from({length:60},(_,i)=>({ad:`Hat ${i+1}`,ibus:i+1,id:4000+i})),bundle=await hashPsseSidecars('d'.repeat(64),[sidecar('buyuk.json',JSON.stringify({bus:rows,load:[]}))]),catalog=bundle.items[0].catalog!;
 assert.equal(catalog.tables.find(table=>table.table==='bus')?.recordCount,60);assert.equal(catalog.preview('bus').length,PSSE_INVENTORY_PREVIEW_LIMIT);assert.equal(catalog.preview('bus')[49]?.ibus,'50');assert.equal(catalog.preview('bus',3).length,3);
 assert.equal(catalog.lookup('bus',{ibus:60,id:'4059'}),'Hat 60');
});
test('byte and SHA-256 roundtrip stays unchanged and statuses map to exact badge labels',async()=>{
 const iec=new Uint8Array([0,1,2,3,255]),sav=strToU8('sav-bytes');
 const bundle=await hashPsseSidecars('c'.repeat(64),[sidecar('kaynak.iec',iec),sidecar('model.sav',sav),sidecar('not.json','{"note":"envanter değil"}'),sidecar('bozuk.json','not-json')]);
 assert.equal(bundle.items[0].format,'IEC');assert.equal(bundle.items[0].sha256,hex(iec));assert.equal(bundle.items[0].byteLength,iec.byteLength);assert.deepEqual(new Uint8Array(await bundle.items[0].file.arrayBuffer()),iec);assert.equal(bundle.items[0].catalog,undefined);
 assert.equal(bundle.items[1].format,'SAV');assert.equal(bundle.items[1].sha256,hex(sav));assert.equal(new TextDecoder().decode(new Uint8Array(await bundle.items[1].file.arrayBuffer())),'sav-bytes');
 assert.equal(bundle.items[2].format,'INVENTORY_JSON');assert.equal(bundle.items[2].catalog,undefined);assert.equal(bundle.items[3].format,'INVENTORY_JSON');assert.equal(bundle.items[3].catalog,undefined);
 assert.deepEqual(bundle.items.map(item=>psseAttachmentStatus(item)),['ARCHIVED','VERIFIED_INPUT','CATALOG_ONLY','CATALOG_ONLY']);
 assert.equal(shaPreview('a'.repeat(64)),'a'.repeat(12)+'…');assert.equal(shaPreview('a'.repeat(64)).length,13);
});
test('sequential captures keep catalogs and items isolated between models',async()=>{
 const first=await hashPsseSidecars('a'.repeat(64),[sidecar('envanter.json',JSON.stringify(inventory)),sidecar('kaynak.iec',new Uint8Array([9,9]))]),second=await hashPsseSidecars('b'.repeat(64),[sidecar('envanter2.json',JSON.stringify({bus:[{ad:'Tek Bara',ibus:1,id:1}],load:[]}))]);
 assert.equal(first.items.length,2);assert.equal(second.items.length,1);assert.notEqual(first.items[0].catalog,second.items[0].catalog);
 assert.equal(first.items[0].catalog!.lookup('bus',{ibus:1}),'Çorlu Merkez 154 kV');assert.equal(first.items[0].catalog!.tables.find(table=>table.table==='bus')?.recordCount,2);
 assert.equal(second.items[0].catalog!.lookup('bus',{ibus:1}),'Tek Bara');assert.equal(second.items[0].catalog!.tables.find(table=>table.table==='bus')?.recordCount,1);
 assert.equal(first.items[0].archiveName,'envanter.json');assert.deepEqual(new Uint8Array(await first.items[1].file.arrayBuffer()),new Uint8Array([9,9]));
});
test('catalog parsing rejects non-JSON, non-object and tableless payloads and strips a BOM',()=>{
 assert.equal(parsePsseInventoryCatalog('not-json'),null);assert.equal(parsePsseInventoryCatalog('[]'),null);assert.equal(parsePsseInventoryCatalog('{"bus":5}'),null);assert.equal(parsePsseInventoryCatalog('{"note":"envanter değil"}'),null);
 const bom=parsePsseInventoryCatalog('\uFEFF{"bus":[{"ad":"A Barası","ibus":1}],"acline":[]}');assert.equal(bom?.tables.find(table=>table.table==='bus')?.recordCount,1);assert.equal(bom?.lookup('bus',{ibus:1}),'A Barası');
});
