import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),base=path.join(root,'evidence','psse-uifix3');
const channels=['chrome','msedge'],reports=await Promise.all(channels.map(async channel=>JSON.parse(await readFile(path.join(base,`browser-e2e-${channel}.json`),'utf8'))));
for(const report of reports){assert.equal(report.schema,'ga.psse.uifix3.browser-e2e.v1');assert.equal(report.status,'PASS',`${report.browser.channel} browser E2E must pass`);}
assert.equal(new Set(reports.map(report=>report.artifact.sha256)).size,1,'Chrome and Edge must test the same standalone HTML bytes');
const compact=report=>({
  status:report.status,
  browser:report.browser,
  workflow:report.workflow,
  offline:report.offline,
  map:{
    viewports:report.map.viewports.map(item=>({viewport:item.viewport,toolbar:item.toolbar,stage:item.stage,canvas:item.canvas,svg:item.svg,canvasScaleErrorCssPx:item.scaleErrorCssPx,overlayErrorCssPx:item.overlayErrorCssPx,basemapPointAlignmentErrorCssPx:item.basemapPointAlignmentErrorCssPx})),
    wheelAnchorDriftCssPx:report.map.wheelAnchorDriftCssPx,
    wheelRoundtrip:report.map.wheelRoundtrip,
    childDragPan:report.map.childDragPan,
    fitRoundtrip:report.map.fitRoundtrip,
    fullscreen:report.map.fullscreen,
  },
  privacy:{privateScreenshots:true,modelNamesHashesIdentifiersValuesAndCoordinatesOmitted:true,publicScreenshotsIncluded:false},
});
const output={schema:'ga.psse.uifix3.browser-e2e-aggregate.v1',status:'PASS',artifact:{sha256:reports[0].artifact.sha256,bytes:reports[0].artifact.bytes},browsers:Object.fromEntries(reports.map(report=>[report.browser.channel,compact(report)])),privacy:{realModelScreenshotsAndDataStayLocal:true}};
await mkdir(base,{recursive:true});await writeFile(path.join(base,'browser-e2e-aggregate.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({output:path.join('evidence','psse-uifix3','browser-e2e-aggregate.json'),status:output.status,artifact:output.artifact,browsers:channels}));
