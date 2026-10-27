import type {PsseAttachmentBundle} from '../../importers/psse/attachments';
import {element,button} from '../../ui/components/dom';
import {format} from '../../ui/components/dom';

/** Render opaque companion files without interpreting them as model tables or study results. */
export function renderPsseAttachments(host:HTMLElement,bundle:PsseAttachmentBundle|null|undefined,sourceSha256:string|undefined){
 const attachments=bundle&&bundle.sourceSha256===sourceSha256?bundle.items:[];if(!attachments.length){host.replaceChildren();host.hidden=true;return;}
 const details=element('details','ga-psse-attachments'),summary=element('summary','',`PSS/E yan dosyaları · ${attachments.length} · yalnız ek dosya`),note=element('p','ga-muted','IEC / GCP / MON / CON ve DGS modeli olmadığı belirlenen JSON envanterleri byte olarak saklanır. JSON envanteri DGS veya RAWX modeli ve bu ekler IEC, N-1 ya da başka analiz sonucu sayılmaz.');details.append(summary,note);
 for(const attachment of attachments){const row=element('div','ga-psse-attachment'),meta=element('div');meta.append(element('strong','',`${attachment.archiveName} · ${format(attachment.byteLength,0)} bayt`),element('small','ga-muted',`${attachment.format} · SHA-256 ${attachment.sha256}`));const save=button('Ek dosyayı indir',()=>{const url=URL.createObjectURL(attachment.file),link=element('a');link.href=url;link.download=attachment.file.name;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});save.setAttribute('aria-label',`${attachment.archiveName} yan dosyasını indir`);row.append(meta,save);details.append(row);}
 host.hidden=false;host.replaceChildren(details);
}
