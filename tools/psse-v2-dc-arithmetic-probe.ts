/** Cache-only diagnostic arithmetic transforms around the actual production DC/KLU path.
 * These deliberately altered inputs are not new solver modes or parity certificates.
 */
import fs from 'node:fs';
import path from 'node:path';
import {decodePsse} from '../src/importers/psse/decode';
import {normalizePsseBusBranch,transformerPrimitive,type PsseBusBranchNetwork} from '../src/domain/psse/network';
import {solvePsseDc,type PsseDcOptions} from '../src/analysis/psse/dc';
import {preparePsseDcSwitchContraction} from '../src/analysis/psse/dc-switch-contraction';
import {psseOptionsHash} from '../src/domain/psse/identity';
import {KluSparseDirectFactorization} from '../src/analysis/power-flow/js/sparse-direct';
import type {SparseMatrix} from '../src/analysis/power-flow/js/types';

const [source,cacheFile='private-re/parity/lossless_dc-real.json',label='old',filter='']=process.argv.slice(2);if(!source||!/^[a-z0-9-]+$/.test(label))throw Error('Expected source, cached parity and safe label');
const model=await decodePsse(Uint8Array.from(fs.readFileSync(source)).buffer,path.basename(source)),original=normalizePsseBusBranch(model),cached=JSON.parse(fs.readFileSync(cacheFile,'utf8'))[0];
if(cached.report.sha256!==model.source.sha256)throw Error('Source/cache mismatch');
const ref=JSON.parse(fs.readFileSync(path.join('private-re/solver-reference',`${model.source.sha256}-dclf_2-${cached.report.reference.optionsHash}`,'reference.json'),'utf8'));
const eq=new Map(model.equipment.map(e=>[e.id,e])),report=new Map<string,number>();for(const r of ref.dcReport.flows)if(r.to!==null){const key=`${r.from}:${r.to}:${r.circuit}`;if(report.has(key))throw Error('Ambiguous directed report');report.set(key,r.pMw);}
const refAngle=new Map<number,number>(ref.buses.NUMBER.map((n:number,i:number)=>[n,ref.buses.ANGLE[i]]));
const stats=(v:number[])=>{const a=v.map(Math.abs).filter(Number.isFinite).sort((x,y)=>x-y);return{count:a.length,max:a.at(-1)??null,mean:a.length?a.reduce((s,x)=>s+x,0)/a.length:null,p95:a[Math.max(0,Math.ceil(a.length*.95)-1)]??null};};
const halfUlp32=(value:number)=>{const buffer=new ArrayBuffer(4),f=new Float32Array(buffer),u=new Uint32Array(buffer);f[0]=Math.abs(value);const before=f[0];u[0]++;return Math.abs(f[0]-before)/2;};
const originalFactorize=KluSparseDirectFactorization.prototype.factorize,originalSolve=KluSparseDirectFactorization.prototype.solve;
type Probe={name:string;network?:(n:PsseBusBranchNetwork)=>void;options?:Partial<PsseDcOptions>;matrix?:'FINAL_F32'|'ACCUM_F32'|'RECIPROCAL_F32';rhsF32?:boolean;solutionF32?:boolean};
function replaceX(n:PsseBusBranchNetwork,change:(x:number)=>number){for(const b of n.branches){if(!b.xPu)continue;const before=transformerPrimitive(b.rPu,b.xPu,b.tapFrom,b.tapTo,b.phaseDeg),gff=b.yff.re-before.yff.re,bff=b.yff.im-before.yff.im,gtt=b.ytt.re-before.ytt.re,btt=b.ytt.im-before.ytt.im;b.xPu=change(b.xPu);const after=transformerPrimitive(b.rPu,b.xPu,b.tapFrom,b.tapTo,b.phaseDeg);b.yff={re:after.yff.re+gff,im:after.yff.im+bff};b.ytt={re:after.ytt.re+gtt,im:after.ytt.im+btt};b.yft=after.yft;b.ytf=after.ytf;}}
const probes:Probe[]=[
 {name:'BASELINE'},
 {name:'SOURCE_X_F32',network:n=>replaceX(n,Math.fround)},
 {name:'SOURCE_B_F32',network:n=>replaceX(n,x=>1/Math.fround(1/x))},
 {name:'ENGINEERING_P_F32',network:n=>{for(const g of n.generators)g.pMw=Math.fround(g.pMw);for(const l of n.loads){l.pMw=Math.fround(l.pMw);l.ipMw=Math.fround(l.ipMw);l.ypMw=Math.fround(l.ypMw);}}},
 {name:'SOURCE_VM_F32',network:n=>{for(const b of n.buses)if(b.initialVm!==null)b.initialVm=Math.fround(b.initialVm);}},
 {name:'MATRIX_FINAL_F32',matrix:'FINAL_F32'},
 {name:'MATRIX_ACCUM_F32',matrix:'ACCUM_F32'},
 {name:'RHS_F32',rhsF32:true},
 {name:'MATRIX_AND_RHS_F32',matrix:'FINAL_F32',rhsF32:true},
 {name:'MATRIX_ACCUM_AND_RHS_F32',matrix:'ACCUM_F32',rhsF32:true},
 {name:'SOLUTION_F32_ONLY',solutionF32:true},
 {name:'REAL_SHUNT_UNITY_DIAGNOSTIC',options:{realShuntVoltagePolicy:'UNITY'}},
 {name:'NO_REAL_SHUNT_DIAGNOSTIC',options:{includeRealShuntConsumption:false}},
];
const publicRows:unknown[]=[],privateRows:unknown[]=[];
for(const probe of probes.filter(p=>!filter||new RegExp(filter).test(p.name))){
 const network=structuredClone(original);probe.network?.(network);if(probe.name!=='BASELINE')network.modelHash=psseOptionsHash({originalModel:original.modelHash,diagnosticTransform:probe.name});
 const {contraction,findings}=preparePsseDcSwitchContraction(model,network);if(findings.some(f=>f.severity==='ERROR'))throw Error('Blocked contraction');
 const refs=new Set(network.buses.flatMap((b,i)=>b.status===1&&b.type===3?[contraction.busToNode[i]]:[])),unknown=contraction.nodeBuses.map((_,i)=>i).filter(i=>!refs.has(i)),local=new Map(unknown.map((i,k)=>[i,k])),ideal=new Set(contraction.branches.map(b=>b.id));
 let captured:SparseMatrix|null=null,rhsCapture:Float64Array|null=null,linearSolution:Float64Array|null=null,matrixDifference=0;
 const accumulation=unknown.map(()=>new Map<number,number>());
 if(probe.matrix==='ACCUM_F32')for(const b of network.branches){if(b.status!==1||ideal.has(b.id))continue;const weight=Math.fround(1/b.xPu),f=local.get(contraction.busToNode[b.from]),t=local.get(contraction.busToNode[b.to]);const add=(i:number,j:number,value:number)=>accumulation[i].set(j,Math.fround((accumulation[i].get(j)??0)+value));if(f!==undefined){add(f,f,weight);if(t!==undefined)add(f,t,-weight);}if(t!==undefined){add(t,t,weight);if(f!==undefined)add(t,f,-weight);}}
 KluSparseDirectFactorization.prototype.factorize=function(matrix:SparseMatrix){let input=matrix;if(matrix.N===unknown.length){captured={...matrix,values:Float64Array.from(matrix.values)};if(probe.matrix){const values=Float64Array.from(matrix.values);for(let row=0;row<matrix.N;row++)for(let k=matrix.rowPtr[row];k<matrix.rowPtr[row+1];k++){const next=probe.matrix==='ACCUM_F32'?(accumulation[row].get(matrix.colIdx[k])??0):Math.fround(matrix.values[k]);matrixDifference=Math.max(matrixDifference,Math.abs(next-matrix.values[k]));values[k]=next;}input={...matrix,values};}}return originalFactorize.call(this,input);};
 KluSparseDirectFactorization.prototype.solve=function(rhs:Float64Array){if(rhs.length===unknown.length){rhsCapture=Float64Array.from(rhs);const r=originalSolve.call(this,probe.rhsF32?Float64Array.from(rhs,Math.fround):rhs);if(probe.solutionF32&&r.x)r.x=Float64Array.from(r.x,Math.fround);if(r.x)linearSolution=Float64Array.from(r.x);return r;}return originalSolve.call(this,rhs);};
 let result:ReturnType<typeof solvePsseDc>;try{result=solvePsseDc({model,network,options:probe.options});}finally{KluSparseDirectFactorization.prototype.factorize=originalFactorize;KluSparseDirectFactorization.prototype.solve=originalSolve;}
 const busByKey=new Map(network.buses.map(b=>[b.connectionKey,b])),angleError:number[]=[],thetaByKey=new Map(result.busResults.map(b=>[b.connectionKey,b.vaDeg===null?null:b.vaDeg*Math.PI/180]));
 for(const b of result.busResults){const sourceBus=busByKey.get(b.connectionKey);if(sourceBus?.status!==1||b.vaDeg===null)continue;const expected=refAngle.get(sourceBus.externalNumber!);if(expected!==undefined)angleError.push(b.vaDeg-expected*180/Math.PI);}
 const capturedX=linearSolution as Float64Array|null,linearTheta=new Float64Array(network.buses.length),linearAngleError:number[]=[],linearFlowError:number[]=[];
 if(capturedX){for(let bus=0;bus<network.buses.length;bus++){const node=contraction.busToNode[bus],column=local.get(node);linearTheta[bus]=column===undefined?0:capturedX[column];if(network.buses[bus].status===1){const reference=refAngle.get(network.buses[bus].externalNumber!);if(reference!==undefined)linearAngleError.push((linearTheta[bus]-reference)*180/Math.PI);}}
  for(const b of network.branches){if(b.status!==1||ideal.has(b.id))continue;const f=network.buses[b.from],t=network.buses[b.to],circuit=String(eq.get(b.sourceEquipmentId)?.fields.ckt??'1').trim(),rf=report.get(`${f.externalNumber}:${t.externalNumber}:${circuit}`),rt=report.get(`${t.externalNumber}:${f.externalNumber}:${circuit}`),series=network.baseMva/b.xPu*(linearTheta[b.from]-linearTheta[b.to]-b.phaseDeg*Math.PI/180),primitive=transformerPrimitive(b.rPu,b.xPu,b.tapFrom,b.tapTo,b.phaseDeg),gf=probe.options?.includeRealShuntConsumption===false?0:(b.yff.re-primitive.yff.re)*(probe.options?.realShuntVoltagePolicy==='UNITY'?1:(f.initialVm??1)**2)*network.baseMva,gt=probe.options?.includeRealShuntConsumption===false?0:(b.ytt.re-primitive.ytt.re)*(probe.options?.realShuntVoltagePolicy==='UNITY'?1:(t.initialVm??1)**2)*network.baseMva;if(rf!==undefined)linearFlowError.push(series+gf-rf);if(rt!==undefined)linearFlowError.push(-series+gt-rt);}
 }
 const flowError:number[]=[],details:unknown[]=[];let missing=0;for(const b of result.branchResults){const physical=network.branches.find(x=>x.id===b.id);if(physical?.status!==1)continue;const f=network.buses[physical.from],t=network.buses[physical.to],circuit=String(eq.get(b.sourceEquipmentId)?.fields.ckt??'1').trim(),rf=report.get(`${f.externalNumber}:${t.externalNumber}:${circuit}`),rt=report.get(`${t.externalNumber}:${f.externalNumber}:${circuit}`);if(rf===undefined||rt===undefined||b.pFromMw===null||b.pToMw===null){missing++;continue;}const ef=b.pFromMw-rf,et=b.pToMw-rt;flowError.push(ef,et);details.push({id:b.id,fromErrorMw:ef,toErrorMw:et});}
 let originalEquationResidualMw:number|null=null,referenceEquationResidualMw:number|null=null,referenceArithmeticBounds:unknown=null;
 const c=captured as SparseMatrix|null,h=rhsCapture as Float64Array|null;
 if(c&&h){const calculated=capturedX?Array.from(capturedX):unknown.map(node=>{const bus=contraction.nodeBuses[node][0];return thetaByKey.get(network.buses[bus].connectionKey)??0;}),referenceTheta=unknown.map(node=>refAngle.get(network.buses[contraction.nodeBuses[node][0]].externalNumber!)??0),evaluate=(x:number[])=>{let norm=0;for(let row=0;row<c.N;row++){let total=0;for(let k=c.rowPtr[row];k<c.rowPtr[row+1];k++)total+=c.values[k]*x[c.colIdx[k]];norm=Math.max(norm,Math.abs(total-h[row])*network.baseMva);}return norm;};originalEquationResidualMw=evaluate(calculated);referenceEquationResidualMw=evaluate(referenceTheta);
  const componentwise:number[]=[],boundRatios:number[]=[],accumulationRatios:number[]=[];let withinEntryRounding=0,withinAccumulation=0;
  for(let row=0;row<c.N;row++){let total=0,absolute=Math.abs(h[row]),bound=halfUlp32(h[row]);for(let k=c.rowPtr[row];k<c.rowPtr[row+1];k++){const a=c.values[k],x=referenceTheta[c.colIdx[k]],da=halfUlp32(a),dx=halfUlp32(x);total+=a*x;absolute+=Math.abs(a*x);bound+=Math.abs(a)*dx+Math.abs(x)*da+da*dx;}const residual=Math.abs(total-h[row]),eta=absolute?residual/absolute:0,count=c.rowPtr[row+1]-c.rowPtr[row]+4,gamma=count*2**-24/(1-count*2**-24);componentwise.push(eta);boundRatios.push(bound?residual/bound:0);accumulationRatios.push(absolute?residual/(gamma*absolute):0);if(residual<=bound+1e-12)withinEntryRounding++;if(residual<=gamma*absolute+1e-12)withinAccumulation++;}
  referenceArithmeticBounds={rows:c.N,float32UnitRoundoff:2**-24,componentwiseBackwardError:stats(componentwise),backwardErrorInF32UnitRoundoffs:stats(componentwise.map(x=>x/(2**-24))),entryAndAngleRoundingResidualRatio:stats(boundRatios),withinIndependentEntryRhsAngleHalfUlpBounds:withinEntryRounding,withinRowOperationGammaBounds:withinAccumulation,rowOperationResidualRatio:stats(accumulationRatios),caution:'Bounds show compatibility with an arithmetic precision scale, not a proof of PSS/E internal arithmetic or a license to alter the runtime matrix.'};
 }
 const summary={transform:probe.name,diagnosticOnly:probe.name!=='BASELINE',engineReturnedStatus:result.status,physicsCoverage:result.physicsCoverage,failureCodes:result.findings.filter(f=>f.severity==='ERROR').map(f=>f.code),productionComputedMismatchPu:result.maxPMismatchPu,originalEquationResidualMw,referenceEquationResidualMw,referenceArithmeticBounds,largestMatrixAbsoluteChange:matrixDifference,angleErrorDeg:stats(angleError),directedMwError:stats(flowError),directedOverStrict:flowError.filter(x=>Math.abs(x)>.051).length,diagnosticLinearAngleErrorDeg:stats(linearAngleError),diagnosticNonidealMwError:stats(linearFlowError),diagnosticNonidealOverStrict:linearFlowError.filter(x=>Math.abs(x)>.051).length,missing,elapsedMs:result.elapsedMs};publicRows.push(summary);privateRows.push({summary,largest:(details as {id:string;fromErrorMw:number;toErrorMw:number}[]).sort((a,b)=>Math.max(Math.abs(b.fromErrorMw),Math.abs(b.toErrorMw))-Math.max(Math.abs(a.fromErrorMw),Math.abs(a.toErrorMw))).slice(0,20)});console.log(JSON.stringify(summary));
}
const output={schema:'ga.psse.dc-arithmetic-probe.v2',sourceSha256:model.source.sha256,referenceOptionsHash:ref.optionsHash,activeBusCount:original.buses.filter(b=>b.status===1).length,allOracleAnglesF32:[...refAngle.values()].every(v=>v===Math.fround(v)),nonzeroPhaseBranches:original.branches.filter(b=>b.status===1&&b.phaseDeg!==0).length,interpretation:'All variants are explicitly diagnostic arithmetic/input perturbations through the production DC solver. A retained linear iterate for a rejected variant is not a published calculation. They do not authorize a runtime precision change, alternate engine, relaxed threshold, or parity PASS.',probes:publicRows};
fs.mkdirSync('private-re/v2-dc-arithmetic',{recursive:true});fs.writeFileSync(`private-re/v2-dc-arithmetic/${label}.json`,JSON.stringify({output,privateRows},null,2)+'\n');fs.mkdirSync('evidence/psse-v2',{recursive:true});fs.writeFileSync(`evidence/psse-v2/dc-arithmetic-${label}.json`,JSON.stringify(output,null,2)+'\n');
