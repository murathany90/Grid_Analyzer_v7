export function motionPolicy({requested=true,layer='calculated',available=false,mode='p',zoom=1}){
  return {enabled:requested&&layer==='calculated'&&available&&(mode!=='q'||zoom>=1.7)};
}
