import path from 'node:path';
import * as esbuild from 'esbuild';
export const workerInputPaths=new Set();
export const workerPlugin={name:'offline-workers',setup(build){
  build.onResolve({filter:/\?worker-source$/},args=>({path:path.resolve(args.resolveDir,args.path.replace('?worker-source','')),namespace:'worker-source'}));
  build.onLoad({filter:/.*/,namespace:'worker-source'},async args=>{const result=await esbuild.build({entryPoints:[args.path],bundle:true,minify:true,write:false,metafile:true,format:'iife',target:'chrome110',tsconfigRaw:{compilerOptions:{alwaysStrict:true}},legalComments:'inline',loader:{'.txt':'text','.b64':'text'}});for(const file of Object.keys(result.metafile.inputs))workerInputPaths.add(path.resolve(file));return {contents:result.outputFiles[0].text,loader:'text'};});
}};
