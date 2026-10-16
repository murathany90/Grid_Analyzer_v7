/** Optical clearance inside one transformer's own two-row caption. Native
 * winding contact and source centerline remain unchanged and auditable. */
export function transformerCaptionPath(d:string,x:number,y:number){
 const lo=y+25,hi=y+57,commands:string[]=[];let prior:readonly number[]|undefined,passed=false;
 for(const match of d.matchAll(/([ML])([\d.-]+),([\d.-]+)/g)){
  const p=[+match[2],+match[3]] as const;
  if(match[1]==='L'&&prior&&p[0]===x&&prior[0]===x&&Math.min(p[1],prior[1])<hi&&Math.max(p[1],prior[1])>lo){
   const up=p[1]<prior[1],entry=up?hi:lo,exit=up?lo:hi;
   if(Math.abs(prior[1]-(up?hi:lo))>.01&& (up?prior[1]>hi:prior[1]<lo))commands.push(`L${x},${entry}`);
   commands.push(`M${x},${up?Math.min(p[1],exit):Math.max(p[1],exit)}`);
   if(up?p[1]<lo:p[1]>hi)commands.push(`L${p.join(',')}`);passed=true;
  }else commands.push(match[1]+p.join(','));prior=p;
 }
 return{d:commands.join(' '),passed,lo,hi};
}
