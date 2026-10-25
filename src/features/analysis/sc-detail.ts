import type {CompactRow} from './compact-rows';
import {element,button,format} from '../../ui/components/dom';
import {scCurrentKa,nominalKv} from '../../domain/results/sc-node';
/** Compact shared detail; technical evidence is closed until requested. */
export function scDetail(row:CompactRow,source:'GA'|'PF',showMap:()=>void){
 const root=element('div','ga-sc-detail');root.append(element('strong','',row.name),element('p','ga-muted',`${row.tm} · ${nominalKv(row.kv)} kV · FID ${row.fid}`),element('p','',`${source} · ${row.raw.mode} · 3F Ikss: ${scCurrentKa(source==='PF'?row.metrics.ikss?.pf:row.metrics.ikss?.ga)} kA`),element('p','ga-muted',`${row.raw.nodeLabel??''} · Elektriksel ID: ${row.raw.electricalBusId}`));
 if(row.raw.displayFid&&row.raw.displayFid!==row.fid)root.append(element('p','ga-muted',`Görüntüleme alias FID: ${row.raw.displayFid} · Hesap/kaynak FID: ${row.fid} · aynı elektriksel düğüm`));
 if(source==='GA')root.append(element('p','',`PF 3F: ${scCurrentKa(row.metrics.ikss?.pf)} kA · Tanısal GA−PF: ${format(row.raw.diagnosticDelta_kA as number|null,3)} kA`));
 root.append(button('Haritada göster',showMap),element('p','ga-muted','Ağ yaklaşımı; IEC / PF sayısal paritesi doğrulanmadı.'));
 const technical=element('details');technical.append(element('summary','','3F empedansı, gerekçe ve yöntem kanıtı'),element('p','',`3F sürme noktası Zkk: ${format(row.raw.Zkk_R_ohm as number|null,4)} + j${format(row.raw.Zkk_X_ohm as number|null,4)} Ω`),element('p','',String(row.raw.reason_3F??row.raw.referenceReason??'—')),element('p','',String(row.raw.referenceReason??'')));
 const proof=element('details');proof.append(element('summary','','Kimlik ve kaynak kaydı'),element('pre','',JSON.stringify(row.detail,null,2)));technical.append(proof);root.append(technical);return root;
}
