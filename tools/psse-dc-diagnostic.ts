/** Development residual diagnosis, not a solver or replacement reference. */
import fs from 'node:fs';
import path from 'node:path';
import {decodePsse} from '../src/importers/psse/decode';
import {normalizePsseBusBranch,transformerPrimitive} from '../src/domain/psse/network';
const source=process.argv[2];if(!source)throw Error('Expected local source path');
const m=await decodePsse(Uint8Array.from(fs.readFileSync(source)).buffer,path.basename(source)),n=normalizePsseBusBranch(m);
const candidates=fs.readdirSync('private-re/solver-reference').map(x=>'private-re/solver-reference/'+x+'/reference.json').filter(x=>fs.existsSync(x)).map(x=>JSON.parse(fs.readFileSync(x,'utf8'))).filter(r=>r.source.sha256===m.source.sha256&&r.spec.method==='dclf_2');
candidates.sort((a,b)=>(a.dcReport?.flowResolutionMw??1)-(b.dcReport?.flowResolutionMw??1));const r=candidates[0];if(!r)throw Error('No retained DCLF reference');
const angles=new Map<number,number>(r.buses.NUMBER.map((x:number,i:number)=>[x,r.buses.ANGLE[i]])),dc=new Map<string,number>(r.dcReport.flows.filter((x:{to:number|null})=>x.to!==null).map((x:{from:number;to:number;circuit:string;pMw:number})=>[`${x.from}:${x.to}:${x.circuit}`,x.pMw]));
const actualP=new Float64Array(n.buses.length),specifiedP=new Float64Array(n.buses.length),genP=new Float64Array(n.buses.length),refGenP=new Float64Array(n.buses.length),byExternal=new Map(n.buses.map((b,i)=>[b.externalNumber,i]));
for(const g of n.generators)if(g.status===1)genP[g.bus]+=g.pMw;
for(let j=0;j<r.generators.NUMBER.length;j++)if(r.generators.STATUS[j]===1){const i=byExternal.get(r.generators.NUMBER[j]);if(i!==undefined)refGenP[i]+=r.generators.PGEN[j];}
for(const g of n.generators)if(g.status===1)specifiedP[g.bus]+=g.pMw;
for(const l of n.loads)if(l.status===1){const v=n.buses[l.bus].initialVm??1;specifiedP[l.bus]-=l.pMw+l.ipMw*v+l.ypMw*v*v;}
for(const s of n.shunts)if(s.status===1){const v=n.buses[s.bus].initialVm??1;specifiedP[s.bus]-=s.gMw*v*v;}
const differences:{kind:string;x:number;error:number;series:number;extraFrom:number}[]=[],gaps:string[]=[];
for(const b of n.branches){if(b.status!==1)continue;const f=n.buses[b.from],t=n.buses[b.to],ai=angles.get(f.externalNumber??-1),aj=angles.get(t.externalNumber??-1);if(ai===undefined||aj===undefined)continue;
 const base=transformerPrimitive(b.rPu,b.xPu,b.tapFrom,b.tapTo,b.phaseDeg),gf=b.yff.re-base.yff.re,gt=b.ytt.re-base.ytt.re,vf=f.initialVm??1,vt=t.initialVm??1,extraF=n.baseMva*gf*vf*vf,extraT=n.baseMva*gt*vt*vt;
 const p=n.baseMva*(ai-aj-b.phaseDeg*Math.PI/180)/b.xPu;actualP[b.from]+=p+extraF;actualP[b.to]+=-p+extraT;
 const e=m.equipment.find(e=>e.id===b.sourceEquipmentId),circuit=String(e?.fields.ckt??'1').trim(),reported=dc.get(`${f.externalNumber}:${t.externalNumber}:${circuit}`);
 if(reported===undefined)gaps.push(b.id);else differences.push({kind:b.kind,x:b.xPu,error:p+extraF-reported,series:p,extraFrom:extraF});
}
const summary=(a:number[])=>{const s=a.map(Math.abs).sort((a,b)=>a-b);return{count:s.length,max:s.at(-1)??null,mean:s.length?s.reduce((a,b)=>a+b,0)/s.length:null,p95:s[Math.max(0,Math.ceil(.95*s.length)-1)]??null};};
const busResiduals=Array.from(actualP,(p,i)=>n.buses[i].status===1&&n.buses[i].type!==3?p-specifiedP[i]:0),groups=[...new Set(differences.map(x=>x.kind))];
const output={sourceHash:m.source.sha256,referenceOptionsHash:r.optionsHash,referenceFlowResolutionMw:r.dcReport.flowResolutionMw,fromApiAnglesVersusReportMw:summary(differences.map(x=>x.error)),byKind:Object.fromEntries(groups.map(k=>[k,summary(differences.filter(x=>x.kind===k).map(x=>x.error))])),referenceAnglesNodalResidualMw:summary(busResiduals),inputGeneratorPDeltaMw:summary(Array.from(genP,(p,i)=>n.buses[i].type!==3?p-refGenP[i]:0)),missingReports:gaps.length,largest:differences.sort((a,b)=>Math.abs(b.error)-Math.abs(a.error)).slice(0,12)};
fs.mkdirSync('private-re/dc-diagnostic',{recursive:true});fs.writeFileSync('private-re/dc-diagnostic/'+m.source.sha256+'.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
