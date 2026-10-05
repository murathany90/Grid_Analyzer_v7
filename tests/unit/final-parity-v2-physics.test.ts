import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {DgsModel,type DgsRawData} from '../../src/importers/dgs/index';
import {mapCanonical} from '../../src/importers/dgs/canonical';

type Table={Attributes:string[];Values:unknown[][]};
async function fixture(){return JSON.parse(await readFile('tests/fixtures/small-dgs.json','utf8')) as Record<string,Table>;}
function set(table:Table,key:string,value:unknown){const column=table.Attributes.indexOf(key);assert.ok(column>=0,key);table.Values[0][column]=value;}
async function map(raw:Record<string,Table>){return mapCanonical(await new DgsModel(raw as DgsRawData,'parity-physics',1000).build(),'fixture');}

test('ElmSym uses valid IntQlim at immutable pgini and falls back to direct limits',async()=>{
 const raw=await fixture();
 raw.ElmSym={Attributes:['FID','loc_name','outserv','bus1','pgini','qgini','cQ_min','cQ_max','pQlimType'],Values:[
  ['G1','interpolated',0,'C_TR_LV',50,0,-95,33,'QL1'],
  ['G2','below curve',0,'C_TR_LV',-10,0,-95,33,'QL1'],
  ['G3','above curve',0,'C_TR_LV',120,0,-95,33,'QL1'],
  ['G4','invalid curve',0,'C_TR_LV',50,0,-95,33,'QL2'],
  ['G5','missing curve',0,'C_TR_LV',50,0,-95,33,'MISSING'],
 ]};
 raw.IntQlim={Attributes:['FID','cap_P:SIZEROW','cap_P:0','cap_Qmn:0','cap_Qmx:0','cap_P:1','cap_Qmn:1','cap_Qmx:1'],Values:[
  ['QL1',2,0,-100,40,100,-200,80],
  ['QL2',1,0,100,-100,null,null,null],
 ]};
 const generators=new Map((await map(raw)).generators.map(row=>[row.id,row]));
 assert.deepEqual([generators.get('G1')!.qMin,generators.get('G1')!.qMax],[-150,60]);
 assert.deepEqual([generators.get('G2')!.qMin,generators.get('G2')!.qMax],[-100,40]);
 assert.deepEqual([generators.get('G3')!.qMin,generators.get('G3')!.qMax],[-200,80]);
 for(const id of ['G4','G5'])assert.deepEqual([generators.get(id)!.qMin,generators.get(id)!.qMax],[-95,33]);
});

test('variable shunts use the indexed mTaps MVAr and canonical bus to ushnm base',async()=>{
 const raw=await fixture();raw.ElmShnt={Attributes:['FID','loc_name','outserv','bus1','shtype','iTaps','ncapa','ncapx','ushnm','qrean','qcapn','mTaps:SIZEROW','mTaps:0','mTaps:1','mTaps:2'],Values:[
  ['SH1','variable reactor',0,'C_TR_LV',1,1,2,4,100,999,0,3,0,5,11],
  ['SH2','fixed capacitor',0,'C_TR_LV',2,0,1,4,154,0,9,0,null,null,null],
  ['SH3','invalid variable',0,'C_TR_LV',1,1,2,4,154,999,0,1,5,null,null],
 ]};
 const network=await map(raw),shunts=new Map(network.shunts.map(row=>[row.id,row]));
 assert.ok(Math.abs(shunts.get('SH1')!.bPu+11/100*(154/100)**2)<1e-12);
 assert.equal(shunts.get('SH1')!.stepProvenance,'mTaps');assert.equal(shunts.get('SH1')!.activeStepQMvar,11);
 assert.equal(shunts.get('SH2')!.bPu,.09);assert.equal(shunts.get('SH2')!.stepProvenance,'qcapn');
 assert.equal(shunts.get('SH3')!.bPu,0);assert.equal(shunts.get('SH3')!.stepProvenance,'INVALID_MTAPS');
});

test('LV tap transforms series and ratio on canonical bus bases while preserving own-base inputs',async()=>{
 const raw=await fixture(),type=raw.TypTr2,transformer=raw.ElmTr2;
 set(type,'utrn_h',380);set(type,'utrn_l',160);set(type,'tap_side',1);set(type,'itapch',1);set(type,'ntpmn',0);
 set(transformer,'nntap',1);transformer.Attributes.push('mTaps:SIZEROW','mTaps:0','mTaps:1');transformer.Values[0].push(2,160,152);
 const tr=(await map(raw)).transformers[0],rho=.95,sn=100,ownR=800/(1000*sn),ownX=Math.sqrt((12/100)**2-ownR**2),seriesScale=(160/154)**2*rho**2;
 assert.ok(Math.abs(tr.rPu-ownR*seriesScale)<1e-12);assert.ok(Math.abs(tr.xPu-ownX*seriesScale)<1e-12);
 assert.ok(Math.abs(tr.tap-(380/400)/(160/154)/rho)<1e-12);
 assert.ok(Math.abs(tr.gPu-(80/(1000*sn))*(sn/100)*(400/380)**2)<1e-12);
 assert.equal(tr.tapSource,'mTaps');assert.equal(tr.tapSide,1);
});

test('HV tap changes effective magnetizing base without changing LV series tap factor',async()=>{
 const raw=await fixture(),type=raw.TypTr2,transformer=raw.ElmTr2;
 set(type,'utrn_h',380);set(type,'utrn_l',160);set(type,'tap_side',0);set(type,'itapch',1);set(type,'ntpmn',0);
 set(transformer,'nntap',1);transformer.Attributes.push('mTaps:SIZEROW','mTaps:0','mTaps:1');transformer.Values[0].push(2,380,399);
 const tr=(await map(raw)).transformers[0],rho=399/380;
 assert.ok(Math.abs(tr.tap-(380/400)/(160/154)*rho)<1e-12);
 assert.ok(Math.abs(tr.rPu-(800/1000/100)*(160/154)**2)<1e-12);
 assert.ok(Math.abs(tr.gPu-(80/1000/100)*(400/(380*rho))**2)<1e-12);
});
