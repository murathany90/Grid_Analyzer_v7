import {turkeyBasemap} from './turkey-basemap-data';
import {projectWgs84} from './projection';
import type {Settings} from '../persistence/settings';
function geometry(rings:number[][][]):Path2D {
  const path=new Path2D();for(const ring of rings){ring.forEach(([lon,lat],i)=>{const[x,y]=projectWgs84(lon,lat);if(i)path.lineTo(x,y);else path.moveTo(x,y);});path.closePath();}return path;
}
/** Project once. Pan/zoom and style changes only transform cached vector paths. */
export class BasemapRenderer {
  private country=geometry(turkeyBasemap.country);private provinces=geometry(turkeyBasemap.provinces);
  render(canvas:HTMLCanvasElement,width:number,height:number,scale:number,panX:number,panY:number,zoom:number,settings:Settings){
    const g=canvas.getContext('2d')!,dpr=devicePixelRatio||1;g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,width,height);g.fillStyle='#0c1c2c';g.fillRect(0,0,width,height);
    if(settings.basemapStyle==='none')return;
    g.save();g.translate(width/2+panX,height/2+panY);g.scale(scale,scale);g.globalAlpha=settings.basemapOpacity;
    g.fillStyle=settings.basemapStyle==='plain'?'#1b2c38':'#172c3b';g.strokeStyle='#607582';g.lineWidth=1.1/scale;g.fill(this.country,'evenodd');g.stroke(this.country);
    if(settings.showProvinceBorders&&settings.basemapStyle!=='plain'){
      g.strokeStyle='#647582';g.globalAlpha*=Math.min(.85,.18+zoom*.11)*(settings.basemapStyle==='provinces'?1.4:1);g.lineWidth=.55/scale;g.stroke(this.provinces);
    }g.restore();
  }
}
