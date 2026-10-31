import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as esbuild from 'esbuild';
import postcss from 'postcss';
import {workerPlugin,workerInputPaths} from './worker-plugin.mjs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const repo=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:root,encoding:'utf8'}).trim();
const normalized=text=>text.replace(/\r\n/g,'\n');
const require=createRequire(import.meta.url);
const buildIdentity={schema:2,version:JSON.parse(await fs.readFile('package.json','utf8')).version,gitSha:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:repo,encoding:'utf8'}).trim(),tools:{node:process.versions.node,esbuild:esbuild.version,postcss:JSON.parse(await fs.readFile(require.resolve('postcss/package.json'),'utf8')).version}};
const textPlugin={name:'normalized-text',setup(build){build.onLoad({filter:/\.(?:b64|txt)$/},async args=>({contents:normalized(await fs.readFile(args.path,'utf8')),loader:'text'}));}};
const tsconfigRaw={compilerOptions:{alwaysStrict:true}};
const result=await esbuild.build({absWorkingDir:root,entryPoints:['src/main.js'],bundle:true,write:false,format:'iife',target:'chrome110',tsconfigRaw,minify:true,legalComments:'inline',metafile:true,plugins:[workerPlugin,textPlugin],loader:{'.b64':'text','.txt':'text'}});
const cssFiles=(await fs.readdir('src/shared/styles')).filter(f=>f.endsWith('.css')).sort((a,b)=>Number(a.match(/\d+/)?.[0]??999)-Number(b.match(/\d+/)?.[0]??999));
let css=(await Promise.all(cssFiles.map(async f=>{
  return normalized(await fs.readFile('src/shared/styles/'+f,'utf8'));
}))).join('\n');
// Legacy standalone selectors are scoped to the PSS/E root for host integration.
const cssAst=postcss.parse(css);
cssAst.walkRules(rule=>{
  let parent=rule.parent;while(parent){if(parent.type==='atrule'&&/keyframes/i.test(parent.name))return;parent=parent.parent;}
  rule.selectors=rule.selectors.map(selector=>{
    selector=selector.replace(/(^|[\s>+~])(?:html|body|:root)(?=$|[\s.#:[>+~])/g,'$1.psse-module').replace(/\.psse-module\s+\.psse-module/g,'.psse-module');
    return selector.trim().startsWith('.psse-module')?selector:'.psse-module '+selector;
  });
});
const moduleCss=cssAst.toString();
// The existing host/module UI CSS stays byte-identical; the native editor is standalone-only.
css='html,body{margin:0;width:100%;height:100%;overflow:hidden}'+moduleCss+'\n'+normalized(await fs.readFile('../tools/psse-sld/studio_style.css','utf8'));
const app=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const sourceInputs=new Set([...Object.keys(result.metafile.inputs).map(p=>p.startsWith('worker-source:')?p.slice('worker-source:'.length):path.resolve(root,p)),...workerInputPaths,...cssFiles.map(p=>path.join(root,'src/shared/styles',p)),...['scripts/build.mjs','scripts/worker-plugin.mjs','package-lock.json'].map(p=>path.join(root,p)),...['sld-binary-codec.ts'].map(p=>path.join(repo,'src/features/psse',p)),...['studio_style.css','studio_layout.js','studio_model.js','sync-runtime.mjs'].map(p=>path.join(repo,'tools/psse-sld',p))]);
const sourceHash=crypto.createHash('sha256');
const logicalName=file=>path.relative(repo,file).replaceAll('\\','/').replace(/^psse-studio\/node_modules\//,'node_modules/');
for(const file of [...sourceInputs].sort((a,b)=>logicalName(a).localeCompare(logicalName(b),'en'))){sourceHash.update(logicalName(file)+'\0');sourceHash.update(normalized(await fs.readFile(file,'utf8'))+'\0');}
buildIdentity.sourceSha256=sourceHash.digest('hex');
buildIdentity.bundleSha256=crypto.createHash('sha256').update(app+'\0'+css).digest('hex');
const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="ga-build-sha" content="${buildIdentity.gitSha}"><meta name="ga-studio-native-sld" content="1"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob: 'wasm-unsafe-eval'; worker-src blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>Grid Analyzer PSS/E Studio</title><style>${css}</style></head><body><div id="psse-host"></div><script>globalThis.__GA_PSSE_BUILD__=${JSON.stringify(buildIdentity)};${app}</script></body></html>`;
await fs.mkdir('dist',{recursive:true});await fs.mkdir('evidence',{recursive:true});
await fs.writeFile('dist/Grid_Analyzer_PSSE_Portable.html',html);await fs.writeFile('evidence/build-metafile.json',JSON.stringify(result.metafile,null,2));
await esbuild.build({absWorkingDir:root,entryPoints:['src/modules/psse/index.js'],bundle:true,outfile:'dist/psse-module.js',format:'esm',target:'chrome110',tsconfigRaw,minify:true,legalComments:'inline',plugins:[workerPlugin,textPlugin],loader:{'.b64':'text','.txt':'text'}});
await fs.writeFile('dist/psse-module.css',moduleCss);
const info={file:'dist/Grid_Analyzer_PSSE_Portable.html',...buildIdentity,bytes:Buffer.byteLength(html),sha256:crypto.createHash('sha256').update(html).digest('hex'),externalImports:Object.values(result.metafile.outputs).flatMap(o=>o.imports.filter(i=>i.external))};
await fs.writeFile('evidence/build.json',JSON.stringify(info,null,2));console.log(JSON.stringify(info));
const delivery=process.argv.find(a=>a.startsWith('--out-dir='))?.slice(10);
if(delivery){const target=path.resolve(delivery);await fs.mkdir(target,{recursive:true});for(const file of ['Grid_Analyzer_PSSE_Portable.html','psse-module.js','psse-module.css'])await fs.copyFile(path.join(root,'dist',file),path.join(target,file));console.log('Delivered: '+target);}
