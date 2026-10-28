import test from 'node:test';
import assert from 'node:assert/strict';
import {createPsseViewportTransform,panPsseViewportBy,zoomPsseViewportAt,type PssePoint,type PsseViewport} from '../../src/features/psse/viewport-transform';
import {projectWgs84} from '../../src/map/projection';

const viewport:PsseViewport={width:1200,height:690,center:{x:0,y:0},scale:Math.min(1200/21,690/11.5),zoom:2.7,panX:134,panY:-97};
function close(a:number,b:number){assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);}
function same(a:PssePoint,b:PssePoint){close(a.x,b.x);close(a.y,b.y);}
const sizes=[[1200,690],[640,480],[390,800],[1800,430],[2560,1440]];

test('project/unproject and screen/SVG round trips retain real projected locations at every viewport size',()=>{
 for(const [width,height]of sizes){const rect={left:73,top:119,width,height},t=createPsseViewportTransform(viewport);
  for(const [lon,lat]of [[26,42],[35.5,39],[44.5,36]]){const [x,y]=projectWgs84(lon,lat),point={x,y};same(t.unproject(t.project(point)),point);same(t.screenToWorld(t.worldToScreen(point,rect),rect),point);same(t.screenToSvg(t.svgToScreen(t.project(point),rect),rect),t.project(point));}
 }
});
test('Canvas backing-pixel transform and expanded SVG viewBox agree at mobile, wide and fullscreen sizes for every DPR',()=>{
 for(const [width,height]of sizes)for(const dpr of [1,1.25,1.5,2,3]){
  const rect={left:41,top:83,width,height},t=createPsseViewportTransform({...viewport,center:{x:1.4,y:-.8}}),matrix=t.canvasTransform(rect,dpr),box=t.svgViewBox(rect);
  same(t.svgToScreen({x:box.x,y:box.y},rect),{x:rect.left,y:rect.top});same(t.svgToScreen({x:box.x+box.width,y:box.y+box.height},rect),{x:rect.left+width,y:rect.top+height});
  for(const point of [{x:-8,y:3},{x:0,y:0},{x:9,y:-3}]){const screen=t.worldToScreen(point,rect);close((matrix.a*point.x+matrix.c*point.y+matrix.e)/dpr,screen.x-rect.left);close((matrix.b*point.x+matrix.d*point.y+matrix.f)/dpr,screen.y-rect.top);}
 }
});
test('cursor anchored zoom preserves the same world location when CSS scale is not one and pan is already nonzero',()=>{
 for(const [width,height]of sizes){const rect={left:101,top:47,width,height};for(const relative of [{x:.07,y:.13},{x:.91,y:.84},{x:.5,y:.5}]){
  const cursor={x:rect.left+width*relative.x,y:rect.top+height*relative.y},before=createPsseViewportTransform(viewport).screenToWorld(cursor,rect);
  for(const nextZoom of [.65,1,12,64]){const next=zoomPsseViewportAt(viewport,cursor,rect,nextZoom);same(createPsseViewportTransform(next).screenToWorld(cursor,rect),before);}
 }}
});
test('drag displacement stays in CSS pixels regardless of zoom, aspect ratio, and DPR',()=>{
 for(const [width,height]of sizes)for(const zoom of [.65,1,8,64]){const rect={left:42,top:62,width,height},v={...viewport,zoom},delta={x:-93,y:127},point={x:7,y:-3},before=createPsseViewportTransform(v).worldToScreen(point,rect),after=createPsseViewportTransform(panPsseViewportBy(v,delta,rect)).worldToScreen(point,rect);same(after,{x:before.x+delta.x,y:before.y+delta.y});}
});
test('repeated zoom in/out has no cumulative cursor drift and resize never mutates logical pan',()=>{
 const rect={left:9,top:27,width:487,height:803},cursor={x:149,y:639};let v={...viewport};const before=createPsseViewportTransform(v).screenToWorld(cursor,rect);
 for(let i=0;i<100;i++){v=zoomPsseViewportAt(v,cursor,rect,8);v=zoomPsseViewportAt(v,cursor,rect,viewport.zoom);}
 same(createPsseViewportTransform(v).screenToWorld(cursor,rect),before);close(v.panX,viewport.panX);close(v.panY,viewport.panY);
 createPsseViewportTransform(v).svgViewBox({left:0,top:0,width:1920,height:1080});close(v.panX,viewport.panX);close(v.panY,viewport.panY);
});
