import type {Line} from '../domain/model/network';
/** Conservative segment bounding boxes only narrow candidates; exact distance still decides the hit. */
export class ScreenHitGrid {
  private cells=new Map<string,Set<Line>>();
  constructor(lines:readonly Line[],paths:ReadonlyMap<string,readonly(readonly[number,number])[]>,width:number,height:number,private size=96){
    for(const line of lines){const path=paths.get(line.id)??[];for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],left=Math.max(0,Math.min(a[0],b[0])-8),right=Math.min(width,Math.max(a[0],b[0])+8),top=Math.max(0,Math.min(a[1],b[1])-8),bottom=Math.min(height,Math.max(a[1],b[1])+8);if(left>right||top>bottom)continue;
        for(let x=Math.floor(left/size);x<=Math.floor(right/size);x++)for(let y=Math.floor(top/size);y<=Math.floor(bottom/size);y++){const key=x+'|'+y,cell=this.cells.get(key)??new Set();cell.add(line);this.cells.set(key,cell);}}}
  }
  candidates(x:number,y:number):ReadonlySet<Line>{return this.cells.get(Math.floor(x/this.size)+'|'+Math.floor(y/this.size))??new Set();}
}
