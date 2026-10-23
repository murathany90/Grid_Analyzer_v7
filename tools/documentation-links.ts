import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Check the Git index, never let private/local files make public links appear valid. */
export function documentationLinkIssues(root=process.cwd()){
 const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean),tracked=new Set(files),issues:string[]=[],localArtifacts:string[]=[];
 for(const file of files.filter(f=>f.endsWith('.md'))){
  const text=readFileSync(path.join(root,file),'utf8');
  for(const match of text.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)){
   const url=match[1].trim().replace(/^<([^>]+)>.*$/,'$1').replace(/\s+["'].*$/,'');if(/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(url))continue;
   const name=decodeURIComponent(url.split('#')[0].split('?')[0]);if(!name)continue;
   const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),name));
   if(/^(?:\.tmp|local-benchmark-results|kontrol1|control1|\.local-fixtures)\//.test(target)){localArtifacts.push(file+': '+url);continue;}
   if(!tracked.has(target)&&!files.some(f=>f.startsWith(target.replace(/\/$/,'')+'/')))issues.push(file+': '+url+' -> '+target);
  }
 }
 return {issues,localArtifacts};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=documentationLinkIssues();console.log(JSON.stringify(result,null,2));process.exitCode=result.issues.length?1:0;
}
