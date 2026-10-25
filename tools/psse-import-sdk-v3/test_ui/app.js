'use strict';
const $ = id => document.getElementById(id);
let model = null, page = 0, busy = false;
const PAGE_SIZE = 50;
const classes = {buses:'Baralar',branches:'Hatlar',transformers:'Trafolar',generators:'Üreticiler',loads:'Yükler',fixedShunts:'Sabit şöntler',switchedShunts:'Anahtarlamalı şöntler',substations:'Trafo merkezleri',substationNodes:'Fiziksel düğümler',substationSwitches:'Fiziksel anahtarlar',areas:'Bölgeler',zones:'Zonlar',owners:'Sahipler'};
const number = v => typeof v === 'number' ? v.toLocaleString('tr-TR',{maximumFractionDigits:5}) : '—';
function el(tag, text, cls) { const n=document.createElement(tag); if(text!==undefined)n.textContent=String(text); if(cls)n.className=cls; return n; }
function stat(container, name, value) { const n=el('div',undefined,'stat');n.append(el('span',name),el('strong',number(value)));container.append(n); }
function tab(name) { for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===name));for(const s of document.querySelectorAll('[role=tabpanel]'))s.hidden=s.id!==name; }
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
$('change').onclick=()=>{tab('summary');$('file').click();};
$('file').onchange=()=>{if($('file').files[0])loadFile($('file').files[0]);};
const drop=$('drop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag');};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');if(e.dataTransfer.files[0])loadFile(e.dataTransfer.files[0]);};

function table(target, rows, keys) {
  target.replaceChildren();
  if(!rows.length){target.append(el('div','Kayıt yok veya model henüz yüklenmedi.','empty'));return;}
  const t=el('table'),head=el('thead'),hr=el('tr');for(const k of keys)hr.append(el('th',k));head.append(hr);t.append(head);
  const body=el('tbody');for(const row of rows){const tr=el('tr');for(const k of keys){const value=row[k];const text=value===undefined?'—':typeof value==='object'?JSON.stringify(value):typeof value==='number'&&!/ibus|Bus$|Number$|Node$|^ide$|^area$|^zone$|^owner$/i.test(k)?number(value):String(value);const td=el('td',text.length>500?text.slice(0,500)+'…':text);td.title=text;tr.append(td);}body.append(tr);}t.append(body);target.append(t);
}
function renderInventory(){
  const rows=model?.bridge.network[$('class-select').value]||[];
  const query=$('search').value.toLocaleLowerCase('tr-TR');const filtered=query?rows.filter(r=>JSON.stringify(r).toLocaleLowerCase('tr-TR').includes(query)):rows;
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));page=Math.min(page,pages-1);
  const shown=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);const keys=[...new Set(shown.flatMap(Object.keys))];
  table($('inventory-table'),shown,keys);$('page-info').textContent=`${number(filtered.length)} kayıt · ${page+1} / ${pages}`;$('prev').disabled=page===0;$('next').disabled=page+1>=pages;
}
$('class-select').onchange=()=>{page=0;renderInventory();};$('search').oninput=()=>{page=0;renderInventory();};$('prev').onclick=()=>{page--;renderInventory();};$('next').onclick=()=>{page++;renderInventory();};
for(const [key,label]of Object.entries(classes)){const o=el('option',label);o.value=key;$('class-select').append(o);}

function render(){
  const {bridge,canonical,manifest}=model,net=bridge.network,c=bridge.caseIdentification,m=bridge.metadata;
  $('model-name').textContent=m.sourceFile;
  $('identity').replaceChildren();
  for(const line of [`${m.sourceFormat} · ${m.extractionMethod} · ${number(c.sbaseMva)} MVA · ${number(c.baseFrequencyHz)} Hz`,c.titleLine1||'',`Kaynak çözüm durumu: ${c.solutionStatus?.state||'UNKNOWN'} · kayıtlı yöntem: ${c.solutionStatus?.solutionMethod||'—'}`,`SHA-256: ${m.sourceSha256}`])$('identity').append(el('div',line));
  $('counts').replaceChildren();for(const k of ['buses','substations','branches','transformers','generators','loads','substationNodes','substationSwitches'])stat($('counts'),classes[k],(net[k]||[]).length);
  $('capabilities').replaceChildren();
  for(const [key,label]of [['powerFlow','Yük Akışı'],['shortCircuit3Phase','Üç Faz Kısa Devre'],['n1','N-1']]){
    const cap=canonical.capabilities[key],card=el('div',undefined,'cap');card.append(el('h3',label),el('span',cap.state,'badge '+cap.state));
    const details=el('details'),summary=el('summary',`${cap.reasons.length} kapsam gerekçesi`),list=el('ul');
    for(const r of cap.reasons.slice(0,40))list.append(el('li',r));if(cap.reasons.length>40)list.append(el('li',`Tüm ${cap.reasons.length} gerekçe Model Kalitesi raporunda.`));details.append(summary,list);card.append(details);$('capabilities').append(card);
  }
  const live=rows=>(rows||[]).filter(r=>r.inService!==false);
  const sum=(rows,key)=>rows.reduce((s,r)=>s+(typeof r[key]==='number'?r[key]:0),0);
  const gens=live(net.generators),loads=live(net.loads);
  $('operation-stats').replaceChildren();
  for(const [label,value]of [['Devrede üretim P · MW',sum(gens,'pMw')],['Devrede üretim Q · MVAr',sum(gens,'qMvar')],['Sabit güç yük P · MW',sum(loads,'pMw')],['Sabit güç yük Q · MVAr',sum(loads,'qMvar')],['Akım yük P · MW @ 1 pu',sum(loads,'pCurrentMw')],['Admitans yük P · MW @ 1 pu',sum(loads,'pAdmittanceMw')]])stat($('operation-stats'),label,value);
  table($('operation-table'),[
    {Alan:'Sistem bazı',Değer:c.sbaseMva,Birim:'MVA'}, {Alan:'Frekans',Değer:c.baseFrequencyHz,Birim:'Hz'},
    {Alan:'Sabit akım Q',Değer:sum(loads,'qCurrentMvar'),Birim:'MVAr @ 1 pu'}, {Alan:'Sabit admitans Q (kaynak işareti)',Değer:sum(loads,'qAdmittanceMvar'),Birim:'MVAr @ 1 pu'},
    {Alan:'Kaydedilmiş gerilimler',Değer:'Kaynak girdisi; yeni çözüm değil',Birim:'pu / derece'},
    {Alan:'Devrede üretici',Değer:gens.length,Birim:'adet'}, {Alan:'Devrede yük',Değer:loads.length,Birim:'adet'}
  ],['Alan','Değer','Birim']);
  const issues=canonical.diagnostics||[];
  $('quality-summary').replaceChildren();
  const p=el('p',`Elektriksel kabul: ${manifest.importAccepted?'EVET':'HAYIR'} · ${manifest.status} · Dönüştürücü çıkış kodu: ${model.converterExitCode}`);$('quality-summary').append(p);
  $('quality-summary').append(el('p',`Kaynak kalıntısı korunur; Canonical ${canonical.sourceFidelity.fidelity}. ${issues.length} tanı. Fiziksel düğümler solver barası olarak eklenmez. Kısa devre IEC doğrulanmış değildir.`));
  const residue=net.sourceTables||net.sourceSections||{};$('quality-summary').append(el('p',`${Object.keys(residue).length} kaynak tablo/bölümü Bridge içinde saklandı. Envanter normalleştirilmiş alanları gösterir.`));
  $('quality-issues').replaceChildren();
  for(const issue of issues.slice(0,200)){const d=el('div',undefined,'issue '+issue.severity);d.append(el('strong',`${issue.severity} · ${issue.code}`),el('p',issue.message));$('quality-issues').append(d);}
  if(issues.length>200)$('quality-issues').prepend(el('p',`İlk 200 tanı gösteriliyor. ${issues.length} tanının tamamı indirilebilir kalite raporundadır.`,'notice'));
  for(const id of ['download-bridge','download-canonical','download-manifest','download-quality'])$(id).disabled=false;
  renderInventory();
}
function download(value,suffix){if(!model)return;const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download=model.bridge.metadata.sourceFile+suffix;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download-bridge').onclick=()=>download(model.bridge,'.ga-psse.json');$('download-canonical').onclick=()=>download(model.canonical,'.canonical-inspection.json');$('download-manifest').onclick=()=>download(model.manifest,'.manifest.json');$('download-quality').onclick=()=>download({capabilities:model.canonical.capabilities,sourceFidelity:model.canonical.sourceFidelity,diagnostics:model.canonical.diagnostics},'.quality.json');

async function requestModel(url,body){
  if(busy)return;busy=true;model=null;$('file').disabled=true;for(const b of document.querySelectorAll('.examples button'))b.disabled=true;
  $('model-name').textContent='Dosya okunuyor…';$('identity').textContent='Yerel SDK ve elektriksel kapılar çalışıyor.';$('counts').replaceChildren();
  for(const id of ['capabilities','inventory-table','operation-stats','operation-table','quality-summary','quality-issues'])$(id).replaceChildren(el('div','Yeni model okunuyor…','empty'));
  $('status').className='busy';$('status').textContent='Kaynak okunuyor ve elektriksel sadakat denetleniyor. SAV işlemi yerel Siemens runtime kullanır.';
  for(const id of ['download-bridge','download-canonical','download-manifest','download-quality'])$(id).disabled=true;
  try{const response=await fetch(url,{method:'POST',body});const result=await response.json();if(!response.ok)throw Error(result.error||`HTTP ${response.status}`);model=result;page=0;render();$('status').className= result.manifest.importAccepted?'':'blocked';$('status').textContent=result.manifest.importAccepted?'Elektriksel giriş kabul edildi.':`İnceleme için okundu · elektriksel kabul verilmedi: ${result.manifest.status}. Gerekçeler Model Kalitesi sekmesinde.`;}
  catch(e){$('status').className='blocked';$('status').textContent='YÜKLEME REDDEDİLDİ: '+e.message;$('model-name').textContent='Model kabul edilmedi';$('identity').textContent='Kaynak okuma hatası; başarılı yükleme raporlanmadı.';}
  finally{busy=false;$('file').disabled=false;$('file').value='';for(const b of document.querySelectorAll('.examples button'))b.disabled=false;}
}
function loadFile(file){if(!/\.(sav|raw|rawx)$/i.test(file.name)){$('status').textContent='SAV, RAW veya RAWX dosyası seçin.';return;}if(file.size>100*1024*1024){$('status').textContent='Dosya 100 MiB sınırını aşıyor.';return;}return requestModel('/api/upload?name='+encodeURIComponent(file.name),file);}
fetch('/api/examples').then(r=>r.json()).then(data=>{if(!data.files)throw Error(data.error);$('example-dir').textContent=data.directory;for(const name of data.files){const b=el('button',`${name.endsWith('.sav')?'SAV':name.endsWith('.rawx')?'RAWX':'RAW'} · ${name}`);b.onclick=()=>requestModel('/api/example?name='+encodeURIComponent(name));$('example-buttons').append(b);}}).catch(e=>$('example-dir').textContent='control1 listesi alınamadı: '+e.message);
renderInventory();
