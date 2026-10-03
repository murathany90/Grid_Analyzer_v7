import type { AppContext, Feature } from '../../app/contracts';
import { element, button, escapeHtml as h } from '../../ui/components/dom';
import type { Settings } from '../../persistence/settings';

export function createSettingsView(ctx: AppContext): Feature {
  const root=element('section','ga-panel'),title=element('h2','','Ayarlar'),form=element('div','ga-settings-grid'),message=element('p','ga-muted');
  root.append(title,form,button('Uygula',apply),button('Varsayılana dön',()=>{ctx.settings.reset();fill();ctx.notify();}),button('Modeli bellekten temizle',()=>ctx.clearModel()),message);
  const color=(label:string,key:keyof Settings,value:string,help:string)=>`<label title="${h(help)}">${h(label)}<input type="color" data-key="${key}" value="${h(value)}" aria-label="${h(label)}" title="${h(help)}"></label>`;
  const number=(label:string,key:keyof Settings,value:number,help:string,step='.01',min?:number,max?:number)=>`<label title="${h(help)}">${h(label)}<input type="number" data-key="${key}" value="${value}" step="${step}" ${min===undefined?'':`min="${min}"`} ${max===undefined?'':`max="${max}"`} aria-label="${h(label)}" title="${h(help)}"></label>`;
  const check=(label:string,key:keyof Settings,value:boolean,help:string)=>`<label title="${h(help)}">${h(label)}<input type="checkbox" data-key="${key}" ${value?'checked':''} aria-label="${h(label)}" title="${h(help)}"></label>`;
  const mapOnly='Yalnız harita gösterimini etkiler; yük akışı hesabını değiştirmez.';
  function fill():void {
    const s=ctx.settings.value;
    const colors=([
      ['400 kV','color400'],['220 kV','color220'],['154 kV','color154'],['66 kV','color66'],['≤36 kV','colorLow'],
    ] as const).map(([label,key])=>color(label,key,s[key],`${label} nominal hat rengi. ${mapOnly}`)).join('');
    const loadingColors=([s.loadingColor0,s.loadingColor1,s.loadingColor2,s.loadingColor3,s.loadingColor4,s.loadingColor5,s.loadingColor6] as const)
      .map((value,i)=>color(`Kademe ${i} rengi`,(`loadingColor${i}` as keyof Settings),value,`Yüklenme renk kademesi ${i}. ${mapOnly}`)).join('');
    const thresholds=s.thresholds.map((value,i)=>`<label title="P yüklenme eşiği ${i+1}: yalnız harita rengini değiştirir; ekipman limitini değiştirmez.">P eşiği ${i+1} (%)<input type="number" data-threshold="${i}" value="${value}" min="0" max="300" step="1" aria-label="P yüklenme eşiği ${i+1} yüzde"></label>`).join('');
    const qThresholds=s.qThresholds.map((value,i)=>`<label>Q eşiği ${i+1} (%)<input type="number" data-q-threshold="${i}" value="${value}" min="0" max="300" step="1" aria-label="Q yüklenme eşiği ${i+1} yüzde"></label>`).join('');
    form.innerHTML=`
      <fieldset><legend>Genel</legend>
        ${number('Ondalık basamak','precision',s.precision,'Ekrandaki sayı biçimi.', '1',0,8)}
        ${number('Envanter sayfa boyutu','pageSize',s.pageSize,'Liste başına kayıt sayısı.','1',10,100)}
        ${number('TM simgesi boyutu','siteSize',s.siteSize,'Haritadaki TM marker yarıçapı.','.5',1,10)}
        ${check('Kaynak güzergâhı','routeDetail',s.routeDetail,'Hatların kaynak coğrafi güzergâhını gösterir.')}
      </fieldset>
      <fieldset><legend>Harita altlığı</legend>
        <label title="Yerel Türkiye altlığını seçer.">Altlık harita<select data-key="basemapStyle" aria-label="Altlık harita"><option value="dark">Grid Analyzer Koyu</option><option value="plain">Türkiye Sade</option><option value="provinces">Türkiye İl Sınırları</option><option value="none">Altlık Yok</option></select></label>
        ${check('İl sınırları','showProvinceBorders',s.showProvinceBorders,'Altlık üzerindeki il çizgilerini gösterir.')}
        ${number('Altlık opaklığı','basemapOpacity',s.basemapOpacity,'Altlığın görünürlüğü; şebeke sonuçlarını değiştirmez.','.1',0,1)}
      </fieldset>
      <fieldset><legend>Gerilim seviyesi renkleri</legend>${colors}</fieldset>
      <fieldset><legend>P yüklenme renkleri ve eşikleri</legend>
        <label title="Özel renkler veya yeşil önayar.">Palet<select data-key="palette" aria-label="Yüklenme paleti"><option value="voltage">Özel renkler</option><option value="green">Yeşil önayar</option></select></label>
        ${thresholds}${loadingColors}
      </fieldset>
      <fieldset><legend>Q yüklenme bazları ve eşikleri</legend>
        ${number('400 kV Q baz (MVAr)','qBase400Mvar',s.qBase400Mvar,'400 kV hatlar için |Q| / Q baz hesabı.','1',1)}
        ${number('154 kV Q baz (MVAr)','qBase154Mvar',s.qBase154Mvar,'154 kV hatlar için |Q| / Q baz hesabı.','1',1)}
        ${qThresholds}
      </fieldset>
      <fieldset><legend>Bara gerilimi V haritası</legend>
        ${number('V min (pu)','voltageMin',s.voltageMin,'Gerilim renk skalasının alt sınırı; işletme limiti değildir.','.01',.01,2)}
        ${number('V nötr (pu)','voltageNeutral',s.voltageNeutral,'Gerilim renk skalasının merkezi; işletme limiti değildir.','.01',.01,2)}
        ${number('V max (pu)','voltageMax',s.voltageMax,'Gerilim renk skalasının üst sınırı; işletme limiti değildir.','.01',.01,2)}
        ${color('Düşük V rengi','voltageLowColor',s.voltageLowColor,mapOnly)}
        ${color('Nötr V rengi','voltageNeutralColor',s.voltageNeutralColor,mapOnly)}
        ${color('Yüksek V rengi','voltageHighColor',s.voltageHighColor,mapOnly)}
      </fieldset>
      <fieldset><legend>Bara açısı θ haritası</legend>
        ${number('Açı min (°)','angleMin',s.angleMin,'Slack referansına bağlı açı renk aralığı; operasyonel limit değildir.','1',-180,180)}
        ${number('Açı nötr (°)','angleNeutral',s.angleNeutral,'Slack referansına bağlı açı renk merkezi.','1',-180,180)}
        ${number('Açı max (°)','angleMax',s.angleMax,'Slack referansına bağlı açı renk aralığı; operasyonel limit değildir.','1',-180,180)}
        ${color('Negatif açı','angleNegativeColor',s.angleNegativeColor,mapOnly)}
        ${color('Nötr açı','angleNeutralColor',s.angleNeutralColor,mapOnly)}
        ${color('Pozitif açı','anglePositiveColor',s.anglePositiveColor,mapOnly)}
      </fieldset>
      <fieldset><legend>P / Q büyüklüğü</legend>
        ${number('Otomatik ölçek yüzdelik (%)','magnitudePercentile',s.magnitudePercentile,'Görünür hatlardaki |P| veya |Q| dağılımı.','1',50,99.9)}
        ${number('P manuel maksimum (MW, 0=otomatik)','magnitudePMax',s.magnitudePMax,'P yoğunluğu üst sınırı; hesap değişmez.','1',0)}
        ${number('Q manuel maksimum (MVAr, 0=otomatik)','magnitudeQMax',s.magnitudeQMax,'Q yoğunluğu üst sınırı; hesap değişmez.','1',0)}
        ${number('Renk yoğunluğu','magnitudeIntensity',s.magnitudeIntensity,'P/Q hatlarının görsel yoğunluğu.','.1',.1,2)}
      </fieldset>
      <fieldset><legend>Senaryo farkı</legend>
        ${color('Artış rengi','deltaUp',s.deltaUp,mapOnly)}
        ${color('Azalış rengi','deltaDown',s.deltaDown,mapOnly)}
        ${color('Nötr rengi','deltaNeutral',s.deltaNeutral,mapOnly)}
        ${number('ΔP görsel maksimum (MW)','deltaP',s.deltaP,mapOnly,'.001',.001)}
        ${number('ΔQ görsel maksimum (MVAr)','deltaQ',s.deltaQ,mapOnly,'.001',.001)}
        ${number('ΔV görsel maksimum (pu)','deltaV',s.deltaV,mapOnly,'.001',.001)}
        ${number('ΔYük görsel maksimum (%)','deltaLoad',s.deltaLoad,mapOnly,'.001',.001)}
      </fieldset>
      <fieldset><legend>İşletme durumu</legend>
        ${color('Kaynakta servis dışı','colorOut',s.colorOut,mapOnly)}
        ${color('Senaryoda servis dışı','colorScenarioOff',s.colorScenarioOff,mapOnly)}
        ${color('Senaryoda serviste','colorScenarioOn',s.colorScenarioOn,mapOnly)}
        ${color('Sonuç yok','colorNoResult',s.colorNoResult,mapOnly)}
      </fieldset>
      <fieldset><legend>Hat kalınlığı</legend>
        ${number('400 kV','width400',s.width400,mapOnly,'.5',.5,10)}
        ${number('154 / 220 / 66 kV','widthMid',s.widthMid,mapOnly,'.5',.5,10)}
        ${number('Diğer','widthOther',s.widthOther,mapOnly,'.5',.5,10)}
      </fieldset>
      <fieldset><legend>Görünüm ve etkileşim</legend>
        <label>Tema<select data-key="theme" aria-label="Tema"><option value="dark">Koyu</option><option value="light">Açık</option></select></label>
        <label>Hat görünümü<select data-key="layoutMode" aria-label="Hat görünümü"><option value="standard">Standart</option><option value="separated">Ayrık hatlar</option></select></label>
        <label>Akış hızı<select data-key="flowSpeed" aria-label="Akış hızı"><option value="slow">Yavaş</option><option value="normal">Normal</option><option value="fast">Hızlı</option></select></label>
        ${number('Akış yoğunluğu','flowDensity',s.flowDensity,'Görsel akış işaretlerinin sayısı.','1',1,7)}
        ${check('Akış animasyonu','flowDefault',s.flowDefault,'P veya Q yönünü gösterir.')}
        ${check('Lejand','legend',s.legend,'Harita açıklamasını gösterir.')}
        ${check('Boş tıklamada seçimi temizle','clearOnBlank',s.clearOnBlank,'Boş harita tıklamasında seçimi sıfırlar.')}
      </fieldset>`;
    form.querySelectorAll<HTMLSelectElement>('select[data-key]').forEach(e=>e.value=String(s[e.dataset.key as keyof Settings]));
  }
  function apply():void {
    const patch:Record<string,unknown>={};
    form.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-key]').forEach(e=>{patch[e.dataset.key!]=e instanceof HTMLInputElement&&e.type==='checkbox'?e.checked:e instanceof HTMLInputElement&&e.type==='number'?Number(e.value):e.value;});
    patch.thresholds=[...form.querySelectorAll<HTMLInputElement>('[data-threshold]')].map(e=>Number(e.value));
    patch.qThresholds=[...form.querySelectorAll<HTMLInputElement>('[data-q-threshold]')].map(e=>Number(e.value));
    ctx.settings.update(patch as Partial<Settings>);message.textContent='Ayarlar kaydedildi.';ctx.notify();
  }
  let snapshot='';fill();
  return{element:root,render(){const current=JSON.stringify(ctx.settings.value);if(current!==snapshot){snapshot=current;fill();}document.body.classList.toggle('ga-light',ctx.settings.value.theme==='light');}};
}
