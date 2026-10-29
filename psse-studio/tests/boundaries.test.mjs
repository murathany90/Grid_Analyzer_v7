import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createHostAdapter} from '../src/core/host-adapter.js';
async function files(dir){const list=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())list.push(...await files(p));else list.push(p);}return list;}
test('PSS/E source has acyclic module imports and no DGS repository dependency',async()=>{
  const sources=(await files('src')).filter(p=>p.endsWith('.js')),graph=new Map();
  for(const p of sources){const text=await fs.readFile(p,'utf8'),imports=[...text.matchAll(/(?:import|export)\s+(?:[^;]*?\sfrom\s*)?['"]([^'"]+)['"]/g)].map(m=>m[1]);
    assert(imports.every(i=>!i.includes('/dgs/')&&!i.includes('Grid_Analyzer_v7')));
    graph.set(path.resolve(p),imports.filter(i=>i.startsWith('.')).map(i=>path.resolve(path.dirname(p),i.split('?')[0])).filter(i=>i.endsWith('.js')));
  }
  const visiting=new Set(),visited=new Set();function visit(p){if(visited.has(p))return;assert(!visiting.has(p),'Circular import: '+p);visiting.add(p);for(const to of graph.get(p)??[])visit(to);visiting.delete(p);visited.add(p);}for(const p of graph.keys())visit(p);
});
test('host adapter whitelists services and excludes DGS mutable state',()=>{
  const h=createHostAdapter({network:{kind:'DGS'},scenario:{},resultStore:{},settings:{},onNavigate(){}});assert.deepEqual(Object.keys(h),['onNavigate']);assert(Object.isFrozen(h));
});
test('source labels are valid UTF-8 and contain no replacement characters',async()=>{
  for(const file of await files('src')){const bytes=await fs.readFile(file),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);assert(!text.includes('\uFFFD'),file);}
});
test('portable build embeds scripts/styles/workers and forbids external connections',async()=>{
  const html=await fs.readFile('dist/Grid_Analyzer_PSSE_Portable.html','utf8');assert(!/<script[^>]+src=/i.test(html));assert(!/<link[^>]+href=/i.test(html));assert(html.includes("connect-src 'none'"));assert(!html.includes('20261014_1200_SN3_TR0.sav'));assert(html.length<2_000_000);
});
test('original V12 and its backup are byte-identical',async()=>{
  const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),source=await fs.readFile('psse_modu/v12_guncel.html'),backup=await fs.readFile('backups/v12_guncel.original.html');assert.equal(hash(source),hash(backup));
});
