export type EngineeringSymbol='breaker'|'disconnector'|'earth-switch'|'current-transformer'|'voltage-transformer'|'arrester'|'transformer2w'|'autotransformer'|'transformer3w'|'generator'|'load'|'reactor'|'capacitor'|'exit';
/** SVG library only. Callers must have a physical source reference before placing any device. */
export function engineeringSymbol(parent:SVGElement,kind:EngineeringSymbol,x:number,y:number,color:string,closed=true){
  const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');g.setAttribute('data-symbol',kind);g.setAttribute('transform',`translate(${x} ${y})`);parent.append(g);
  const add=(tag:string,attrs:Record<string,string|number>)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));g.append(e);return e;};
  const p=(d:string)=>add('path',{d,fill:'none',stroke:color,'stroke-width':2});
  const circle=(cx:number,cy:number,r=11)=>add('circle',{cx,cy,r,fill:'#102033',stroke:color,'stroke-width':2});
  if(kind==='breaker')add('rect',{x:-7,y:-8,width:14,height:16,fill:closed?color:'#102033',stroke:color,'stroke-width':2});
  else if(kind==='disconnector'||kind==='earth-switch'){p(`M0 11 L${closed?0:9} -11`);if(kind==='earth-switch')p('M0 11 V18 M-9 18 H9 M-6 22 H6 M-3 26 H3');}
  else if(kind==='transformer2w'||kind==='autotransformer'||kind==='transformer3w'){circle(0,-7);circle(0,7);if(kind==='autotransformer')p('M-16 17 L16 -17 M10 -17 H16 V-11');if(kind==='transformer3w')circle(15,0);}
  else if(kind==='current-transformer'){circle(0,0,8);p('M0 -16 V16');}
  else if(kind==='voltage-transformer'){circle(0,-6,8);circle(0,6,8);}
  else if(kind==='arrester'){add('rect',{x:-6,y:-12,width:12,height:24,fill:'none',stroke:color});p('M6 -12 L-6 12');}
  else if(kind==='capacitor')p('M0 -18 V-4 M-10 -4 H10 M-10 4 H10 M0 4 V18');
  else if(kind==='reactor')p('M0 -18 V-12 C14 -12 14 -4 0 -4 C14 -4 14 4 0 4 C14 4 14 12 0 12 V18');
  else if(kind==='load')p('M0 -14 V-7 M-11 -7 H11 L0 12 Z');
  else if(kind==='exit')p('M0 -16 V4 M-7 -3 L0 4 L7 -3');
  else {circle(0,0,13);p('M-8 0 C-4 -10 0 -10 0 0 C0 10 4 10 8 0');}
  return g;
}
