import {SaxesParser} from 'saxes';import {createHash} from 'node:crypto';
/** Compare final caption-only renders with already independently verified conductors. */
export function electricalFingerprint(xml){
 const parser=new SaxesParser(),stack=[],rows=[];
 parser.on('opentag',t=>{const a=t.attributes,owner=a['data-id']??stack.at(-1)??'';stack.push(owner);
  if(a['data-connection'])rows.push(['wire',owner,a['data-native-terminal'],a.d,a['data-source-conductor']??'']);
  if(a['data-physical-switch'])rows.push(['switch',a['data-physical-switch'],a['data-from'],a['data-to'],a['data-contact-in'],a['data-contact-out'],a['data-state']]);
  if(a['data-equipment-center'])rows.push(['equipment',a['data-class'],owner,a['data-equipment-center'],a['data-terminals'],a['data-hv-terminal']??'',a['data-lv-terminal']??'']);
  if(a['data-junction'])rows.push(['junction',a['data-junction'],a.cx,a.cy]);
 });parser.on('closetag',()=>stack.pop());parser.write(xml).close();return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
