import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanonicalNetwork } from '../../src/domain/model/network';
import { applyPowerFactoryControlContext, importPowerFactoryControlContext } from '../../src/analysis/validation/powerfactory-control-context';

const header = 'sep=;\r\nkind;ownerFid;ownerName;ownerClass;index;key;value;unit;refFid;refName;refClass;status\r\n';
const meta = (key: string, value: string) => `meta;;;;;${key};${value};;;;;OK\r\n`;
const field = (kind: string, key: string, value: string, refFid = '') => `${kind};L1;Load renamed;ElmLod;;${key};${value};;${refFid};;${refFid ? 'ElmTerm' : ''};OK\r\n`;
const source = header + meta('schemaVersion', 'PF-GA-CONTROL-1.0') + meta('modelId', '20261001_1500_SN4_TR0') + meta('studyTimeLocal', '2026-10-01 15:00:00') + meta('summary.elmLodCount', '1') + meta('summary.elmStactrlCount','0') + meta('summary.stationControllerMemberCount','0')
  + field('attribute', 'inService', '1') + field('attribute', 'plini', '10,000000') + field('attribute', 'qlini', '2,000000')
  + field('attribute', 'i_scale', '1') + field('attribute', 'scale0', '1,000000') + field('reference', 'connectedBus', '', 'B1')
  + field('result', 'm:P:bus1', '9,988868') + field('result', 'm:Q:bus1', '2,000000');
const network = { name: '20261001_1500_SN4_TR0.json', studyCase: '20261001_1500_SN4_TR0',
  loads: [{ id: 'L1', inService: true, bus: 'B1', pMw: 10, qMvar: 2 }, { id: 'L2', inService: false, bus: 'B2', pMw: 3, qMvar: 1 }], stationControllers:[],
  diagnostics: [{ code: 'ACTIVE_BALANCE_ELIGIBILITY_MISSING', message: 'missing', severity: 'WARNING' }] } as unknown as CanonicalNetwork;

test('ControlContext i_scale is applied only after FID, study time, bus and initial P/Q validation', () => {
  const context = importPowerFactoryControlContext(source);
  assert.equal(context.loads.length, 1);
  assert.equal(context.loads[0].iScale, 1);
  assert.equal(context.loads[0].finalPMw, 9.988868);
  const applied = applyPowerFactoryControlContext(network, context);
  assert.equal(applied.loads[0].activeBalanceEligibility, true);
  assert.equal(applied.loads[0].activeBalanceEligibilitySource, 'ElmLod.i_scale');
  assert.equal(applied.loads[1].activeBalanceEligibility, undefined);
  assert.equal(applied.diagnostics?.some(item => item.code === 'ACTIVE_BALANCE_ELIGIBILITY_MISSING'), false);
  assert.equal(network.loads[0].activeBalanceEligibility, undefined, 'original source model stays immutable');
});

test('ControlContext rejects missing eligibility, duplicate FID field and wrong source values', () => {
  assert.throws(() => importPowerFactoryControlContext(source.replace('i_scale;1', 'i_scale;')), /i_scale/);
  assert.throws(() => importPowerFactoryControlContext(source + field('attribute', 'i_scale', '1')), /yineleniyor/);
  const changed = importPowerFactoryControlContext(source.replace('plini;10,000000', 'plini;11,000000'));
  assert.throws(() => applyPowerFactoryControlContext(network, changed), /başlangıç P\/Q/);
  assert.throws(() => applyPowerFactoryControlContext(network, importPowerFactoryControlContext(source.replaceAll('L1;', 'L3;'))), /FID/);
});

test('ControlContext validates station psym membership by FID and supplies source cvqq sharing',()=>{
  const stationRows='attribute;VK1;Station;ElmStactrl;;i_droop;0;;;;;OK\r\n'
    +'attribute;VK1;Station;ElmStactrl;;ddroop;0,000000;;;;;OK\r\n'
    +'reference;VK1;Station;ElmStactrl;;rembar;;;B1;;ElmTerm;OK\r\n'
    +'reference;VK1;Station;ElmStactrl;0;psym;;;G1;;ElmSym;OK\r\n'
    +'attribute;VK1;Station;ElmStactrl;0;cvqq;100,000000;;;;;OK\r\n';
  const text=source.replace('summary.elmStactrlCount;0','summary.elmStactrlCount;1').replace('summary.stationControllerMemberCount;0','summary.stationControllerMemberCount;1')+stationRows;
  const input={...network,stationControllers:[{id:'VK1',inService:true,remoteBus:'B1',unitIds:['G1'],droopModeRaw:0,droopValueRaw:0,sourceRefs:{}}]} as unknown as CanonicalNetwork;
  const context=importPowerFactoryControlContext(text),applied=applyPowerFactoryControlContext(input,context);
  assert.deepEqual(applied.stationControllers[0].qParticipationRaw,[100]);
  assert.equal(applied.diagnostics?.some(item=>item.code==='STATION_CVQQ_FROM_PF_CONTROL_CONTEXT'),true);
  const wrong={...input,stationControllers:[{...input.stationControllers[0],unitIds:['renamed-generator']}]} as CanonicalNetwork;
  assert.throws(()=>applyPowerFactoryControlContext(wrong,context),/psym/);
});
