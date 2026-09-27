import { solveNR } from './newton';
import type { NumericalModel, SelfTestResult } from './types';

export function selfTests(): SelfTestResult[] {
 const cases=[];
 const m={n:2,baseMVA:100,slack:0,slackVm:1,pSpec:[0,-50],qSpec:[0,-20],busType:[2,0],vmSet:[1,1],shuntG:[0,0],shuntB:[0,0],qMinNet:[null,null],qMaxNet:[null,null],branches:[{i:0,j:1,r:.01,x:.1,bch:0,tap:1,phase:0}]};
 const r=solveNR(m);cases.push({name:'2-bus slack-load',pass:r.converged&&(r.Vm?.[1]??NaN)>.9&&(r.Vm?.[1]??NaN)<1.05,status:r.status,value:r.Vm?.[1]??null});
 const m2={n:3,baseMVA:100,slack:0,slackVm:1,pSpec:[0,40,-80],qSpec:[0,0,-25],busType:[2,1,0],vmSet:[1,1.02,1],shuntG:[0,0,0],shuntB:[0,0,0],qMinNet:[null,-100,null],qMaxNet:[null,100,null],branches:[{i:0,j:1,r:.01,x:.12,bch:.02,tap:1,phase:0},{i:1,j:2,r:.015,x:.1,bch:.02,tap:1,phase:0},{i:0,j:2,r:.02,x:.15,bch:.01,tap:1,phase:0}]};
 const r2=solveNR(m2);cases.push({name:'3-bus slack-PV-PQ',pass:r2.converged&&Math.abs((r2.Vm?.[1]??NaN)-1.02)<1e-5,status:r2.status,value:r2.Vm?.[1]??null});
 const m3=structuredClone(m2);m3.qMinNet=[null,-5,null];m3.qMaxNet=[null,5,null];const r3=solveNR(m3);cases.push({name:'PV Q-limit to PQ',pass:r3.converged&&(r3.pvToPq?.length??0)>0,status:r3.status,value:r3.pvToPq?.length??0});
 const mt={n:2,baseMVA:100,slack:0,slackVm:1,pSpec:[0,0],qSpec:[0,0],busType:[2,0],vmSet:[1,1],shuntG:[0,0],shuntB:[0,0],qMinNet:[null,null],qMaxNet:[null,null],branches:[{i:0,j:1,r:.01,x:.1,bch:0,tap:1.05,phase:0}]};
 const rt=solveNR(mt),expected=1/1.05;cases.push({name:'transformer off-nominal tap',pass:rt.converged&&Math.abs((rt.Vm?.[1]??NaN)-expected)<2e-3,status:rt.status,value:rt.Vm?.[1]??null});
 const mc={n:2,baseMVA:100,slack:0,slackVm:1,pSpec:[0,-10],qSpec:[0,-2],busType:[2,0],vmSet:[1,1],shuntG:[0,0],shuntB:[0,0],qMinNet:[null,null],qMaxNet:[null,null],branches:[{i:0,j:1,r:.005,x:-.08,bch:0,tap:1,phase:0}]};
 const rc=solveNR(mc),loss=rc.branches?.[0]?rc.branches[0].pf+rc.branches[0].pt:NaN;cases.push({name:'series capacitor negative X',pass:rc.converged&&Number.isFinite(loss)&&loss>=-1e-6,status:rc.status,value:loss});
 const ml=structuredClone(m);const rl=solveNR(ml),loss2=rl.branches?.[0]?rl.branches[0].pf+rl.branches[0].pt:NaN;cases.push({name:'branch active loss invariant',pass:rl.converged&&loss2>0,status:rl.status,value:loss2});
 const mn=structuredClone(m);mn.slack=-1;const rn=solveNR(mn);cases.push({name:'island without slack',pass:rn.status==='NO_SLACK'&&!rn.converged,status:rn.status,value:null});
 return cases;
}
