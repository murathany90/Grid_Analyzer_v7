import {captionLines,feederCaption,localDeviceName} from './caption-text';
let context:CanvasRenderingContext2D|null|undefined;
export function textWidth(value:string,size=10):number {
 if(context===undefined)context=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
 if(context){context.font=`${size}px system-ui, sans-serif`;return context.measureText(value).width;}
 return [...value].reduce((w,c)=>w+(/[MW@]/.test(c)?0.95:/[ilı.,' ]/.test(c)?0.3:0.65)*size,0);
}
export const labelTop=-12,labelBottom=(expanded:boolean)=>expanded?132:54;
export const upperLabelOffset=(expanded:boolean)=>labelBottom(expanded)+24;
export const lowerLabelOffset=36;
export const labelWidth=(name:string,station:string,kv:number)=>Math.max(72,...captionLines(feederCaption(name,station,kv),kv<=36?17:24).map(row=>textWidth(row)))+12;
export const transformerTitleWidth=(name:string,station:string)=>Math.max(54,textWidth(localDeviceName(name,station).slice(0,26)))+12;
