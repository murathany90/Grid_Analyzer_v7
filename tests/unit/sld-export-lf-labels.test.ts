import test from 'node:test';
import assert from 'node:assert/strict';
import {sldExportFilename} from '../../src/features/sld/export-filename';
import {formatMw,formatMvar,formatLoading,formatTap,lfPowerRows,lfTransformerRows} from '../../src/features/sld/result-labels';
import type {SldResultOverlay} from '../../src/features/sld/result-overlay';

test('SVG/PNG share readable Unicode station identity and local wall-clock date/time',()=>{
 const now=new Date(2026,11,11,10,0),site={name:'Akkopru',id:'M111'};
 assert.equal(sldExportFilename(site,'png',now),'Akkopru(M111)_11.12.26_1000.png');
 assert.equal(sldExportFilename(site,'svg',now),'Akkopru(M111)_11.12.26_1000.svg');
 assert.equal(sldExportFilename({name:'Çığ İstasyonu / Şönt: Trafo?',id:'M111'},'svg',new Date(2026,0,2,0,5)),'Çığ İstasyonu Şönt Trafo(M111)_02.01.26_0005.svg');
 assert.equal(sldExportFilename({name:'<>:"/\\|?*\u0001 .',id:''},'png',now),'TM(TM)_11.12.26_1000.png');
});
test('Short LF formats preserve sign, finite zero, tap steps and missing quantities',()=>{
 assert.equal(formatMw(-12.34),'-12.3 MW');assert.equal(formatMvar(0),'0.0 MVAr');assert.equal(formatLoading(85.24),'85.2 %');assert.equal(formatTap(-2),'-2 kademe');
 for(const v of [undefined,null,NaN,Infinity,-Infinity,'','12']){assert.equal(formatMw(v),'— MW');assert.equal(formatMvar(v),'— MVAr');assert.equal(formatLoading(v),'— %');assert.equal(formatTap(v),'— kademe');}
});
function overlay(status='CONVERGED'):SldResultOverlay{return {status,method:'FULL_AC_NR',phase:'POST',outageKey:null,entries:new Map([['ElmTr2|T',{status,method:'FULL_AC_NR',values:{fromTerminal:'HV',toTerminal:'LV',pFromMw:10,qFromMvar:3,pToMw:-9.7,qToMvar:-2,loadingPercent:42,tapPosition:7},lines:[],direction:10,alarm:false}]])};}
test('Minimal LF rows use the actual native side and a single transformer summary',()=>{
 const o=overlay();assert.deepEqual(lfPowerRows(o,'ElmTr2|T','LV'),['-9.7 MW','-2.0 MVAr']);assert.deepEqual(lfPowerRows(o,'ElmTr2|T','FOREIGN'),['— MW','— MVAr']);
 assert.deepEqual(lfTransformerRows(o,'ElmTr2|T','HV'),['10.0 MW','3.0 MVAr','42.0 %   7 kademe']);
 o.phase='CHANGE';assert.deepEqual(lfPowerRows(o,'ElmTr2|T','LV'),['Δ -9.7 MW','Δ -2.0 MVAr']);
});
for(const status of ['NOT_RUN','STALE','UNKNOWN','BLOCKED','PARTIAL','UNSUPPORTED'])test('Minimal LF keeps the existing quantity gate: '+status,()=>{
 assert.deepEqual(lfTransformerRows(overlay(status),'ElmTr2|T','HV'),['— MW','— MVAr','— %   — kademe']);
});
test('Unknown loading basis admits only validated powers; absent results remain dashes',()=>{
 const o=overlay('UNKNOWN_LOADING_BASIS');o.entries.get('ElmTr2|T')!.validatedQuantities=['pFromMw','qFromMvar'];
 assert.deepEqual(lfTransformerRows(o,'ElmTr2|T','HV'),['10.0 MW','3.0 MVAr','— %   — kademe']);
 assert.deepEqual(lfPowerRows(undefined,undefined,'HV'),['— MW','— MVAr']);
});
