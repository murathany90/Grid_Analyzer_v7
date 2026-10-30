const finite=v=>typeof v==='number'&&Number.isFinite(v);
/** GA DGS screen-space motion rules; electrical inputs stay PSS/E owned. */
export function flowArrows(lines,{mode='p',time=0,zoom=1,speed='normal',density=4,selected}={}){
  const arrows=[],cells=new Map(),factor={slow:.72,normal:1,fast:1.35}[speed]??1;
  const locate=(line,fraction)=>{
    let distance=line.length*fraction,i=0;while(i<line.lengths.length-1&&distance>line.lengths[i])distance-=line.lengths[i++];const a=line.path[i],b=line.path[i+1],t=distance/(line.lengths[i]||1),x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
    return {x,y,angle:Math.atan2(b.y-a.y,b.x-a.x)};
  };
  const add=(line,fraction,forward,q,side)=>{
    const {x,y,angle}=locate(line,fraction);
    const cell=mode==='q'?`${Math.floor(x/96)}|${Math.floor(y/60)}`:`${Math.floor(x/115)}|${Math.floor(y/115)}`;
    if((cells.get(cell)??0)>=density&&line.id!==selected)return;
    cells.set(cell,(cells.get(cell)??0)+1);arrows.push({id:line.id,x,y,angle:angle+(forward?0:Math.PI),q,label:mode==='q'&&zoom>=4.5?{...locate(line,side==='from'?.12:.88),text:(side==='from'?'F ':'T ')+Math.abs(q).toFixed(0)+' MVAr'}:null});
  };
  for(const original of lines){
    const path=original.path??[original.a,original.b],lengths=original.lengths??path.slice(1).map((b,i)=>Math.hypot(b.x-path[i].x,b.y-path[i].y)),line=original.lengths?original:{...original,path,lengths,length:lengths.reduce((a,b)=>a+b,0)};
    if(line.status!==1||![400,154].includes(line.kv))continue;
    const length=line.length;
    if(mode==='q'){
      if(length<48)continue;
      for(const [side,q,forward,phase]of [['from',line.qFrom,line.qFrom>=0,0],['to',line.qTo,line.qTo<0,.31]]){
        if(!finite(q)||Math.abs(q)<.1)continue;
        const progress=(time/5000*factor+phase)%.26,fraction=side==='from'?(forward?.08+progress:.34-progress):(forward?.66+progress:.92-progress);
        add(line,fraction,forward,q,side);
      }
    }else{
      if(length<34||!finite(line.pFrom)||!finite(line.pTo)||!(line.pFrom>0&&line.pTo<0||line.pFrom<0&&line.pTo>0)||Math.abs(line.pFrom)<.15)continue;
      const count=Math.min(3,Math.ceil(length/180)),rate=factor*(.52+Math.min(120,line.loading||30)/120*1.15);
      for(let k=0;k<count;k++){let d=(time/1000*36*rate+k*length/count)%length;if(line.pFrom<0)d=length-d;add(line,d/length,line.pFrom>0);}
    }
  }
  return arrows;
}
export function createFlowLayer({stage,svg,settings,state,window:win=window}){
  const canvas=document.createElement('canvas');canvas.className='ga-psse-flow-canvas';canvas.setAttribute('aria-label','PSS/E hareketli güç akışı');stage.append(canvas);
  let lines=[],frame=0,disposed=false,screen=[],matrixKey='';const g=canvas.getContext('2d');
  function clear(){g.clearRect(0,0,canvas.width,canvas.height);canvas.dataset.arrowCount='0';canvas.dataset.flowMetric='none';}
  function stop(){win.cancelAnimationFrame(frame);frame=0;clear();}
  function draw(time){
    frame=0;const s=state();if(disposed||!s.enabled||document.hidden||!stage.clientWidth||!stage.clientHeight){clear();return;}
    const box=canvas.getBoundingClientRect(),dpr=win.devicePixelRatio||1,width=Math.round(box.width*dpr),height=Math.round(box.height*dpr);
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,box.width,box.height);
    // One live matrix per frame includes SVG viewBox AND the current pan/zoom group transform.
    const matrix=svg.querySelector('.ga-psse-geo-links')?.getScreenCTM();if(!matrix){clear();return;}
    const point=p=>({x:matrix.a*p.x+matrix.c*p.y+matrix.e-box.left,y:matrix.b*p.x+matrix.d*p.y+matrix.f-box.top});
    const key=[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f,box.left,box.top].join('|');
    if(key!==matrixKey){screen=lines.map(l=>{const path=(l.path??[l.a,l.b]).map(point),lengths=path.slice(1).map((b,i)=>Math.hypot(b.x-path[i].x,b.y-path[i].y));return {...l,path,lengths,length:lengths.reduce((a,b)=>a+b,0)};});matrixKey=key;}
    const config=settings(),arrows=flowArrows(screen,{mode:s.mode,time,zoom:s.zoom,speed:config.flowSpeed,density:config.flowDensity,selected:s.selected});
    for(const a of arrows){g.save();g.translate(a.x,a.y);g.rotate(a.angle);g.fillStyle=s.mode==='q'?'#a7efff':'#ffe2a2';g.beginPath();g.moveTo(s.mode==='q'?7:6,0);g.lineTo(-5,s.mode==='q'?-4:-3.5);g.lineTo(-3,0);g.lineTo(-5,s.mode==='q'?4:3.5);g.closePath();g.fill();if(s.mode==='q'){g.strokeStyle='#12364a';g.lineWidth=1;g.stroke();}g.restore();}
    const labelCells=new Set();g.font='9px system-ui';g.fillStyle='#d4f8ff';for(const a of arrows){if(!a.label)continue;const cell=Math.floor(a.label.x/96)+'|'+Math.floor(a.label.y/52);if((labelCells.has(cell)||labelCells.size>=220)&&a.id!==s.selected)continue;labelCells.add(cell);g.fillText(a.label.text,a.label.x+4,a.label.y-5);}
    canvas.dataset.arrowCount=String(arrows.length);canvas.dataset.flowMetric=s.mode;canvas.dataset.frame=String(time);frame=win.requestAnimationFrame(draw);
  }
  const refresh=()=>{const s=state();if(!s.enabled){stop();return;}if(!frame)frame=win.requestAnimationFrame(draw);};
  const visibility=()=>{if(document.hidden)stop();else refresh();};document.addEventListener('visibilitychange',visibility);
  return {canvas,setLines(value){lines=value;matrixKey='';refresh();},refresh,stop,dispose(){disposed=true;stop();document.removeEventListener('visibilitychange',visibility);canvas.remove();}};
}
