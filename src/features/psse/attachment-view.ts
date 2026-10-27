import type {PsseAttachmentBundle,PsseInventoryCatalog,PsseInventoryTableRow,PsseSidecarAttachment} from '../../importers/psse/attachments';
import {PSSE_INVENTORY_PREVIEW_LIMIT} from '../../importers/psse/attachments';
import {element,button,format} from '../../ui/components/dom';

/** Import status badges: archived bytes, catalog-only inventory JSON or the verified solver input itself. */
export type PsseAttachmentStatus='ARCHIVED'|'CATALOG_ONLY'|'VERIFIED_INPUT';
const STATUS_TITLES:Record<PsseAttachmentStatus,string>={ARCHIVED:'Arşivlenmiş yan dosya; çözücü girdisi veya analiz sonucu değildir.',CATALOG_ONLY:'Yalnız katalog; kayıt sayıları ve kimlik etiketleri için özetlenir, çözücü girdisi veya analiz sonucu değildir.',VERIFIED_INPUT:'Doğrulanmış PSS/E model girdisi (SAV); bu panelde yalnız kaynak olarak gösterilir.'};
/** Badges use the exact status labels; iec/gcp/mon/con are archived, inventory JSON is catalog-only, sav is the verified input. */
export function psseAttachmentStatus(attachment:Pick<PsseSidecarAttachment,'archiveName'|'format'>):PsseAttachmentStatus{
 if(attachment.format==='SAV'||attachment.archiveName.split('.').at(-1)?.toUpperCase()==='SAV')return'VERIFIED_INPUT';
 return attachment.format==='INVENTORY_JSON'?'CATALOG_ONLY':'ARCHIVED';
}
/** Truncated SHA-256 preview for row display; the full digest stays in the title tooltip. */
export const shaPreview=(sha256:string,length=12):string=>sha256.slice(0,length)+'…';

function renderCatalogRow(row:PsseInventoryTableRow):HTMLElement{
 const rowElement=element('div','ga-psse-attachment-catalog-row');rowElement.append(element('strong','',row.ad??'—'));
 const keys=[['ibus',row.ibus],['ckt',row.ckt],['machid',row.machid],['id',row.id]].filter((entry):entry is [string,string]=>entry[1]!==null).map(([key,value])=>`${key} ${value}`);
 if(keys.length)rowElement.append(element('small','ga-muted',keys.join(' · ')));
 return rowElement;
}
/** Catalog-only inventory summary: fixed per-table record counts, expandable capped row browse; contingency stays a future N-1 input candidate. */
function renderInventoryCatalog(catalog:PsseInventoryCatalog):HTMLElement{
 const details=element('details','ga-psse-attachment-catalog'),grid=element('div','ga-psse-attachment-catalog-grid');details.append(element('summary','','YTBS envanter özeti · yalnız katalog (çözücü girdisi değil)'));
 for(const table of catalog.tables){const tableDetails=element('details','ga-psse-attachment-catalog-table'),malformed=table.malformedCount?` · ${format(table.malformedCount,0)} bozuk`:'';tableDetails.append(element('summary','',`${table.table} · ${format(table.recordCount,0)} kayıt${malformed}${table.table==='contingency'?' · gelecek N-1 girdisi adayı (sonuç değil)':''}`));for(const row of catalog.preview(table.table,PSSE_INVENTORY_PREVIEW_LIMIT))tableDetails.append(renderCatalogRow(row));grid.append(tableDetails);}
 details.append(grid);return details;
}

/** Render opaque companion files without interpreting them as model tables or study results. */
export function renderPsseAttachments(host:HTMLElement,bundle:PsseAttachmentBundle|null|undefined,sourceSha256:string|undefined){
 const attachments=bundle&&bundle.sourceSha256===sourceSha256?bundle.items:[];if(!attachments.length){host.replaceChildren();host.hidden=true;return;}
 const details=element('details','ga-psse-attachments'),summary=element('summary','',`PSS/E yan dosyaları · ${attachments.length} · yalnız ek dosya`),heading=element('h3','ga-psse-attachment-heading','Kaynak Ekleri / YTBS Dosyaları'),note=element('p','ga-muted','IEC / GCP / MON / CON arşivleri ARCHIVED, JSON envanteri CATALOG_ONLY, SAV modeli VERIFIED_INPUT olarak işaretlenir. Ek dosyalar byte olarak saklanır; DGS veya RAWX modeli, N-1 ya da başka bir analiz sonucu sayılmaz. Envanter tabloları yalnız katalog amaçlı özetlenir.');details.append(summary,heading,note);
 for(const attachment of attachments){const row=element('div','ga-psse-attachment'),meta=element('div'),status=psseAttachmentStatus(attachment),badge=element('span','ga-psse-attachment-badge',status);badge.dataset.status=status;badge.title=STATUS_TITLES[status];const digest=element('code','',`SHA-256 ${attachment.sha256}`);digest.title=`SHA-256 ${attachment.sha256} · ${attachment.byteLength} bayt`;meta.append(element('strong','',attachment.archiveName),badge,element('small','ga-muted',`${attachment.format} · ${format(attachment.byteLength,0)} bayt`),digest);if(attachment.catalog)meta.append(renderInventoryCatalog(attachment.catalog));const save=button('Ek dosyayı indir',()=>{const url=URL.createObjectURL(attachment.file),link=element('a');link.href=url;link.download=attachment.file.name;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});save.setAttribute('aria-label',`${attachment.archiveName} yan dosyasını indir`);row.append(meta,save);details.append(row);}
 host.hidden=false;host.replaceChildren(details);
}
