/** Original public validation networks. They contain no licensed model data. */
import fs from 'node:fs';
import path from 'node:path';
type Row=Record<string,number|string>;
const table=(rows:Row[])=>{const fields=[...new Set(rows.flatMap(row=>Object.keys(row)))];return {fields,data:rows.map(row=>fields.map(key=>row[key]??null))};};
const bus=(ibus:number,ide:number)=>({ibus,name:'SYNTH '+ibus,baskv:110,ide,area:1,zone:1,owner:1,vm:1,va:0,nvhi:1.1,nvlo:.9,evhi:1.1,evlo:.9});
const gen=(ibus:number,pg:number)=>({ibus,machid:'1',pg,qg:0,qt:200,qb:-200,vs:ibus===1?1.04:1.01,ireg:0,nreg:0,mbase:100,zr:0,zx:.2,rt:0,xt:0,gtap:1,stat:1,rmpct:100,pt:400,pb:0,baslod:0,o1:1,f1:1,wmod:0,wpf:1});
const line=(ibus:number,jbus:number,ckt='1')=>({ibus,jbus,ckt,rpu:.01,xpu:.1,bpu:.02,name:'SYNTH LINE',rate1:200,rate2:220,rate3:250,gi:0,bi:0,gj:0,bj:0,stat:1,bp:0,met:1,len:1,o1:1,f1:1});
function transformer(three=false):Row{
 const t:Row={ibus:1,jbus:3,kbus:three?2:0,ckt:'T',cw:1,cz:1,cm:1,mag1:0,mag2:-.002,nmet:2,name:'SYNTH XFMR',stat:1,o1:1,f1:1,r1_2:.005,x1_2:.12,sbase1_2:100};
 if(three)Object.assign(t,{r2_3:.006,x2_3:.14,sbase2_3:100,r3_1:.007,x3_1:.16,sbase3_1:100,vmstar:1,anstar:0});
 for(let w=1;w<=(three?3:2);w++)Object.assign(t,{['windv'+w]:w===1?1.03:1,['nomv'+w]:110,['ang'+w]:0,['wdg'+w+'rate1']:200,['wdg'+w+'rate2']:220,['wdg'+w+'rate3']:250,['cod'+w]:0,['cont'+w]:0,['node'+w]:0,['rma'+w]:1.1,['rmi'+w]:.9,['vma'+w]:1.1,['vmi'+w]:.9,['ntp'+w]:33,['tab'+w]:0,['cr'+w]:0,['cx'+w]:0,['cnxa'+w]:0});
 return t;
}
export function syntheticRawx(name='basic'):string{
 const generators=[gen(1,70),gen(2,60)],loads:Row[]=[{ibus:3,loadid:'1',stat:1,area:1,zone:1,pl:130,ql:45,ip:0,iq:0,yp:0,yq:0,owner:1,scale:1,intrpt:0,dgenp:0,dgenq:0,dgenm:0,loadtype:'',name:'SYNTH LOAD'}];
 let lines:Row[]=[line(1,2),line(2,3),line(1,3)];
 const network:Record<string,unknown>={caseid:table([{ic:0,sbase:100,rev:36,xfrrat:0,nxfrat:0,basfrq:50,title1:'Original public synthetic validation',title2:name}]),bus:table([bus(1,3),bus(2,2),bus(3,1)])};
 // RAWX global case records use a flat data vector.
 (network.caseid as {data:unknown[]}).data=(network.caseid as {data:unknown[][]}).data[0];
 if(name==='zip')Object.assign(loads[0],{pl:70,ql:20,ip:30,iq:10,yp:30,yq:15});
 if(name==='q-limits')Object.assign(generators[1],{qt:5,qb:-5,vs:1.06});
 if(name==='q-zero-range')Object.assign(generators[1],{qt:0,qb:0,vs:1.06});
 if(['tap','phase','three-winding','cm2','cw2-cz2','cw3-cz3','nominal-base'].includes(name)){
  const t=transformer(name==='three-winding');
  if(name==='phase')t.ang1=8;
  if(name==='tap')t.windv2=1.02;
  if(name==='cw2-cz2')Object.assign(t,{cw:2,cz:2,windv1:113.3,windv2:112.2,r1_2:.0025,x1_2:.06,sbase1_2:50});
  if(name==='cw3-cz3')Object.assign(t,{cw:3,cz:3,windv1:1.03,windv2:1.02,r1_2:125000,x1_2:Math.hypot(.0025,.06),sbase1_2:50});
  if(name==='nominal-base')Object.assign(t,{nomv1:132,nomv2:121,windv2:1.02});
  if(name==='cm2')Object.assign(t,{cm:2,mag1:50000,mag2:.01});
  lines=name==='three-winding'?[line(1,2)]:[line(1,2),line(2,3)];network.transformer=table([t]);
 }
 if(name==='shunt')network.fixshunt=table([{ibus:3,shntid:'1',stat:1,gl:1,bl:15,name:'SYNTH SHUNT'}]);
 if(name==='end-shunts'){Object.assign(lines[0],{gi:.002,bi:-.01,gj:.003,bj:.015});}
 if(name==='negative-x')lines[0].xpu=-.05;
 if(name.startsWith('switched-'))network.swshunt=table([{ibus:3,shntid:'1',modsw:name==='switched-continuous'?2:1,adjm:name==='switched-adjm'?1:0,stat:name==='switched-off'?0:1,vswhi:1.02,vswlo:.98,swreg:0,nreg:0,rmpct:100,rmidnt:'',binit:10,name:'SYNTH SWITCHED',s1:1,n1:4,b1:5,s2:1,n2:0,b2:0,s3:1,n3:0,b3:0,s4:1,n4:0,b4:0,s5:1,n5:0,b5:0,s6:1,n6:0,b6:0,s7:1,n7:0,b7:0,s8:1,n8:0,b8:0}]);
 network.generator=table(generators);network.load=table(loads);network.acline=table(lines);
 network.area=table([{iarea:1,isw:1,pdes:0,ptol:10,arname:'SYNTH AREA'}]);network.zone=table([{izone:1,zoname:'SYNTH ZONE'}]);network.owner=table([{iowner:1,owname:'SYNTH OWNER'}]);
 return JSON.stringify({network},null,2)+'\n';
}
if(process.argv[1]&&path.basename(process.argv[1])==='psse-synthetic-cases.ts'){
 const directory=process.argv[2]??'.tmp/psse-synthetic';fs.mkdirSync(directory,{recursive:true});
 for(const name of ['basic','zip','q-limits','q-zero-range','tap','phase','three-winding','cm2','shunt','switched-on','switched-off','switched-continuous','switched-adjm','cw2-cz2','cw3-cz3','nominal-base','end-shunts','negative-x'])fs.writeFileSync(path.join(directory,name+'.rawx'),syntheticRawx(name));
 console.log(directory);
}
