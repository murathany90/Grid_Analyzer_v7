import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const reportPath=new URL('../../evidence/psse-uifix3/browser-e2e-aggregate.json',import.meta.url);

test('UIFIX3 real-model offline browser evidence is sanitized and passes in Chrome and Edge',async()=>{
  const report=JSON.parse(await readFile(reportPath,'utf8'));
  assert.equal(report.schema,'ga.psse.uifix3.browser-e2e-aggregate.v1');
  assert.equal(report.status,'PASS');
  assert.deepEqual(Object.keys(report.browsers).sort(),['chrome','msedge']);
  assert.equal(report.artifact.bytes,2599124);
  assert.match(report.artifact.sha256,/^[a-f0-9]{64}$/);

  for(const [channel,result]of Object.entries<any>(report.browsers)){
    assert.equal(result.status,'PASS',`${channel} browser passed`);
    assert.ok(result.browser.version);
    assert.equal(result.offline.scheme,'file:');
    assert.equal(result.offline.externalRequestCount,0);
    assert.equal(result.offline.blockedRequestCount,0);
    for(const key of ['psseZipImport','dgsZipImport','fullAcNr','lightningSourceFlowsMissing','lightningCalculatedPqil','lightningDelta','branchScenarioRecalculated','baseScenarioDelta','undo','calculationOptionsReused'])assert.equal(result.workflow[key],true,`${channel} ${key}`);
    assert.deepEqual(result.workflow.mapFlows,{finiteBranchP:true,calculatedFlowArrows:true});
    assert.equal(result.workflow.baseline.method,'NR_POLAR');
    assert.equal(result.workflow.baseline.initialVoltage,'SOURCE_SAVED');
    assert.equal(result.workflow.baseline.numericalStatus,'CONVERGED');
    assert.equal(result.workflow.baseline.publicationStatus,'LIMITED_PROFILE');
    assert.equal(result.workflow.baseline.classification,'SOLVED_APPROXIMATE');
    assert.equal(result.workflow.baseline.source,'GA_PSSE_CALCULATED');
    assert.ok(result.map.wheelAnchorDriftCssPx<2);
    assert.deepEqual(result.map.wheelRoundtrip,{zoomError:0,panError:0});
    assert.equal(result.map.childDragPan,true);
    assert.equal(result.map.fitRoundtrip,true);
    assert.equal(result.map.fullscreen.length,3);
    assert.ok(result.map.fullscreen.every((item:any)=>item.passed&&!item.detailsOpen&&item.height>=item.availableMapHeight-10));

    const viewports=result.map.viewports;
    for(const [width,height]of [[1600,1000],[1366,768]])for(const dpr of [1,1.25,2]){
      const item=viewports.find((candidate:any)=>candidate.viewport.width===width&&candidate.viewport.height===height&&candidate.viewport.dpr===dpr);
      assert.ok(item,`${channel} has ${width}×${height} at DPR ${dpr}`);
      assert.ok(item.canvasScaleErrorCssPx<=.51);
      assert.equal(item.overlayErrorCssPx,0);
      assert.ok(item.basemapPointAlignmentErrorCssPx<.001);
    }
  }

  assert.equal(report.privacy.realModelScreenshotsAndDataStayLocal,true);
  for(const result of Object.values<any>(report.browsers)){
    assert.equal(result.privacy.privateScreenshots,true);
    assert.equal(result.privacy.publicScreenshotsIncluded,false);
  }
  const serialized=JSON.stringify(report);
  assert.doesNotMatch(serialized,/20261026_\d{4}_SN\d+_TR\d+|C:\\Users\\|Download[s]?\\/i);
});
