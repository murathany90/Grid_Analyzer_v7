import * as m0 from './shared/retained-support.js';
import * as m1 from './core/workers.js';
import * as m2 from './model/normalization.js';
import * as m3 from './calculations/identity.js';
import * as m4 from './calculations/readiness.js';
import * as m5 from './ui/inventory.js';
import * as m6 from './ui/presentation.js';
import * as m7 from './ui/retained-results.js';
import * as m8 from './analysis/retained-analysis.js';
import * as m9 from './map/retained-map.js';
import * as m10 from './sld/retained-sld.js';
import * as m11 from './ui/retained-settings-help.js';
export function createRuntime(environment) {
 const ctx = {...environment};
 const modules=[m0,m1,m2,m3,m4,m5,m6,m7,m8,m9,m10,m11];
 for(const m of modules)m.define(ctx);
 for(const [,initialize] of modules.flatMap(m=>m.initializers).sort((a,b)=>a[0]-b[0]))initialize(ctx);
 return ctx;
}
