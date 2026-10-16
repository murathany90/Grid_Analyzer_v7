import {captionLines,feederCaption} from './caption-text';
/** Same font as SVG text. Node-only layout checks use a conservative em width. */
export function textWidth(value:string,size=10):number {
 const context=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
 if(context){context.font=`${size}px system-ui, sans-serif`;return context.measureText(value).width;}
 return [...value].reduce((width,c)=>width+(/[MW@]/.test(c)?.95:/[ilı.,' ]/.test(c)?.3:.65)*size,0);
}
export const feederLabelWidth=(name:string,station:string,kv:number)=>Math.max(72,...captionLines(feederCaption(name,station,kv),kv<=36?17:24).map(row=>textWidth(row)))+16;
export const feederLabelTop=-12;
export const feederLabelBottom=(expanded:boolean)=>expanded?132:54;
/** Gap from the complete, fixed two-name/two-result block to its exit tip. */
export const exitLabelGap=24;
export const upperLabelOffset=(expanded:boolean)=>feederLabelBottom(expanded)+exitLabelGap;
export const transformerCaptionEnd=62;
