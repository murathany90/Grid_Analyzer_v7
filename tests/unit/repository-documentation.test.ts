import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {documentationLinkIssues} from '../../tools/documentation-links';

test('public Markdown links resolve in Git and root delivery reports are explicitly listed',()=>{
 const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const rootDocuments=['README.md','AGENT_HANDOFF.md','ARCHITECTURE_DECISIONS.md','BUG_ROOT_CAUSE.md','DGS_REGRESSION_REPORT.md','MODEL_FIDELITY_REPORT.md','PERFORMANCE_REPORT.md','PSSE_AC_DC_PARITY_REPORT.md','PSSE_SOLVER_RESEARCH.md','UI_DGS_PSSE_PARITY.md','YTBS_AREA_ZONE_OWNER_MAPPING.md','AC_ROOT_CAUSE_AND_SOLUTION.md','PSSE_AC_FDNS_DC_PARITY.md','GEO_COORDINATE_FIT_AUDIT.md','SLD_TM_PARITY.md','DGS_REGRESSION.md','AC_FDNS_ROOT_CAUSE_V4.md','PSSE_FNSL_FDNS_PARITY_V4.md','YTBS_ZIP_SIDECAR_INVENTORY.md','UI_DGS_PSSE_V4_PARITY.md','DGS_REGRESSION_V4.md','V4_ONE_HOUR_FIX_REPORT.md','V4_UIFIX3_DGS_MAP_PARITY.md','V4_UIFIX3_REAL_MODEL_E2E.md','DGS_REGRESSION_UIFIX3.md','PSSE_FULL_AC_REFERENCE_PARITY.md','DGS_PSSE_MAP_UI_PARITY.md','MODEL_FIDELITY.md','SLD_HANDOFF.md'];
 assert.deepEqual(files.filter(f=>!f.includes('/')&&f.endsWith('.md')).sort(),rootDocuments.sort());
 const links=documentationLinkIssues();assert.deepEqual(links.issues,[]);assert.deepEqual(links.localArtifacts,[]);
 assert.ok(!files.some(f=>/^(kontrol1|control1|local-benchmark-results|docs\/history\/local)\//.test(f)));
});
