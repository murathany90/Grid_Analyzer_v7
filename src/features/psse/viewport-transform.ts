/** Shared affine transform for the projected PSS/E world, SVG and Canvas.
 * Pan is always in logical viewBox units, before the CSS fit scale and DPR.
 * Screen points use client coordinates; Canvas coefficients use backing pixels.
 */
export interface PssePoint {x:number;y:number}
export interface PsseScreenRect {left:number;top:number;width:number;height:number}
export interface PsseViewport {width:number;height:number;center:PssePoint;scale:number;zoom:number;panX:number;panY:number}

export function createPsseViewportTransform(viewport:PsseViewport){
 const {width,height,center,scale,zoom,panX,panY}=viewport;
 if(![width,height,scale,zoom].every(value=>Number.isFinite(value)&&value>0)||![center.x,center.y,panX,panY].every(Number.isFinite))throw Error('PSSE_VIEWPORT_INVALID');
 const worldScale=scale*zoom;
 const screenScale=(rect:PsseScreenRect)=>{const k=Math.min(rect.width/width,rect.height/height);return Number.isFinite(k)&&k>0?k:1;};
 const project=(point:PssePoint):PssePoint=>({x:width/2+panX+(point.x-center.x)*worldScale,y:height/2+panY+(point.y-center.y)*worldScale});
 const unproject=(point:PssePoint):PssePoint=>({x:center.x+(point.x-width/2-panX)/worldScale,y:center.y+(point.y-height/2-panY)/worldScale});
 const svgToScreen=(point:PssePoint,rect:PsseScreenRect):PssePoint=>{const k=screenScale(rect);return{x:rect.left+rect.width/2+(point.x-width/2)*k,y:rect.top+rect.height/2+(point.y-height/2)*k};};
 const screenToSvg=(point:PssePoint,rect:PsseScreenRect):PssePoint=>{const k=screenScale(rect);return{x:width/2+(point.x-rect.left-rect.width/2)/k,y:height/2+(point.y-rect.top-rect.height/2)/k};};
 const worldToScreen=(point:PssePoint,rect:PsseScreenRect)=>svgToScreen(project(point),rect);
 const screenToWorld=(point:PssePoint,rect:PsseScreenRect)=>unproject(screenToSvg(point,rect));
 /** Expanded viewBox fills non-matching aspect ratios without stretching either layer. */
 const svgViewBox=(rect:PsseScreenRect)=>{const k=screenScale(rect),w=rect.width/k,h=rect.height/k;return{x:width/2-w/2,y:height/2-h/2,width:w,height:h};};
 const canvasTransform=(rect:PsseScreenRect,dpr=1)=>{const k=screenScale(rect),ratio=Number.isFinite(dpr)&&dpr>0?dpr:1,s=worldScale*k;return{a:s*ratio,b:0,c:0,d:s*ratio,e:(rect.width/2+panX*k-center.x*s)*ratio,f:(rect.height/2+panY*k-center.y*s)*ratio};};
 return{project,unproject,screenScale,svgToScreen,screenToSvg,worldToScreen,screenToWorld,svgViewBox,canvasTransform};
}

/** Keep the world point under the cursor fixed while changing zoom. */
export function zoomPsseViewportAt(viewport:PsseViewport,screenAnchor:PssePoint,rect:PsseScreenRect,nextZoom:number):PsseViewport{
 if(!Number.isFinite(nextZoom)||nextZoom<=0)throw Error('PSSE_VIEWPORT_ZOOM_INVALID');
 const transform=createPsseViewportTransform(viewport),anchor=transform.screenToSvg(screenAnchor,rect),world=transform.unproject(anchor),nextScale=viewport.scale*nextZoom;
 return{...viewport,zoom:nextZoom,panX:anchor.x-viewport.width/2-(world.x-viewport.center.x)*nextScale,panY:anchor.y-viewport.height/2-(world.y-viewport.center.y)*nextScale};
}

/** Convert a CSS pointer displacement once; DPR never enters interaction math. */
export function panPsseViewportBy(viewport:PsseViewport,screenDelta:PssePoint,rect:PsseScreenRect):PsseViewport{
 const k=createPsseViewportTransform(viewport).screenScale(rect);
 return{...viewport,panX:viewport.panX+screenDelta.x/k,panY:viewport.panY+screenDelta.y/k};
}
