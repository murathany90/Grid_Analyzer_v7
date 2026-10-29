import {zipSync,strToU8} from 'fflate';
/** Compress existing package parts without changing any XML, cells or styles. */
export function zipParts(parts,{level=6}={}){
  return zipSync(Object.fromEntries(parts.map(([name,content])=>[name,typeof content==='string'?strToU8(content):content])),{level,mtime:new Date(2000,0,1)});
}
