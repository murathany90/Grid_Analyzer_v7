import test from 'node:test';
import assert from 'node:assert/strict';
import {define} from '../src/modules/psse/ui/studio-tables.js';
import {sheetXml} from '../src/shared/export/workbook.js';

test('ND preserves numeric source types, circuit IDs, leading zero text and missing values',()=>{
 const model={equipment:[{id:'line:101:102:01',kind:'line',name:'123',fields:{ibus:101,jbus:102,ckt:'01',rpu:.0000000123456789,xpu:.125}}]};
 const ctx={ga:{psseNetwork:{},psseInspection:model},sources:()=>model,result:()=>null,targetKind:{'AC Line':'line'}};define(ctx);
 const data=ctx.liveDataset({name:'AC Line',columns:['From Bus Number','To Bus Number','Id','Name','Line R pu','Line X pu','Unknown']},'nd');
 assert.deepEqual(data.rows[0],[101,102,'01','123',.0000000123456789,.125,'']);
 const xml=sheetXml(data.headers,[...data.rows,[103,104,'9007199254740993','007',null,0,'']]);
 assert.match(xml,/<c r="A2"[^>]*><v>101<\/v>/);assert.match(xml,/<c r="C2" t="inlineStr"><is><t xml:space="preserve">01<\/t>/);
 assert.match(xml,/>9007199254740993<\/t>/);assert.match(xml,/>007<\/t>/);assert(!xml.includes('r="G2"'));
});

test('CSV default and Turkish numeric formats retain BOM, separator, precision and text IDs',()=>{
 let locale='invariant',download;const ctx={main:'nd',tabIndex:0,origin:'synthetic',$$:()=>({value:locale})};define(ctx);ctx.download=(name,text)=>download=text;
 ctx.selectData=()=>({headers:['Bus','Circuit','Voltage','Name'],rows:[[393221,'01',160.76772555593575,'007']]});ctx.query='';
 ctx.exportVisible();assert(download.startsWith('\uFEFF'));assert(download.includes('"393221";"01";"160.76772555593575";"007"'));
 locale='tr';ctx.exportVisible();assert(download.includes('"393221";"01";"160,76772555593575";"007"'));assert.equal(download.split('\r\n').length,2);
});
