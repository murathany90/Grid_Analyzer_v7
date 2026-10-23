import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {documentationLinkIssues} from '../../tools/documentation-links';

test('public Markdown links resolve in Git and README is the sole root Markdown',()=>{
 const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 assert.deepEqual(files.filter(f=>!f.includes('/')&&f.endsWith('.md')),['README.md']);
 const links=documentationLinkIssues();assert.deepEqual(links.issues,[]);assert.deepEqual(links.localArtifacts,[]);
 assert.ok(!files.some(f=>/^(kontrol1|control1|local-benchmark-results|docs\/history\/local)\//.test(f)));
});
