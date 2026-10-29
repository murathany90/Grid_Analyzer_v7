export function createSettings(controller) {
  const panel=document.createElement('section');panel.className='psse-settings ga-panel';panel.innerHTML='<h2>Ayarlar</h2><div class="psse-settings-grid"></div>';
  let grid=panel.lastElementChild;
  const fields=[];
  function field(name,label,choices,type='number',min,max,step){
    const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(choices?'select':'input');input.setAttribute('aria-label',label);input.dataset.setting=name;
    if(choices)for(const [value,text]of choices)input.add(new Option(text,value));else{input.type=type;if(min!=null)input.min=min;if(max!=null)input.max=max;if(step!=null)input.step=step;}
    input.onchange=()=>{const value=choices||type==='color'?input.value:Number(input.value);if(!choices&&type==='number'&&(!Number.isFinite(value)||(min!=null&&value<min)||(max!=null&&value>max))){render();return;}controller.settings.update({[name]:name==='rateIndex'?Number(value):value});};wrap.append(input);grid.append(wrap);fields.push([name,input]);
  }
  field('rateIndex','Yüklenme paydası RATE',Array.from({length:12},(_,i)=>[String(i),i<3?'RATE '+['A','B','C'][i]:'RATE '+(i+1)]));
  field('theme','Tema',[['dark','Koyu'],['light','Açık']]);field('precision','Ondalık basamak',null,'number',0,8,1);
  field('palette','Yüklenme paleti',[['voltage','GA özel renkler'],['green','Yeşil']]);
  for(const [name,label]of [['color400','400 kV'],['color220','220 kV'],['color154','154 kV'],['color66','66 kV'],['colorLow','Alçak gerilim'],['colorOut','Devre dışı']])field(name,label,null,'color');
  for(const [name,label]of [['width400','400 kV hat kalınlığı'],['widthMid','Orta gerilim hat kalınlığı'],['widthOther','Diğer hat kalınlığı']])field(name,label,null,'number',.3,8,.1);
  field('flowSpeed','Akış hızı',[['slow','Yavaş'],['normal','Normal'],['fast','Hızlı']]);field('flowDensity','Akış yoğunluğu',null,'number',1,12,1);
  field('siteSize','TM simge boyutu',null,'number',3.2,10,.1);field('basemapOpacity','Altlık saydamlığı',null,'number',0,1,.05);
  field('qBase400Mvar','400 kV Q baz (Mvar)',null,'number',1,10000,1);field('qBase154Mvar','154 kV Q baz (Mvar)',null,'number',1,10000,1);
  const threshold=document.createElement('fieldset');threshold.innerHTML='<legend>Yüklenme eşikleri (%)</legend>';grid.append(threshold);const thresholds=[];
  for(let i=0;i<6;i++){const input=document.createElement('input');input.type='number';input.min=0;input.max=300;input.setAttribute('aria-label','Yüklenme eşiği '+(i+1));input.onchange=()=>{const values=thresholds.map(x=>Number(x.value));if(values.every(v=>Number.isFinite(v)&&v>=0&&v<=300))controller.settings.update({thresholds:values.sort((a,b)=>a-b)});else render();};threshold.append(input);thresholds.push(input);}
  const advanced=document.createElement('details');advanced.innerHTML='<summary>Harita renkleri ve metrik ölçekleri</summary><div class="psse-settings-grid"></div>';panel.append(advanced);grid=advanced.lastElementChild;
  for(const[name,label]of [['colorNoResult','Veri yok'],['colorScenarioOff','Senaryo devre dışı'],['colorScenarioOn','Senaryo serviste'],['voltageLowColor','Düşük V rengi'],['voltageNeutralColor','Nötr V rengi'],['voltageHighColor','Yüksek V rengi'],['angleNegativeColor','Negatif açı rengi'],['angleNeutralColor','Nötr açı rengi'],['anglePositiveColor','Pozitif açı rengi']])field(name,label,null,'color');
  for(let i=0;i<7;i++)field('loadingColor'+i,'Yüklenme kademe '+i+' rengi',null,'color');
  for(const[name,label]of [['voltageMin','V alt ölçek (pu)'],['voltageNeutral','V nötr (pu)'],['voltageMax','V üst ölçek (pu)']])field(name,label,null,'number',.01,2,.01);
  for(const[name,label]of [['angleMin','Açı alt ölçek (°)'],['angleNeutral','Açı nötr (°)'],['angleMax','Açı üst ölçek (°)']])field(name,label,null,'number',-180,180,1);
  const qt=document.createElement('fieldset');qt.innerHTML='<legend>Q eşikleri (%)</legend>';grid.append(qt);const qThresholds=[];
  for(let i=0;i<6;i++){const input=document.createElement('input');input.type='number';input.min=0;input.max=300;input.setAttribute('aria-label','Q eşiği '+(i+1));input.onchange=()=>{const values=qThresholds.map(x=>Number(x.value));if(values.every(v=>Number.isFinite(v)&&v>=0&&v<=300))controller.settings.update({qThresholds:values.sort((a,b)=>a-b)});else render();};qt.append(input);qThresholds.push(input);}
  function render(){for(const[name,input]of fields)input.value=String(controller.settings.value[name]);thresholds.forEach((input,i)=>input.value=controller.settings.value.thresholds[i]);qThresholds.forEach((input,i)=>input.value=controller.settings.value.qThresholds[i]);}
  render();return {element:panel,render};
}
