import * as m0 from './ui/studio-tables.js';
import * as m1 from './ui/studio-results.js';
import * as m2 from './ui/studio-export.js';
import * as m3 from './ui/studio-assets.js';
import {installNativeTables} from './ui/native-tables.js';
export function createRuntime(environment, headless=false) {
 const ctx = {...environment};
 const modules=[m0,m1,m2,m3];
 for(const m of modules)m.define(ctx);
 installNativeTables(ctx);
 for(const [,initialize] of modules.flatMap(m=>m.initializers).sort((a,b)=>a[0]-b[0])){if(headless&&String(initialize).includes('ctx.init()'))continue;initialize(ctx);}
 return ctx;
}
