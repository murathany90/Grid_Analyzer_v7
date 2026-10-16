import {captionLines,feederCaption,localDeviceName} from './caption-text';
let context:CanvasRenderingContext2D|null|undefined;
function measure(value:string,size=10){
 if(context===undefined)context=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
 if(context){context.font=`${size}px system-ui, sans-serif`;return context.measureText(value).width;}
 return [...value].reduce((w,c)=>w+(/[MW@]/.test(c)?0.95:/[ilı.,' ]/.test(c)?0.3:0.65)*size,0);
}
export const feederCaptionWidth=(name:string,station:string,kv:number)=>Math.max(72,...captionLines(feederCaption(name,station,kv),kv<=36?17:24).map(s=>measure(s)))+12;
export const exitCaptionOffset=(direction:number,expanded=false)=>direction<0?-(expanded?150:74):32;
/** Both rows sit immediately below the body, ending before the winding axis. */
export const transformerCaptionWidth=(name:string,station:string)=>Math.max(54,measure(localDeviceName(name,station).slice(0,25)+'…'))+12;
export const transformerCaptionRight=-8;
/** Search only the caption's own bay, with true text bounds. Moving a caption
 * never moves a switch, native terminal, conductor or next voltage region. */
export function interbusCaption(x:number,y:number,half:number,height:number,cell:{x1:number;x2:number;y1:number;y2:number},occupied:readonly {x1:number;x2:number;y1:number;y2:number}[]){
 const xs=[x,cell.x1+half+4,cell.x2-half-4],candidates:{x:number;y:number;cost:number}[]=[];
 for(let n=0;n<=12;n++)for(const yy of n?[y+n*14,y-n*14]:[y])for(const xx of xs){
  if(xx-half<cell.x1||xx+half>cell.x2||yy-12<cell.y1||yy+height>cell.y2)continue;
  const box={x1:xx-half,x2:xx+half,y1:yy-12,y2:yy+height};
  if(!occupied.some(o=>box.x1<o.x2&&box.x2>o.x1&&box.y1<o.y2&&box.y2>o.y1))candidates.push({x:xx,y:yy,cost:Math.abs(yy-y)+Math.abs(xx-x)});
 }
 return candidates.sort((a,b)=>a.cost-b.cost)[0]??null;
}
