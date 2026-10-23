import type {AppContext} from '../app/contracts';
import {element,button,format} from '../ui/components/dom';
import {compactScRows,type CompactRow} from '../features/analysis/compact-rows';
import {selectScMode,currentScResult} from '../domain/results/sc-selection';

export function createLightningScPanel(ctx:AppContext){
  const root=element('div','ga-lightning-sc-panel');
  const toolbar=element('div','ga-lightning-sc-toolbar');
  const tmSelect=element('select','ga-lightning-sc-tm');
  const modeSelect=element('select','ga-lightning-sc-mode');
  const unitBtn=button('Birim: A',()=>toggleUnit(),'Akım birimini değiştir (A / kA)');
  const search=element('input','ga-lightning-sc-search');
  const tableHost=element('div','ga-lightning-sc-table-host');
  const detailHost=element('div','ga-lightning-sc-detail-host');
  const statusLine=element('div','ga-lightning-sc-status');

  tmSelect.setAttribute('aria-label','Seçili TM');
  modeSelect.setAttribute('aria-label','SC hesap modu');
  modeSelect.innerHTML='<option value="MAX">MAX Arıza</option><option value="MIN">MIN Arıza</option>';
  search.type='search';
  search.placeholder='Bara adı veya FID ara';
  search.setAttribute('aria-label','TM baralarında ara');

  toolbar.append(tmSelect,modeSelect,unitBtn,search);
  root.append(statusLine,toolbar,tableHost,detailHost);

  let scUnit:'A'|'kA'='A';
  let selectedRowKey='';
  let lastNetwork:unknown=null;
  let lastSiteId='';

  function toggleUnit(){
    scUnit=scUnit==='A'?'kA':'A';
    unitBtn.textContent='Birim: '+scUnit;
    render();
  }

  tmSelect.onchange=()=>{
    ctx.filters.siteId=tmSelect.value;
    if(tmSelect.value){
      ctx.selection={id:tmSelect.value,sourceClass:'ElmSite'};
    }
    selectedRowKey='';
    ctx.notify();
  };

  modeSelect.onchange=()=>{
    const mode=modeSelect.value as 'MAX'|'MIN';
    selectScMode(ctx,mode);
    selectedRowKey='';
    ctx.notify();
  };

  search.oninput=()=>renderTable();

  const fmtScVal=(valKa:number|null|undefined,unit:'A'|'kA'):string=>{
    if(valKa===null||valKa===undefined||!Number.isFinite(valKa))return '—';
    if(unit==='A')return Math.round(valKa*1000).toLocaleString('tr-TR',{maximumFractionDigits:0});
    return Number(valKa).toLocaleString('tr-TR',{minimumFractionDigits:3,maximumFractionDigits:3});
  };

  const fmtZ=(r:number|null|undefined,x:number|null|undefined)=>{
    if(r==null||x==null||!Number.isFinite(r)||!Number.isFinite(x))return '—';
    return `${format(r,3)} + j${format(x,3)} Ω (|Z| = ${format(Math.hypot(r,x),3)} Ω)`;
  };

  function updateTmOptions(){
    if(lastNetwork===ctx.network&&lastSiteId===ctx.filters.siteId)return;
    lastNetwork=ctx.network;
    lastSiteId=ctx.filters.siteId;
    tmSelect.replaceChildren();
    const allOpt=element('option','','Tüm TM Baraları');
    allOpt.value='';
    tmSelect.append(allOpt);

    const sites=ctx.network?.sites??[];
    for(const s of sites){
      const opt=element('option','',s.name);
      opt.value=s.id;
      tmSelect.append(opt);
    }
    if(ctx.filters.siteId&&sites.some(s=>s.id===ctx.filters.siteId)){
      tmSelect.value=ctx.filters.siteId;
    }else if(ctx.selection?.sourceClass==='ElmSite'&&sites.some(s=>s.id===ctx.selection?.id)){
      tmSelect.value=ctx.selection.id;
    }else{
      tmSelect.value='';
    }
  }

  function renderTable(){
    updateTmOptions();
    const sc=currentScResult(ctx);
    if(sc)modeSelect.value=sc.profile.calculateMode;

    const allRows=compactScRows(ctx);
    const selectedSite=tmSelect.value;
    const q=search.value.trim().toLocaleLowerCase('tr-TR');

    let rows=allRows;
    if(selectedSite){
      const siteObj=ctx.network?.sites.find(s=>s.id===selectedSite);
      const siteName=siteObj?.name;
      rows=rows.filter(r=>r.tm===siteName||(siteObj&&Array.isArray(r.raw?.siteIds)&&r.raw.siteIds.includes(selectedSite)));
    }
    if(q){
      rows=rows.filter(r=>r.name.toLocaleLowerCase('tr-TR').includes(q)||r.fid.toLocaleLowerCase('tr-TR').includes(q));
    }

    statusLine.textContent=`⚡ Seçili Kapsam: ${selectedSite?(ctx.network?.sites.find(s=>s.id===selectedSite)?.name??selectedSite):"Tüm TM'ler"} · ${rows.length} elektriksel bara · Mod: ${modeSelect.value}`;

    tableHost.replaceChildren();
    if(!ctx.network){
      tableHost.append(element('p','ga-muted','Model yüklenmedi.'));
      detailHost.replaceChildren();
      return;
    }
    if(!sc){
      tableHost.append(element('p','ga-muted','Bu kapsam ve mod için hesaplanmış SC sonucu yok. Analizler → Kısa Devre ekranından hesabı çalıştırın.'));
      detailHost.replaceChildren();
      return;
    }
    if(!rows.length){
      tableHost.append(element('p','ga-muted','Seçili TM için elektrik barası bulunamadı.'));
      detailHost.replaceChildren();
      return;
    }

    const table=element('table','ga-lightning-sc-table');
    const thead=element('thead');
    const headerTr=element('tr');
    for(const h of ['TM','Bara','kV',scUnit==='A'?'3F Ikss(A)':'3F Ikss(kA)',scUnit==='A'?'1F Ikss(A)':'1F Ikss(kA)','Durum']){
      const th=element('th','',h);
      headerTr.append(th);
    }
    thead.append(headerTr);
    table.append(thead);

    const tbody=element('tbody');
    for(const row of rows){
      const tr=element('tr');
      if(row.key===selectedRowKey)tr.classList.add('is-selected');

      const tmTd=element('td','',row.tm);
      const nameTd=element('td','',row.name);
      nameTd.title=row.fid;
      const kvTd=element('td','',row.kv!=null?format(row.kv,0):'—');

      // 3F cell
      const td3F=element('td');
      const ga3=row.metrics.ikss?.ga,st3=row.raw.status_3F;
      if(st3==='CALCULATED_NETWORK_APPROXIMATION'&&ga3!=null&&Number.isFinite(ga3)){
        td3F.textContent=fmtScVal(ga3,scUnit);
      }else if(st3==='BLOCKED'){
        td3F.textContent='Engellendi';td3F.className='ga-sc-status-blocked';
      }else if(st3==='NOT_COMPUTABLE'){
        td3F.textContent='Hesaplanamaz';td3F.className='ga-sc-status-uncomputed';
      }else if(st3==='NOT_RUN'){
        td3F.textContent='Hesaplanmadı';td3F.className='ga-sc-status-notrun';
      }else if(st3==='STALE'){
        td3F.textContent='Güncel Değil';td3F.className='ga-sc-status-stale';
      }else{
        td3F.textContent=String(st3||'—');td3F.className='ga-sc-status-uncomputed';
      }

      // 1F cell
      const td1F=element('td');
      const ga1=row.metrics.ikss1F?.ga,st1=row.raw.status_1F;
      if(st1==='CALCULATED_NETWORK_APPROXIMATION'&&ga1!=null&&Number.isFinite(ga1)){
        td1F.textContent=fmtScVal(ga1,scUnit);
      }else if(st1==='BLOCKED'){
        td1F.textContent='Engellendi';td1F.className='ga-sc-status-blocked';
      }else if(st1==='NOT_COMPUTABLE'){
        td1F.textContent='Hesaplanamaz';td1F.className='ga-sc-status-uncomputed';
      }else if(st1==='NOT_RUN'){
        td1F.textContent='Hesaplanmadı';td1F.className='ga-sc-status-notrun';
      }else if(st1==='STALE'){
        td1F.textContent='Güncel Değil';td1F.className='ga-sc-status-stale';
      }else{
        td1F.textContent=String(st1||'—');td1F.className='ga-sc-status-uncomputed';
      }

      // Status cell
      const tdStatus=element('td','',row.raw.Hesap_Durumu==='CALCULATED'?'Hesaplandı':row.raw.Hesap_Durumu==='PARTIAL'?'Kısmi':row.raw.Hesap_Durumu==='STALE'?'Güncel Değil':row.raw.Hesap_Durumu==='NOT_RUN'?'Hesaplanmadı':'Engellendi');

      tr.append(tmTd,nameTd,kvTd,td3F,td1F,tdStatus);
      tr.onclick=()=>{
        selectedRowKey=row.key;
        renderTable();
        renderDetail(row);
      };
      tr.ondblclick=()=>{
        ctx.select(row.fid,'ElmTerm');
      };
      tbody.append(tr);
    }
    table.append(tbody);
    tableHost.append(table);

    const currentSelected=rows.find(r=>r.key===selectedRowKey);
    if(currentSelected){
      renderDetail(currentSelected);
    }else{
      detailHost.replaceChildren();
    }
  }

  function renderDetail(row:CompactRow){
    detailHost.replaceChildren();
    const card=element('div','ga-lightning-sc-detail-card');
    const head=element('div','ga-lightning-sc-detail-head');
    head.append(element('strong','',row.name+' ('+row.fid+')'),button('Haritada Göster',()=>ctx.select(row.fid,'ElmTerm'),'Barayı haritada seç'));

    const ikssInfo=element('div','ga-compact-triple');
    const ga3=row.metrics.ikss?.ga,pf3=row.metrics.ikss?.pf,delta3=row.metrics.ikss?.delta;
    const ga1=row.metrics.ikss1F?.ga;

    ikssInfo.innerHTML=`
      <p><strong>3F Ikss:</strong> ${ga3!=null?fmtScVal(ga3,'kA')+' kA ('+fmtScVal(ga3,'A')+' A)':'Hesaplanmadı'} ${pf3!=null?`· PF: ${format(pf3,3)} kA (Δ: ${delta3!=null&&delta3>0?'+':''}${format(delta3,3)} kA)`:'· PF 3F kaydı yok'}</p>
      <p><strong>1F Ikss:</strong> ${ga1!=null?fmtScVal(ga1,'kA')+' kA ('+fmtScVal(ga1,'A')+' A)':'Hesaplanmadı'} <small class="ga-muted">(PF 1F referansı yok — karşılaştırma yapılamaz)</small></p>
      <p><strong>LF Noktası:</strong> U = ${row.metrics.voltage?.ga!=null?format(row.metrics.voltage.ga,2)+' kV':'—'} · Açı θ = ${row.metrics.angle?.ga!=null?format(row.metrics.angle.ga,1)+'°':'—'}</p>
    `;

    const rawObj=row.raw;
    const zTable=element('table','ga-compact-detail-table');
    zTable.innerHTML=`
      <thead><tr><th>Bileşen Empedansı</th><th>Değer (R + jX Ω)</th></tr></thead>
      <tbody>
        <tr><td>Pozitif Bileşen (Z₁)</td><td>${fmtZ(rawObj.Z1_R_ohm as number|null,rawObj.Z1_X_ohm as number|null)}</td></tr>
        <tr><td>Negatif Bileşen (Z₂)</td><td>${fmtZ(rawObj.Z2_R_ohm as number|null,rawObj.Z2_X_ohm as number|null)}</td></tr>
        <tr><td>Sıfır Bileşen (Z₀)</td><td>${fmtZ(rawObj.Z0_R_ohm as number|null,rawObj.Z0_X_ohm as number|null)}</td></tr>
        <tr><td>Eşdeğer Çevrim Empedansı (Zkk)</td><td>${fmtZ(rawObj.Zkk_R_ohm as number|null,rawObj.Zkk_X_ohm as number|null)}</td></tr>
      </tbody>
    `;

    const methodBox=element('div','ga-field');
    methodBox.innerHTML=`
      <p><strong>Yöntem:</strong> IEC 60909-0:2016 (Ağ Yaklaşımı) · <strong>Mod:</strong> ${String(rawObj.mode??'—')}</p>
      <p><strong>3F Durum:</strong> ${String(rawObj.status_3F)} ${rawObj.reason_3F?`(${rawObj.reason_3F})`:''}</p>
      <p><strong>1F Durum:</strong> ${String(rawObj.status_1F)} ${rawObj.reason_1F?`(${rawObj.reason_1F})`:''}</p>
    `;

    card.append(head,ikssInfo,zTable,methodBox);
    detailHost.append(card);
  }

  function render(){
    renderTable();
  }

  return {element:root,render};
}
