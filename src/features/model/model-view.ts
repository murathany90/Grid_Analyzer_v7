import {DgsSemanticDictionary} from '../../domain/dgs-semantics/classes';
import {inspectModelFile,type ModelEntry} from '../../importers/model-file';
import type { AppContext, Feature } from '../../app/contracts';
import { element, button, csvCell, downloadText, format } from '../../ui/components/dom';
import {createPsseView} from '../psse/psse-view';

const capabilityNames = [
  ['powerFlow', 'Yük Akışı'],
  ['shortCircuit3Phase', 'Üç Faz Kısa Devre'],
  ['n1', 'N-1'],
] as const;

export function createModelView(ctx: AppContext, options:{unified?:boolean}={}): Feature {
  const root = element('section', 'ga-feature ga-model-view');
  const heading = element('div', 'ga-feature-heading');
  heading.append(element('h2', '', 'Model Özeti'), element('p', 'ga-muted', 'PowerFactory DGS modeli bu tarayıcı oturumunda işlenir.'));
  const drop = element('div', 'ga-drop');
  drop.tabIndex = 0;
  drop.setAttribute('role', 'group');
  drop.setAttribute('aria-label', 'DGS veya PSS/E şebeke modeli yükle');
  const dropTitle = element('strong', '', 'DGS JSON / PSS/E SAV, RAW, RAWX veya ZIP');
  const input = element('input');
  input.id = 'modelFileInput'; input.type = 'file'; input.accept = '.json,.sav,.raw,.rawx,.zip,application/json,application/zip';
  input.className = 'ga-visually-hidden';
  input.setAttribute('aria-label', 'DGS JSON veya PSS/E SAV RAW RAWX ZIP dosyaları');
  const choose = button('Dosya seç', () => input.click());
  choose.dataset.helpLabel='Model dosyası ve kimlik';
  const fileLabel = element('label', 'ga-file-label', 'Dosya seçin'); fileLabel.htmlFor = input.id;
  fileLabel.append(input);
  const loading = element('span', 'ga-muted', 'Kaynak dosya bu tarayıcı oturumuna yüklenir.');
  drop.append(dropTitle, element('p', 'ga-muted', 'DGS JSON veya PSS/E SAV / RAW / RAWX / ZIP · Dosyalar bu tarayıcıda işlenir'), choose, fileLabel, loading);

  const message = element('p', 'ga-notice');
  const summary = element('div', 'ga-card-grid');
  const capabilityPanel = element('section', 'ga-panel');
  capabilityPanel.append(element('h3', '', 'Model kapsamı'));
  const capabilities = element('div', 'ga-card-grid');
  capabilityPanel.append(capabilities);
  const warningsPanel = element('section', 'ga-panel');
  warningsPanel.append(element('h3', '', 'Model tanısı'));
  const warningList = element('ul', 'ga-warning-list');
  const warningActions = element('div', 'ga-actions');
  const warningCount = element('span', 'ga-muted');
  const exportWarnings = button('Tüm uyarıları CSV', () => {
    const network = ctx.network; if (!network) return;
    const csv = '\ufeff' + [['Warning'], ...network.warnings.map(warning => [warning])].map(row => row.map(csvCell).join(';')).join('\r\n');
    downloadText(csv, 'GridAnalyzer_model_uyarilari.csv', 'text/csv;charset=utf-8');
  });
  warningActions.append(warningCount, exportWarnings);
  warningsPanel.append(warningList);
  warningsPanel.append(warningActions);
  const classPanel = element('section', 'ga-panel');
  classPanel.append(element('h3', '', 'DGS sınıf sayıları'));
  const classList = element('div', 'ga-class-counts');
  classPanel.append(classList);
  let loadGeneration=0;const cancelLoad=button('Model yüklemesini iptal et',()=>{loadGeneration++;ctx.cancel();loadingNow=false;loading.textContent='Model yüklemesi iptal edildi.';input.disabled=false;render();});drop.append(cancelLoad);message.hidden=true;
  const hero=element('div','ga-model-hero'),identityPanel=element('section','ga-model-identity');hero.append(drop,identityPanel);
  if(options.unified)root.append(heading,hero,message,summary,capabilityPanel,classPanel);else root.append(heading,drop,message,summary,capabilityPanel,warningsPanel,classPanel);
  const psseSummary=createPsseView('summary',{getModel:()=>ctx.psseInspection,onKind:kind=>{ctx.psseInventoryKind=kind;ctx.setView('inventory');}});psseSummary.element.hidden=true;root.append(psseSummary.element);

  let loadingNow = false;
  function selectEntry(entries:ModelEntry[]):Promise<ModelEntry|null>{
    return new Promise(resolve=>{const dialog=element('dialog','ga-zip-dialog'),select=element('select'),size=element('p','ga-muted');
      dialog.setAttribute('aria-label','ZIP içinden model seç');select.setAttribute('aria-label','ZIP içindeki model dosyası');
      entries.forEach((e,i)=>select.append(new Option(e.name,String(i))));
      const update=()=>{size.textContent=`Açılmış boyut: ${format(entries[Number(select.value)].size/1024**2,2)} MiB`;};select.onchange=update;update();
      const finish=(entry:ModelEntry|null)=>{dialog.close();dialog.remove();resolve(entry);};
      dialog.append(element('h3','','ZIP içinden model seç'),select,size,button('Seçilen modeli yükle',()=>finish(entries[Number(select.value)])),button('Vazgeç',()=>finish(null)));
      dialog.oncancel=e=>{e.preventDefault();finish(null);};document.body.append(dialog);dialog.showModal();
    });
  }
  const load = async (files: FileList | File[]) => {
    if (!files.length || loadingNow) return;
    const selectedFiles = Array.from(files).slice(0, 1);
    if (files.length > 1) ctx.setMessage('Tek etkin model destekleniyor; ilk model dosyası incelenecek.');
    loadingNow = true;const generation=++loadGeneration;cancelLoad.hidden=false;
    input.disabled = true;
    choose.disabled = true;
    loading.textContent = `Yükleniyor · ${selectedFiles[0].name}`;
    try {
      const archive=await inspectModelFile(selectedFiles[0],{extensions:['json','sav','raw','rawx']});
      const entry=archive.entries.length===1?archive.entries[0]:await selectEntry(archive.entries);
      if(!entry||generation!==loadGeneration)return;loading.textContent=`${entry.name} · Açılmış boyut ${format(entry.size/1024**2,1)} MiB`;
      const file=await archive.extract(entry);if(generation!==loadGeneration)return;await ctx.loadFiles([file]);
    } catch (error) {
      ctx.setMessage(`Model yüklenemedi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if(generation!==loadGeneration)return;
      loadingNow = false;
      input.disabled = false;
      choose.disabled = false;
      loading.textContent = 'Kaynak dosya bu tarayıcı oturumuna yüklenir.';
      input.value = '';
      render();
    }
  };
  input.addEventListener('change', () => void load(input.files ? Array.from(input.files) : []));
  drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('ga-drop-active'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('ga-drop-active'));
  drop.addEventListener('drop', event => {
    event.preventDefault(); drop.classList.remove('ga-drop-active');
    if (event.dataTransfer?.files) void load(Array.from(event.dataTransfer.files));
  });
  drop.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });

  function render(): void {
    if (ctx.view !== 'model') return;
    cancelLoad.hidden=!ctx.busy&&!loadingNow;choose.disabled=ctx.busy||loadingNow;message.hidden=!ctx.busy&&!loadingNow;
    const network = ctx.network;
    const psse=ctx.psseInspection;psseSummary.element.hidden=!psse;summary.hidden=capabilityPanel.hidden=classPanel.hidden=!!psse;identityPanel.hidden=!!psse;warningsPanel.hidden=!!psse;
    if(psse){psseSummary.render();message.textContent=ctx.status;return;}
    message.textContent = ctx.status || 'Model bekleniyor.';
    if (!network) {
      summary.replaceChildren(element('p', 'ga-empty', 'Henüz model yüklenmedi.'));identityPanel.replaceChildren(element('h3','','Model bekleniyor'),element('p','ga-muted','JSON veya ZIP seçin; kaynak veriler sunucuya gönderilmez.'));
      capabilities.replaceChildren(); warningList.replaceChildren(); classList.replaceChildren(); warningCount.textContent = ''; exportWarnings.disabled = true;
      return;
    }
    exportWarnings.disabled = network.warnings.length === 0;
    warningCount.textContent = `${network.warnings.length.toLocaleString('tr-TR')} kaynak uyarısı`;

    const time=/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/.exec(network.studyCase??network.name),date=time?`${time[3]}.${time[2]}.${time[1]} ${time[4]}:${time[5]}`:'Kaynakta belirtilmemiş';
    identityPanel.replaceChildren(element('small','ga-eyebrow','AKTİF MODEL'),element('h3','',network.name),element('p','ga-muted','StudyCase · '+(network.studyCase??'—')),element('p','ga-muted','Model zamanı · '+date),element('small','ga-muted','SHA-256 / model kimliği'),element('code','ga-model-sha',network.modelHash));identityPanel.title='Zaman, varsa kaynak StudyCase adından okunur; sistem saatiyle doldurulmaz.';
    const cards = [['Kayıt',format(network.records,0)],['TM',format(network.sites.length,0)],['Bara / terminal',format(network.buses.length,0)],['Hat',format(network.lines.length,0)],['Trafo',format(network.transformers.length,0)],['Üretici',format(network.generators.length,0)],['Yük',format(network.loads.length,0)],['Anahtar',format(network.switches.length,0)]];
    summary.replaceChildren(...cards.map(([label, value]) => {
      const card = element('div', 'ga-card'); card.append(element('span', 'ga-muted', label), element('strong', '', value)); return card;
    }));

    capabilities.replaceChildren(...capabilityNames.map(([key, label]) => {
      const capability = network.capabilities[key];
      const card = element('div', 'ga-card');
      card.dataset.capabilityState=capability.state;card.append(element('strong','',label),element('small','ga-muted',capability.state==='BLOCKED'?'Kaynak verisi bu hesap için yeterli değil; teknik kapsamı inceleyin.':key==='powerFlow'?'Tam AC çözüm; kontrol ve kaynak kapsamı sınırlıdır.':key==='shortCircuit3Phase'?'Üç faz MAX/MIN ağ yaklaşımı; kaynak kapsamı denetlenir.':'≥66 kV indirgenmiş DC ön tarama; AC güvenlik onayı değildir.'));const technical=element('details','ga-capability-details');technical.append(element('summary','','Teknik kapsam ⓘ'));const reasons=key==='n1'?['Servisteki hat ve iki sargılı trafoların 66 kV ve üzeri indirgenmiş ağında DC ön tarama yapılır.','Yalnız aktif güç, ada ayrılması ve tahmini yüklenme değerlendirilir; reaktif güç, gerilim ve tam AC kesinti doğrulaması bu yöntemin kapsamı dışındadır.','DC taramasında ihlal bulunmaması, AC güvenliğin doğrulandığı anlamına gelmez.']:capability.reasons.map(r=>r.replace('current-profile','mevcut kaynak profili').replace('droop','gerilim eğimi').replace('enum profilleri','kod profilleri'));technical.append(element('p','',reasons.join(' ')),element('p','','PowerFactory/PSS-E sayısal paritesi: NOT_VERIFIED'));card.append(technical);
      return card;
    }));

    if(!options.unified)warningList.replaceChildren(...network.warnings.map(w=>element('li','',w)));
    const classes = Object.entries(network.classCounts).sort(([a], [b]) => a.localeCompare(b, 'tr'));
    classList.replaceChildren(...classes.map(([name, count]) => {
      const row = button(name,()=>{ctx.networkInventoryClass=name;ctx.setView('inventory');});row.classList.add('ga-count-row');row.title=`${name} (${DgsSemanticDictionary[name]??'Teknik Veri'})`+(name==='ElmOwner'?' · Kaynak modeldeki sahiplik gruplaması; hukuki mülkiyet doğrulaması içermez.':'');row.replaceChildren();row.append(element('code','ga-class-code',name),element('span','ga-class-label',`(${DgsSemanticDictionary[name]??'Teknik Veri'})`),element('strong','ga-class-count',format(count,0))); return row;
    }));
  }

  if (ctx.view === 'model') render();
  return { element: root, render };
}
