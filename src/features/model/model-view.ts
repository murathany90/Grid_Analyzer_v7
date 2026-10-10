import {inspectModelFile,type ModelEntry} from '../../importers/model-file';
import type { AppContext, Feature } from '../../app/contracts';
import { element, button, csvCell, downloadText, format } from '../../ui/components/dom';

const capabilityNames = [
  ['powerFlow', 'Yük akışı'],
  ['shortCircuit3Phase', 'Üç faz kısa devre'],
  ['shortCircuitGround', 'Toprak arızası'],
  ['n1', 'N−1'],
] as const;

export function createModelView(ctx: AppContext): Feature {
  const root = element('section', 'ga-feature ga-model-view');
  const heading = element('div', 'ga-feature-heading');
  heading.append(element('h2', '', 'Model Yükle'), element('p', 'ga-muted', 'PowerFactory DGS modeli bu tarayıcı oturumunda işlenir.'));
  const drop = element('div', 'ga-drop');
  drop.tabIndex = 0;
  drop.setAttribute('role', 'group');
  drop.setAttribute('aria-label', 'YTBS / DIgSILENT modeli JSON veya ZIP yükle');
  const dropTitle = element('strong', '', 'YTBS / DIgSILENT modeli — JSON veya ZIP');
  const input = element('input');
  input.id = 'modelFileInput'; input.type = 'file'; input.accept = '.json,.zip,application/json,application/zip';
  input.className = 'ga-visually-hidden';
  input.setAttribute('aria-label', 'JSON veya ZIP dosyaları');
  const choose = button('Dosya seç', () => input.click());
  choose.dataset.helpLabel='Model dosyası ve kimlik';
  const fileLabel = element('label', 'ga-file-label', 'Dosya seçin'); fileLabel.htmlFor = input.id;
  fileLabel.append(input);
  const loading = element('span', 'ga-muted', 'JSON dosyası bu tarayıcı oturumuna yüklenir.');
  drop.append(dropTitle, element('p', 'ga-muted', 'JSON veya ZIP · Dosyalar bu tarayıcıda işlenir'), choose, fileLabel, loading);

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
    downloadText(csv, 'YTBS_model_uyarilari.csv', 'text/csv;charset=utf-8');
  });
  warningActions.append(warningCount, exportWarnings);
  warningsPanel.append(warningList);
  warningsPanel.append(warningActions);
  const classPanel = element('section', 'ga-panel');
  classPanel.append(element('h3', '', 'DGS sınıf sayıları'));
  const classList = element('div', 'ga-class-counts');
  classPanel.append(classList);
  const cancelLoad=button('Model yüklemesini iptal et',()=>ctx.cancel());drop.append(cancelLoad);message.hidden=true;
  root.append(heading, drop, message, summary, capabilityPanel, warningsPanel, classPanel);

  let loadingNow = false;
  function selectEntry(entries:ModelEntry[]):Promise<ModelEntry|null>{
    return new Promise(resolve=>{const dialog=element('dialog','ga-zip-dialog'),select=element('select'),size=element('p','ga-muted');
      dialog.setAttribute('aria-label','ZIP içinden model seç');select.setAttribute('aria-label','ZIP JSON dosyası');
      entries.forEach((e,i)=>select.append(new Option(e.name,String(i))));
      const update=()=>{size.textContent=`Açılmış boyut: ${format(entries[Number(select.value)].size/1024**2,2)} MiB`;};select.onchange=update;update();
      const finish=(entry:ModelEntry|null)=>{dialog.close();dialog.remove();resolve(entry);};
      dialog.append(element('h3','','ZIP içinden model seç'),select,size,button('Seçilen JSON’u yükle',()=>finish(entries[Number(select.value)])),button('Vazgeç',()=>finish(null)));
      dialog.oncancel=e=>{e.preventDefault();finish(null);};root.append(dialog);dialog.showModal();
    });
  }
  const load = async (files: FileList | File[]) => {
    if (!files.length || loadingNow) return;
    const selectedFiles = Array.from(files).slice(0, 1);
    if (files.length > 1) ctx.setMessage('Tek etkin model destekleniyor; ilk JSON dosyası yüklenecek.');
    loadingNow = true;
    input.disabled = true;
    choose.disabled = true;
    loading.textContent = `Yükleniyor · ${selectedFiles[0].name}`;
    try {
      const archive=await inspectModelFile(selectedFiles[0]);
      const entry=archive.entries.length===1?archive.entries[0]:await selectEntry(archive.entries);
      if(!entry)return;loading.textContent=`${entry.name} · Açılmış boyut ${format(entry.size/1024**2,1)} MiB`;
      await ctx.loadFiles([await archive.extract(entry)]);
    } catch (error) {
      ctx.setMessage(`Model yüklenemedi: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      loadingNow = false;
      input.disabled = false;
      choose.disabled = false;
      loading.textContent = 'JSON dosyası bu tarayıcı oturumuna yüklenir.';
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
    cancelLoad.hidden=!ctx.busy||!!ctx.network;
    const network = ctx.network;
    message.textContent = ctx.status || 'Model bekleniyor.';
    if (!network) {
      summary.replaceChildren(element('p', 'ga-empty', 'Henüz model yüklenmedi.'));
      capabilities.replaceChildren(); warningList.replaceChildren(); classList.replaceChildren(); warningCount.textContent = ''; exportWarnings.disabled = true;
      return;
    }
    exportWarnings.disabled = network.warnings.length === 0;
    warningCount.textContent = `${network.warnings.length.toLocaleString('tr-TR')} uyarı · ilk 35 gösteriliyor`;

    const cards = [
      ['Model', network.name], ['Kayıt', format(network.records, 0)], ['Bara', format(network.buses.length, 0)],
      ['Hat', format(network.lines.length, 0)], ['Trafo', format(network.transformers.length, 0)], ['TM', format(network.sites.length, 0)],['StudyCase',network.studyCase||network.name],['Model SHA-256',network.modelHash],
    ];
    summary.replaceChildren(...cards.map(([label, value]) => {
      const card = element('div', 'ga-card'); card.append(element('span', 'ga-muted', label), element('strong', '', value)); return card;
    }));

    capabilities.replaceChildren(...capabilityNames.map(([key, label]) => {
      const capability = network.capabilities[key];
      const card = element('div', 'ga-card');
      card.append(element('span', 'ga-muted', label), element('strong', `ga-state ga-state-${capability.state.toLowerCase()}`, capability.state));
      if (capability.reasons.length) card.append(element('small', 'ga-muted', capability.reasons.join(' · ')));
      return card;
    }));

    warningList.replaceChildren(...(network.warnings.length
      ? [...network.warnings.slice(0, 35).map(warning => element('li', '', warning)), ...(network.warnings.length > 35 ? [element('li', 'ga-muted', `${network.warnings.length - 35} ek uyarı CSV dışa aktarımında bulunur.`)] : [])]
      : [element('li', 'ga-muted', 'Model uyarısı yok.') ]));
    const classes = Object.entries(network.classCounts).sort(([a], [b]) => a.localeCompare(b, 'tr'));
    classList.replaceChildren(...classes.map(([name, count]) => {
      const row = element('div', 'ga-count-row'); row.append(element('code', '', name), element('span', '', format(count, 0))); return row;
    }));
  }

  if (ctx.view === 'model') render();
  return { element: root, render };
}
