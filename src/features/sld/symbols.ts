export type EngineeringSymbol='breaker'|'disconnector'|'earth-switch'|'current-transformer'|'voltage-transformer'|'arrester'|'transformer2w'|'autotransformer'|'transformer3w'|'generator'|'load'|'reactor'|'capacitor'|'shunt-reactor'|'capacitor-bank'|'series-reactor'|'series-capacitor'|'reactive-equivalent'|'exit';
type Contact=readonly[number,number];
export type SwitchSymbolCode='KE-01'|'GENERIC_DISCONNECTOR'|'UNSPECIFIED';
/** Normalized V0 E2/F2/E3/F3 geometry. Generic disconnector makes no motor/earth claim. */
export function switchSymbolDefinition(code:SwitchSymbolCode,closed:boolean|null){
 return {contacts:[[0,-16],[0,16]] as Contact[],stubs:[[[0,-16],[0,-6]],[[0,6],[0,16]]] as Contact[][],
  body:code==='KE-01'?{x:-7,y:-10,width:14,height:20}:null,partial:code==='UNSPECIFIED'||closed===null,
  bridge:closed===true&&code!=='UNSPECIFIED'?[[0,-6],[4,-6],[4,6],[0,6]] as Contact[]:[],blade:closed===false&&code!=='UNSPECIFIED'?[[0,6],[6,-5]] as Contact[]:[]};
}
export function drawSwitchSymbol(parent:SVGElement,code:SwitchSymbolCode,x:number,y:number,color:string,closed:boolean|null){
 const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');g.setAttribute('data-switch-profile',code);g.setAttribute('transform',`translate(${x} ${y})`);g.dataset.symbolState=closed===null?'UNKNOWN':closed?'CLOSED':'OPEN';parent.append(g);
 const d=switchSymbolDefinition(code,closed),add=(tag:string,a:Record<string,string|number>)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(a))e.setAttribute(k,String(v));g.append(e);return e;},line=(pts:readonly Contact[],attr:Record<string,string|number>={})=>add('path',{d:pts.map((p,i)=>(i?'L':'M')+p.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':1.7,...attr});
 if(d.body)add('rect',{...d.body,fill:'var(--sld-paper, #102033)',stroke:color,'stroke-width':1.7,'data-breaker-body':'true'});
 for(const p of d.stubs)line(p,{'data-symbol-stub':'true'});
 for(const [i,p]of d.contacts.entries())add('circle',{cx:p[0],cy:p[1],r:1.6,fill:color,'data-symbol-contact':i===0?'TOP':'BOTTOM'});
 add('circle',{cx:0,cy:6,r:1.6,fill:color});
 if(d.bridge.length){line(d.bridge,{'data-conducting-bridge':'CLOSED'});add('circle',{cx:0,cy:-6,r:1.6,fill:color});}
 if(d.blade.length){line(d.blade,{'data-switch-blade':'OPEN'});line([[-2.5,-8.5],[2.5,-3.5]]);line([[-2.5,-3.5],[2.5,-8.5]]);}
 if(d.partial){add('rect',{x:-10,y:-7,width:20,height:14,fill:'var(--sld-paper, #102033)',stroke:color,'data-symbol-partial':'true'});const t=add('text',{x:0,y:4,fill:color,'font-size':11,'text-anchor':'middle'});t.textContent='?';}
 return g;
}
/** SVG library only. Callers must have a physical source reference before placing any device. */
export function engineeringSymbol(parent:SVGElement,kind:EngineeringSymbol,x:number,y:number,color:string,closed=true,secondaryColor=color){
  const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');g.setAttribute('data-symbol',kind);g.setAttribute('transform',`translate(${x} ${y})`);parent.append(g);
  const add=(tag:string,attrs:Record<string,string|number>)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));g.append(e);return e;};
  const p=(d:string)=>add('path',{d,fill:'none',stroke:color,'stroke-width':2});
  const circle=(cx:number,cy:number,r=11,c=color)=>add('circle',{cx,cy,r,fill:'var(--sld-paper, #102033)',stroke:c,'stroke-width':2});
  if(kind==='breaker')add('rect',{x:-7,y:-8,width:14,height:16,fill:closed?color:'var(--sld-paper, #102033)',stroke:color,'stroke-width':2});
  else if(kind==='disconnector'||kind==='earth-switch'){p(`M0 11 L${closed?0:9} -11`);if(kind==='earth-switch')p('M0 11 V18 M-9 18 H9 M-6 22 H6 M-3 26 H3');}
  else if(kind==='transformer2w'||kind==='autotransformer'||kind==='transformer3w'){circle(0,-7);circle(0,7,11,secondaryColor);if(kind==='autotransformer')p('M-16 17 L16 -17 M10 -17 H16 V-11');if(kind==='transformer3w')circle(15,0);}
  else if(kind==='current-transformer'){circle(0,0,8);p('M0 -16 V16');}
  else if(kind==='voltage-transformer'){circle(0,-6,8);circle(0,6,8);}
  else if(kind==='arrester'){add('rect',{x:-6,y:-12,width:12,height:24,fill:'none',stroke:color});p('M6 -12 L-6 12');}
  else if(kind==='capacitor'||kind==='series-capacitor')p('M0 -18 V-4 M-10 -4 H10 M-10 4 H10 M0 4 V18');
  else if(kind==='capacitor-bank'){p('M0 -18 V-10 M-10 -10 H10 M-10 -4 H10 M0 -4 V4 M-10 4 H10 M-10 10 H10 M0 10 V18');p('M-8 18 H8 M-5 22 H5 M-2 26 H2').dataset.symbolEarth='shunt-reference';}
  else if(kind==='reactor'||kind==='shunt-reactor'||kind==='series-reactor'){
   p('M0 -18 V-12 C-12 -12 -12 -4 0 -4 C-12 -4 -12 4 0 4 C-12 4 -12 12 0 12 V18').dataset.reactorCoil='true';
   if(kind==='shunt-reactor')p('M-8 18 H8 M-5 22 H5 M-2 26 H2').dataset.symbolEarth='shunt-reference';
   if(kind==='series-reactor'){circle(0,-18,1.6);circle(0,18,1.6);}
  }
  else if(kind==='reactive-equivalent'){p('M0 -18 V-10 M0 10 V18');add('rect',{x:-7,y:-10,width:14,height:20,fill:'var(--sld-paper, #102033)',stroke:color,'stroke-width':2});const label=add('text',{x:0,y:4,fill:color,'font-size':10,'text-anchor':'middle'});label.textContent='X';g.dataset.symbolPartial='UNRESOLVED_REACTIVE_TYPE';}
  else if(kind==='load')p('M0 -14 V-7 M-11 -7 H11 L0 12 Z');
  else if(kind==='exit')p('M0 -16 V4 M-7 -3 L0 4 L7 -3');
  else {circle(0,0,13);p('M-8 0 C-4 -10 0 -10 0 0 C0 10 4 10 8 0');}
  return g;
}
