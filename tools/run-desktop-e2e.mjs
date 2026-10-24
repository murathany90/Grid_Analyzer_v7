import {spawnSync} from 'node:child_process';
const scripts=[['tools/browser-smoke.mjs'],['--import','tsx','tools/pf-benchmark-browser-smoke.ts'],['tools/map-lightning-audit-browser-smoke.mjs'],['tools/n1-diagnostic-browser-smoke.mjs'],['tools/sld-browser-smoke.mjs'],['tools/n1-sc-browser-acceptance.mjs','tests/fixtures/small-dgs.json','PUBLIC','AUTO'],['tools/workspace-unification-browser.mjs'],['tools/analysis-ux-browser.mjs'],['tools/sc-engine-browser.mjs']];
const failed=[];
for(const args of scripts){const r=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,GA_DESKTOP_ONLY:'1'}});if(r.status!==0)failed.push({script:args.at(-1),status:r.status});}
console.log('DESKTOP_E2E_SUMMARY '+JSON.stringify({scripts:scripts.length,failed}));if(failed.length)process.exitCode=1;
