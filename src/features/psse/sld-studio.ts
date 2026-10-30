// @ts-nocheck
/* Grid Analyzer PSS/E Native SLD Studio Module */
export function mountPsseSldStudio(): void {
  if (typeof window === 'undefined' || (window as any).__GA_SLD_STUDIO_MOUNTED__) return;
  (window as any).__GA_SLD_STUDIO_MOUNTED__ = true;
  if (typeof document !== 'undefined' && !document.getElementById('ga-sld-studio-style')) {
    const st = document.createElement('style');
    st.id = 'ga-sld-studio-style';
    st.textContent = "/* Grid Analyzer native PSS/E SLD Studio \u2014 Wide Canvas, Zero Side Panels, PSS/E Diagram Properties Modal */\n.ga-psse-sld.ga-sld-studio-ready{max-height:none!important;min-height:0;overflow:visible;position:relative;display:block}\n.ga-psse-sld.ga-sld-studio-ready>.ga-psse-sld-stage.ga-studio-native-source{position:absolute!important;visibility:hidden!important;pointer-events:none!important;width:99%!important;height:1px!important;overflow:hidden!important;z-index:-1}\n.ga-sld-studio-ready>.ga-feature-heading{display:none!important}\n.ga-sld-studio-ready>.ga-psse-diagram-controls.ga-studio-native-controls,.ga-psse-sld.ga-sld-studio-ready>.ga-psse-diagram-controls.ga-studio-native-controls{position:absolute!important;visibility:hidden!important;pointer-events:none!important;left:0!important;top:30px!important;width:99%!important;min-height:0!important;max-height:1px!important;overflow:hidden!important;z-index:-1}\n.ga-sld-studio{border:1px solid var(--edge,#33465a);border-radius:8px;background:var(--panel,#112233);padding:6px 8px;min-height:660px;display:flex;flex-direction:column;gap:5px;width:100%;max-width:100%;box-sizing:border-box;overflow:hidden;font-family:system-ui,'Segoe UI',sans-serif;position:relative}\n.ga-sld-studio:fullscreen{height:100dvh;border-radius:0;padding:8px}\n.ga-studio-topstrip{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid var(--edge,#2f4458);padding-bottom:3px;flex-wrap:wrap}\n.ga-studio-tabs{display:flex;align-items:end;gap:3px;overflow-x:auto;min-height:30px;white-space:nowrap;scrollbar-width:thin;flex:1;min-width:220px}\n.ga-studio-tab{display:flex;align-items:center;gap:1px;border:1px solid var(--edge,#33465a);border-bottom:0;border-radius:6px 6px 0 0;background:var(--panel2,#172d42);height:28px}\n.ga-studio-tab.is-active{background:var(--panel,#112233);box-shadow:inset 0 2px 0 var(--accent,#5bb5dc)}\n.ga-studio-tabs button{border:0;background:transparent;color:var(--text,#eaf1f9);cursor:pointer;padding:4px 7px;font-size:11px;white-space:nowrap}\n.ga-studio-tab-close,.ga-studio-tab-rename,.ga-studio-tab-dup{font-size:11px!important;color:var(--muted,#a6bace)!important;padding:3px 4px!important}\n.ga-studio-badges{display:flex;align-items:center;gap:5px;flex-wrap:wrap}\n.ga-studio-badge{font-size:10px;padding:2px 7px;border-radius:10px;background:#19354d;border:1px solid #385e7d;color:#cbe4f9;white-space:nowrap}\n.ga-studio-badge.is-native{background:#143d34;border-color:#2f8f72;color:#9ef2d5}\n.ga-studio-toolbar{display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:thin;padding:2px 1px;min-height:32px;flex-shrink:0;flex-wrap:wrap}\n.ga-studio-sep{width:1px;height:20px;background:var(--edge,#354b60);margin:0 2px;flex-shrink:0}\n.ga-studio-button{display:inline-flex;align-items:center;justify-content:center;gap:3px;background:var(--panel2,#193147);border:1px solid var(--edge,#3f5568);border-radius:5px;color:var(--text,#eaf1fa);padding:4px 8px;font:11px system-ui,'Segoe UI',sans-serif;white-space:nowrap;cursor:pointer;min-height:27px}\n.ga-studio-button:hover:not(:disabled),.ga-studio-button.is-active{border-color:var(--accent,#50afd3);background:color-mix(in srgb,var(--accent,#43a6d8) 24%,var(--panel2,#193147))}\n.ga-studio-button.is-native-btn{border-color:#35997a;background:#153c34;color:#b8f7e0;font-weight:600}\n.ga-studio-button.is-native-btn:hover:not(:disabled){background:#1e5448;border-color:#4cd3a9}\n.ga-studio-button.is-settings-btn{border-color:#5688c7;background:#193454;color:#d6e9ff;font-weight:600}\n.ga-studio-button:disabled{opacity:.45;cursor:not-allowed}\n.ga-studio-select{background:var(--panel2,#193147);border:1px solid var(--edge,#3f5568);border-radius:5px;color:var(--text,#eaf1fa);font:11px system-ui;padding:3px 6px;min-height:27px;max-width:190px;flex-shrink:0}\n.ga-studio-dropdown{position:relative;display:inline-block;z-index:100000}\n.ga-studio-menu{position:absolute;top:calc(100% + 4px);right:0;z-index:100000;min-width:235px;background:#13283c;border:1px solid #45617a;border-radius:7px;box-shadow:0 12px 32px rgba(0,0,0,.7);padding:6px;display:none;flex-direction:column;gap:2px}\n.ga-studio-dropdown.is-open .ga-studio-menu{display:flex}\n.ga-studio-menu button{background:transparent;border:0;border-radius:4px;color:#e6f0fa;text-align:left;padding:6px 9px;font:11px system-ui;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px}\n.ga-studio-menu button:hover{background:rgba(82,189,225,.16);color:#fff}\n.ga-studio-menu hr{border:0;border-top:1px solid #2d4459;margin:3px 0}\n.ga-studio-workspace{display:grid;grid-template-columns:minmax(0,1fr);width:100%;min-height:620px;height:clamp(620px,calc(100dvh - 185px),1160px);position:relative}\n.ga-studio-stage{position:relative;width:100%;height:100%;border:1px solid var(--edge,#365166);border-radius:6px;overflow:hidden;min-height:0;background:#0d1e2e}\n.ga-studio-stage.is-grid{background-image:radial-gradient(rgba(130,175,215,.22) 1px,transparent 1px);background-size:var(--ga-grid-px,18px) var(--ga-grid-px,18px)}\n.ga-studio-stage svg.ga-studio-drawing{display:block;width:100%;height:100%;background:transparent;touch-action:none;user-select:none}\n.ga-studio-stage .ga-studio-selected{filter:drop-shadow(0 0 5px #f5d161)!important}\n.ga-studio-stage .ga-studio-multi-selected{filter:drop-shadow(0 0 4px #52d1ff)!important}\n.ga-studio-stage .ga-sld-bus,.ga-studio-stage .ga-sld-branch,.ga-studio-stage [data-ga-node],.ga-studio-stage [data-sld-id]{cursor:pointer}\n.ga-studio-stage .ga-studio-sld-label{cursor:move;pointer-events:all}\n.ga-studio-stage .ga-studio-sld-label text{pointer-events:all}\n.ga-studio-stage .ga-studio-knee{fill:#f5d161;stroke:#0c1c2c;stroke-width:1.4;cursor:grab;opacity:0;transition:opacity .12s}\n.ga-studio-stage.show-knees-always .ga-studio-knee,.ga-studio-stage .ga-studio-sld-link:hover .ga-studio-knee,.ga-studio-stage .ga-studio-selected .ga-studio-knee{opacity:1}\n.ga-studio-stage.show-knees-never .ga-studio-knee{display:none!important}\n.ga-studio-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:100%;color:var(--muted,#a7bacb);font-size:13px;padding:32px;gap:12px}\n.ga-studio-empty-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;max-width:680px;width:100%;margin-top:6px}\n.ga-studio-empty-card{border:1px solid #355068;border-radius:8px;background:rgba(19,40,60,.75);padding:14px;text-align:left}\n.ga-studio-empty-card h4{margin:0 0 6px;color:#e6f2ff;font-size:12px}\n.ga-studio-empty-card p{margin:0;font-size:11px;line-height:1.45;color:#9eb4c7}\n.ga-studio-context-bar{position:absolute;right:12px;bottom:12px;z-index:35;display:none;align-items:center;gap:6px;background:rgba(15,31,46,.94);border:1px solid #486b8a;border-radius:7px;padding:5px 9px;box-shadow:0 6px 20px rgba(0,0,0,.45);backdrop-filter:blur(6px);max-width:calc(100% - 24px);flex-wrap:wrap}\n.ga-studio-context-bar.is-visible{display:flex}\n.ga-studio-context-title{font-size:11px;font-weight:600;color:#e8f3fc;max-width:310px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ga-studio-feedback-row{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--edge,#34495c);padding:4px 4px 1px;font-size:11px;color:var(--muted,#a7b8c8)}\n.ga-studio-feedback{margin:0;font-size:11px;line-height:1.25;color:var(--muted,#a7b8c8);white-space:normal!important}\n.ga-studio-feedback[data-kind='warn']{color:#e7bb70}\n.ga-studio-feedback[data-kind='error']{color:#fa8080}\n.ga-studio-feedback[data-kind='ok']{color:#7ce8be}\n/* Modals: PSS(R)E Diagram Settings & Contextual Inspector */\n.ga-studio-modal-backdrop{position:fixed;inset:0;z-index:999;background:rgba(5,12,20,.68);display:none; place-items:center;padding:16px;backdrop-filter:blur(2px)}\n.ga-studio-modal-backdrop.is-open{display:grid}\n.ga-studio-modal{background:#14283b;border:1px solid #486884;border-radius:9px;box-shadow:0 18px 48px rgba(0,0,0,.65);color:#eaf2fa;width:min(680px,96vw);max-height:88dvh;display:flex;flex-direction:column;overflow:hidden;font:12px system-ui,'Segoe UI',sans-serif}\n.ga-studio-modal-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#0f2030;border-bottom:1px solid #31495e}\n.ga-studio-modal-head strong{font-size:13px;color:#f0f6fc}\n.ga-studio-modal-tabs{display:flex;gap:2px;background:#102233;padding:6px 10px 0;border-bottom:1px solid #31495e;overflow-x:auto}\n.ga-studio-modal-tab{border:1px solid transparent;border-bottom:0;border-radius:6px 6px 0 0;background:transparent;color:#9rb2c7;padding:7px 12px;font:600 11px system-ui;cursor:pointer;color:#9fb4c7;white-space:nowrap}\n.ga-studio-modal-tab.is-active{background:#14283b;border-color:#3b5670;color:#66c4eb}\n.ga-studio-modal-body{padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;height:480px;min-height:480px;max-height:480px}\n.ga-studio-bus-popup{position:fixed;z-index:100005;background:#142a3e;border:1px solid #4f7396;border-radius:7px;box-shadow:0 8px 24px rgba(0,0,0,.6);padding:8px;display:flex;flex-direction:column;gap:6px;font:11px system-ui;color:#eaf2fa;min-width:180px}\n.ga-studio-bus-popup button{background:#1b364e;border:1px solid #3c5b78;border-radius:4px;color:#eaf2fa;padding:5px 8px;font:11px system-ui;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between}\n.ga-studio-bus-popup button:hover{background:#264c6d;border-color:#52a8d8}\n.ga-studio-bus-popup hr{border:0;border-top:1px solid #2d4459;margin:2px 0}\n.ga-studio-prop-group{border:1px solid #2d455b;border-radius:6px;padding:10px 12px;background:#112334}\n.ga-studio-prop-group h4{margin:0 0 8px;font-size:11px;color:#7ec7e8;text-transform:uppercase;letter-spacing:.3px}\n.ga-studio-prop-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px 14px;align-items:center}\n.ga-studio-check{display:flex;align-items:center;gap:7px;font-size:11px;color:#dde9f4;cursor:pointer}\n.ga-studio-field{display:flex;flex-direction:column;gap:3px;font-size:11px;color:#b8cadb}\n.ga-studio-field input,.ga-studio-field select,.ga-studio-field textarea{padding:5px 7px;border-radius:4px;border:1px solid #3f586e;background:#0d1c2a;color:#eaf2fa;font:11px system-ui}\n.ga-studio-color-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:#dde9f4}\n.ga-studio-color-row input[type='color']{width:36px;height:24px;padding:0;border:1px solid #48647c;border-radius:4px;background:transparent;cursor:pointer}\n.ga-studio-modal-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;background:#0f2030;border-top:1px solid #31495e}\n.ga-studio-modal-foot-right{display:flex;align-items:center;gap:6px}\n\n";
    document.head.appendChild(st);
  }
/* Grid Analyzer PSS/E Studio - Native .sld + Wide-Canvas Engineering SLD Studio
 * Zero hardcoded profiles/templates. Pure CArchive binary codec + SAV TM/OWNER one-click builder.
 */
(() => {
'use strict';
const NS='http://www.w3.org/2000/svg', KEY='ga.psse.sld.documents.v4', MAX_SAVE=3_900_000, SLD_SCALE=90;
const BRIDGE_URL='http://127.0.0.1:18765', BRIDGE_TOKEN='ga-psse-365-local-bridge-v1';
const $=(sel,root=document)=>root.querySelector(sel);
const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
const E=(tag,cls='',text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
const S=(tag,attrs={})=>{const x=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))if(v!==undefined&&v!==null)x.setAttribute(k,String(v));return x;};
const num=(n,d=1)=>Number.isFinite(n)?Number(n).toLocaleString('tr-TR',{minimumFractionDigits:0,maximumFractionDigits:d}):'—';
const safe=(x)=>String(x??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,240);
const nval=(x,def=0)=>{const v=Number(x);return Number.isFinite(v)?v:def;};
const uid=()=>`sld-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const formatBytes=n=>n>1e6?`${num(n/1e6,2)} MB`:`${num(n/1000,1)} kB`;
const controller=()=>window.psseStudio?.controller??window.__GA_BRIDGE__;

function defaultDiagramSettings(){
  return {
    annotations:{
      showBusId:false,
      showBusName:true,
      showCktId:true,
      showEquipId:false,
      busVoltageMode:'pu_kv',     // 'pu' | 'kv' | 'pu_kv' | 'pu_ang' | 'hide'
      branchFlowMode:'pq',        // 'pq' | 'mva' | 'current' | 'loading' | 'hide'
      showRadialResults:true,
      flowDirectionMode:'arrow',  // 'arrow' | 'sign' | 'both' | 'hide'
      decimals:1
    },
    coloring:{
      colorMode:'voltage',        // 'voltage' | 'source' | 'loading' | 'bus_limits'
      kv400:'#ec6767',
      kv220:'#eebc69',
      kv154:'#4b9dde',
      kv66:'#58c5a0',
      kvLow:'#b49ee1',
      boundColor:'#dce7f3',
      unboundColor:'#7f93a8',
      highlightUnbound:true,
      switchClosed:'#53cf9d',
      switchOpen:'#fa8080',
      dashedOutOfService:true,
      labelColor:'#e4eef8',
      resultLayer:'SOURCE_SAVED'  // 'SOURCE_SAVED' | 'GA_PSSE_CALCULATED'
    },
    layout:{
      busOrientation:'horizontal', // 'horizontal' (DEFAULT) | 'vertical'
      orthogonalLinks:true,
      showGrid:false,
      snapToGrid:false,
      gridSpacing:18,
      snapStep:9,
      showLabels:true,
      fontScale:100,
      labelAlign:'auto',          // 'auto' | 'middle' | 'start'
      showFlowArrows:true,
      autoResolveOverlaps:true,
      showTitle:true,
      diagramTitle:''
    },
    advanced:{
      bgColor:'#0d1e2e',
      portKneeVisibility:'hover', // 'hover' | 'always' | 'never'
      kneeSize:4.0,
      zoomMin:25,
      zoomMax:18000,
      zoomStep:16,
      lineWidthScale:1.0,
      hideCrowdedLabels:false,
      antiAliasing:true,
      lockLayout:false
    }
  };
}

const CP1254_HIGH={0xd0:'Ğ',0xdd:'İ',0xde:'Ş',0xf0:'ğ',0xfd:'ı',0xfe:'ş',0xc7:'Ç',0xe7:'ç',0xd6:'Ö',0xf6:'ö',0xdc:'Ü',0xfc:'ü'};
const UNICODE_TO_CP1254={'Ğ':0xd0,'İ':0xdd,'Ş':0xde,'ğ':0xf0,'ı':0xfd,'ş':0xfe,'Ç':0xc7,'ç':0xe7,'Ö':0xd6,'ö':0xf6,'Ü':0xdc,'ü':0xfc};
function decodeCp1254(bytes){let s='';for(let i=0;i<bytes.length;i++){const b=bytes[i];s+=CP1254_HIGH[b]??String.fromCharCode(b);}return s;}
function encodeCp1254(text){const a=[];for(let i=0;i<text.length;i++){const c=text[i];if(c in UNICODE_TO_CP1254)a.push(UNICODE_TO_CP1254[c]);else{const k=text.charCodeAt(i);a.push(k<256?k:0x3f);}}return new Uint8Array(a);}
function bgrToHex(c,fb='#7cb7f0'){if(c===undefined||c===null||!Number.isFinite(c)||c<0)return fb;const r=c&0xff,g=(c>>8)&0xff,b=(c>>16)&0xff;if(r===0&&g===0&&b===0)return '#dce7f3';if(r===128&&g===128&&b===64)return '#72a7d0';return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;}
function hexToBgr(hex){const s=String(hex||'').replace(/^#/,'');if(s.length!==6)return 0xffffff;const r=parseInt(s.slice(0,2),16)||0,g=parseInt(s.slice(2,4),16)||0,b=parseInt(s.slice(4,6),16)||0;return r|(g<<8)|(b<<16);}

const state={
  root:null,host:null,tabs:null,doc:null,docs:[],modelHash:null,drag:null,
  selection:null,multiSelect:new Set(),mode:'select',
  dirty:false,undo:[],redo:[],svg:null,stage:null,
  refs:{},nativeBytes:new Map(),
  restoreAttemptedFor:null,bridgeOnline:false,
  globalSettings:defaultDiagramSettings()
};

function activeSettings(){return state.doc?.settings||state.globalSettings;}
function toast(msg,kind='info'){if(!state.host)return;const t=$('.ga-studio-feedback',state.host);if(t){t.textContent=msg;t.dataset.kind=kind;}}
function model(){return controller()?.psseInspection??null;}
function network(){return controller()?.psseNetwork??null;}
function hash(){return network()?.modelHash??'standalone';}
function sourceRows(){const m=model();return new Map((m?.equipment||[]).map(e=>[e.id,e]));}

function findAscii(bytes,needle,start=0,end=bytes.length){
  const nlen=needle.length,lim=Math.min(bytes.length,end)-nlen;
  for(let i=Math.max(0,start);i<=lim;i++){
    let ok=true;
    for(let k=0;k<nlen;k++){if(bytes[i+k]!==needle.charCodeAt(k)){ok=false;break;}}
    if(ok)return i;
  }
  return -1;
}

function validateSldBinary(bytes){
  if(!bytes||bytes.length<512){
    return {valid:false,version:'',reason:'Dosya boyutu geçerli bir PSS®E .sld CArchive dosyası için çok küçük (<512 bayt).'};
  }
  const vlen=bytes[0];
  if(vlen<6||vlen>12||bytes[1+vlen]!==0){
    return {valid:false,version:'',reason:'Geçersiz PSS®E .sld binary başlığı: CArchive sürüm imzası bulunamadı.'};
  }
  const ver=decodeCp1254(bytes.subarray(1,1+vlen));
  if(!/^2\.0\.(48|49|50|51)\.\d+$/.test(ver)){
    return {valid:false,version:ver,reason:`Desteklenmeyen veya sahte .sld versiyon başlığı: "${ver}".`};
  }
  const hasSldClass=findAscii(bytes,'CSldBusbar')>=0||findAscii(bytes,'CSldBranch')>=0||findAscii(bytes,'CSldPointNode')>=0||findAscii(bytes,'CSldLayer')>=0;
  if(!hasSldClass){
    return {valid:false,version:ver,reason:'CArchive içinde CSldBusbar / CSldBranch / CSldLayer çalışma zamanı sınıfları bulunamadı.'};
  }
  return {valid:true,version:ver};
}

const PSSE_365_PREAMBLE_B64 =
  'CDIuMC41MS4xAP///wCAgIAAAMgAAAAAAKCZmak/AAAA4E1ioD8AAADgTWKwPwEAAAAAAACgmZnJPwAAAAAAAIA/AQAAAP////8BAAAAAAAAoJmZuT8AAACgmZnZPwAAAAAAACRAAAAAQOF6hD8AAACgmZm5PwAAAKCZmck/AAAAQDMz0z8AAACgmZm5PwEAAAAHAAAAAAAAAAAAJEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABkAAAAAAAAoJmZqT8AAAAAZmbm1yIrDcBcj3KHwEoywAAAKJkY8EZAVHYYKplzBUBmZubXIisNwMsOQ1ym4THAAAAomRjwRkBUdhgqmXMFQAAAAAAAAAAAAAAAAACAAAD/gAAAAAAAAAAAAAAAAAAAAwAAAPoABDM2LjQBMBhEaWFncmFtX0RpYWdyYW1fU2V0dGluZ3MAATACMTIPQ29sb3JWaXNpYmlsaXR5AAE3C0hpZGVVbmJvdW5kATAFQm91bmQBMAdVbmJvdW5kCDE2NzExOTM1CEJya3JPcGVuBTY1MjgwCUJya3JDbG9zZQMyNTUNU2hvd0xvb3BGbG93cwExCUxvb3BGbG93cwczOTk3Njk1ATABMA1GYXVsdFNldHRpbmdzAAEzBVdpZHRoATIFU3R5bGUFNjM1MjAFQ29sb3IHODQyMTUwNAEwATALT09TU2V0dGluZ3MAATQGVXNlT09TATEFV2lkdGgBMQVTdHlsZQU2MzczNgVDb2xvcgc0MTk0MzY4ATABMAxWUkNTU2V0dGluZ3MAATYPVXNlVm9sdGFnZUNvbG9yATEPVXNlVm9sdGFnZUxheWVyATEFV2lkdGgWMSAgMSAgMSAgMSAgMSAgMSAgMSAgMQVTdHlsZR4tMSAgLTEgIC0xICAtMSAgLTEgIC0xICAtMSAgLTEFQ29sb3I9MCAgMjU1ICAxNjcxMTY4MCAgNjUyODAgIDgzODg4NjMgIDg0MjE0NDAgIDE0MzUyMzg0ICAxNjcxMTY4MARWb2x0NzAuMDAwICAxMy44MDAgIDE4LjAwMCAgMjAuMDAwICAyMS42MDAgIDIzMC4wMDAgIDUwMC4wMDABMAEwCUJhckNoYXJ0cwABNAlCYXJDaGFydHMBMA1UcmFuc0JhckNoYXJ0ATAPQmFyQ2hhcnRQZXJjZW50ETk1ICAxMDAgIDEwNSAgMTEwDUJhckNoYXJ0Q29sb3IXMTMzNjk1NDggIDI1NSAgMjA0ICAxMjgBMAEwEUR5bmFtaWNSYW5nZUNoZWNrAAIxNRJVc2VCcmFuY2hMb2FkQ29sb3IBMA1MaW5lTG9hZENvbG9yBTMzMDIzDUxpbmVMb2FkV2lkdGgBNQ1MaW5lTG9hZFN0eWxlAi0xC0xpbmVMb2FkaW5nCjEwMC4wMDAwMDAPVXNlQnVzVm9sdENvbG9yATAPQnVzVm9sdE1pbkNvbG9yBTMyNzY4D0J1c1ZvbHRNYXhDb2xvcgc4Mzg4ODYzD0J1c1ZvbHRNaW5XaWR0aAExD0J1c1ZvbHRNYXhXaWR0aAEyEUJ1c1ZvbHRNaW5Wb2x0YWdlCDAuMDAwMDAwEUJ1c1ZvbHRNYXhWb2x0YWdlCDEuMDAwMDAwD0JyYW5jaFJhdGluZ1NldAExDFN3ZFJhdGluZ1NldAEwD1VzZVN3ZExvYWRDb2xvcgEwATABMA5NVVNUQW5ub3RhdGlvbgABNQtNVVNUT3B0aW9uMQExC01VU1RPcHRpb24yATILTVVTVE9wdGlvbjMBMwtNVVNUT3B0aW9uNAEwC01VU1RPcHRpb240ATEBMAEwDURZTkFubm90YXRpb24AATMHRFlOTW9kZQExCURZTlJlc3VsdAExCkRZTkNvbnRvdXIBMAEwATANUkVMQW5ub3RhdGlvbgACMTEHUkVMTW9kZQEwClJFTE91dE1vZGUBMQpSRUxCdXNNb2RlATAKUkVMQ250TGlzdAExCVJFTENudEJ1cwExCVJFTENudEJybgExCVJFTFByYkJ1cwExCVJFTFByYkJybgExCVJFTERldEJ1cwExCVJFTERldEJybgExB1JFTFZSZWMBMQEwATANQVNDQW5ub3RhdGlvbgACMTAFQW5ub3QBMARUeXBlATEIRmF1bHRCdXMJMTAwMDAwMDAwA0JvZQExB0NvbnRyaWIBMAdGcm9tQnVzCTEwMDAwMDAwMAVUb0J1cwkxMDAwMDAwMDAHTGFzdEJ1cwkxMDAwMDAwMDAHQnVzU2VjdAkxMDAwMDAwMDACSWQAATABMA1JRUNBbm5vdGF0aW9uAAIxMAVBbm5vdAEwBFR5cGUBMQhGYXVsdEJ1cwkxMDAwMDAwMDADQm9lATEHQ29udHJpYgEwB0Zyb21CdXMJMTAwMDAwMDAwBVRvQnVzCTEwMDAwMDAwMAdMYXN0QnVzCTEwMDAwMDAwMAdCdXNTZWN0CTEwMDAwMDAwMAJJZAABMAEwC0Fubm90YXRpb25zAAIxNAtSZXN1bHRzVHlwZQExCEhpZGVNb2RlATAIRGlhZ1ByZWMKMSAgMSAgMSAgMhBCcmFuY2hBbm5vdGF0aW9uBzYgIDAgIDEKRmxvd0RpcmVjdAEwB0J1c1ZvbHQENiAgNAVCdXNJZAEyCUVxdWlwbWVudAQwICAxDlBlcmNlbnRNVkFMaW5lATEVUGVyY2VudE1WQVRyYW5zZm9ybWVyATEKUmVwb3J0TVNMcwExEVJlcG9ydEJ1c1NlY3Rpb25zATEMQnVzSW1wZWRhbmNlATYPQnJhbmNoSW1wZWRhbmNlATYBMAEwAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAABbw97DL794QKAAAAAAkAEAAFAAAAAFQXJpYWwBAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAAAAAHgAAAAAAAOBRuL4/AAAAAP///wABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAQAAAAAAAEDhepQ/AAAAAA==';

function getDefaultPreamble(){
  const bin=atob(PSSE_365_PREAMBLE_B64);
  const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}

function findMainListStart(bytes){
  const idx=findAscii(bytes,'CSld');
  if(idx<8)throw new Error('Geçersiz PSS®E .sld CArchive: CSld sınıf başlangıcı bulunamadı.');
  return idx-8;
}

function encodeMapStruct(mapStr,isBusbar=false){
  const parts=(mapStr||'').trim().split(/\s+/);
  if(parts.length===0||!parts[0])return new Uint8Array(0);
  const buf=new Uint8Array(32);
  const dv=new DataView(buf.buffer);
  dv.setUint32(0,32,true);
  const code=parts[0].toUpperCase();
  const b1=parts[1]&&/^\d+$/.test(parts[1])?parseInt(parts[1],10):0;
  const b2=parts[2]&&/^\d+$/.test(parts[2])?parseInt(parts[2],10):0;
  const ckt=parts[3]?parts[3]:(parts[2]?parts[2]:'1');

  if(code==='BU'){
    dv.setUint32(4,1,true);dv.setUint32(12,b1,true);
    buf.set(encodeCp1254('    '),20);
  }else if(code==='TR'||code==='TX'){
    dv.setUint32(4,5,true);dv.setUint32(12,b1,true);dv.setUint32(16,b2,true);
    buf.set(encodeCp1254((ckt+'    ').slice(0,4)),20);
  }else if(code==='LI'||code==='LN'){
    dv.setUint32(4,9,true);dv.setUint32(12,b1,true);dv.setUint32(16,b2,true);
    buf.set(encodeCp1254((ckt+'    ').slice(0,4)),20);
  }else if(code==='ME'||code==='GE'){
    dv.setUint32(4,3,true);dv.setUint32(12,b1,true);
    buf.set(encodeCp1254((ckt+'    ').slice(0,4)),20);
  }else if(code==='LO'){
    dv.setUint32(4,2,true);dv.setUint32(12,b1,true);
    buf.set(encodeCp1254((ckt+'    ').slice(0,4)),20);
  }else{
    dv.setUint32(4,1,true);dv.setUint32(12,b1,true);
    buf.set(encodeCp1254('    '),20);
  }
  return buf;
}

function decodeMapStruct(mapRaw){
  if(mapRaw.length<20)return {map:'',stype:'Node',psse:'BusNode',sdef:0};
  const dv=new DataView(mapRaw.buffer,mapRaw.byteOffset,mapRaw.byteLength);
  const mtype=dv.getUint32(4,true),bus1=dv.getUint32(12,true),bus2=dv.getUint32(16,true);
  const bus3=mapRaw.length>=24?dv.getUint32(20,true):0;
  const ckt=decodeCp1254(mapRaw.subarray(20,Math.min(24,mapRaw.length))).trim()||'1';

  switch(mtype){
    case 1:return {map:bus1?`BU ${bus1}`:'',stype:'Busbar',psse:'Busbar',sdef:1};
    case 2:return {map:bus1?`LO ${bus1} ${ckt} `:'',stype:'Radial',psse:'Load',sdef:2};
    case 3:return {map:bus1?`ME ${bus1} ${ckt} `:'',stype:'Radial',psse:'Machine',sdef:4};
    case 4:
    case 6:return {map:bus1?`FXS ${bus1} ${ckt} `:'',stype:'Radial',psse:'FixedShunt',sdef:5};
    case 5:
    case 11:return {map:bus1&&bus2?`TR ${bus1} ${bus2}${bus3?' '+bus3:''} ${ckt} `:'',stype:'Branch',psse:bus3?'TWTransformer':'Transformer',sdef:bus3?11:10};
    case 7:
    case 13:return {map:bus1?`SWS ${bus1} ${ckt} `:'',stype:'Radial',psse:'SwitchedShunt',sdef:13};
    case 9:return {map:bus1&&bus2?`LI ${bus1} ${bus2} ${ckt} `:'',stype:'Branch',psse:'Branch',sdef:32};
    case 10:
    case 12:return {map:bus1&&bus2?`SYS ${bus1} ${bus2} ${ckt} `:'',stype:'Branch',psse:'SwitchingDev',sdef:3};
    default:return {map:bus1?`BU ${bus1}`:'',stype:'Busbar',psse:'Busbar',sdef:1};
  }
}

class SldArchiveReader {
  constructor(bytes,pos=0,isV51=true){
    this.bytes=bytes;
    this.dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    this.pos=pos;
    this.isV51=isV51;
    this.map=new Map();
    this.map.set(0,{type:'NULL',value:null});
    this.nextIdx=1;
  }
  u8(){return this.bytes[this.pos++];}
  u16(){const v=this.dv.getUint16(this.pos,true);this.pos+=2;return v;}
  u32(){const v=this.dv.getUint32(this.pos,true);this.pos+=4;return v;}
  f64(){const v=this.dv.getFloat64(this.pos,true);this.pos+=8;return v;}
  skip(n){const b=this.bytes.subarray(this.pos,this.pos+n);this.pos+=n;return b;}
  count(){const c=this.u16();return c===0xffff?this.u32():c;}
  cstringRaw(){
    const b=this.u8();let length=b;
    if(b===0xff){const w=this.u16();length=w===0xffff?this.u32():w;}
    const s=this.bytes.subarray(this.pos,this.pos+length);this.pos+=length;return s;
  }
  readObject(){
    const startPos=this.pos,w=this.u16();
    if(w===0)return null;
    const obTag=w===0x7fff?this.u32():w;
    if(w!==0xffff&&(w&0x8000)===0){
      const entry=this.map.get(obTag);
      if(!entry)throw new Error(`Invalid REF 0x${obTag.toString(16)} at pos ${startPos}`);
      return ['REF',obTag,entry.value];
    }
    let clsName;
    if(w===0xffff){
      this.u16();const nameLen=this.u16();
      clsName=decodeCp1254(this.bytes.subarray(this.pos,this.pos+nameLen));
      this.pos+=nameLen;
      const clsIdx=this.nextIdx++;
      this.map.set(clsIdx,{type:'CLASS',value:clsName});
    }else{
      const clsIdx=obTag&0x7fff,entry=this.map.get(clsIdx);
      if(!entry||entry.type!=='CLASS')throw new Error(`Invalid CLASS tag 0x${obTag.toString(16)} at pos ${startPos}`);
      clsName=entry.value;
    }
    const obIdx=this.nextIdx++,obj={_obIdx:obIdx,_class:clsName,_pos:startPos};
    this.map.set(obIdx,{type:'OBJ',value:obj});
    this.deserializeObj(clsName,obj);
    obj._end=this.pos;
    return ['NEW',obIdx,obj];
  }
  readObList(){
    const cnt=this.count(),items=[];
    for(let i=0;i<cnt;i++)items.push(this.readObject());
    return items;
  }
  deserializeCompBase(obj){
    obj.id=this.u32();obj.rot=this.f64();obj.layer=this.u32();obj.flag0=this.u8();
    obj.f1=this.u32();obj.f2=this.u32();obj.f3=this.u32();obj.color=this.u32();
    obj.comp_pre_map=this.skip(12);obj.map_raw=this.cstringRaw();
    const acnt=this.count();obj.comp_annots=[];
    for(let i=0;i<acnt;i++)obj.comp_annots.push(this.cstringRaw());
    obj.comp_post_map=this.skip(this.isV51?37:33);
    obj.x=this.f64();obj.y=this.f64();
    obj.comp_post_xy=this.skip(16);
    obj.labels=this.readObList();
  }
  deserializeSymbolBase(obj){
    this.deserializeCompBase(obj);obj.sdef=this.u32();obj.sym_flag=this.u32();
    obj.ports=this.readObList();
  }
  deserializeObj(clsName,obj){
    if(clsName==='CSldBusbar'){
      this.deserializeSymbolBase(obj);
      obj.bus_tail=this.skip(this.isV51?60:58);
    }else if(clsName==='CSldPointNode'||clsName==='CSldRadial'||clsName==='CSldBranch'||clsName==='CSldTwoWindingTransformer'||clsName==='CSldThreeWindingTransformer'){
      this.deserializeSymbolBase(obj);
      obj.sym_tail=this.skip(this.isV51?12:10);
    }else if(clsName==='CSldLabel'){
      this.deserializeCompBase(obj);
      obj.text=decodeCp1254(this.cstringRaw());
      obj.owner=this.readObject();
      obj.lbl_vis=this.u32();obj.lbl_bg=this.u32();obj.lbl_default_font=this.u32();
      obj.lbl_font_info=this.skip(36);
      obj.lbl_font_name=decodeCp1254(this.cstringRaw());
      obj.lbl_font_tail=this.skip(8);
    }else if(clsName==='CSldPort'){
      obj.owner=this.readObject();obj.link=this.readObject();
      obj.port_idx=this.u32();obj.dx=this.f64();obj.dy=this.f64();
      obj.port_tail=this.skip(16);
    }else if(clsName==='CSldLink'){
      this.deserializeCompBase(obj);
      obj.link_pre_knees=this.skip(66);
      obj.knees=this.readObList();
      obj.p1=this.readObject();obj.p2=this.readObject();
      obj.link_tail=this.skip(32);
    }else if(clsName==='CSldKneePoint'){
      this.deserializeCompBase(obj);
      obj.owner=this.readObject();
    }else if(clsName==='CSldLayer'){
      obj.layer_hdr=this.skip(20);
      obj.name=decodeCp1254(this.cstringRaw());
      obj.vis=this.u32();
      const numLists=this.isV51?22:21;
      obj.layer_lists=[];
      for(let i=0;i<numLists;i++)obj.layer_lists.push(this.readObList());
    }else if(clsName==='CSldGroup'){
      obj.name=decodeCp1254(this.cstringRaw());
      obj.items=this.readObList();
    }else if(clsName==='CSldSavedView'){
      obj.name=decodeCp1254(this.cstringRaw());
      obj.view_data=this.skip(78);
    }else{
      throw new Error(`Desteklenmeyen CArchive sınıfı: "${clsName}"`);
    }
  }
}

class SldArchiveWriter {
  constructor(isV51=true){
    this.chunks=[];this.totalLen=0;this.isV51=isV51;
    this.storeMap=new Map();this.classMap=new Map();this.nextIdx=1;
  }
  u8(v){this.chunks.push(new Uint8Array([v&0xff]));this.totalLen+=1;}
  u16(v){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,v&0xffff,true);this.chunks.push(b);this.totalLen+=2;}
  u32(v){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,v>>>0,true);this.chunks.push(b);this.totalLen+=4;}
  f64(v){const b=new Uint8Array(8);new DataView(b.buffer).setFloat64(0,Number(v),true);this.chunks.push(b);this.totalLen+=8;}
  bytes(b){if(b&&b.length>0){this.chunks.push(b);this.totalLen+=b.length;}}
  count(cnt){if(cnt<0xffff){this.u16(cnt);}else{this.u16(0xffff);this.u32(cnt);}}
  cstringRaw(raw){
    const len=raw.length;
    if(len<0xff){this.u8(len);}else if(len<0xffff){this.u8(0xff);this.u16(len);}else{this.u8(0xff);this.u16(0xffff);this.u32(len);}
    this.bytes(raw);
  }
  writeClass(clsName){
    if(!this.classMap.has(clsName)){
      const clsIdx=this.nextIdx++;
      this.classMap.set(clsName,clsIdx);
      this.u16(0xffff);this.u16(1);
      const bName=encodeCp1254(clsName);
      this.u16(bName.length);this.bytes(bName);
    }else{
      const clsIdx=this.classMap.get(clsName);
      this.u16(0x8000|(clsIdx&0x7fff));
    }
  }
  writeObject(obj){
    if(obj===null||obj===undefined){this.u16(0);return;}
    if(Array.isArray(obj)&&obj.length===3&&(obj[0]==='NEW'||obj[0]==='REF')){obj=obj[2];if(!obj){this.u16(0);return;}}
    if(this.storeMap.has(obj)){
      const obIdx=this.storeMap.get(obj);
      if(obIdx<0x7fff){this.u16(obIdx);}else{this.u16(0x7fff);this.u32(obIdx);}
      return;
    }
    const clsName=obj._class;
    this.writeClass(clsName);
    const obIdx=this.nextIdx++;
    this.storeMap.set(obj,obIdx);
    this.serializeObj(clsName,obj);
  }
  writeObList(items){
    this.count(items.length);
    for(let i=0;i<items.length;i++)this.writeObject(items[i]);
  }
  serializeCompBase(obj){
    this.u32(obj.id);this.f64(obj.rot??0.0);this.u32(obj.layer??4);this.u8(obj.flag0??0);
    this.u32(obj.f1??1);this.u32(obj.f2??1);this.u32(obj.f3??1);this.u32(obj.color??0);
    this.bytes(obj.comp_pre_map||new Uint8Array(12));
    this.cstringRaw(obj.map_raw||new Uint8Array(0));
    const annots=obj.comp_annots||[];
    this.count(annots.length);
    for(let i=0;i<annots.length;i++)this.cstringRaw(annots[i]);
    this.bytes(obj.comp_post_map||new Uint8Array(this.isV51?37:33));
    this.f64(obj.x??0.0);this.f64(obj.y??0.0);
    this.bytes(obj.comp_post_xy||new Uint8Array(16));
    this.writeObList(obj.labels||[]);
  }
  serializeSymbolBase(obj){
    this.serializeCompBase(obj);this.u32(obj.sdef??0);this.u32(obj.sym_flag??0);
    this.writeObList(obj.ports||[]);
  }
  serializeObj(clsName,obj){
    if(clsName==='CSldBusbar'){
      this.serializeSymbolBase(obj);this.bytes(obj.bus_tail||new Uint8Array(this.isV51?60:58));
    }else if(clsName==='CSldPointNode'||clsName==='CSldRadial'||clsName==='CSldBranch'||clsName==='CSldTwoWindingTransformer'||clsName==='CSldThreeWindingTransformer'){
      this.serializeSymbolBase(obj);this.bytes(obj.sym_tail||new Uint8Array(this.isV51?12:10));
    }else if(clsName==='CSldLabel'){
      this.serializeCompBase(obj);this.cstringRaw(encodeCp1254(obj.text||''));
      this.writeObject(obj.owner);
      this.u32(obj.lbl_vis??1);this.u32(obj.lbl_bg??16777215);this.u32(obj.lbl_default_font??0);
      this.bytes(obj.lbl_font_info||new Uint8Array(36));
      this.cstringRaw(encodeCp1254(obj.lbl_font_name||'Arial'));
      this.bytes(obj.lbl_font_tail||new Uint8Array(8));
    }else if(clsName==='CSldPort'){
      this.writeObject(obj.owner);this.writeObject(obj.link);
      this.u32(obj.port_idx??0);this.f64(obj.dx??0.0);this.f64(obj.dy??0.0);
      this.bytes(obj.port_tail||new Uint8Array(16));
    }else if(clsName==='CSldLink'){
      this.serializeCompBase(obj);this.bytes(obj.link_pre_knees||new Uint8Array(66));
      this.writeObList(obj.knees||[]);this.writeObject(obj.p1);this.writeObject(obj.p2);
      this.bytes(obj.link_tail||new Uint8Array(32));
    }else if(clsName==='CSldKneePoint'){
      this.serializeCompBase(obj);this.writeObject(obj.owner);
    }else if(clsName==='CSldLayer'){
      this.bytes(obj.layer_hdr||new Uint8Array(20));
      this.cstringRaw(encodeCp1254(obj.name||''));
      this.u32(obj.vis??1);
      const lists=obj.layer_lists||[];
      const numLists=this.isV51?22:21;
      for(let i=0;i<numLists;i++)this.writeObList(lists[i]||[]);
    }else if(clsName==='CSldGroup'){
      this.cstringRaw(encodeCp1254(obj.name||'Default'));
      this.writeObList(obj.items||[]);
    }else if(clsName==='CSldSavedView'){
      this.cstringRaw(encodeCp1254(obj.name||'Default'));
      this.bytes(obj.view_data||new Uint8Array(78));
    }else{
      throw new Error(`Bilinmeyen CArchive serileştirme sınıfı: "${clsName}"`);
    }
  }
  getBuffer(){
    const out=new Uint8Array(this.totalLen);let off=0;
    for(const ch of this.chunks){out.set(ch,off);off+=ch.length;}
    return out;
  }
}

async function parseSldBinary(bytes,fileName=''){
  const check=validateSldBinary(bytes);
  if(!check.valid)throw new Error(check.reason||'Geçersiz PSS®E .sld binary dosyası.');
  const isV51=check.version.startsWith('2.0.51.')||check.version.startsWith('2.0.50.');
  const startOff=findMainListStart(bytes);
  const reader=new SldArchiveReader(bytes,startOff,isV51);

  const rawMainList=reader.readObList();
  const u1=reader.u32();
  const rawLayers=reader.readObList();
  const u2=reader.u16();
  const rawGroups=reader.readObList();
  const rawViews=reader.readObList();

  const objs=[];
  reader.map.forEach(entry=>{if(entry.type==='OBJ')objs.push(entry.value);});

  const components=[];
  for(const o of objs){
    const clsName=o._class;
    if(clsName==='CSldBusbar'||clsName==='CSldPointNode'||clsName==='CSldRadial'||clsName==='CSldBranch'||clsName==='CSldTwoWindingTransformer'||clsName==='CSldThreeWindingTransformer'){
      const dec=decodeMapStruct(o.map_raw||new Uint8Array(0));
      let stype=dec.stype,blen,bwidth,ends;
      if(clsName==='CSldBusbar'){
        stype='Busbar';
        if(o.bus_tail&&o.bus_tail.length>=28){
          const dv=new DataView(o.bus_tail.buffer,o.bus_tail.byteOffset,o.bus_tail.byteLength);
          bwidth=Number(dv.getFloat64(12,true).toFixed(4));
          blen=Number(dv.getFloat64(20,true).toFixed(4));
        }else{bwidth=0.4;blen=16.0;}
        const bx=o.x,by=o.y,isHoriz=Math.abs((o.rot??0.0)%180)>45;
        ends=isHoriz
          ?[[Number((bx-blen/2).toFixed(6)),Number(by.toFixed(6))],[Number((bx+blen/2).toFixed(6)),Number(by.toFixed(6))]]
          :[[Number(bx.toFixed(6)),Number((by+blen/2).toFixed(6))],[Number(bx.toFixed(6)),Number((by-blen/2).toFixed(6))]];
      }
      const symComp={
        id:o.id,t:'Symbol',stype,psse:dec.psse,sdef:o.sdef??dec.sdef,
        layer:o.layer??4,color:o.color??0,map:dec.map,
        pos:[Number(o.x.toFixed(6)),Number(o.y.toFixed(6))],
        rot:Number((o.rot??0.0).toFixed(4))
      };
      if(blen!==undefined&&bwidth!==undefined&&ends){
        symComp.len=blen;symComp.width=bwidth;symComp.ends=ends;
      }
      symComp._rawObj=o;
      components.push(symComp);
    }
  }

  for(const o of objs){
    if(o._class==='CSldLink'){
      const p1Obj=o.p1?(Array.isArray(o.p1)?o.p1[2]:o.p1):null;
      const p2Obj=o.p2?(Array.isArray(o.p2)?o.p2[2]:o.p2):null;
      const s1Obj=p1Obj&&p1Obj.owner?(Array.isArray(p1Obj.owner)?p1Obj.owner[2]:p1Obj.owner):null;
      const s2Obj=p2Obj&&p2Obj.owner?(Array.isArray(p2Obj.owner)?p2Obj.owner[2]:p2Obj.owner):null;
      const p1Pos=s1Obj&&p1Obj?[Number((s1Obj.x+p1Obj.dx).toFixed(6)),Number((s1Obj.y+p1Obj.dy).toFixed(6))]:[0.0,0.0];
      const p2Pos=s2Obj&&p2Obj?[Number((s2Obj.x+p2Obj.dx).toFixed(6)),Number((s2Obj.y+p2Obj.dy).toFixed(6))]:[0.0,0.0];

      const knees=[],rawKnees=[],kList=o.knees||[];
      for(const kw of kList){
        const kp=Array.isArray(kw)?kw[2]:kw;
        if(kp){
          const kpos=[Number(kp.x.toFixed(6)),Number(kp.y.toFixed(6))];
          knees.push(kpos);
          rawKnees.push({id:kp.id,pos:kpos,binOffset:kp._pos||0});
        }
      }
      const linkComp={
        id:o.id,t:'Link',layer:o.layer??4,color:o.color??0,lwidth:1,
        p1:{sym:s1Obj?s1Obj.id:0,pos:p1Pos,idx:p1Obj?p1Obj.port_idx??0:0},
        p2:{sym:s2Obj?s2Obj.id:0,pos:p2Pos,idx:p2Obj?p2Obj.port_idx??0:0}
      };
      if(knees.length>0){linkComp.knees=knees;linkComp._rawKnees=rawKnees;}
      linkComp._rawObj=o;
      components.push(linkComp);
    }
  }

  for(const o of objs){
    if(o._class==='CSldLabel'){
      const ownerObj=o.owner?(Array.isArray(o.owner)?o.owner[2]:o.owner):null;
      components.push({
        id:o.id,t:'Label',layer:o.layer??4,color:o.color??0,
        pos:[Number(o.x.toFixed(6)),Number(o.y.toFixed(6))],
        rot:Number((o.rot??0.0).toFixed(4)),
        text:o.text||'',fh:9,owner:ownerObj?ownerObj.id:undefined,
        _rawObj:o
      });
    }
  }

  const docLayers=[];
  for(let idx=0;idx<layers.length;idx++){
    const lObj=Array.isArray(layers[idx])?layers[idx][2]:layers[idx];
    if(lObj)docLayers.push({n:idx,desc:lObj.name||`Layer ${idx}`,vis:lObj.vis===0?'Invisible':'Visible'});
  }

  return {format:'ga-sld-v1',fileVersion:check.version,layers:docLayers,components,rawBytes:bytes,_rawMainList:rawMainList,_rawLayers:rawLayers,_rawGroups:rawGroups,_rawViews:rawViews,_u1:u1,_u2:u2};
}

function serializeSldBinary(doc,targetVersion='2.0.51.1'){
  const isV51=!targetVersion.startsWith('2.0.49.');
  let preamble;
  if(doc.rawBytes&&doc.rawBytes.length>=512){
    const pEnd=findMainListStart(doc.rawBytes);
    preamble=doc.rawBytes.subarray(0,pEnd);
  }else{
    preamble=getDefaultPreamble();
  }

  if(doc._rawLayers&&doc._rawMainList){
    const compMap=new Map();
    for(const c of doc.components)compMap.set(c.id,c);

    for(const w of doc._rawMainList){
      const o=Array.isArray(w)?w[2]:w;
      if(!o)continue;
      const c=compMap.get(o.id);
      if(c){
        if(c.pos){o.x=c.pos[0];o.y=c.pos[1];}
        if(c.rot!==undefined)o.rot=c.rot;
        if(c.color!==undefined)o.color=c.color;
        if(c.t==='Link'){
          if(c.knees&&Array.isArray(c.knees)){
            const kList=[];
            for(let kidx=0;kidx<c.knees.length;kidx++){
              const kp=c.knees[kidx];
              const kneeId=90000+o.id*10+kidx;
              kList.push({
                _class:'CSldKneePoint',id:kneeId,rot:0.0,layer:o.layer??4,flag0:0,f1:1,f2:1,f3:0,color:o.color??0,
                comp_pre_map:new Uint8Array(12),map_raw:new Uint8Array(0),comp_annots:[],comp_post_map:new Uint8Array(isV51?37:33),
                x:kp[0],y:kp[1],comp_post_xy:new Uint8Array(16),labels:[],owner:o
              });
            }
            o.knees = kList;
          }
        }else if(c.t==='Label'&&c.text!==undefined){o.text=c.text;}
      }
    }

    const writer=new SldArchiveWriter(isV51);
    writer.writeObList(doc._rawMainList.map(w=>Array.isArray(w)?w[2]:w));
    writer.u32(doc._u1??1);
    writer.writeObList(doc._rawLayers.map(w=>Array.isArray(w)?w[2]:w));
    writer.u16(doc._u2??0);
    writer.writeObList(doc._rawGroups?doc._rawGroups.map(w=>Array.isArray(w)?w[2]:w):[]);
    writer.writeObList(doc._rawViews?doc._rawViews.map(w=>Array.isArray(w)?w[2]:w):[]);

    const bodyBytes=writer.getBuffer();
    const fullBytes=new Uint8Array(preamble.length+bodyBytes.length);
    fullBytes.set(preamble,0);
    fullBytes.set(bodyBytes,preamble.length);
    parseSldBinary(fullBytes);
    return fullBytes;
  }

  const symMap=new Map(),linkList=[],labelsByOwner=new Map(),portsBySym=new Map();
  for(const c of doc.components){
    if(c.t==='Symbol'){symMap.set(c.id,c);portsBySym.set(c.id,[]);
    }else if(c.t==='Link'){linkList.push(c);
    }else if(c.t==='Label'){
      const owner=c.owner??0,list=labelsByOwner.get(owner)??[];list.push(c);labelsByOwner.set(owner,list);
    }
  }

  const carchiveObjs=new Map();
  symMap.forEach((c,cid)=>{
    const stype=c.stype||'Busbar';
    const clsName=stype==='Busbar'?'CSldBusbar':(stype==='Node'?'CSldPointNode':(stype==='Radial'?'CSldRadial':'CSldBranch'));
    const mapRaw=encodeMapStruct(c.map||'',stype==='Busbar');
    const pos=c.pos||[0.0,0.0],blen=c.len??16.0,bwidth=c.width??0.4,color=c.color??0xff0000,layer=c.layer??4,rot=c.rot??0.0;
    const busTail=new Uint8Array(isV51?60:58),busDv=new DataView(busTail.buffer);
    busDv.setUint32(0,1,true);busDv.setUint32(4,color,true);
    busDv.setFloat64(12,bwidth,true);busDv.setFloat64(20,blen,true);
    busDv.setFloat32(28,1.0,true);busDv.setFloat32(32,1.0,true);busDv.setInt32(36,-1,true);
    busDv.setUint16(40,2,true);busDv.setUint16(42,2,true);busDv.setUint16(44,1,true);busDv.setUint16(46,1,true);

    const obj={
      _class:clsName,id:cid,rot,layer,flag0:0,f1:1,f2:1,f3:1,color,
      comp_pre_map:new Uint8Array(12),map_raw:mapRaw,comp_annots:[],
      comp_post_map:new Uint8Array(isV51?37:33),x:pos[0],y:pos[1],comp_post_xy:new Uint8Array(16),
      labels:[],sdef:c.sdef??(stype==='Busbar'?1:0),sym_flag:0,ports:[],
      bus_tail:busTail,sym_tail:new Uint8Array(isV51?12:10)
    };
    carchiveObjs.set(cid,obj);
  });

  for(const l of linkList){
    const lid=l.id,p1Info=l.p1||{},p2Info=l.p2||{},s1Id=p1Info.sym,s2Id=p2Info.sym;
    const s1Obj=carchiveObjs.get(s1Id),s2Obj=carchiveObjs.get(s2Id);
    const p1Pos=p1Info.pos||(s1Obj?[s1Obj.x,s1Obj.y]:[0.0,0.0]);
    const p2Pos=p2Info.pos||(s2Obj?[s2Obj.x,s2Obj.y]:[0.0,0.0]);
    const color=l.color??0x00ff00,layer=l.layer??4;

    const linkPreKnees=new Uint8Array(66);
    linkPreKnees[0]=0xcd;linkPreKnees[1]=0xcc;linkPreKnees[2]=0x4c;linkPreKnees[3]=0x3d;
    linkPreKnees[4]=0xff;linkPreKnees[5]=0xff;linkPreKnees[6]=0xff;linkPreKnees[7]=0xff;
    linkPreKnees[16]=0x01;linkPreKnees[46]=0xff;linkPreKnees[47]=0xff;linkPreKnees[48]=0xff;linkPreKnees[49]=0xff;
    linkPreKnees[58]=0xe0;linkPreKnees[59]=0x51;linkPreKnees[60]=0xb8;linkPreKnees[61]=0xbe;linkPreKnees[62]=0x3f;

    const linkTail=new Uint8Array(32);linkTail[1]=0x01;
    const linkObj={
      _class:'CSldLink',id:lid,rot:0.0,layer,flag0:0,f1:1,f2:1,f3:0,color,
      comp_pre_map:new Uint8Array(12),map_raw:new Uint8Array(0),comp_annots:[],
      comp_post_map:new Uint8Array(isV51?37:33),x:0.0,y:0.0,comp_post_xy:new Uint8Array(16),
      labels:[],link_pre_knees:linkPreKnees,knees:[],p1:null,p2:null,link_tail:linkTail
    };
    carchiveObjs.set(lid,linkObj);

    const knees=l.knees||[];
    for(let kidx=0;kidx<knees.length;kidx++){
      const kp=knees[kidx],kneeId=90000+lid*10+kidx;
      const kObj={
        _class:'CSldKneePoint',id:kneeId,rot:0.0,layer,flag0:0,f1:1,f2:1,f3:0,color,
        comp_pre_map:new Uint8Array(12),map_raw:new Uint8Array(0),comp_annots:[],
        comp_post_map:new Uint8Array(isV51?37:33),x:kp[0],y:kp[1],comp_post_xy:new Uint8Array(16),
        labels:[],owner:linkObj
      };
      linkObj.knees.push(kObj);
    }

    const dx1=s1Obj?p1Pos[0]-s1Obj.x:0.0,dy1=s1Obj?p1Pos[1]-s1Obj.y:0.0;
    const port1={_class:'CSldPort',owner:s1Obj,link:linkObj,port_idx:p1Info.idx??(portsBySym.get(s1Id)?.length??0),dx:dx1,dy:dy1,port_tail:new Uint8Array(16)};
    linkObj.p1=port1;if(s1Obj)portsBySym.get(s1Id).push(port1);

    const dx2=s2Obj?p2Pos[0]-s2Obj.x:0.0,dy2=s2Obj?p2Pos[1]-s2Obj.y:0.0;
    const port2={_class:'CSldPort',owner:s2Obj,link:linkObj,port_idx:p2Info.idx??(portsBySym.get(s2Id)?.length??0),dx:dx2,dy:dy2,port_tail:new Uint8Array(16)};
    linkObj.p2=port2;if(s2Obj)portsBySym.get(s2Id).push(port2);
  }

  carchiveObjs.forEach((sObj,sid)=>{
    if(sObj._class==='CSldBusbar'||sObj._class==='CSldPointNode'||sObj._class==='CSldRadial'||sObj._class==='CSldBranch'){
      sObj.ports=portsBySym.get(sid)||[];
    }
  });

  labelsByOwner.forEach((lblList,ownerId)=>{
    const ownerObj=carchiveObjs.get(ownerId);if(!ownerObj)return;
    for(const l of lblList){
      const pos=l.pos||[ownerObj.x,ownerObj.y];
      const fontInfo=new Uint8Array(36),fontDv=new DataView(fontInfo.buffer);
      fontDv.setInt32(0,9,true);fontDv.setInt32(16,400,true);
      const lblObj={
        _class:'CSldLabel',id:l.id,rot:l.rot??0.0,layer:l.layer??(ownerObj.layer??4),
        flag0:0,f1:1,f2:1,f3:1,color:l.color??0xffffff,
        comp_pre_map:new Uint8Array(12),map_raw:new Uint8Array(0),comp_annots:[],
        comp_post_map:new Uint8Array(isV51?37:33),x:pos[0],y:pos[1],comp_post_xy:new Uint8Array(16),
        labels:[],text:l.text||'',owner:ownerObj,lbl_vis:1,lbl_bg:0xffffff,lbl_default_font:0,
        lbl_font_info:fontInfo,lbl_font_name:'Arial',lbl_font_tail:new Uint8Array(8)
      };
      ownerObj.labels.push(lblObj);
    }
  });

  const mainList=[];
  for(const c of doc.components){
    const cid=c.id;
    if(carchiveObjs.has(cid)){
      const o=carchiveObjs.get(cid);
      mainList.push(o);
      if(o.labels)for(const lbl of o.labels)mainList.push(lbl);
      if(o.knees)for(const kp of o.knees)mainList.push(kp);
    }
  }

  const layerNames=[
    'Background','Foreground','BaseVoltage 154,0','BaseVoltage 380,0','BaseVoltage 400,0',
    'BaseVoltage 220,0','BaseVoltage 66,0','BaseVoltage 33,0','BaseVoltage 31,5',
    'BaseVoltage 15,8','BaseVoltage 10,6','BaseVoltage 10,5','BaseVoltage 6,3',
    'BaseVoltage 3,3','BaseVoltage 0,4','User Layer 1','User Layer 2','User Layer 3','User Layer 4'
  ];
  const activeNames=isV51?layerNames:layerNames.slice(0,12),layers=[];
  for(let lIdx=0;lIdx<activeNames.length;lIdx++){
    const layerHdr=new Uint8Array([0x00,0x00,0x00,0x00,0x7b,0x14,0xae,0x47,0xe1,0x7a,0x84,0x3f,0x00,0x00,0x00,0x00,0x00,0x00,0x59,0x40]);
    layers.push({_class:'CSldLayer',layer_hdr:layerHdr,name:activeNames[lIdx],vis:1,layer_lists:Array.from({length:isV51?22:21},()=>[])});
  }

  const groups=[{_class:'CSldGroup',name:'Default',items:[]}];
  const viewData=new Uint8Array(78),viewDv=new DataView(viewData.buffer);
  viewDv.setFloat64(0,-25.0,true);viewDv.setFloat64(8,-25.0,true);viewDv.setFloat64(16,25.0,true);viewDv.setFloat64(24,25.0,true);
  const views=[{_class:'CSldSavedView',name:'Default',view_data:viewData}];

  const writer=new SldArchiveWriter(isV51);
  writer.writeObList(mainList);
  writer.u32(1);
  writer.writeObList(layers);
  writer.u16(0);
  writer.writeObList(groups);
  writer.writeObList(views);

  const bodyBytes=writer.getBuffer();
  const fullBytes=new Uint8Array(preamble.length+bodyBytes.length);
  fullBytes.set(preamble,0);
  fullBytes.set(bodyBytes,preamble.length);

  return fullBytes;
}

function patchSldBinary(baseBytes,doc){
  const check=validateSldBinary(baseBytes);
  if(!check.valid)throw new Error(check.reason||'Geçersiz temel .sld binary dosyası.');
  const targetVer=check.version||'2.0.51.1';
  const docWithBytes={...doc,rawBytes:baseBytes};
  return serializeSldBinary(docWithBytes,targetVer);
}

/* Part 2: Symbol -> Port -> Link -> KneePoint Geometry & PSS(R)E-like SVG Renderer */
function isBusbarHorizontal(sym){
  if(!sym)return true;
  if(sym.ends&&sym.ends.length===2&&sym.ends[0]&&sym.ends[1]){
    return Math.abs(sym.ends[1][0]-sym.ends[0][0])>=Math.abs(sym.ends[1][1]-sym.ends[0][1]);
  }
  return Math.abs((Number(sym.rot)||0)%180)>45;
}

function recomputeBusbarEnds(sym){
  if(!sym||sym.stype!=='Busbar'||!sym.pos)return;
  const [cx,cy]=sym.pos,len=Math.max(0.4,Number(sym.len)||2.0),half=len/2;
  const horiz=Math.abs((Number(sym.rot)||0)%180)>45;
  sym.ends=horiz
    ?[[Number((cx-half).toFixed(4)),Number(cy.toFixed(4))],[Number((cx+half).toFixed(4)),Number(cy.toFixed(4))]]
    :[[Number(cx.toFixed(4)),Number((cy+half).toFixed(4))],[Number(cx.toFixed(4)),Number((cy-half).toFixed(4))]];
}

function computeBusbarPortRatio(busSym,pt){
  if(!busSym||!busSym.pos||!pt)return 0;
  const len=Math.max(0.4,Number(busSym.len)||2.0);
  const horiz=isBusbarHorizontal(busSym);
  const delta=horiz?(pt[0]-busSym.pos[0]):(pt[1]-busSym.pos[1]);
  return Math.max(-0.48,Math.min(0.48,Number((delta/len).toFixed(4))));
}

function getPortWorldPos(sym,portSpec){
  if(!sym||!sym.pos)return portSpec?.pos?[...portSpec.pos]:[0,0];
  const [sx,sy]=sym.pos;
  if(sym.stype==='Busbar'){
    const len=Math.max(0.4,Number(sym.len)||2.0);
    const ratio=portSpec?.offsetRatio!==undefined?Number(portSpec.offsetRatio):computeBusbarPortRatio(sym,portSpec?.pos);
    if(portSpec)portSpec.offsetRatio=ratio;
    const horiz=isBusbarHorizontal(sym);
    return horiz
      ?[Number((sx+ratio*len).toFixed(4)),Number(sy.toFixed(4))]
      :[Number(sx.toFixed(4)),Number((sy+ratio*len).toFixed(4))];
  }
  if(sym.stype==='Branch'){
    const idx=Number(portSpec?.idx??0);
    const rotRad=((Number(sym.rot)||0)*Math.PI)/180;
    const step=0.18;
    if(sym.psse==='TWTransformer'&&idx===2){
      return [Number((sx+Math.cos(rotRad)*step).toFixed(4)),Number((sy-Math.sin(rotRad)*step).toFixed(4))];
    }
    const sign=idx===0?1:-1;
    const dx=Math.sin(rotRad)*step*sign,dy=Math.cos(rotRad)*step*sign;
    return [Number((sx+dx).toFixed(4)),Number((sy+dy).toFixed(4))];
  }
  return [Number(sx.toFixed(4)),Number(sy.toFixed(4))];
}

function ensureLinkPortAttachments(gaSld){
  if(!gaSld||!Array.isArray(gaSld.components))return;
  const symMap=new Map();
  for(const c of gaSld.components)if(c.t==='Symbol')symMap.set(c.id,c);
  for(const c of gaSld.components){
    if(c.t!=='Link')continue;
    for(const side of [c.p1,c.p2]){
      if(!side||side.sym===undefined)continue;
      const sym=symMap.get(side.sym);
      if(!sym)continue;
      if(sym.stype==='Busbar'&&side.offsetRatio===undefined){
        side.offsetRatio=computeBusbarPortRatio(sym,side.pos||sym.pos);
      }
      if(!side.pos)side.pos=getPortWorldPos(sym,side);
    }
  }
}

function buildOrthogonalKnees(p1Pos,p2Pos,busSym,otherSym){
  const [x1,y1]=p1Pos,[x2,y2]=p2Pos;
  if(Math.abs(x1-x2)<0.04||Math.abs(y1-y2)<0.04)return [];
  const busHoriz=busSym&&busSym.stype==='Busbar'?isBusbarHorizontal(busSym):null;
  if(busHoriz===true){
    // Exit horizontally-oriented busbar vertically (perpendicular 90°)
    const midY=Number(((y1+y2)/2).toFixed(4));
    if(otherSym&&otherSym.stype==='Busbar'&&isBusbarHorizontal(otherSym)){
      return [[Number(x1.toFixed(4)),midY],[Number(x2.toFixed(4)),midY]];
    }
    return [[Number(x1.toFixed(4)),Number(y2.toFixed(4))]];
  }
  if(busHoriz===false){
    // Exit vertically-oriented busbar horizontally (perpendicular 90°)
    const midX=Number(((x1+x2)/2).toFixed(4));
    if(otherSym&&otherSym.stype==='Busbar'&&!isBusbarHorizontal(otherSym)){
      return [[midX,Number(y1.toFixed(4))],[midX,Number(y2.toFixed(4))]];
    }
    return [[Number(x2.toFixed(4)),Number(y1.toFixed(4))]];
  }
  return [[Number(x1.toFixed(4)),Number(y2.toFixed(4))]];
}

function updateLinkGeometryForMovedSymbol(lk,movedSymId,dx,dy,symMap,orthogonal){
  const s1=lk.p1?.sym!==undefined?symMap.get(lk.p1.sym):null;
  const s2=lk.p2?.sym!==undefined?symMap.get(lk.p2.sym):null;
  const oldP1=lk.p1?.pos?[...lk.p1.pos]:[0,0];
  const oldP2=lk.p2?.pos?[...lk.p2.pos]:[0,0];
  const moved1=lk.p1?.sym===movedSymId,moved2=lk.p2?.sym===movedSymId;
  if(moved1&&s1)lk.p1.pos=getPortWorldPos(s1,lk.p1);
  if(moved2&&s2)lk.p2.pos=getPortWorldPos(s2,lk.p2);
  if(!lk.p1?.pos||!lk.p2?.pos)return;

  if(moved1&&moved2){
    if(Array.isArray(lk.knees)){
      lk.knees=lk.knees.map(k=>[Number((k[0]+dx).toFixed(4)),Number((k[1]+dy).toFixed(4))]);
    }
    return;
  }
  if(!Array.isArray(lk.knees)||lk.knees.length===0){
    if(orthogonal){
      lk.knees=buildOrthogonalKnees(lk.p1.pos,lk.p2.pos,s1||s2,s2||s1);
    }
    return;
  }
  // Preserve orthogonal alignment of first/last knee with its attached endpoint
  if(moved1&&lk.knees.length>=1){
    const k0=lk.knees[0];
    const wasVert=Math.abs(oldP1[0]-k0[0])<0.08;
    const wasHoriz=Math.abs(oldP1[1]-k0[1])<0.08;
    if(wasVert)k0[0]=Number(lk.p1.pos[0].toFixed(4));
    else if(wasHoriz)k0[1]=Number(lk.p1.pos[1].toFixed(4));
    else if(orthogonal){
      lk.knees=buildOrthogonalKnees(lk.p1.pos,lk.p2.pos,s1,s2);
      return;
    }
  }
  if(moved2&&lk.knees.length>=1){
    const kLast=lk.knees[lk.knees.length-1];
    const wasVert=Math.abs(oldP2[0]-kLast[0])<0.08;
    const wasHoriz=Math.abs(oldP2[1]-kLast[1])<0.08;
    if(wasVert)kLast[0]=Number(lk.p2.pos[0].toFixed(4));
    else if(wasHoriz)kLast[1]=Number(lk.p2.pos[1].toFixed(4));
    else if(orthogonal){
      lk.knees=buildOrthogonalKnees(lk.p1.pos,lk.p2.pos,s1,s2);
    }
  }
}

function translateGaSldSymbol(sym,dx,dy,gaDoc=state.doc?.gaSld){
  if(!sym||!sym.pos||!gaDoc)return;
  sym.pos=[Number((sym.pos[0]+dx).toFixed(4)),Number((sym.pos[1]+dy).toFixed(4))];
  if(sym.stype==='Busbar')recomputeBusbarEnds(sym);
  else if(sym.ends&&sym.ends.length===2){
    sym.ends=[
      [Number((sym.ends[0][0]+dx).toFixed(4)),Number((sym.ends[0][1]+dy).toFixed(4))],
      [Number((sym.ends[1][0]+dx).toFixed(4)),Number((sym.ends[1][1]+dy).toFixed(4))]
    ];
  }
  const symMap=new Map();
  for(const c of gaDoc.components)if(c.t==='Symbol')symMap.set(c.id,c);
  const ortho=Boolean(activeSettings()?.layout?.orthogonalLinks);
  for(const c of gaDoc.components){
    if(c.t==='Label'&&c.owner===sym.id&&c.pos){
      c.pos=[Number((c.pos[0]+dx).toFixed(4)),Number((c.pos[1]+dy).toFixed(4))];
    }else if(c.t==='Link'&&(c.p1?.sym===sym.id||c.p2?.sym===sym.id)){
      updateLinkGeometryForMovedSymbol(c,sym.id,dx,dy,symMap,ortho);
    }
  }
}

function resizeOrRotateBusbar(busSym,newLen,newWid,newRot,gaDoc=state.doc?.gaSld){
  if(!busSym||busSym.stype!=='Busbar'||!gaDoc)return;
  if(newLen!==undefined)busSym.len=Math.max(0.4,Number(newLen)||2.0);
  if(newWid!==undefined)busSym.width=Math.max(0.02,Number(newWid)||0.05);
  if(newRot!==undefined)busSym.rot=Number(newRot)||0;
  recomputeBusbarEnds(busSym);
  const symMap=new Map();
  for(const c of gaDoc.components)if(c.t==='Symbol')symMap.set(c.id,c);
  const ortho=Boolean(activeSettings()?.layout?.orthogonalLinks);
  for(const c of gaDoc.components){
    if(c.t==='Link'&&(c.p1?.sym===busSym.id||c.p2?.sym===busSym.id)){
      if(c.p1?.sym===busSym.id)c.p1.pos=getPortWorldPos(busSym,c.p1);
      if(c.p2?.sym===busSym.id)c.p2.pos=getPortWorldPos(busSym,c.p2);
      if(ortho&&c.p1?.pos&&c.p2?.pos){
        const s1=symMap.get(c.p1.sym),s2=symMap.get(c.p2.sym);
        c.knees=buildOrthogonalKnees(c.p1.pos,c.p2.pos,s1,s2);
      }
    }
  }
}

function kvColor(kv,cfg=activeSettings()?.coloring){
  const c=cfg||defaultDiagramSettings().coloring;
  return kv>=300?c.kv400:kv>=180?c.kv220:kv>=100?c.kv154:kv>36?c.kv66:c.kvLow;
}

function layerColor(layerNum,layers=[],cfg=activeSettings()?.coloring){
  const c=cfg||defaultDiagramSettings().coloring;
  const l=layers.find(x=>Number(x.n)===Number(layerNum));
  const d=(l?.desc||'').toLowerCase();
  if(d.includes('400')||d.includes('380'))return c.kv400;
  if(d.includes('220'))return c.kv220;
  if(d.includes('154'))return c.kv154;
  if(d.includes('66')||d.includes('33')||d.includes('31')||d.includes('15'))return c.kv66;
  return '#8ab8df';
}

function matchSavEquipment(mapStr){
  if(!mapStr)return null;
  const n=network(),m=model();if(!n)return null;
  const parts=String(mapStr).trim().split(/\s+/);
  const kind=parts[0],b1=parts[1],b2=parts[2],ckt=(parts[3]||'1').trim();
  if(kind==='BU'&&b1){
    const bus=n.buses.find(b=>String(b.externalNumber)===b1||b.connectionKey===b1||b.id===`bus:${b1}`);
    if(bus)return {type:'bus',bus,id:bus.id,sourceEquipmentId:bus.sourceEquipmentId};
  }else if((kind==='LI'||kind==='TR'||kind==='SYS')&&b1&&b2){
    const br=n.branches.find(b=>{
      const f=String(n.buses[b.from]?.externalNumber??b.terminalFrom),t=String(n.buses[b.to]?.externalNumber??b.terminalTo);
      const matchEnds=(f===b1&&t===b2)||(f===b2&&t===b1);
      return matchEnds&&(String(b.windingId||'1').trim()===ckt||!parts[3]);
    });
    if(br)return {type:'branch',branch:br,id:br.id,sourceEquipmentId:br.sourceEquipmentId};
  }else if(kind==='ME'&&b1){
    const gen=(n.generators||[]).find(g=>String(n.buses[g.bus]?.externalNumber)===b1);
    if(gen)return {type:'generator',generator:gen,id:gen.id,sourceEquipmentId:gen.sourceEquipmentId};
  }else if(kind==='LO'&&b1){
    const ld=(n.loads||[]).find(l=>String(n.buses[l.bus]?.externalNumber)===b1);
    if(ld)return {type:'load',load:ld,id:ld.id,sourceEquipmentId:ld.sourceEquipmentId};
  }else if((kind==='FXS'||kind==='SWS')&&b1){
    const sh=(n.shunts||[]).find(s=>String(n.buses[s.bus]?.externalNumber)===b1);
    if(sh)return {type:'shunt',shunt:sh,id:sh.id,sourceEquipmentId:sh.sourceEquipmentId};
  }
  if(m){
    const eq=m.equipment.find(e=>String(e.fields?.ibus)===b1||(String(e.fields?.i)===b1&&String(e.fields?.j)===b2));
    if(eq)return {type:eq.kind,equipment:eq,id:eq.id,sourceEquipmentId:eq.id};
  }
  return null;
}

function getCalculationResults(cfg=activeSettings()){
  const c=controller(),calc=c?.psseCalculation,sc=c?.psseScenario;
  const useCalc=cfg?.coloring?.resultLayer==='GA_PSSE_CALCULATED';
  const valid=Boolean(calc&&calc.status==='CONVERGED'&&calc.scenarioHash===sc?.hash);
  return {
    valid:useCalc?valid:Boolean(valid),
    useCalc,
    calc,
    busMap:new Map((valid?calc.busResults:[]).map(r=>[String(r.connectionKey),r])),
    branchMap:new Map((valid?calc.branchResults:[]).map(r=>[r.id,r])),
    scenarioOps:new Map((sc?.operations||[]).map(o=>[o.equipmentId,o.value]))
  };
}

function buildPathWithCrossings(pts,horizSegments){
  // Adds small bridge arc jumps when a vertical segment crosses an existing horizontal segment from another link
  let d=`M ${pts[0][0]} ${pts[0][1]}`;
  for(let i=0;i<pts.length-1;i++){
    const [x1,y1]=pts[i],[x2,y2]=pts[i+1];
    if(Math.abs(x1-x2)<0.5&&Math.abs(y2-y1)>14&&horizSegments.length>0){
      const minY=Math.min(y1,y2)+6,maxY=Math.max(y1,y2)-6,dir=y2>y1?1:-1;
      const hits=[];
      for(const hs of horizSegments){
        if(hs.y>minY&&hs.y<maxY&&x1>hs.x1+6&&x1<hs.x2-6){
          hits.push(hs.y);
        }
      }
      hits.sort((a,b)=>dir>0?a-b:b-a);
      let curY=y1;
      for(const hy of hits){
        if(Math.abs(hy-curY)<9)continue;
        const r=4.2*dir;
        d+=` L ${x1} ${(hy-r).toFixed(1)} A 4.2 4.2 0 0 ${dir>0?1:0} ${x1} ${(hy+r).toFixed(1)}`;
        curY=hy+r;
      }
    }
    d+=` L ${x2} ${y2}`;
  }
  return d;
}

function renderGaSldToSvg(gaSld,customSettings=null){
  ensureLinkPortAttachments(gaSld);
  const cfg=customSettings||activeSettings()||defaultDiagramSettings();
  const ann=cfg.annotations,col=cfg.coloring,lay=cfg.layout,adv=cfg.advanced;
  const dec=Number(ann.decimals??1);
  const comps=gaSld.components||[],layers=gaSld.layers||[];
  const symMap=new Map();
  for(const c of comps)if(c.t==='Symbol')symMap.set(c.id,c);

  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const touch=(x,y)=>{if(!Number.isFinite(x)||!Number.isFinite(y))return;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;};
  for(const c of comps){
    if(c.pos)touch(c.pos[0]*SLD_SCALE,-c.pos[1]*SLD_SCALE);
    if(c.ends)for(const e of c.ends)if(e)touch(e[0]*SLD_SCALE,-e[1]*SLD_SCALE);
    if(c.p1?.pos)touch(c.p1.pos[0]*SLD_SCALE,-c.p1.pos[1]*SLD_SCALE);
    if(c.p2?.pos)touch(c.p2.pos[0]*SLD_SCALE,-c.p2.pos[1]*SLD_SCALE);
    if(c.knees)for(const k of c.knees)if(k)touch(k[0]*SLD_SCALE,-k[1]*SLD_SCALE);
  }
  if(!Number.isFinite(minX)){minX=-500;minY=-350;maxX=500;maxY=350;}
  const pad=75,vbX=Math.round(minX-pad),vbY=Math.round(minY-pad),vbW=Math.max(400,Math.round(maxX-minX+pad*2)),vbH=Math.max(300,Math.round(maxY-minY+pad*2));
  const svg=S('svg',{
    xmlns:NS,
    viewBox:`${vbX} ${vbY} ${vbW} ${vbH}`,
    class:'ga-studio-drawing ga-studio-native-sld',
    'shape-rendering':adv.antiAliasing?'geometricPrecision':'crispEdges',
    'data-sld-version':gaSld.fileVersion||'2.0.51.1'
  });
  svg.append(S('rect',{x:vbX-vbW*2,y:vbY-vbH*2,width:vbW*5,height:vbH*5,fill:adv.bgColor||'#0d1e2e','data-bg':'1'}));

  const layerGroups=new Map();
  const getLayerGroup=(n)=>{
    const ln=Number.isFinite(Number(n))?Number(n):1;
    if(!layerGroups.has(ln)){
      const lmeta=layers.find(x=>Number(x.n)===ln);
      const g=S('g',{'class':'ga-sld-layer-group','data-sld-layer':ln,'data-layer-desc':lmeta?.desc||`Layer ${ln}`});
      if(lmeta?.vis==='Hidden')g.style.display='none';
      svg.append(g);
      layerGroups.set(ln,g);
    }
    return layerGroups.get(ln);
  };
  for(const l of layers)getLayerGroup(l.n);

  const {valid,busMap,branchMap,scenarioOps}=getCalculationResults(cfg);
  const eqRows=sourceRows();

  // Collect horizontal link segments for crossing jumper arcs
  const horizSegments=[];

  // 1) Render Links first (under symbols)
  for(const c of comps){
    if(c.t!=='Link'||!c.p1?.pos||!c.p2?.pos)continue;
    const lg=getLayerGroup(c.layer??2);
    const pts=[c.p1.pos,...(c.knees||[]),c.p2.pos].map(p=>[Number((p[0]*SLD_SCALE).toFixed(2)),Number((-p[1]*SLD_SCALE).toFixed(2))]);
    const d=buildPathWithCrossings(pts,horizSegments);
    for(let i=0;i<pts.length-1;i++){
      if(Math.abs(pts[i][1]-pts[i+1][1])<0.5&&Math.abs(pts[i][0]-pts[i+1][0])>12){
        horizSegments.push({y:pts[i][1],x1:Math.min(pts[i][0],pts[i+1][0]),x2:Math.max(pts[i][0],pts[i+1][0])});
      }
    }
    const s1=symMap.get(c.p1.sym),s2=symMap.get(c.p2.sym);
    const ownerSym=(s1?.stype==='Branch'||s1?.stype==='Radial')?s1:((s2?.stype==='Branch'||s2?.stype==='Radial')?s2:(s1||s2));
    const match=ownerSym?matchSavEquipment(ownerSym.map):null;
    let stroke=bgrToHex(c.color,layerColor(c.layer,layers,col));
    if(col.colorMode==='voltage'){
      const bSym=s1?.stype==='Busbar'?s1:(s2?.stype==='Busbar'?s2:null);
      const bMatch=bSym?matchSavEquipment(bSym.map):null;
      if(bMatch?.bus?.baseKv)stroke=kvColor(bMatch.bus.baseKv,col);
      else if(match?.branch){
        const fBus=network()?.buses?.[match.branch.from];
        if(fBus?.baseKv)stroke=kvColor(fBus.baseKv,col);
      }else stroke=layerColor(c.layer,layers,col);
    }else if(col.colorMode==='loading'&&valid&&match?.branch){
      const r=branchMap.get(match.branch.id);
      if(r){
        const pct=Math.max(nval(r.loadingFromPct,0),nval(r.loadingToPct,0));
        stroke=pct>=100?'#ee5d63':pct>=80?'#f7b24f':'#49ba8f';
      }
    }
    if(col.highlightUnbound&&ownerSym&&!match&&network()?.buses?.length){
      stroke=col.unboundColor||'#7f93a8';
    }
    const isOut=match?.branch?.status===0||(match?.sourceEquipmentId&&scenarioOps.get(match.sourceEquipmentId)===0);
    const sw=Math.max(1.1,Math.min(5.5,(c.lwidth||0.02)*SLD_SCALE*0.8*(adv.lineWidthScale||1)));
    const g=S('g',{
      class:'ga-studio-sld-link',
      'data-sld-id':c.id,
      'data-sld-type':'Link',
      'data-sld-layer':c.layer??2,
      'data-p1-sym':c.p1?.sym??'',
      'data-p2-sym':c.p2?.sym??'',
      'data-ga-node':`link:${c.id}`
    });
    const path=S('path',{d,fill:'none',stroke,'stroke-width':sw.toFixed(2),class:'ga-sld-line'});
    if((c.lstyle&&c.lstyle>0)||(isOut&&col.dashedOutOfService))path.setAttribute('stroke-dasharray','5 3');
    g.append(path);

    // Optional directional flow arrow at midpoint of longest segment
    if(lay.showFlowArrows&&ann.flowDirectionMode!=='hide'&&pts.length>=2){
      let bestLen=0,mx=0,my=0,ang=0;
      for(let i=0;i<pts.length-1;i++){
        const dx=pts[i+1][0]-pts[i][0],dy=pts[i+1][1]-pts[i][1],segL=Math.hypot(dx,dy);
        if(segL>bestLen){bestLen=segL;mx=(pts[i][0]+pts[i+1][0])/2;my=(pts[i][1]+pts[i+1][1])/2;ang=(Math.atan2(dy,dx)*180)/Math.PI;}
      }
      if(bestLen>28){
        g.append(S('path',{d:'M -4 -2.8 L 4 0 L -4 2.8 Z',fill:stroke,opacity:'.82',transform:`translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${ang.toFixed(1)})`}));
      }
    }

    const kr=Number(adv.kneeSize||4.0);
    (c.knees||[]).forEach((kp,idx)=>{
      const kx=Number((kp[0]*SLD_SCALE).toFixed(2)),ky=Number((-kp[1]*SLD_SCALE).toFixed(2));
      g.append(S('circle',{cx:kx,cy:ky,r:kr,class:'ga-studio-knee','data-link-id':c.id,'data-knee-idx':idx}));
    });
    lg.append(g);
  }

  // 2) Render Symbols
  const fontMult=(Number(lay.fontScale)||100)/100;
  for(const c of comps){
    if(c.t!=='Symbol'||!c.pos)continue;
    const lg=getLayerGroup(c.layer??1);
    const x=Number((c.pos[0]*SLD_SCALE).toFixed(2)),y=Number((-c.pos[1]*SLD_SCALE).toFixed(2));
    const rot=Number(c.rot||0);
    const stype=c.stype||'Node',psse=c.psse||stype;
    const match=matchSavEquipment(c.map);
    const isOut=match?.sourceEquipmentId&&scenarioOps.has(match.sourceEquipmentId)?Number(scenarioOps.get(match.sourceEquipmentId))===0:(match?.branch?.status===0||match?.bus?.status===0);
    let stroke=bgrToHex(c.color,layerColor(c.layer,layers,col));
    if(col.colorMode==='voltage'){
      if(match?.bus?.baseKv)stroke=kvColor(match.bus.baseKv,col);
      else if(match?.branch){
        const fBus=network()?.buses?.[match.branch.from];
        if(fBus?.baseKv)stroke=kvColor(fBus.baseKv,col);
      }else stroke=layerColor(c.layer,layers,col);
    }else if(col.colorMode==='bus_limits'&&match?.bus){
      const calcBus=busMap.get(String(match.bus.connectionKey));
      const vm=valid&&calcBus?calcBus.vmPu:match.bus.initialVm;
      if(Number.isFinite(vm))stroke=vm<0.95||vm>1.05?'#ee5d63':vm<0.98||vm>1.02?'#f7b24f':'#49ba8f';
    }else if(col.colorMode==='loading'&&valid&&match?.branch){
      const r=branchMap.get(match.branch.id);
      if(r){
        const pct=Math.max(nval(r.loadingFromPct,0),nval(r.loadingToPct,0));
        stroke=pct>=100?'#ee5d63':pct>=80?'#f7b24f':'#49ba8f';
      }
    }
    if(col.highlightUnbound&&!match&&network()?.buses?.length){
      stroke=col.unboundColor||'#7f93a8';
    }

    const g=S('g',{
      class:`ga-studio-sld-symbol ${stype==='Busbar'?'ga-sld-bus':'ga-sld-branch'} ${isOut?'is-out':''}`,
      'data-sld-id':c.id,
      'data-sld-type':'Symbol',
      'data-sld-stype':stype,
      'data-sld-psse':psse,
      'data-sld-sdef':c.sdef??0,
      'data-sld-layer':c.layer??1,
      'data-sld-map':c.map||'',
      'data-sld-x':c.pos[0],
      'data-sld-y':c.pos[1],
      'data-sld-rot':rot,
      'data-ga-node':`sym:${c.id}`,
      'data-kind':psse.toLowerCase()
    });
    if(match?.type==='bus')g.setAttribute('data-bus-id',match.id);
    if(match?.type==='branch')g.setAttribute('data-source-branch',match.id);
    if(match?.sourceEquipmentId)g.setAttribute('data-source-eq',match.sourceEquipmentId);

    if(stype==='Busbar'){
      let x1,y1,x2,y2;
      if(c.ends&&c.ends.length===2&&c.ends[0]&&c.ends[1]){
        x1=Number((c.ends[0][0]*SLD_SCALE).toFixed(2));y1=Number((-c.ends[0][1]*SLD_SCALE).toFixed(2));
        x2=Number((c.ends[1][0]*SLD_SCALE).toFixed(2));y2=Number((-c.ends[1][1]*SLD_SCALE).toFixed(2));
      }else{
        recomputeBusbarEnds(c);
        x1=Number((c.ends[0][0]*SLD_SCALE).toFixed(2));y1=Number((-c.ends[0][1]*SLD_SCALE).toFixed(2));
        x2=Number((c.ends[1][0]*SLD_SCALE).toFixed(2));y2=Number((-c.ends[1][1]*SLD_SCALE).toFixed(2));
      }
      const bw=Math.max(4.5,Math.min(12,(c.width||0.06)*SLD_SCALE*(adv.lineWidthScale||1)));
      const bar=S('line',{x1,y1,x2,y2,stroke,'stroke-width':bw.toFixed(1),'stroke-linecap':'round',class:'ga-sld-busbar'});
      if(isOut&&col.dashedOutOfService)bar.setAttribute('stroke-dasharray','6 4');
      g.append(bar);
      if(ann.busVoltageMode!=='hide'&&match?.bus){
        const b=match.bus,calcBus=busMap.get(String(b.connectionKey));
        const vm=valid&&calcBus?calcBus.vmPu:b.initialVm;
        const va=valid&&calcBus?calcBus.vaDeg:(b.initialVa??0);
        const kvVal=(b.baseKv&&Number.isFinite(vm))?(b.baseKv*vm):b.baseKv;
        let vText='';
        if(ann.busVoltageMode==='pu')vText=`${num(vm,Math.max(2,dec))} pu`;
        else if(ann.busVoltageMode==='kv')vText=`${num(kvVal,dec)} kV`;
        else if(ann.busVoltageMode==='pu_ang')vText=`${num(vm,Math.max(2,dec))} pu ∠${num(va,dec)}°`;
        else vText=`${num(vm,Math.max(2,dec))} pu · ${num(kvVal,dec)} kV`;
        const badge=S('text',{
          x,
          y:y+(Math.abs(y2-y1)>Math.abs(x2-x1)?-10:15),
          'text-anchor':'middle',
          fill:'#9ee6c9',
          'font-size':(7.8*fontMult).toFixed(1),
          class:'ga-studio-pf-badge'
        });
        badge.textContent=vText;
        g.append(badge);
      }
    }else if(psse==='Transformer'||psse==='TWTransformer'){
      const r=9.5;
      const symG=S('g',{transform:`translate(${x} ${y}) rotate(${-rot})`,class:'ga-sld-sym-inner'});
      symG.append(
        S('circle',{cx:0,cy:-r*0.65,r,fill:adv.bgColor||'#102336',stroke,'stroke-width':2,class:'ga-sld-xfmr-coil'}),
        S('circle',{cx:0,cy:r*0.65,r,fill:adv.bgColor||'#102336',stroke,'stroke-width':2,class:'ga-sld-xfmr-coil'})
      );
      if(psse==='TWTransformer'){
        symG.append(S('circle',{cx:r*0.95,cy:0,r:r*0.85,fill:adv.bgColor||'#102336',stroke:'#e6b85c','stroke-width':1.8}));
      }
      g.append(symG);
    }else if(psse==='SwitchingDev'){
      const swCol=isOut?(col.switchOpen||'#fa8080'):(col.switchClosed||stroke);
      const symG=S('g',{transform:`translate(${x} ${y}) rotate(${-rot})`,class:'ga-sld-sym-inner'});
      symG.append(S('rect',{x:-6.5,y:-6.5,width:13,height:13,rx:1.5,fill:isOut?(adv.bgColor||'#102336'):swCol,stroke:swCol,'stroke-width':1.8}));
      if(isOut)symG.append(S('line',{x1:-5,y1:-5,x2:5,y2:5,stroke:swCol,'stroke-width':1.6}));
      g.append(symG);
    }else if(psse==='Machine'){
      const symG=S('g',{transform:`translate(${x} ${y})`,class:'ga-sld-sym-inner'});
      symG.append(S('circle',{cx:0,cy:0,r:11.5,fill:adv.bgColor||'#102336',stroke:'#53cf9d','stroke-width':2}));
      const t=S('text',{x:0,y:4,'text-anchor':'middle',fill:'#d9fbee','font-size':10,'font-weight':'700'});t.textContent='G';
      symG.append(t);g.append(symG);
      if(ann.showRadialResults&&match?.generator){
        const eq=eqRows.get(match.generator.sourceEquipmentId);
        const pg=eq?.operating?.pg?.value??match.generator.pgMw,qg=eq?.operating?.qg?.value??match.generator.qgMvar;
        if(Number.isFinite(pg)||Number.isFinite(qg)){
          const rt=S('text',{x:x+14,y:y+3,fill:'#8be9c1','font-size':(7.4*fontMult).toFixed(1),class:'ga-studio-pf-badge'});
          rt.textContent=`${num(pg,dec)} MW / ${num(qg,dec)} MVAr`;
          g.append(rt);
        }
      }
    }else if(psse==='Load'){
      const symG=S('g',{transform:`translate(${x} ${y}) rotate(${-rot})`,class:'ga-sld-sym-inner'});
      symG.append(S('path',{d:'M -9 -8 H 9 L 0 11 Z',fill:adv.bgColor||'#142c42',stroke:'#eab863','stroke-width':1.8}));
      g.append(symG);
      if(ann.showRadialResults&&match?.load){
        const eq=eqRows.get(match.load.sourceEquipmentId);
        const pl=eq?.operating?.pl?.value??match.load.pMw,ql=eq?.operating?.ql?.value??match.load.qMvar;
        if(Number.isFinite(pl)||Number.isFinite(ql)){
          const rt=S('text',{x:x+12,y:y+4,fill:'#f5cf87','font-size':(7.4*fontMult).toFixed(1),class:'ga-studio-pf-badge'});
          rt.textContent=`${num(pl,dec)} MW / ${num(ql,dec)} MVAr`;
          g.append(rt);
        }
      }
    }else if(psse==='FixedShunt'||psse==='SwitchedShunt'){
      const symG=S('g',{transform:`translate(${x} ${y}) rotate(${-rot})`,class:'ga-sld-sym-inner'});
      symG.append(
        S('line',{x1:-8,y1:-3,x2:8,y2:-3,stroke:'#c79bf2','stroke-width':2}),
        S('line',{x1:-8,y1:3,x2:8,y2:3,stroke:'#c79bf2','stroke-width':2}),
        S('line',{x1:-5,y1:8,x2:5,y2:8,stroke:'#c79bf2','stroke-width':1.5})
      );
      g.append(symG);
    }else if(stype==='Branch'){
      const symG=S('g',{transform:`translate(${x} ${y}) rotate(${-rot})`,class:'ga-sld-sym-inner'});
      symG.append(
        S('line',{x1:0,y1:-8,x2:0,y2:8,stroke,'stroke-width':2.2}),
        S('circle',{cx:0,cy:0,r:3.2,fill:stroke})
      );
      g.append(symG);
    }else{
      g.append(S('circle',{cx:x,cy:y,r:3.6,fill:stroke,stroke:'#0d1e2e','stroke-width':1.2,class:'ga-sld-sym-inner'}));
    }

    if(ann.branchFlowMode!=='hide'&&match?.branch){
      const br=match.branch,r=branchMap.get(br.id);
      if(r){
        const pct=Math.max(nval(r.loadingFromPct,0),nval(r.loadingToPct,0));
        let fTxt='';
        const dirPrefix=ann.flowDirectionMode==='sign'||ann.flowDirectionMode==='both'?(nval(r.pFromMw,0)>=0?'+':''):'';
        if(ann.branchFlowMode==='pq')fTxt=`${dirPrefix}${num(r.pFromMw,dec)} MW · ${num(r.qFromMvar,dec)} MVAr`;
        else if(ann.branchFlowMode==='mva')fTxt=`${num(r.sFromMva,dec)} MVA`;
        else if(ann.branchFlowMode==='current')fTxt=`${num(r.iFromA,dec)} A`;
        else if(ann.branchFlowMode==='loading')fTxt=`%${num(pct,dec)} yük`;
        if(fTxt){
          const pfTxt=S('text',{
            x:x+11,
            y:y-6,
            fill:pct>=100?'#ff7b7b':pct>=80?'#f7c266':'#8be9c1',
            'font-size':(7.5*fontMult).toFixed(1),
            class:'ga-studio-pf-badge'
          });
          pfTxt.textContent=fTxt;
          g.append(pfTxt);
        }
      }
    }

    const tip=S('title');
    tip.textContent=`[${psse}] id=${c.id} · map="${c.map||'—'}" · katman=${c.layer??1}${match?` · SAV=${match.id}`:' · (SAV eşleşmesi yok)'}`;
    g.append(tip);
    lg.append(g);
  }

  // 3) Render Labels
  if(lay.showLabels!==false){
    for(const c of comps){
      if(c.t!=='Label'||!c.pos||!c.text||c.vis===false)continue;
      const ownerSym=c.owner!==undefined?symMap.get(c.owner):null;
      if(ownerSym&&ownerSym.stype==='Busbar'){
        if(!ann.showBusId&&!ann.showBusName)continue;
      }else if(ownerSym&&ownerSym.stype==='Branch'){
        if(!ann.showCktId&&!ann.showEquipId&&c.text.trim().length<=4)continue;
      }
      const lg=getLayerGroup(c.layer??1);
      const x=Number((c.pos[0]*SLD_SCALE).toFixed(2)),y=Number((-c.pos[1]*SLD_SCALE).toFixed(2));
      const rot=Number(c.rot||0);
      const fh=Math.max(6.0,Math.min(18,((c.fh||9)*0.82*fontMult)));
      const fill=col.colorMode==='source'?bgrToHex(c.color,col.labelColor||'#e4eef8'):(col.labelColor||bgrToHex(c.color,'#e4eef8'));
      const anchor=lay.labelAlign==='middle'?'middle':lay.labelAlign==='start'?'start':undefined;
      const g=S('g',{
        class:'ga-studio-sld-label',
        'data-sld-id':c.id,
        'data-sld-type':'Label',
        'data-sld-layer':c.layer??1,
        'data-sld-owner':c.owner??'',
        'data-sld-x':c.pos[0],
        'data-sld-y':c.pos[1],
        'data-sld-rot':rot,
        'data-ga-node':`lbl:${c.id}`,
        transform:rot?`rotate(${-rot} ${x} ${y})`:undefined
      });
      const textEl=S('text',{x,y,fill,'font-size':fh.toFixed(1),'font-family':'Arial, system-ui, sans-serif','text-anchor':anchor});
      let rawText=String(c.text);
      if(ownerSym&&ownerSym.stype==='Busbar'&&(!ann.showBusId||!ann.showBusName)){
        const parts=rawText.split(/\r?\n/);
        if(parts.length>1){
          rawText=ann.showBusId?parts[0]:parts.slice(1).join(' ');
        }
      }
      const lines=rawText.split(/\r?\n/);
      lines.forEach((ln,idx)=>{
        const tsp=S('tspan',{x,dy:idx===0?'0':`${(fh*1.15).toFixed(1)}`});
        tsp.textContent=ln;
        textEl.append(tsp);
      });
      g.append(textEl);
      lg.append(g);
    }
  }

  // Optional Diagram Title
  if(lay.showTitle&&(lay.diagramTitle||gaSld.title||gaSld.name)){
    const titleTxt=S('text',{
      x:vbX+22,
      y:vbY+26,
      fill:col.labelColor||'#eaf2fa',
      'font-size':(14*fontMult).toFixed(1),
      'font-weight':'600',
      'data-diagram-title':'1'
    });
    titleTxt.textContent=lay.diagramTitle||gaSld.title||gaSld.name;
    svg.append(titleTxt);
  }

  return svg;
}

/* Part 3: One-Click SAV -> TM & SAV -> OWNER Native SLD Builders */
function layerForKv(kv){
  if(kv>=300)return 4;
  if(kv>=180)return 3;
  if(kv>=100)return 2;
  return 5;
}

function defaultSldLayers(){
  return [
    {n:0,desc:'Background',vis:'Visible'},
    {n:1,desc:'Foreground',vis:'Visible'},
    {n:2,desc:'BaseVoltage 154,0',vis:'Visible'},
    {n:3,desc:'BaseVoltage 220,0',vis:'Visible'},
    {n:4,desc:'BaseVoltage 400,0',vis:'Visible'},
    {n:5,desc:'BaseVoltage <=66,0',vis:'Visible'}
  ];
}

function resolveGaSldOverlaps(gaSld){
  if(!gaSld||!Array.isArray(gaSld.components))return 0;
  const lbls=gaSld.components.filter(c=>c.t==='Label'&&c.pos&&c.text&&c.vis!==false);
  const syms=gaSld.components.filter(c=>c.t==='Symbol'&&c.pos);
  let moved=0;
  for(let pass=0;pass<7;pass++){
    for(let i=0;i<lbls.length;i++){
      const a=lbls[i];
      const aw=Math.max(0.45,Math.min(2.9,(a.text.length*0.052))),ah=0.25*(a.text.split('\n').length);
      // Push away from non-owner symbols that overlap label box
      for(const s of syms){
        if(s.id===a.owner||s.stype==='Busbar')continue;
        const dx=a.pos[0]-s.pos[0],dy=a.pos[1]-s.pos[1];
        if(Math.abs(dx)<(aw/2+0.22)&&Math.abs(dy)<(ah/2+0.22)){
          a.pos[1]=Number((a.pos[1]+(dy>=0?0.18:-0.18)).toFixed(4));
          moved++;
        }
      }
      for(let j=i+1;j<lbls.length;j++){
        const b=lbls[j];
        if(Math.abs(a.pos[0]-b.pos[0])>3.6||Math.abs(a.pos[1]-b.pos[1])>1.9)continue;
        const bw=Math.max(0.45,Math.min(2.9,(b.text.length*0.052))),bh=0.25*(b.text.split('\n').length);
        const ox=(aw+bw)/2-Math.abs(a.pos[0]-b.pos[0]),oy=(ah+bh)/2-Math.abs(a.pos[1]-b.pos[1]);
        if(ox>0&&oy>0){
          const pushY=(a.pos[1]>=b.pos[1]?1:-1)*(oy*0.56+0.045);
          a.pos[1]=Number((a.pos[1]+pushY).toFixed(4));
          b.pos[1]=Number((b.pos[1]-pushY).toFixed(4));
          moved++;
        }
      }
    }
  }
  return moved;
}

function getStationBusIndices(stationId){
  const n=network(),m=model();if(!n||!m)return {name:stationId,indices:[]};
  const eqMap=sourceRows();
  const indices=[];
  let stName='';
  const subEq=eqMap.get(`substation:${stationId}`)||eqMap.get(stationId);
  if(subEq?.name)stName=subEq.name;
  n.buses.forEach((b,idx)=>{
    if(!b.source)return;
    const eq=eqMap.get(b.sourceEquipmentId);
    const isub=String(eq?.fields?.isub??'');
    const bName=String(eq?.name||b.connectionKey||'').trim();
    const prefix=bName.split(/[\s_-]+/)[0];
    if(isub===stationId||`substation:${isub}`===stationId||prefix===stationId||b.id===stationId){
      indices.push(idx);
      if(!stName&&bName)stName=prefix;
    }
  });
  // Fallback: if station dropdown in native view matched buses, read from native station view
  if(!indices.length){
    const nativeSvgEl=$('.ga-psse-sld-svg',state.root);
    if(nativeSvgEl){
      for(const g of $$('.ga-sld-bus[data-bus-id]',nativeSvgEl)){
        const bid=g.dataset.busId;
        const idx=n.buses.findIndex(b=>b.id===bid);
        if(idx>=0)indices.push(idx);
      }
    }
  }
  return {name:stName||stationId,indices};
}

function buildTmGaSld(stationId,orientation='horizontal'){
  const n=network(),m=model();
  if(!n||!m)return null;
  const eqMap=sourceRows();
  const {name:stName,indices}=getStationBusIndices(stationId);
  if(!indices.length)return null;

  const isHoriz=orientation!=='vertical';
  const visibleSet=new Set(indices);

  // Collect 3W transformers touching station
  const threeMap=new Map();
  for(const br of n.branches){
    if(br.kind==='three-winding-leg'){
      if(!threeMap.has(br.sourceEquipmentId))threeMap.set(br.sourceEquipmentId,[]);
      threeMap.get(br.sourceEquipmentId).push(br);
    }
  }
  const threeGroups=[];
  for(const [srcId,legs] of threeMap.entries()){
    legs.sort((a,b)=>Number(a.windingId)-Number(b.windingId));
    const terms=[...new Set(legs.flatMap(l=>[l.from,l.to]).filter(i=>n.buses[i]?.source))];
    if(terms.some(i=>visibleSet.has(i)))threeGroups.push({sourceEquipmentId:srcId,legs,terminals:terms});
  }

  const allBranches=n.branches.filter(b=>b.kind!=='three-winding-leg'&&(visibleSet.has(b.from)||visibleSet.has(b.to)));
  const internalBranches=allBranches.filter(b=>visibleSet.has(b.from)&&visibleSet.has(b.to));
  const externalBranches=allBranches.filter(b=>visibleSet.has(b.from)!==visibleSet.has(b.to));

  // Count degree per bus to size busbar length appropriately
  const busDeg=new Map(indices.map(i=>[i,1]));
  for(const br of allBranches){
    if(visibleSet.has(br.from))busDeg.set(br.from,(busDeg.get(br.from)||0)+1);
    if(visibleSet.has(br.to))busDeg.set(br.to,(busDeg.get(br.to)||0)+1);
  }
  for(const g of threeGroups){
    for(const t of g.terminals)if(visibleSet.has(t))busDeg.set(t,(busDeg.get(t)||0)+1);
  }
  for(const gen of n.generators||[])if(visibleSet.has(gen.bus))busDeg.set(gen.bus,(busDeg.get(gen.bus)||0)+1);
  for(const ld of n.loads||[])if(visibleSet.has(ld.bus))busDeg.set(ld.bus,(busDeg.get(ld.bus)||0)+1);
  for(const sh of n.shunts||[])if(visibleSet.has(sh.bus))busDeg.set(sh.bus,(busDeg.get(sh.bus)||0)+1);

  // Group station buses by voltage tier descending
  const tiers=new Map();
  for(const idx of indices){
    const kv=n.buses[idx].baseKv||0;
    const key=kv>=300?400:kv>=180?220:kv>=100?154:kv>36?66:36;
    if(!tiers.has(key))tiers.set(key,[]);
    tiers.get(key).push(idx);
  }
  const sortedTiers=[...tiers.entries()].sort((a,b)=>b[0]-a[0]);

  const comps=[];
  let idSeq=100;
  const busSymByIdx=new Map();
  const portUseByBusIdx=new Map(indices.map(i=>[i,[]]));
  const allocBusPort=(busIdx,hintRatio=null)=>{
    const busSym=busSymByIdx.get(busIdx);
    if(!busSym)return {sym:undefined,offsetRatio:0,pos:[0,0]};
    const used=portUseByBusIdx.get(busIdx)||[];
    const total=Math.max(2,busDeg.get(busIdx)||2);
    let ratio=hintRatio!==null?hintRatio:(-0.42+(used.length/(total))*0.84);
    while(used.some(u=>Math.abs(u-ratio)<0.055))ratio+=0.065;
    ratio=Math.max(-0.46,Math.min(0.46,Number(ratio.toFixed(4))));
    used.push(ratio);
    portUseByBusIdx.set(busIdx,used);
    const spec={sym:busSym.id,offsetRatio:ratio};
    spec.pos=getPortWorldPos(busSym,spec);
    return spec;
  };

  // Place Busbars (Horizontal tiers top-to-bottom when isHoriz=true; Vertical columns left-to-right when isHoriz=false)
  let tierCursor=isHoriz?4.2:-5.5;
  for(const [kvKey,busIndices] of sortedTiers){
    busIndices.sort((a,b)=>(n.buses[a].externalNumber??a)-(n.buses[b].externalNumber??b));
    const count=busIndices.length;
    busIndices.forEach((bIdx,posIdx)=>{
      const bus=n.buses[bIdx],eq=eqMap.get(bus.sourceEquipmentId);
      const deg=busDeg.get(bIdx)||2;
      const barLen=Number(Math.max(3.4,Math.min(9.5,deg*0.65+1.8)).toFixed(2));
      let cx,cy;
      if(isHoriz){
        const span=barLen+2.2;
        cx=Number(((posIdx-(count-1)/2)*span).toFixed(3));
        cy=Number(tierCursor.toFixed(3));
      }else{
        const span=barLen+2.2;
        cx=Number(tierCursor.toFixed(3));
        cy=Number((-(posIdx-(count-1)/2)*span).toFixed(3));
      }
      const cid=idSeq++;
      const lyr=layerForKv(bus.baseKv||kvKey);
      const busNum=bus.externalNumber||bus.connectionKey;
      const bName=(eq?.name||bus.connectionKey||'').trim();
      const sym={
        id:cid,t:'Symbol',stype:'Busbar',psse:'Busbar',sdef:1,layer:lyr,
        map:`BU ${busNum}`,
        pos:[cx,cy],
        rot:isHoriz?90:0,
        len:barLen,
        width:0.065,
        color:hexToBgr(kvColor(bus.baseKv||kvKey))
      };
      recomputeBusbarEnds(sym);
      comps.push(sym);
      busSymByIdx.set(bIdx,sym);

      const lblPos=isHoriz?[cx,Number((cy+0.34).toFixed(4))]:[Number((cx-0.42).toFixed(4)),Number((cy+barLen/2+0.25).toFixed(4))];
      comps.push({
        id:idSeq++,t:'Label',owner:cid,layer:lyr,color:0xffffff,
        pos:lblPos,rot:0,
        text:`${busNum}\n${bName.slice(0,22)} (${num(bus.baseKv,0)} kV)`,
        fh:9
      });
    });
    tierCursor+=isHoriz?-3.6:4.4;
  }

  // Place Internal 2W Transformers & Internal AC Lines
  const pairGroups=new Map();
  for(const br of internalBranches){
    const k=[br.from,br.to].sort((a,b)=>a-b).join(':');
    if(!pairGroups.has(k))pairGroups.set(k,[]);
    pairGroups.get(k).push(br);
  }

  for(const peers of pairGroups.values()){
    peers.forEach((br,pIdx)=>{
      const sFrom=busSymByIdx.get(br.from),sTo=busSymByIdx.get(br.to);
      if(!sFrom||!sTo)return;
      const offset=(pIdx-(peers.length-1)/2)*0.75;
      const p1Spec=allocBusPort(br.from);
      const p2Spec=allocBusPort(br.to);
      const mx=Number(((p1Spec.pos[0]+p2Spec.pos[0])/2+(isHoriz?offset:0)).toFixed(4));
      const my=Number(((p1Spec.pos[1]+p2Spec.pos[1])/2+(isHoriz?0:offset)).toFixed(4));
      const isTr=br.kind==='transformer';
      const fBus=n.buses[br.from],tBus=n.buses[br.to];
      const b1=fBus.externalNumber||fBus.connectionKey,b2=tBus.externalNumber||tBus.connectionKey;
      const ckt=String(br.windingId||'1').trim();
      const lyr=layerForKv(Math.max(fBus.baseKv||0,tBus.baseKv||0));
      const colBgr=hexToBgr(kvColor(Math.max(fBus.baseKv||0,tBus.baseKv||0)));
      const cid=idSeq++;
      const brSym={
        id:cid,t:'Symbol',stype:'Branch',psse:isTr?'Transformer':'Branch',sdef:isTr?10:32,layer:lyr,
        map:`${isTr?'TR':'LI'} ${b1} ${b2} ${ckt} `,
        pos:[mx,my],rot:isHoriz?0:90,color:colBgr
      };
      comps.push(brSym);
      comps.push({
        id:idSeq++,t:'Label',owner:cid,layer:lyr,color:0xdce7f3,
        pos:[Number((mx+(isHoriz?0.45:0)).toFixed(4)),Number((my+(isHoriz?0.05:0.35)).toFixed(4))],
        rot:0,text:`${isTr?'TR':'HAT'} ckt ${ckt}`,fh:8
      });
      const brPort0={sym:cid,idx:0};brPort0.pos=getPortWorldPos(brSym,brPort0);
      const brPort1={sym:cid,idx:1};brPort1.pos=getPortWorldPos(brSym,brPort1);
      comps.push({
        id:idSeq++,t:'Link',layer:lyr,color:colBgr,lwidth:0.022,lstyle:br.status===0?1:0,
        p1:p1Spec,p2:brPort0,knees:buildOrthogonalKnees(p1Spec.pos,brPort0.pos,sFrom,brSym)
      });
      comps.push({
        id:idSeq++,t:'Link',layer:lyr,color:colBgr,lwidth:0.022,lstyle:br.status===0?1:0,
        p1:p2Spec,p2:brPort1,knees:buildOrthogonalKnees(p2Spec.pos,brPort1.pos,sTo,brSym)
      });
    });
  }

  // Place 3-Winding Transformers
  threeGroups.forEach((grp,gIdx)=>{
    const eq=eqMap.get(grp.sourceEquipmentId);
    const ckt=String(eq?.fields?.ckt||'1').trim();
    const visTerms=grp.terminals.filter(t=>busSymByIdx.has(t));
    if(!visTerms.length)return;
    const pts=visTerms.map(t=>busSymByIdx.get(t).pos);
    const cx=Number((pts.reduce((s,p)=>s+p[0],0)/pts.length+(gIdx*0.9)).toFixed(4));
    const cy=Number((pts.reduce((s,p)=>s+p[1],0)/pts.length+0.45).toFixed(4));
    const bNums=grp.terminals.map(t=>n.buses[t]?.externalNumber||n.buses[t]?.connectionKey).filter(Boolean);
    const cid=idSeq++;
    const trSym={
      id:cid,t:'Symbol',stype:'Branch',psse:'TWTransformer',sdef:11,layer:4,
      map:bNums.length>=2?`TR ${bNums[0]} ${bNums[1]} ${bNums[2]||''} ${ckt} `:'',
      pos:[cx,cy],rot:0,color:hexToBgr('#e6b85c')
    };
    comps.push(trSym);
    comps.push({id:idSeq++,t:'Label',owner:cid,layer:4,color:0xf5d78e,pos:[Number((cx+0.55).toFixed(4)),cy],rot:0,text:`3W TR ckt ${ckt}`,fh:8.5});
    visTerms.slice(0,3).forEach((tIdx,wIdx)=>{
      const busSym=busSymByIdx.get(tIdx);
      const p1Spec=allocBusPort(tIdx);
      const p2Spec={sym:cid,idx:wIdx};p2Spec.pos=getPortWorldPos(trSym,p2Spec);
      comps.push({
        id:idSeq++,t:'Link',layer:busSym.layer||4,color:busSym.color,lwidth:0.022,
        p1:p1Spec,p2:p2Spec,knees:buildOrthogonalKnees(p1Spec.pos,p2Spec.pos,busSym,trSym)
      });
    });
  });

  // Place External Feeders (lines to neighbor stations)
  externalBranches.forEach((br)=>{
    const ownIdx=visibleSet.has(br.from)?br.from:br.to;
    const otherIdx=ownIdx===br.from?br.to:br.from;
    const ownSym=busSymByIdx.get(ownIdx);
    if(!ownSym)return;
    const ownBus=n.buses[ownIdx],otherBus=n.buses[otherIdx];
    const otherEq=eqMap.get(otherBus?.sourceEquipmentId);
    const otherName=(otherEq?.name||otherBus?.connectionKey||'DIŞ BARA').trim();
    const b1=ownBus.externalNumber||ownBus.connectionKey,b2=otherBus?.externalNumber||otherBus?.connectionKey||'0';
    const ckt=String(br.windingId||'1').trim();
    const p1Spec=allocBusPort(ownIdx);
    const fx=isHoriz?p1Spec.pos[0]:Number((ownSym.pos[0]+1.85).toFixed(4));
    const fy=isHoriz?Number((ownSym.pos[1]+1.55).toFixed(4)):p1Spec.pos[1];
    const cid=idSeq++;
    const lyr=ownSym.layer||2;
    const fSym={
      id:cid,t:'Symbol',stype:'Branch',psse:'Branch',sdef:32,layer:lyr,
      map:`LI ${b1} ${b2} ${ckt} `,
      pos:[fx,fy],rot:isHoriz?0:90,color:ownSym.color
    };
    comps.push(fSym);
    comps.push({
      id:idSeq++,t:'Label',owner:cid,layer:lyr,color:0xdce7f3,
      pos:[Number((fx+(isHoriz?0:0.65)).toFixed(4)),Number((fy+(isHoriz?0.36:0)).toFixed(4))],
      rot:0,text:`→ ${otherName.slice(0,18)} (${b2}) ckt ${ckt}`,fh:8
    });
    const p2Spec={sym:cid,idx:0};p2Spec.pos=getPortWorldPos(fSym,p2Spec);
    comps.push({
      id:idSeq++,t:'Link',layer:lyr,color:ownSym.color,lwidth:0.02,lstyle:br.status===0?1:0,
      p1:p1Spec,p2:p2Spec,knees:buildOrthogonalKnees(p1Spec.pos,p2Spec.pos,ownSym,fSym)
    });
  });

  // Place Generators, Loads, and Shunts on Station Buses
  for(const bIdx of indices){
    const busSym=busSymByIdx.get(bIdx),bus=n.buses[bIdx];
    if(!busSym)continue;
    const busNum=bus.externalNumber||bus.connectionKey;
    const gens=(n.generators||[]).filter(g=>g.bus===bIdx).slice(0,4);
    const loads=(n.loads||[]).filter(l=>l.bus===bIdx).slice(0,4);
    const shunts=(n.shunts||[]).filter(s=>s.bus===bIdx).slice(0,4);
    const radials=[
      ...gens.map(g=>({psse:'Machine',sdef:4,map:`ME ${busNum} 1 `,txt:`G (${busNum})`,col:'#53cf9d'})),
      ...loads.map(l=>({psse:'Load',sdef:2,map:`LO ${busNum} 1 `,txt:`YÜK (${busNum})`,col:'#eab863'})),
      ...shunts.map(s=>({psse:'FixedShunt',sdef:5,map:`FXS ${busNum} 1 `,txt:`ŞÖNT ${num(s.bMvar,1)} MVAr`,col:'#c79bf2'}))
    ];
    radials.forEach((rad)=>{
      const p1Spec=allocBusPort(bIdx);
      const rx=isHoriz?p1Spec.pos[0]:Number((busSym.pos[0]-1.45).toFixed(4));
      const ry=isHoriz?Number((busSym.pos[1]-1.25).toFixed(4)):p1Spec.pos[1];
      const cid=idSeq++;
      const rSym={
        id:cid,t:'Symbol',stype:'Radial',psse:rad.psse,sdef:rad.sdef,layer:busSym.layer||2,
        map:rad.map,pos:[rx,ry],rot:0,color:hexToBgr(rad.col)
      };
      comps.push(rSym);
      comps.push({
        id:idSeq++,t:'Label',owner:cid,layer:busSym.layer||2,color:hexToBgr(rad.col),
        pos:[rx,Number((ry-0.32).toFixed(4))],rot:0,text:rad.txt,fh:7.8
      });
      comps.push({
        id:idSeq++,t:'Link',layer:busSym.layer||2,color:hexToBgr(rad.col),lwidth:0.018,
        p1:p1Spec,p2:{sym:cid,idx:0,pos:[rx,ry]},knees:buildOrthogonalKnees(p1Spec.pos,[rx,ry],busSym,rSym)
      });
    });
  }

  const gaDoc={
    format:'ga-sld-v1',
    name:`${stName}_TM.sld`,
    title:`${stName} TM (${indices.length} Bara · ${isHoriz?'Yatay':'Dikey'} Yerleşim)`,
    fileVersion:'2.0.51.1',
    layers:defaultSldLayers(),
    components:comps
  };
  ensureLinkPortAttachments(gaDoc);
  resolveGaSldOverlaps(gaDoc);
  return gaDoc;
}

function buildOwnerGaSld(ownerCode,voltageFilter='all',orientation='horizontal'){
  const n=network(),m=model();if(!n||!m)return null;
  const eqMap=sourceRows();
  const isAllowed=b=>b.source&&(voltageFilter==='all'||(voltageFilter==='400'?b.baseKv>=300:voltageFilter==='220'?b.baseKv>=180&&b.baseKv<300:voltageFilter==='154'?b.baseKv>=100&&b.baseKv<180:voltageFilter==='66'?b.baseKv>36&&b.baseKv<100:b.baseKv<=36));
  const selected=n.buses.map((b,i)=>({b,i,e:eqMap.get(b.sourceEquipmentId)})).filter(o=>o.e&&String(o.e.fields.owner)===String(ownerCode)&&isAllowed(o.b));
  if(!selected.length)return null;

  const isHoriz=orientation!=='vertical';
  const selectedIdx=new Set(selected.map(o=>o.i));
  const allBranches=n.branches.filter(b=>b.kind!=='three-winding-leg'&&b.status===1&&(selectedIdx.has(b.from)||selectedIdx.has(b.to)));

  // Group buses by primary representative bus per substation (plus keep all selected buses mapped)
  const groups=new Map(),byBusIdx=new Map();
  for(const o of selected){
    const gid=String(o.e.fields.isub??'')||String(o.e.name||o.b.connectionKey).trim().split(/[\s_-]+/)[0];
    if(!groups.has(gid)){
      groups.set(gid,{
        id:gid,
        name:eqMap.get('substation:'+gid)?.name||o.e.name||gid,
        buses:[],
        maxKv:0,
        adj:new Set(),
        deg:0,
        cx:0,cy:0
      });
    }
    const g=groups.get(gid);
    g.buses.push(o);
    if((o.b.baseKv||0)>g.maxKv)g.maxKv=o.b.baseKv||0;
    byBusIdx.set(o.i,gid);
  }

  const pairs=new Map(),external=new Map();
  for(const br of allBranches){
    const g1=byBusIdx.get(br.from),g2=byBusIdx.get(br.to);
    if(g1&&g2&&g1!==g2){
      const key=[g1,g2].sort().join('|');
      if(!pairs.has(key))pairs.set(key,{g1,g2,branches:[]});
      pairs.get(key).branches.push(br);
      groups.get(g1).adj.add(g2);groups.get(g2).adj.add(g1);
      groups.get(g1).deg++;groups.get(g2).deg++;
    }else if((g1&&!g2)||(!g1&&g2)){
      const inG=g1||g2,outIdx=g1?br.to:br.from,outBus=n.buses[outIdx],outEq=eqMap.get(outBus?.sourceEquipmentId);
      const extId=String(outEq?.fields?.isub??outBus?.connectionKey??outIdx);
      if(!external.has(extId)){
        external.set(extId,{id:extId,name:eqMap.get('substation:'+extId)?.name||outEq?.name||`DIŞ_${extId}`,bus:outBus,branches:[],innerGroups:new Set()});
      }
      const rec=external.get(extId);
      rec.branches.push(br);rec.innerGroups.add(inG);
      groups.get(inG).deg++;
    }
  }

  // Layered barycenter layout for crossing minimization
  const items=[...groups.values()].sort((a,b)=>(b.maxKv-a.maxKv)||(b.deg-a.deg)||a.name.localeCompare(b.name,'tr'));
  const cols=Math.min(7,Math.max(3,Math.ceil(Math.sqrt(items.length*1.35))));
  const rows=[];
  for(let r=0;r<Math.ceil(items.length/cols);r++){
    rows.push(items.slice(r*cols,(r+1)*cols));
  }
  // 2-pass barycenter ordering across rows to minimize edge crossings
  const colPos=new Map();
  rows.forEach(row=>row.forEach((g,cIdx)=>colPos.set(g.id,cIdx)));
  for(let pass=0;pass<3;pass++){
    for(let r=1;r<rows.length;r++){
      rows[r].sort((a,b)=>{
        const na=[...a.adj].filter(id=>colPos.has(id)),nb=[...b.adj].filter(id=>colPos.has(id));
        const ba=na.length?na.reduce((s,id)=>s+colPos.get(id),0)/na.length:colPos.get(a.id);
        const bb=nb.length?nb.reduce((s,id)=>s+colPos.get(id),0)/nb.length:colPos.get(b.id);
        return ba-bb;
      });
      rows[r].forEach((g,cIdx)=>colPos.set(g.id,cIdx));
    }
  }

  const cellX=4.6,cellY=3.5;
  const comps=[];
  let idSeq=100;
  const groupSymMap=new Map();
  const portCounter=new Map();
  const allocSymPort=(sym,totalDeg=4)=>{
    const used=portCounter.get(sym.id)||[];
    const idx=used.length;
    const span=Math.max(2,totalDeg);
    let ratio=-0.44+((idx+0.5)/span)*0.88;
    ratio=Math.max(-0.46,Math.min(0.46,Number(ratio.toFixed(4))));
    used.push(ratio);portCounter.set(sym.id,used);
    const spec={sym:sym.id,offsetRatio:ratio};
    spec.pos=getPortWorldPos(sym,spec);
    return spec;
  };

  rows.forEach((row,rIdx)=>{
    row.forEach((g,cIdx)=>{
      const cx=Number(((cIdx-(row.length-1)/2)*cellX).toFixed(3));
      const cy=Number((((rows.length-1)/2-rIdx)*cellY).toFixed(3));
      g.cx=cx;g.cy=cy;
      g.buses.sort((a,b)=>(b.b.baseKv||0)-(a.b.baseKv||0));
      const repBus=g.buses[0].b;
      const busNum=repBus.externalNumber||repBus.connectionKey;
      const lyr=layerForKv(g.maxKv);
      const barLen=Number(Math.max(2.2,Math.min(3.6,1.6+g.deg*0.22)).toFixed(2));
      const cid=idSeq++;
      const sym={
        id:cid,t:'Symbol',stype:'Busbar',psse:'Busbar',sdef:1,layer:lyr,
        map:`BU ${busNum}`,
        pos:[cx,cy],
        rot:isHoriz?90:0,
        len:barLen,
        width:0.065,
        color:hexToBgr(kvColor(g.maxKv))
      };
      recomputeBusbarEnds(sym);
      comps.push(sym);
      groupSymMap.set(g.id,sym);
      comps.push({
        id:idSeq++,t:'Label',owner:cid,layer:lyr,color:0xffffff,
        pos:[cx,Number((cy+(isHoriz?0.34:barLen/2+0.25)).toFixed(4))],
        rot:0,
        text:`${g.name.slice(0,22)}\n${busNum} · ${g.buses.length} bara (${num(g.maxKv,0)} kV)`,
        fh:8.5
      });
    });
  });

  // Route inter-substation links with orthogonal 90° lanes
  let laneIdx=0;
  for(const pair of pairs.values()){
    const s1=groupSymMap.get(pair.g1),s2=groupSymMap.get(pair.g2);
    if(!s1||!s2)continue;
    const g1=groups.get(pair.g1),g2=groups.get(pair.g2);
    const br=pair.branches[0];
    const fBus=n.buses[br.from],tBus=n.buses[br.to];
    const b1=fBus?.externalNumber||fBus?.connectionKey||'0',b2=tBus?.externalNumber||tBus?.connectionKey||'0';
    const ckt=String(br.windingId||'1').trim();
    const kv=Math.max(fBus?.baseKv||154,tBus?.baseKv||154);
    const lyr=layerForKv(kv),colBgr=hexToBgr(kvColor(kv));

    const p1Spec=allocSymPort(s1,g1.deg+1);
    const p2Spec=allocSymPort(s2,g2.deg+1);
    const laneOffset=((laneIdx++%5)-2)*0.18;
    const mx=Number(((p1Spec.pos[0]+p2Spec.pos[0])/2+laneOffset).toFixed(4));
    const my=Number(((p1Spec.pos[1]+p2Spec.pos[1])/2+laneOffset).toFixed(4));
    const cid=idSeq++;
    const brSym={
      id:cid,t:'Symbol',stype:'Branch',psse:br.kind==='transformer'?'Transformer':'Branch',
      sdef:br.kind==='transformer'?10:32,layer:lyr,
      map:`${br.kind==='transformer'?'TR':'LI'} ${b1} ${b2} ${ckt} `,
      pos:[mx,my],rot:0,color:colBgr
    };
    comps.push(brSym);
    if(pair.branches.length>1){
      comps.push({id:idSeq++,t:'Label',owner:cid,layer:lyr,color:0xdce7f3,pos:[Number((mx+0.28).toFixed(4)),Number((my+0.18).toFixed(4))],rot:0,text:`${pair.branches.length}x devre`,fh:7.5});
    }
    const bp0={sym:cid,idx:0};bp0.pos=getPortWorldPos(brSym,bp0);
    const bp1={sym:cid,idx:1};bp1.pos=getPortWorldPos(brSym,bp1);
    comps.push({
      id:idSeq++,t:'Link',layer:lyr,color:colBgr,lwidth:0.022,
      p1:p1Spec,p2:bp0,knees:buildOrthogonalKnees(p1Spec.pos,bp0.pos,s1,brSym)
    });
    comps.push({
      id:idSeq++,t:'Link',layer:lyr,color:colBgr,lwidth:0.022,
      p1:p2Spec,p2:bp1,knees:buildOrthogonalKnees(p2Spec.pos,bp1.pos,s2,brSym)
    });
  }

  // Place boundary feeders on right column
  const extList=[...external.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr')).slice(0,18);
  const extX=Number(((cols/2+0.95)*cellX).toFixed(3));
  extList.forEach((ext,eIdx)=>{
    const extY=Number((((extList.length-1)/2-eIdx)*1.45).toFixed(3));
    const bNum=ext.bus?.externalNumber||ext.bus?.connectionKey||ext.id;
    const cid=idSeq++;
    const extSym={
      id:cid,t:'Symbol',stype:'Busbar',psse:'Busbar',sdef:1,layer:3,
      map:`BU ${bNum}`,pos:[extX,extY],rot:isHoriz?90:0,len:1.6,width:0.05,color:hexToBgr('#eebc69')
    };
    recomputeBusbarEnds(extSym);
    comps.push(extSym);
    comps.push({
      id:idSeq++,t:'Label',owner:cid,layer:3,color:0xffddb7,
      pos:[extX,Number((extY+0.28).toFixed(4))],rot:0,
      text:`[SINIR] ${ext.name.slice(0,18)} (${bNum})`,fh:7.8
    });
    for(const inGId of ext.innerGroups){
      const sIn=groupSymMap.get(inGId);if(!sIn)continue;
      const p1Spec=allocSymPort(sIn,groups.get(inGId)?.deg||3);
      const p2Spec=allocSymPort(extSym,ext.innerGroups.size+1);
      const br=ext.branches[0];
      const fB=n.buses[br.from]?.externalNumber||br.terminalFrom,tB=n.buses[br.to]?.externalNumber||br.terminalTo;
      const brId=idSeq++;
      const mx=Number(((p1Spec.pos[0]+p2Spec.pos[0])/2).toFixed(4)),my=Number(((p1Spec.pos[1]+p2Spec.pos[1])/2).toFixed(4));
      const bSym={id:brId,t:'Symbol',stype:'Branch',psse:'Branch',sdef:32,layer:3,map:`LI ${fB} ${tB} 1 `,pos:[mx,my],rot:0,color:hexToBgr('#eebc69')};
      comps.push(bSym);
      const bp0={sym:brId,idx:0};bp0.pos=getPortWorldPos(bSym,bp0);
      const bp1={sym:brId,idx:1};bp1.pos=getPortWorldPos(bSym,bp1);
      comps.push({id:idSeq++,t:'Link',layer:3,color:hexToBgr('#eebc69'),lwidth:0.018,lstyle:1,p1:p1Spec,p2:bp0,knees:buildOrthogonalKnees(p1Spec.pos,bp0.pos,sIn,bSym)});
      comps.push({id:idSeq++,t:'Link',layer:3,color:hexToBgr('#eebc69'),lwidth:0.018,lstyle:1,p1:p2Spec,p2:bp1,knees:buildOrthogonalKnees(p2Spec.pos,bp1.pos,extSym,bSym)});
    }
  });

  const op=ownerOptions().find(o=>o.code===String(ownerCode));
  const gaDoc={
    format:'ga-sld-v1',
    name:`OWNER_${ownerCode}_${(op?.name||'BOLGE').replace(/\W+/g,'_')}.sld`,
    title:`OWNER ${ownerCode} (${op?.name||'Bölge'}) · ${selected.length} Bara · ${items.length} TM · ${extList.length} Sınır Fideri`,
    fileVersion:'2.0.51.1',
    layers:defaultSldLayers(),
    components:comps
  };
  ensureLinkPortAttachments(gaDoc);
  resolveGaSldOverlaps(gaDoc);
  return gaDoc;
}

/* Part 4: Document Lifecycle, Live Drag Engine, 4-Tab Diagram Settings Modal & Strict Native Export */
const DB_NAME='GridAnalyzer_SLD_Store';
const DB_VERSION=1;
function getSldDb(){
  return new Promise(res=>{
    if(typeof indexedDB==='undefined'){res(null);return;}
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('docs'))db.createObjectStore('docs',{keyPath:'id'});
      if(!db.objectStoreNames.contains('blobs'))db.createObjectStore('blobs');
    };
    req.onsuccess=()=>res(req.result);
    req.onerror=()=>res(null);
  });
}

async function saveToDb(docs,activeId,nativeMap,globalSettings,h){
  const db=await getSldDb();
  if(!db)return;
  const tx=db.transaction(['docs','blobs'],'readwrite');
  const docStore=tx.objectStore('docs'),blobStore=tx.objectStore('blobs');
  for(const d of docs){
    docStore.put({
      id:d.id,name:d.name,origin:d.origin,modelHash:h,stationId:d.stationId,owner:d.owner,
      voltageFilter:d.voltageFilter,svg:d.svg,notice:d.notice,gaSld:d.gaSld,settings:d.settings,
      structModified:d.structModified,createdAt:d.createdAt,modifiedAt:d.modifiedAt,
      dirty:d.dirty,isActive:d.id===activeId
    });
    const bin=nativeMap.get(d.id);
    if(bin)blobStore.put(bin,d.id);
  }
}

function save(){
  if(!hash())return;
  const h=hash();
  try{
    const data=JSON.stringify({
      schema:'ga.sld.workspace.v4',
      modelHash:h,
      active:state.doc?.id,
      globalSettings:state.globalSettings,
      documents:state.docs.map(d=>({id:d.id,name:d.name,origin:d.origin,modelHash:d.modelHash,stationId:d.stationId,owner:d.owner,voltageFilter:d.voltageFilter,notice:d.notice,createdAt:d.createdAt,modifiedAt:d.modifiedAt}))
    });
    localStorage.setItem(KEY,data);
    state.dirty=false;
  }catch(e){}
  saveToDb(state.docs,state.doc?.id,state.nativeBytes,state.globalSettings,h).catch(()=>{});
}

async function restore(){
  const h=hash();if(!h||state.restoreAttemptedFor===h)return;
  state.restoreAttemptedFor=h;
  try{
    const db=await getSldDb();
    if(db){
      const tx=db.transaction(['docs','blobs'],'readonly');
      const docsReq=tx.objectStore('docs').getAll();
      const docs=await new Promise(r=>{docsReq.onsuccess=()=>r(docsReq.result||[]);docsReq.onerror=()=>r([]);});
      const validDocs=docs.filter(d=>d&&d.modelHash===h);
      if(validDocs.length>0){
        state.docs=validDocs;
        for(const d of validDocs){
          const blobReq=tx.objectStore('blobs').get(d.id);
          const bin=await new Promise(r=>{blobReq.onsuccess=()=>r(blobReq.result);blobReq.onerror=()=>r(null);});
          if(bin)state.nativeBytes.set(d.id,bin);
        }
        const actDoc=state.docs.find(d=>d.isActive)||state.docs[0];
        if(actDoc)activate(actDoc.id);
        return;
      }
    }
  }catch(e){}
  try{
    const j=JSON.parse(localStorage.getItem(KEY)||'null');
    if(j?.globalSettings)state.globalSettings=Object.assign(defaultDiagramSettings(),j.globalSettings);
    if(j?.modelHash===h&&Array.isArray(j.documents)){
      state.docs=j.documents.filter(d=>d&&typeof d.id==='string').slice(0,30);
      state.doc=state.docs.find(d=>d.id===j.active)??state.docs[0]??null;
    }
  }catch(e){}
}

function createDoc({name,origin,svg='',stationId='',owner='',voltageFilter='all',notice='',rawBytes=null,gaSld=null,settings=null}){
  const docSettings=settings?structuredClone(settings):structuredClone(state.globalSettings);
  if(gaSld&&!svg){
    const svgEl=renderGaSldToSvg(gaSld,docSettings);
    svg=new XMLSerializer().serializeToString(svgEl);
  }
  const doc={
    id:uid(),name:safe(name),origin,modelHash:hash(),stationId,owner,voltageFilter,svg,notice,
    gaSld,settings:docSettings,structModified:false,
    createdAt:new Date().toISOString(),modifiedAt:new Date().toISOString(),dirty:false,rawRetained:!!rawBytes
  };
  if(rawBytes)state.nativeBytes.set(doc.id,rawBytes);
  state.docs.push(doc);
  activate(doc.id);
  return doc;
}

function snapshot(){
  if(!state.doc||!state.svg)return;
  state.doc.svg=new XMLSerializer().serializeToString(state.svg);
  state.doc.modifiedAt=new Date().toISOString();
  state.doc.dirty=true;
  state.dirty=true;
  renderTabs();
  save();
}

function commit(){
  if(!state.doc||!state.svg)return;
  state.undo.push({
    svg:new XMLSerializer().serializeToString(state.svg),
    gaSld:state.doc.gaSld?structuredClone(state.doc.gaSld):null,
    settings:state.doc.settings?structuredClone(state.doc.settings):null
  });
  if(state.undo.length>45)state.undo.shift();
  state.redo=[];
}

function applyStageVisualSettings(){
  if(!state.stage)return;
  const cfg=activeSettings();
  state.stage.style.background=cfg.advanced.bgColor||'#0d1e2e';
  state.stage.style.setProperty('--ga-grid-px',`${cfg.layout.gridSpacing||18}px`);
  state.stage.classList.toggle('is-grid',Boolean(cfg.layout.showGrid));
  state.stage.classList.toggle('show-knees-always',cfg.advanced.portKneeVisibility==='always');
  state.stage.classList.toggle('show-knees-never',cfg.advanced.portKneeVisibility==='never');
  if(state.refs.orientHoriz&&state.refs.orientVert){
    const isH=cfg.layout.busOrientation!=='vertical';
    state.refs.orientHoriz.classList.toggle('is-active',isH);
    state.refs.orientVert.classList.toggle('is-active',!isH);
  }
}

function renderEmptyStage(){
  if(!state.stage)return;
  const wrap=E('div','ga-studio-empty');
  wrap.append(
    E('strong','','PSS®E Tek Hat Şeması (SLD) Düzenleme Çalışma Alanı'),
    E('span','','Başlamak için aşağıdaki iki gerçek veri giriş yönteminden birini kullanın:')
  );
  const cards=E('div','ga-studio-empty-cards');
  const cardA=E('div','ga-studio-empty-card');
  cardA.append(
    E('h4','','A. SAV Modelinden Tek Tık Otomatik Çizim'),
    E('p','','Üst araç çubuğundan SAV modelindeki gerçek bir Trafo Merkezini (TM) veya OWNER bölgesini (23 Bölge) seçip "⚡ TM Çiz" veya "🗺 OWNER Çiz" butonuna tıklayın.')
  );
  const cardB=E('div','ga-studio-empty-card');
  cardB.append(
    E('h4','','B. PSS®E Native .sld Şemasını Açma ve Düzenleme'),
    E('p','','"📂 .sld Aç" butonuna tıklayarak veya bilgisayarınızdaki gerçek PSS®E .sld dosyasını bu alana sürükleyip bırakarak orijinal koordinat ve bağlantılarıyla açın.')
  );
  cards.append(cardA,cardB);
  wrap.append(cards);
  state.stage.replaceChildren(wrap);
}

function activate(id){
  state.doc=state.docs.find(d=>d.id===id)||null;
  state.selection=null;state.multiSelect.clear();state.undo=[];state.redo=[];
  renderTabs();
  applyStageVisualSettings();
  updateContextBar(null);
  if(!state.doc){
    renderEmptyStage();
    updateHeaderBadges();
    return;
  }
  state.stage.replaceChildren();
  if(state.doc.gaSld){
    const svg=renderGaSldToSvg(state.doc.gaSld,state.doc.settings);
    state.stage.append(svg);
    state.svg=svg;
    bindSvg();
    state.doc.svg=new XMLSerializer().serializeToString(svg);
  }else if(state.doc.svg){
    const node=new DOMParser().parseFromString(state.doc.svg,'image/svg+xml').documentElement;
    state.stage.append(document.importNode(node,true));
    state.svg=state.stage.querySelector('svg');
    bindSvg();
  }
  updateHeaderBadges();
  toast(state.doc.notice||`${state.doc.name} · ${state.doc.origin}`,'info');
  save();
}

function updateHeaderBadges(){
  const host=state.refs.badges;if(!host)return;
  host.replaceChildren();
  const n=network();
  if(n){
    host.append(E('span','ga-studio-badge',`SAV: ${num(n.buses.length,0)} bara · ${num(n.branches.length,0)} dal`));
  }
  if(!state.doc)return;
  host.append(E('span','ga-studio-badge'+(state.doc.gaSld?' is-native':''),state.doc.origin));
  if(state.doc.gaSld){
    const syms=state.doc.gaSld.components.filter(c=>c.t==='Symbol');
    const links=state.doc.gaSld.components.filter(c=>c.t==='Link');
    const lbls=state.doc.gaSld.components.filter(c=>c.t==='Label');
    let matched=0;for(const s of syms)if(matchSavEquipment(s.map))matched++;
    host.append(
      E('span','ga-studio-badge is-native',`CArchive ${state.doc.gaSld.fileVersion||'2.0.51.1'}`),
      E('span','ga-studio-badge',`${syms.length} sembol · ${links.length} bağ · ${lbls.length} etiket`)
    );
    if(n)host.append(E('span','ga-studio-badge',`SAV eşleşen: ${matched}/${syms.length}`));
  }
}

function closeDoc(id){
  const d=state.docs.find(x=>x.id===id);if(!d)return;
  state.nativeBytes.delete(id);
  state.docs=state.docs.filter(x=>x!==d);
  activate(state.doc?.id===id?state.docs.at(-1)?.id:state.doc?.id);
  save();
}

function renderTabs(){
  if(!state.tabs)return;
  state.tabs.replaceChildren();
  for(const d of state.docs){
    const tab=E('div','ga-studio-tab'+(d===state.doc?' is-active':''));
    tab.setAttribute('role','tab');
    tab.setAttribute('aria-selected',String(d===state.doc));
    const name=E('button','ga-studio-tab-name',`${d.name}${d.dirty?' •':''}`);
    name.title=`${d.origin} · ${d.name}`;
    name.onclick=()=>activate(d.id);
    const dup=E('button','ga-studio-tab-dup','⧉');
    dup.title='Sekmeyi kopyala';
    dup.onclick=()=>duplicateDoc(d);
    const rename=E('button','ga-studio-tab-rename','✎');
    rename.title='Yeniden adlandır';
    rename.onclick=()=>{
      const nn=prompt('Şema adı:',d.name);
      if(nn?.trim()){d.name=safe(nn.trim());renderTabs();save();}
    };
    const x=E('button','ga-studio-tab-close','×');
    x.title='Sekmeyi kapat';
    x.onclick=()=>closeDoc(d.id);
    tab.append(name,dup,rename,x);
    state.tabs.append(tab);
  }
}

function duplicateDoc(d=state.doc){
  if(!d)return;
  const raw=state.nativeBytes.get(d.id);
  createDoc({
    name:`${d.name} (kopya)`,
    origin:d.origin,
    svg:d.svg,
    stationId:d.stationId,
    owner:d.owner,
    voltageFilter:d.voltageFilter,
    gaSld:d.gaSld?structuredClone(d.gaSld):null,
    settings:d.settings?structuredClone(d.settings):null,
    rawBytes:raw?new Uint8Array(raw):null,
    notice:'Kopya diyagram sekmesi oluşturuldu.'
  });
}

function currentStation(){return $('[aria-label="Trafo merkezi"]',state.root);}
function fromStationId(stationId){
  const select=currentStation();if(!select)return false;
  const opt=[...select.options].find(o=>o.value===stationId);if(!opt)return false;
  select.value=stationId;select.dispatchEvent(new Event('change',{bubbles:true}));return true;
}

function newTm(stationOverride=''){
  const sel=currentStation();
  if(!network()){toast('Önce SAV modelini yükleyin ve TM seçin.','warn');return null;}
  const stationId=stationOverride||state.refs.tm?.value||sel?.value;
  if(!stationId){toast('Lütfen üst listeden bir Trafo Merkezi (TM) seçin.','warn');return null;}
  if(sel&&stationId!==sel.value)fromStationId(stationId);
  const orient=activeSettings()?.layout?.busOrientation||'horizontal';
  const gaSld=buildTmGaSld(stationId,orient);
  if(!gaSld||!gaSld.components.length){
    toast('Seçilen TM için SAV modelinde aktif bara bulunamadı.','warn');
    return null;
  }
  const optText=state.refs.tm?.selectedOptions?.[0]?.textContent?.split(' · ')[0]||gaSld.name.replace(/_TM\.sld$/,'');
  return createDoc({
    name:`${optText} TM`,
    stationId,
    origin:'TM_AUTO',
    gaSld,
    notice:`${optText} TM şeması SAV modelinden (${orient==='vertical'?'Dikey':'Yatay'} bara düzeniyle) oluşturuldu.`
  });
}

function ownerOptions(){
  const m=model(),buses=network()?.buses||[];if(!m)return[];
  const eq=new Map(m.equipment.filter(e=>e.kind==='bus').map(e=>[e.id,e]));
  const ow=new Map(m.equipment.filter(e=>e.kind==='owner').map(e=>[String(e.fields.iowner),e.name]));
  const counts=new Map();
  for(const b of buses){
    if(!b.source)continue;
    const e=eq.get(b.sourceEquipmentId),code=String(e?.fields.owner??'');
    if(code)counts.set(code,(counts.get(code)||0)+1);
  }
  return [...counts].map(([code,count])=>({code,count,name:ow.get(code)||({'723':'YURTDISI'}[code])||`OWNER ${code}`})).sort((a,b)=>Number(a.code)-Number(b.code));
}

function populateStations(){
  const source=currentStation(),sel=state.refs.tm;if(!sel||!source)return;
  const old=sel.value||source.value;
  sel.replaceChildren(...[...source.options].map(o=>new Option(o.textContent,o.value)));
  if([...sel.options].some(o=>o.value===old))sel.value=old;else sel.value=source.value;
}

function populateOwner(){
  const sel=state.refs.owner;if(!sel)return;
  const old=sel.value;
  const source=$('[aria-label="BM / Bus OWNER filtresi"]',state.root);
  const names=new Map([...source?.options||[]].filter(o=>o.value).map(o=>[o.value,(o.textContent||'').replace(/\s*\(\d+\)\s*$/,'').trim()]));
  sel.replaceChildren(new Option('OWNER Bölgesi Seç (23 Bölge)',''),...ownerOptions().map(o=>new Option(`${names.get(o.code)||o.name} (${o.code}) · ${o.count} bara`,o.code)));
  if([...sel.options].some(o=>o.value===old))sel.value=old;
}

function newOwner(ownerOverride=''){
  if(!network()){toast('Önce SAV modelini yükleyin.','warn');return null;}
  const owner=String(ownerOverride||state.refs.owner?.value||'').trim();
  if(!owner){toast('Lütfen üst listeden bir OWNER bölgesi seçin.','warn');return null;}
  const vFilter=state.refs.voltage?.value||'all';
  const orient=activeSettings()?.layout?.busOrientation||'horizontal';
  const gaSld=buildOwnerGaSld(owner,vFilter,orient);
  if(!gaSld||!gaSld.components.length){
    toast('Bu filtrede seçilen OWNER bölgesi için bara bulunamadı.','warn');
    return null;
  }
  const op=ownerOptions().find(o=>o.code===owner);
  const display=state.refs.owner?.selectedOptions?.[0]?.textContent?.split(' (')[0]||op?.name||`OWNER ${owner}`;
  return createDoc({
    name:`${display} (${owner})`,
    origin:'OWNER_AUTO',
    owner,
    voltageFilter:vFilter,
    gaSld,
    notice:`OWNER ${owner} (${display}) bölgesel şeması 90° ortogonal hatlarla oluşturuldu.`
  });
}

function setBusOrientation(orient){
  const norm=orient==='vertical'?'vertical':'horizontal';
  state.globalSettings.layout.busOrientation=norm;
  if(state.doc?.settings)state.doc.settings.layout.busOrientation=norm;
  applyStageVisualSettings();
  if(!state.doc||!state.doc.gaSld)return;
  commit();
  if(state.doc.origin==='TM_AUTO'&&state.doc.stationId&&network()){
    const rebuilt=buildTmGaSld(state.doc.stationId,norm);
    if(rebuilt){
      state.doc.gaSld=rebuilt;
      refreshGaSldCanvas(false);
      fit();
      toast(`TM şeması ${norm==='horizontal'?'YATAY':'DİKEY'} bara düzenine geçirildi.`,'ok');
      return;
    }
  }
  if(state.doc.origin==='OWNER_AUTO'&&state.doc.owner&&network()){
    const rebuilt=buildOwnerGaSld(state.doc.owner,state.doc.voltageFilter||'all',norm);
    if(rebuilt){
      state.doc.gaSld=rebuilt;
      refreshGaSldCanvas(false);
      fit();
      toast(`OWNER şeması ${norm==='horizontal'?'YATAY':'DİKEY'} bara düzenine geçirildi.`,'ok');
      return;
    }
  }
  // For NATIVE_SLD or custom selection, rotate selected busbars or all busbars to match requested orientation
  const targetRot=norm==='horizontal'?90:0;
  const selComp=state.selection?.dataset?.sldId?findGaSldComp(state.selection.dataset.sldId):null;
  if(selComp&&selComp.stype==='Busbar'){
    resizeOrRotateBusbar(selComp,selComp.len,selComp.width,targetRot,state.doc.gaSld);
  }else{
    for(const c of state.doc.gaSld.components){
      if(c.t==='Symbol'&&c.stype==='Busbar'){
        resizeOrRotateBusbar(c,c.len,c.width,targetRot,state.doc.gaSld);
      }
    }
  }
  refreshGaSldCanvas(true);
  toast(`Bara yönü ${norm==='horizontal'?'YATAY':'DİKEY'} olarak güncellendi.`,'ok');
}

function setMode(mode){
  state.mode=mode;
  $$('[data-ga-tool]',state.host).forEach(b=>b.classList.toggle('is-active',b.dataset.gaTool===mode));
  const msg={
    select:'Araç: Seç / Taşı — Bara, ekipman, etiket veya knee-point sürükleyin.',
    route90:'Araç: Hat Rotası (90°) — Bir bağlantı hattına tıklayarak 90° dik açılı rotaya dönüştürün.',
    knee:'Araç: Knee-Point Ekle/Sil — Hat üzerine tıklayarak kırılma noktası ekleyin; mevcut noktaya tıklayarak silin.',
    label:'Araç: Etiket Taşı — Yalnızca etiketleri seçip kaydırın (semboller sabit kalır).'
  }[mode]||`Araç: ${mode}`;
  toast(msg,'info');
}

function bounds(){const a=state.svg?.viewBox?.baseVal;return a?{x:a.x,y:a.y,w:a.width,h:a.height}:null;}
function toPoint(e){
  const svg=state.svg;if(!svg)return {x:0,y:0};
  const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
  try{
    const pt=p.matrixTransform(svg.getScreenCTM().inverse());
    const cfg=activeSettings();
    if(cfg.layout.snapToGrid){
      const step=Number(cfg.layout.snapStep)||9;
      return {x:Math.round(pt.x/step)*step,y:Math.round(pt.y/step)*step};
    }
    return pt;
  }catch{return {x:0,y:0};}
}

function target(e){
  const knee=e.target.closest?.('.ga-studio-knee');
  if(knee&&state.svg.contains(knee))return knee;
  if(state.mode==='label'){
    const lbl=e.target.closest?.('.ga-studio-sld-label');
    return lbl&&state.svg.contains(lbl)?lbl:null;
  }
  const node=e.target.closest?.('[data-sld-id], [data-ga-node], .ga-sld-bus, .ga-sld-branch');
  return node&&state.svg.contains(node)?node:null;
}

function findGaSldComp(id){
  if(!state.doc?.gaSld)return null;
  const n=Number(id);
  return state.doc.gaSld.components.find(c=>c.id===n)||null;
}

function uniqueId(el){
  if(!el)return 'Nesne';
  if(el.dataset?.sldId){
    const c=findGaSldComp(el.dataset.sldId);
    if(c){
      if(c.t==='Label')return `Etiket #${c.id}: ${(c.text||'').replace(/\s+/g,' ').slice(0,34)}`;
      if(c.t==='Symbol')return `${c.psse||c.stype} #${c.id}${c.map?' · '+c.map.trim():''}`;
      return `Bağlantı #${c.id}`;
    }
  }
  return el.getAttribute('data-ga-node')||el.getAttribute('data-bus-id')||'Nesne';
}

function refreshGaSldCanvas(keepViewBox=true){
  if(!state.doc?.gaSld||!state.stage)return;
  applyStageVisualSettings();
  const vb=keepViewBox&&state.svg?state.svg.getAttribute('viewBox'):null;
  const selId=state.selection?.dataset?.sldId;
  const newSvg=renderGaSldToSvg(state.doc.gaSld,state.doc.settings);
  if(vb)newSvg.setAttribute('viewBox',vb);
  const old=state.stage.querySelector('svg');
  if(old)old.replaceWith(newSvg);else state.stage.append(newSvg);
  state.svg=newSvg;
  bindSvg();
  if(selId){
    const nextEl=$(`[data-sld-id="${selId}"]`,state.svg);
    if(nextEl)selectNode(nextEl,false);
  }else updateContextBar(null);
  snapshot();
  updateHeaderBadges();
}

function updateContextBar(el){
  const bar=state.refs.contextBar;if(!bar)return;
  if(!el){
    bar.classList.remove('is-visible');
    return;
  }
  bar.classList.add('is-visible');
  state.refs.contextTitle.textContent=uniqueId(el);
}

function selectNode(el,additive=false){
  if(!additive){
    $$('.ga-studio-selected, .ga-studio-multi-selected',state.stage).forEach(n=>{
      n.classList.remove('ga-studio-selected','ga-studio-multi-selected');
    });
    state.multiSelect.clear();
  }
  state.selection=el;
  if(el){
    el.classList.add('ga-studio-selected');
    state.multiSelect.add(el);
    if(state.multiSelect.size>1){
      for(const m of state.multiSelect)if(m!==el)m.classList.add('ga-studio-multi-selected');
    }
  }
  updateContextBar(el);
}

function updateLiveSvgForMovedSymbol(sym){
  if(!state.svg||!state.doc?.gaSld||!sym)return;
  const sx=Number((sym.pos[0]*SLD_SCALE).toFixed(2)),sy=Number((-sym.pos[1]*SLD_SCALE).toFixed(2));
  const symEl=$(`.ga-studio-sld-symbol[data-sld-id="${sym.id}"]`,state.svg);
  if(symEl){
    symEl.setAttribute('data-sld-x',String(sym.pos[0]));
    symEl.setAttribute('data-sld-y',String(sym.pos[1]));
    if(sym.stype==='Busbar'&&sym.ends?.length===2){
      const line=$('line.ga-sld-busbar',symEl);
      if(line){
        line.setAttribute('x1',String(Number((sym.ends[0][0]*SLD_SCALE).toFixed(2))));
        line.setAttribute('y1',String(Number((-sym.ends[0][1]*SLD_SCALE).toFixed(2))));
        line.setAttribute('x2',String(Number((sym.ends[1][0]*SLD_SCALE).toFixed(2))));
        line.setAttribute('y2',String(Number((-sym.ends[1][1]*SLD_SCALE).toFixed(2))));
      }
      const badge=$('.ga-studio-pf-badge',symEl);
      if(badge){badge.setAttribute('x',String(sx));badge.setAttribute('y',String(sy+15));}
    }else{
      const inner=$('.ga-sld-sym-inner',symEl);
      if(inner){
        if(inner.tagName.toLowerCase()==='circle'){
          inner.setAttribute('cx',String(sx));inner.setAttribute('cy',String(sy));
        }else{
          inner.setAttribute('transform',`translate(${sx} ${sy}) rotate(${-(sym.rot||0)})`);
        }
      }
    }
  }
  for(const c of state.doc.gaSld.components){
    if(c.t==='Label'&&c.owner===sym.id&&c.pos){
      const lblEl=$(`.ga-studio-sld-label[data-sld-id="${c.id}"]`,state.svg);
      if(lblEl){
        const lx=Number((c.pos[0]*SLD_SCALE).toFixed(2)),ly=Number((-c.pos[1]*SLD_SCALE).toFixed(2));
        const txt=$('text',lblEl);
        if(txt){
          txt.setAttribute('x',String(lx));txt.setAttribute('y',String(ly));
          $$('tspan',txt).forEach(ts=>ts.setAttribute('x',String(lx)));
        }
      }
    }else if(c.t==='Link'&&(c.p1?.sym===sym.id||c.p2?.sym===sym.id)){
      const lkEl=$(`.ga-studio-sld-link[data-sld-id="${c.id}"]`,state.svg);
      if(lkEl&&c.p1?.pos&&c.p2?.pos){
        const pts=[c.p1.pos,...(c.knees||[]),c.p2.pos].map(p=>[Number((p[0]*SLD_SCALE).toFixed(2)),Number((-p[1]*SLD_SCALE).toFixed(2))]);
        const path=$('path.ga-sld-line',lkEl);
        if(path)path.setAttribute('d','M '+pts.map(p=>`${p[0]} ${p[1]}`).join(' L '));
        const circles=$$('circle.ga-studio-knee',lkEl);
        (c.knees||[]).forEach((kp,kIdx)=>{
          if(circles[kIdx]){
            circles[kIdx].setAttribute('cx',String(Number((kp[0]*SLD_SCALE).toFixed(2))));
            circles[kIdx].setAttribute('cy',String(Number((-kp[1]*SLD_SCALE).toFixed(2))));
          }
        });
      }
    }
  }
}

function handleKneeOrRouteToolClick(p,el){
  if(!state.doc?.gaSld)return;
  if(el?.classList?.contains('ga-studio-knee')&&state.mode==='knee'){
    const lk=findGaSldComp(Number(el.dataset.linkId));
    const kIdx=Number(el.dataset.kneeIdx);
    if(lk&&Array.isArray(lk.knees)&&lk.knees[kIdx]!==undefined){
      commit();
      lk.knees.splice(kIdx,1);
      refreshGaSldCanvas(true);
      toast(`Knee-point silindi (Bağ #${lk.id}).`,'ok');
    }
    return;
  }
  const linkEl=el?.closest?.('.ga-studio-sld-link')||(el?.dataset?.sldType==='Link'?el:null);
  if(!linkEl){
    toast('Lütfen bir bağlantı hattı (Link) üzerine tıklayın.','warn');
    return;
  }
  const lk=findGaSldComp(Number(linkEl.dataset.sldId));
  if(!lk||!lk.p1?.pos||!lk.p2?.pos)return;
  commit();
  if(state.mode==='route90'){
    const s1=findGaSldComp(lk.p1.sym),s2=findGaSldComp(lk.p2.sym);
    lk.knees=buildOrthogonalKnees(lk.p1.pos,lk.p2.pos,s1,s2);
    refreshGaSldCanvas(true);
    toast(`Bağlantı #${lk.id} 90° dik açılı rotaya dönüştürüldü.`,'ok');
  }else if(state.mode==='knee'){
    if(!Array.isArray(lk.knees))lk.knees=[];
    const kx=Number((p.x/SLD_SCALE).toFixed(4)),ky=Number((-p.y/SLD_SCALE).toFixed(4));
    const pts=[lk.p1.pos,...lk.knees,lk.p2.pos];
    let bestIdx=lk.knees.length,bestDist=1e9;
    for(let i=0;i<pts.length-1;i++){
      const mx=(pts[i][0]+pts[i+1][0])/2,my=(pts[i][1]+pts[i+1][1])/2;
      const d=Math.hypot(kx-mx,ky-my);
      if(d<bestDist){bestDist=d;bestIdx=i;}
    }
    const [x1,y1]=pts[bestIdx],[x2,y2]=pts[bestIdx+1];
    const isHoriz=Math.abs(x2-x1)>=Math.abs(y2-y1);
    if(isHoriz){
      lk.knees.splice(bestIdx,0,[kx,y1],[kx,ky]);
    }else{
      lk.knees.splice(bestIdx,0,[x1,ky],[kx,ky]);
    }
    refreshGaSldCanvas(true);
    toast(`90° Dik Knee-point çifti eklendi (Bağ #${lk.id} · toplam ${lk.knees.length}).`,'ok');
  }
}

function groupSelected(){
  if(state.multiSelect.size<2){
    toast('Gruplamak için en az 2 nesne seçilmelidir (Shift ile çoklu seçim yapın).','warn');
    return;
  }
  commit();
  const gid='grp-'+Date.now();
  let count=0;
  for(const el of state.multiSelect){
    const cid=Number(el.dataset?.sldId);
    const comp=findGaSldComp(cid);
    if(comp){comp.groupId=gid;count++;}
  }
  toast(`${count} nesne başarıyla gruplandı.`,'ok');
  snapshot();
}

function ungroupSelected(){
  commit();
  let count=0;
  const targets=state.multiSelect.size>0?[...state.multiSelect]:(state.selection?[state.selection]:[]);
  for(const el of targets){
    const cid=Number(el.dataset?.sldId);
    const comp=findGaSldComp(cid);
    if(comp&&comp.groupId){delete comp.groupId;count++;}
  }
  if(count>0){toast(`${count} nesnenin grubu çözüldü.`,'ok');snapshot();}
  else{toast('Seçili grupta çözülecek eleman bulunamadı.','warn');}
}

function showBusbarPopup(busComp,clientX,clientY){
  hideBusbarPopup();
  const popup=E('div','ga-studio-bus-popup');
  popup.style.left=`${Math.min(window.innerWidth-200,clientX+10)}px`;
  popup.style.top=`${Math.min(window.innerHeight-220,clientY+10)}px`;

  popup.append(E('strong','',`Bara #${busComp.id} Biçimlendir`),E('hr'));
  const btnFlat=E('button','','━ Düz Bara (Standart)');
  btnFlat.onclick=()=>{
    commit();busComp.stype='Busbar';busComp.len=busComp.len&&busComp.len>4?busComp.len:16.0;busComp.width=0.4;
    recomputeBusbarEnds(busComp);refreshGaSldCanvas(true);hideBusbarPopup();
    toast(`Bara #${busComp.id} Düz Bara olarak ayarlandı.`,'ok');
  };
  const btnDot=E('button','','● Nokta / Daire Bara');
  btnDot.onclick=()=>{
    commit();busComp.stype='Busbar';busComp.len=0.4;busComp.width=0.4;
    recomputeBusbarEnds(busComp);refreshGaSldCanvas(true);hideBusbarPopup();
    toast(`Bara #${busComp.id} Nokta/Daire Bara olarak ayarlandı.`,'ok');
  };
  const btnShort=E('button','','─ Kısa Bara');
  btnShort.onclick=()=>{
    commit();busComp.stype='Busbar';busComp.len=4.0;busComp.width=0.4;
    recomputeBusbarEnds(busComp);refreshGaSldCanvas(true);hideBusbarPopup();
    toast(`Bara #${busComp.id} Kısa Bara olarak ayarlandı.`,'ok');
  };
  const btnClose=E('button','','Kapat');
  btnClose.onclick=()=>hideBusbarPopup();
  popup.append(btnFlat,btnDot,btnShort,E('hr'),btnClose);
  document.body.append(popup);
  state.busPopup=popup;
}

function hideBusbarPopup(){
  if(state.busPopup){state.busPopup.remove();state.busPopup=null;}
}

function bindSvg(){
  const svg=state.svg;if(!svg)return;
  svg.removeAttribute('width');svg.removeAttribute('height');
  svg.style.width='100%';svg.style.height='100%';svg.style.touchAction='none';

  svg.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const p=toPoint(e),el=target(e);
    if(state.mode==='route90'||state.mode==='knee'){
      handleKneeOrRouteToolClick(p,el);
      return;
    }
    const locked=Boolean(activeSettings()?.advanced?.lockLayout);
    if(el?.classList?.contains('ga-studio-knee')&&!locked){
      commit();
      state.drag={id:e.pointerId,p,prev:p,el,mode:'knee',linkId:Number(el.dataset.linkId),kneeIdx:Number(el.dataset.kneeIdx),changed:false};
      svg.setPointerCapture(e.pointerId);e.preventDefault();return;
    }
    if(el)selectNode(el,e.shiftKey);else if(!e.shiftKey)selectNode(null);
    const canMove=el&&!locked&&el.dataset?.sldType!=='Link';
    const mode=canMove?'move':'pan';
    if(mode==='move')commit();
    state.drag={id:e.pointerId,p,prev:p,el,mode,vb:bounds(),changed:false};
    svg.setPointerCapture(e.pointerId);e.preventDefault();
  });

  svg.addEventListener('pointermove',e=>{
    const d=state.drag;if(!d||d.id!==e.pointerId)return;
    const p=toPoint(e),dx=p.x-d.prev.x,dy=p.y-d.prev.y;
    if(d.mode==='pan'){
      if(d.vb){
        const disp={x:p.x-d.p.x,y:p.y-d.p.y};
        svg.setAttribute('viewBox',`${d.vb.x-disp.x} ${d.vb.y-disp.y} ${d.vb.w} ${d.vb.h}`);
      }
    }else if(d.mode==='knee'&&state.doc?.gaSld){
      const lk=findGaSldComp(d.linkId);
      if(lk&&lk.knees&&lk.knees[d.kneeIdx]){
        lk.knees[d.kneeIdx]=[Number((p.x/SLD_SCALE).toFixed(4)),Number((-p.y/SLD_SCALE).toFixed(4))];
        d.el.setAttribute('cx',String(p.x));d.el.setAttribute('cy',String(p.y));
        const pts=[lk.p1.pos,...lk.knees,lk.p2.pos].map(pt=>[Number((pt[0]*SLD_SCALE).toFixed(2)),Number((-pt[1]*SLD_SCALE).toFixed(2))]);
        const path=d.el.closest('.ga-studio-sld-link')?.querySelector('path.ga-sld-line');
        if(path)path.setAttribute('d','M '+pts.map(pt=>`${pt[0]} ${pt[1]}`).join(' L '));
        d.changed=true;
      }
    }else if(d.mode==='move'&&Math.abs(dx)+Math.abs(dy)>0.02){
      const targets=state.multiSelect.size>1?[...state.multiSelect]:[d.el];
      const sdx=dx/SLD_SCALE,sdy=-dy/SLD_SCALE;
      for(const item of targets){
        if(state.doc?.gaSld&&item?.dataset?.sldId){
          const c=findGaSldComp(item.dataset.sldId);
          if(c){
            if(c.t==='Symbol'){
              translateGaSldSymbol(c,sdx,sdy,state.doc.gaSld);
              updateLiveSvgForMovedSymbol(c);
            }else if(c.t==='Label'&&c.pos){
              c.pos=[Number((c.pos[0]+sdx).toFixed(4)),Number((c.pos[1]+sdy).toFixed(4))];
              const lx=Number((c.pos[0]*SLD_SCALE).toFixed(2)),ly=Number((-c.pos[1]*SLD_SCALE).toFixed(2));
              const txt=$('text',item);
              if(txt){
                txt.setAttribute('x',String(lx));txt.setAttribute('y',String(ly));
                $$('tspan',txt).forEach(ts=>ts.setAttribute('x',String(lx)));
              }
            }
          }
        }
      }
      d.changed=true;
    }
    d.prev=p;
  });

  const end=()=>{
    if(!state.drag)return;
    const d=state.drag;state.drag=null;
    if(d.changed){
      if(state.doc?.gaSld)refreshGaSldCanvas(true);
      else snapshot();
    }else if(d.mode==='pan')snapshot();
  };
  svg.addEventListener('pointerup',end);
  svg.addEventListener('pointercancel',end);

  svg.addEventListener('wheel',e=>{
    e.preventDefault();
    const vb=bounds();if(!vb)return;
    const adv=activeSettings().advanced;
    const stepPct=(Number(adv.zoomStep)||16)/100;
    const scale=e.deltaY<0?(1-stepPct):(1+stepPct);
    const p=toPoint(e);
    const nw=Math.max(Number(adv.zoomMin)||25,Math.min(Number(adv.zoomMax)||18000,vb.w*scale));
    const nh=vb.h*nw/vb.w;
    svg.setAttribute('viewBox',`${p.x-(p.x-vb.x)*nw/vb.w} ${p.y-(p.y-vb.y)*nh/vb.h} ${nw} ${nh}`);
    snapshot();
  },{passive:false});

  svg.addEventListener('dblclick',e=>{
    const el=target(e);
    if(el){
      selectNode(el);
      openObjectInspectorModal(el);
    }
  });
}

function zoomBy(factor){
  const vb=bounds();if(!vb||!state.svg)return;
  const adv=activeSettings().advanced;
  const nw=Math.max(Number(adv.zoomMin)||25,Math.min(Number(adv.zoomMax)||18000,vb.w*factor));
  const nh=vb.h*nw/vb.w;
  const cx=vb.x+vb.w/2,cy=vb.y+vb.h/2;
  state.svg.setAttribute('viewBox',`${cx-nw/2} ${cy-nh/2} ${nw} ${nh}`);
  snapshot();
}

function fit(){
  const svg=state.svg;if(!svg)return;
  try{
    const groups=$$('.ga-sld-layer-group',svg);
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const g of groups){
      if(g.style.display==='none')continue;
      const bb=g.getBBox();
      if(bb.width>0||bb.height>0){
        if(bb.x<minX)minX=bb.x;
        if(bb.y<minY)minY=bb.y;
        if(bb.x+bb.width>maxX)maxX=bb.x+bb.width;
        if(bb.y+bb.height>maxY)maxY=bb.y+bb.height;
      }
    }
    if(Number.isFinite(minX)){
      const pad=48;
      svg.setAttribute('viewBox',`${minX-pad} ${minY-pad} ${Math.max(120,maxX-minX+pad*2)} ${Math.max(90,maxY-minY+pad*2)}`);
      snapshot();
    }
  }catch{toast('Sığdırma hesaplanamadı.','warn');}
}

function focusSelected(){
  if(!state.selection||!state.svg){toast('Odaklanmak için önce bir nesne seçin.','warn');return;}
  if(state.doc?.gaSld&&state.selection.dataset?.sldId){
    const c=findGaSldComp(state.selection.dataset.sldId);
    const pt=c?.pos||(c?.p1?.pos&&c?.p2?.pos?[(c.p1.pos[0]+c.p2.pos[0])/2,(c.p1.pos[1]+c.p2.pos[1])/2]:null);
    if(pt){
      const cx=pt[0]*SLD_SCALE,cy=-pt[1]*SLD_SCALE;
      const vb=bounds()||{w:600,h:400};
      const w=Math.min(vb.w,520),h=Math.min(vb.h,360);
      state.svg.setAttribute('viewBox',`${cx-w/2} ${cy-h/2} ${w} ${h}`);
      snapshot();
      return;
    }
  }
}

function toggleFullscreen(){
  if(!state.host)return;
  if(!document.fullscreenElement){
    state.host.requestFullscreen?.().catch(()=>{});
  }else{
    document.exitFullscreen?.().catch(()=>{});
  }
}

function alignSelected(mode){
  const items=[...state.multiSelect];
  if(items.length<2){toast('Hizalama için Shift+Tık ile en az 2 nesne seçin.','warn');return;}
  commit();
  if(state.doc?.gaSld){
    const comps=items.map(el=>findGaSldComp(el.dataset?.sldId)).filter(c=>c&&c.pos);
    if(comps.length<2)return;
    if(mode==='left'){const v=Math.min(...comps.map(c=>c.pos[0]));comps.forEach(c=>{const dx=v-c.pos[0];if(c.t==='Symbol')translateGaSldSymbol(c,dx,0);else c.pos[0]=v;});}
    else if(mode==='center-x'){const v=comps.reduce((s,c)=>s+c.pos[0],0)/comps.length;comps.forEach(c=>{const dx=Number((v-c.pos[0]).toFixed(4));if(c.t==='Symbol')translateGaSldSymbol(c,dx,0);else c.pos[0]=Number(v.toFixed(4));});}
    else if(mode==='top'){const v=Math.max(...comps.map(c=>c.pos[1]));comps.forEach(c=>{const dy=v-c.pos[1];if(c.t==='Symbol')translateGaSldSymbol(c,0,dy);else c.pos[1]=v;});}
    else if(mode==='center-y'){const v=comps.reduce((s,c)=>s+c.pos[1],0)/comps.length;comps.forEach(c=>{const dy=Number((v-c.pos[1]).toFixed(4));if(c.t==='Symbol')translateGaSldSymbol(c,0,dy);else c.pos[1]=Number(v.toFixed(4));});}
    else if(mode==='distribute-x'){
      comps.sort((a,b)=>a.pos[0]-b.pos[0]);
      const min=comps[0].pos[0],max=comps.at(-1).pos[0],step=(max-min)/(comps.length-1||1);
      comps.forEach((c,i)=>{const dx=Number((min+i*step-c.pos[0]).toFixed(4));if(c.t==='Symbol')translateGaSldSymbol(c,dx,0);else c.pos[0]=Number((min+i*step).toFixed(4));});
    }else if(mode==='distribute-y'){
      comps.sort((a,b)=>a.pos[1]-b.pos[1]);
      const min=comps[0].pos[1],max=comps.at(-1).pos[1],step=(max-min)/(comps.length-1||1);
      comps.forEach((c,i)=>{const dy=Number((min+i*step-c.pos[1]).toFixed(4));if(c.t==='Symbol')translateGaSldSymbol(c,0,dy);else c.pos[1]=Number((min+i*step).toFixed(4));});
    }
    refreshGaSldCanvas(true);
    toast(`Hizalama uygulandı (${comps.length} nesne).`,'ok');
  }
}

function rotateSelected(){
  if(!state.selection||!state.doc?.gaSld)return;
  const c=findGaSldComp(state.selection.dataset?.sldId);
  if(!c)return;
  commit();
  const nextRot=((Number(c.rot||0)+90)%360);
  if(c.stype==='Busbar'){
    resizeOrRotateBusbar(c,c.len,c.width,nextRot,state.doc.gaSld);
  }else{
    c.rot=nextRot;
    if(c.t==='Symbol')translateGaSldSymbol(c,0,0,state.doc.gaSld);
  }
  refreshGaSldCanvas(true);
  toast(`${uniqueId(state.selection)} 90° döndürüldü.`,'ok');
}

function resolveOverlaps(){
  if(!state.doc?.gaSld)return 0;
  commit();
  const moved=resolveGaSldOverlaps(state.doc.gaSld);
  refreshGaSldCanvas(true);
  toast(`Etiket ve sembol çakışma azaltma tamamlandı (${moved} çakışma düzeltildi).`,'ok');
  return moved;
}

function undo(){
  if(!state.undo.length||!state.svg||!state.doc)return;
  state.redo.push({
    svg:new XMLSerializer().serializeToString(state.svg),
    gaSld:state.doc.gaSld?structuredClone(state.doc.gaSld):null,
    settings:state.doc.settings?structuredClone(state.doc.settings):null
  });
  const prev=state.undo.pop();
  state.doc.gaSld=prev.gaSld;
  if(prev.settings)state.doc.settings=prev.settings;
  if(state.doc.gaSld)refreshGaSldCanvas(true);
}

function redo(){
  if(!state.redo.length||!state.svg||!state.doc)return;
  state.undo.push({
    svg:new XMLSerializer().serializeToString(state.svg),
    gaSld:state.doc.gaSld?structuredClone(state.doc.gaSld):null,
    settings:state.doc.settings?structuredClone(state.doc.settings):null
  });
  const next=state.redo.pop();
  state.doc.gaSld=next.gaSld;
  if(next.settings)state.doc.settings=next.settings;
  if(state.doc.gaSld)refreshGaSldCanvas(true);
}

function exportFile(data,name,type='application/octet-stream'){
  const url=URL.createObjectURL(new Blob([data],{type}));
  const a=E('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function basename(){return (state.doc?.name||'SLD').replace(/\.sld$/i,'').replace(/[\\/:*?"<>|]/g,'_').slice(0,75);}

async function exportNativeSld(options={}){
  if(!state.doc||!state.doc.gaSld){
    const msg='Dışa aktarılacak aktif bir SLD şeması bulunmuyor.';
    toast(msg,'error');
    return {ok:false,error:msg};
  }
  const gaSld=state.doc.gaSld;
  ensureLinkPortAttachments(gaSld);
  const rawBytes=state.nativeBytes.get(state.doc.id)||null;
  const docToSerialize={...gaSld,rawBytes:rawBytes||undefined};

  try{
    const targetVer=gaSld.fileVersion||(rawBytes?validateSldBinary(rawBytes).version:'2.0.51.1')||'2.0.51.1';
    const sldBytes=serializeSldBinary(docToSerialize,targetVer);
    state.nativeBytes.set(state.doc.id,sldBytes);
    state.doc.structModified=false;
    const fileName=(options.fileName||basename())+'.sld';
    if(!options.skipDownload)exportFile(sldBytes,fileName,'application/octet-stream');
    toast(`Gerçek native PSS®E binary .sld kaydedildi (${formatBytes(sldBytes.length)} · CArchive ${targetVer} · Köprüsüz Native).`,'ok');
    return {ok:true,mode:'native-serializer',bytes:sldBytes};
  }catch(e){
    toast('Native CArchive dışa aktarım hatası: '+e.message,'error');
    return {ok:false,error:e.message};
  }
}

async function exportNativeSldAs(){
  if(!state.doc?.gaSld){toast('Dışa aktarılacak aktif SLD bulunmuyor.','error');return;}
  const current=basename();
  const name=prompt('Yeni PSS®E .sld dosya adı:',current);
  if(!name)return;
  await exportNativeSld({fileName:name.trim().replace(/\.sld$/i,'')});
}

function exportGaSldJson(){
  if(!state.doc?.gaSld)return;
  ensureLinkPortAttachments(state.doc.gaSld);
  exportFile(JSON.stringify(state.doc.gaSld,null,2),basename()+'.gasld.json','application/json;charset=utf-8');
  toast(`${basename()}.gasld.json indirildi.`,'ok');
}

function svgText(){
  if(!state.svg)return null;
  const copy=state.svg.cloneNode(true);
  $$('.ga-studio-selected,.ga-studio-multi-selected',copy).forEach(n=>n.classList.remove('ga-studio-selected','ga-studio-multi-selected'));
  copy.setAttribute('xmlns',NS);
  const bg=activeSettings()?.advanced?.bgColor||'#0d1e2e';
  copy.setAttribute('style',`background:${bg};font-family:system-ui,Segoe UI,sans-serif;color:#eaf1fa`);
  return new XMLSerializer().serializeToString(copy);
}

function exportSvg(){const xml=svgText();if(xml)exportFile(xml,basename()+'.svg','image/svg+xml;charset=utf-8');}

async function exportPng(){
  const xml=svgText(),vb=bounds();if(!xml||!vb)return;
  const canvas=E('canvas'),w=Math.min(3600,Math.max(900,Math.round(vb.w*1.5)));
  canvas.width=w;canvas.height=Math.min(4500,Math.max(500,Math.round(w*vb.h/vb.w)));
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=activeSettings()?.advanced?.bgColor||'#0d1e2e';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const img=new Image(),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));
  try{
    await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(Error('SVG görüntü yüklenemedi'));img.src=url;});
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    canvas.toBlob(b=>{if(b)exportFile(b,basename()+'.png','image/png');});
  }catch(e){toast(e.message,'error');}finally{URL.revokeObjectURL(url);}
}

function exportProject(){
  save();
  const work={
    schema:'ga.sld.workspace.v3',
    source:{modelHash:hash(),sourceSha256:network()?.sourceSha256,name:network()?.sourceName},
    active:state.doc?.id,
    globalSettings:state.globalSettings,
    documents:state.docs.map(d=>({id:d.id,name:d.name,origin:d.origin,modelHash:d.modelHash,stationId:d.stationId,owner:d.owner,voltageFilter:d.voltageFilter,svg:d.svg,gaSld:d.gaSld,settings:d.settings}))
  };
  exportFile(JSON.stringify(work,null,2),'GridAnalyzer_SLD_Proje.json','application/json;charset=utf-8');
}

function importProject(json){
  if(json?.format==='ga-sld-v1'&&Array.isArray(json.components)){
    ensureLinkPortAttachments(json);
    createDoc({name:json.name||json.title||'SLD_Diagram.sld',origin:'NATIVE_SLD',gaSld:json,notice:'ga-sld-v1 diyagramı içe aktarıldı.'});
    return;
  }
  if((json?.schema!=='ga.sld.workspace.v3'&&json?.schema!=='ga.sld.workspace.v2')||!Array.isArray(json.documents)){
    throw new Error('Geçersiz SLD proje/diyagram JSON dosyası.');
  }
  if(json.globalSettings)state.globalSettings=Object.assign(defaultDiagramSettings(),json.globalSettings);
  let count=0;
  for(const d of json.documents.slice(0,30)){
    if(d.gaSld){
      ensureLinkPortAttachments(d.gaSld);
      createDoc({name:d.name||'Aktarılan',origin:d.origin||'NATIVE_SLD',gaSld:d.gaSld,settings:d.settings,owner:d.owner,stationId:d.stationId});
      count++;
    }
  }
  toast(`${count} şema sekmesi içe aktarıldı.`,'ok');
}

async function importOne(file){
  const suffix=file.name.split('.').pop()?.toLowerCase();
  if(suffix==='json'){
    try{importProject(JSON.parse(await file.text()));}catch(e){toast('JSON Hatası: '+e.message,'error');}
    return {ok:true};
  }
  if(suffix==='sld'){
    const bytes=new Uint8Array(await file.arrayBuffer());
    const check=validateSldBinary(bytes);
    if(!check.valid){
      const errMsg=`Geçersiz .sld dosyası reddedildi (${file.name}): ${check.reason}`;
      toast(errMsg,'error');
      return {ok:false,error:errMsg};
    }
    try{
      const gaSld=await parseSldBinary(bytes,file.name);
      createDoc({
        name:file.name,
        origin:'NATIVE_SLD',
        gaSld,
        rawBytes:bytes,
        notice:`Gerçek PSS®E .sld yüklendi: ${file.name} (${formatBytes(bytes.length)} · CArchive ${check.version} · ${gaSld.components.length} bileşen).`
      });
      toast(`${file.name} başarıyla doğrulandı ve açıldı (${gaSld.components.length} bileşen).`,'ok');
      return {ok:true,gaSld};
    }catch(e){
      const errMsg=`SLD çözümleme hatası (${file.name}): ${e.message}`;
      toast(errMsg,'error');
      return {ok:false,error:errMsg};
    }
  }
  const msg='Desteklenmeyen dosya uzantısı: '+suffix;
  toast(msg,'warn');
  return {ok:false,error:msg};
}

/* 4-Tab PSS(R)E Diagram Settings Modal */
function openDiagramSettingsModal(){
  const backdrop=state.refs.settingsModal;if(!backdrop)return;
  const working=structuredClone(activeSettings());
  let activeTab='annotations';

  const body=$('.ga-studio-modal-body',backdrop);
  const tabBtns=$$('.ga-studio-modal-tab',backdrop);

  const previewLive=()=>{
    if(state.doc){
      state.doc.settings=structuredClone(working);
      refreshGaSldCanvas(true);
    }else{
      state.globalSettings=structuredClone(working);
      applyStageVisualSettings();
    }
  };

  const renderTabContent=()=>{
    tabBtns.forEach(b=>b.classList.toggle('is-active',b.dataset.tab===activeTab));
    body.replaceChildren();

    const mkCheck=(label,obj,key)=>{
      const l=E('label','ga-studio-check');
      const cb=E('input');cb.type='checkbox';cb.checked=Boolean(obj[key]);
      cb.onchange=()=>{obj[key]=cb.checked;previewLive();};
      l.append(cb,document.createTextNode(label));
      return l;
    };
    const mkSelect=(label,obj,key,opts)=>{
      const l=E('label','ga-studio-field',label);
      const s=E('select');
      for(const [v,t] of opts){
        const o=new Option(t,String(v));
        if(String(obj[key])===String(v))o.selected=true;
        s.append(o);
      }
      s.onchange=()=>{obj[key]=typeof obj[key]==='number'?Number(s.value):s.value;previewLive();};
      l.append(s);return l;
    };
    const mkNumber=(label,obj,key,min,max,step=1)=>{
      const l=E('label','ga-studio-field',label);
      const inp=E('input');inp.type='number';inp.min=String(min);inp.max=String(max);inp.step=String(step);inp.value=String(obj[key]);
      inp.onchange=()=>{obj[key]=Math.max(min,Math.min(max,nval(inp.value,obj[key])));previewLive();};
      l.append(inp);return l;
    };
    const mkColor=(label,obj,key)=>{
      const row=E('div','ga-studio-color-row');
      row.append(E('span','',label));
      const inp=E('input');inp.type='color';inp.value=String(obj[key]||'#4b9dde');
      inp.oninput=()=>{obj[key]=inp.value;previewLive();};
      row.append(inp);return row;
    };

    if(activeTab==='annotations'){
      const g1=E('div','ga-studio-prop-group');
      g1.append(E('h4','','Bara ve Ekipman Kimlik Açıklamaları'));
      const gr1=E('div','ga-studio-prop-grid');
      gr1.append(
        mkCheck('Bara numarası göster (Bus ID)',working.annotations,'showBusId'),
        mkCheck('Bara adı göster (Bus Name)',working.annotations,'showBusName'),
        mkCheck('Hat devre kimliği göster (Circuit ID)',working.annotations,'showCktId'),
        mkCheck('Ekipman kimliği göster (Equipment ID)',working.annotations,'showEquipId'),
        mkCheck('Jeneratör / Yük / Şönt sonuç etiketi',working.annotations,'showRadialResults')
      );
      g1.append(gr1);

      const g2=E('div','ga-studio-prop-group');
      g2.append(E('h4','','Bara Gerilimi, Hat Akışı ve Hassasiyet'));
      const gr2=E('div','ga-studio-prop-grid');
      gr2.append(
        mkSelect('Bara Gerilimi Gösterimi',working.annotations,'busVoltageMode',[
          ['pu_kv','pu ve kV birlikte'],['pu','Yalnızca pu'],['kv','Yalnızca kV'],['pu_ang','pu ve Açı ( derece )'],['hide','Gizle']
        ]),
        mkSelect('Hat / Trafo Güç Akışı',working.annotations,'branchFlowMode',[
          ['pq','MW ve MVAr'],['mva','Görünür Güç (MVA)'],['current','Akım (A)'],['loading','% Yüklenme Oranı'],['hide','Gizle']
        ]),
        mkSelect('Akış Yönü Gösterimi',working.annotations,'flowDirectionMode',[
          ['arrow','Akış Oku Göster'],['sign','İşaret (+/-) Göster'],['both','Ok + İşaret'],['hide','Gizle']
        ]),
        mkSelect('Sayısal Ondalık Basamak',working.annotations,'decimals',[
          [0,'0 basamak (Tam sayı)'],[1,'1 ondalık (Örn: 154.2)'],[2,'2 ondalık (Örn: 1.02)'],[3,'3 ondalık (Örn: 1.024)']
        ])
      );
      g2.append(gr2);
      body.append(g1,g2);
    }else if(activeTab==='coloring'){
      const g1=E('div','ga-studio-prop-group');
      g1.append(E('h4','','Renklendirme Modu ve Veri Katmanı'));
      const gr1=E('div','ga-studio-prop-grid');
      gr1.append(
        mkSelect('Şema Renklendirme Kriteri',working.coloring,'colorMode',[
          ['voltage','Gerilim Seviyesine Göre (kV)'],
          ['source','Dosya / Katman Orijinal Rengi'],
          ['loading','Hat Yüklenme Oranına Göre (%)'],
          ['bus_limits','Bara Gerilim Sınırlarına Göre (pu)']
        ]),
        mkSelect('Sonuç Veri Katmanı',working.coloring,'resultLayer',[
          ['SOURCE_SAVED','SOURCE_SAVED (Kaydedilmiş SAV)'],
          ['GA_PSSE_CALCULATED','GA_PSSE_CALCULATED (Hesaplanan)']
        ]),
        mkCheck('Bağsız (Unbound) nesneleri farklı renkle vurgula',working.coloring,'highlightUnbound'),
        mkCheck('Servis dışı elemanları kesikli çizgiyle göster',working.coloring,'dashedOutOfService')
      );
      g1.append(gr1);

      const g2=E('div','ga-studio-prop-group');
      g2.append(E('h4','','Gerilim Seviyesi ve Durum Renk Paleti (PSS®E Benzeri)'));
      const gr2=E('div','ga-studio-prop-grid');
      gr2.append(
        mkColor('400 kV (380 kV) Bara/Hat Rengi',working.coloring,'kv400'),
        mkColor('220 kV Bara/Hat Rengi',working.coloring,'kv220'),
        mkColor('154 kV Bara/Hat Rengi',working.coloring,'kv154'),
        mkColor('66 kV Bara/Hat Rengi',working.coloring,'kv66'),
        mkColor('≤36 kV (OG) Bara/Hat Rengi',working.coloring,'kvLow'),
        mkColor('Bağsız (Unbound) Nesne Rengi',working.coloring,'unboundColor'),
        mkColor('Kapalı Anahtar / Kesici Rengi',working.coloring,'switchClosed'),
        mkColor('Açık Anahtar / Kesici Rengi',working.coloring,'switchOpen'),
        mkColor('Genel Etiket Metin Rengi',working.coloring,'labelColor')
      );
      g2.append(gr2);
      body.append(g1,g2);
    }else if(activeTab==='layout'){
      const g1=E('div','ga-studio-prop-group');
      g1.append(E('h4','','Bara Yerleşim Yönü ve Ortogonal Bağlantılar'));
      const gr1=E('div','ga-studio-prop-grid');
      gr1.append(
        mkSelect('Varsayılan TM Bara Yönü',working.layout,'busOrientation',[
          ['horizontal','YATAY Bara Düzeni (Varsayılan)'],
          ['vertical','DİKEY Bara Düzeni']
        ]),
        mkCheck('Perpendicular / Orthogonal bağlantılar (90°)',working.layout,'orthogonalLinks'),
        mkCheck('Hatlar üzerinde akış oklarını göster',working.layout,'showFlowArrows'),
        mkCheck('Otomatik etiket/nesne çakışma azaltma',working.layout,'autoResolveOverlaps')
      );
      g1.append(gr1);

      const g2=E('div','ga-studio-prop-group');
      g2.append(E('h4','','Izgara (Grid), Etiket Boyutu ve Diyagram Başlığı'));
      const gr2=E('div','ga-studio-prop-grid');
      gr2.append(
        mkCheck('Arka plan ızgarasını göster (Show Grid)',working.layout,'showGrid'),
        mkCheck('Sürüklerken ızgaraya kenetle (Snap-to-Grid)',working.layout,'snapToGrid'),
        mkNumber('Izgara Aralığı (px)',working.layout,'gridSpacing',6,72,3),
        mkNumber('Yakalama Hassasiyeti (birim)',working.layout,'snapStep',3,36,1.5),
        mkCheck('Tüm etiketleri göster',working.layout,'showLabels'),
        mkNumber('Etiket Yazı Boyutu Ölçeği (%)',working.layout,'fontScale',60,180,5),
        mkSelect('Etiket Hizalama',working.layout,'labelAlign',[
          ['auto','Otomatik'],['middle','Ortalı'],['start','Sola Hizalı']
        ]),
        mkCheck('Diyagram başlığını üstte göster',working.layout,'showTitle')
      );
      const titleField=E('label','ga-studio-field','Özel Diyagram Başlığı');
      const titleIn=E('input');titleIn.value=working.layout.diagramTitle||'';titleIn.placeholder='Boş bırakılırsa şema adı kullanılır';
      titleIn.oninput=()=>{working.layout.diagramTitle=safe(titleIn.value);previewLive();};
      titleField.append(titleIn);
      g2.append(gr2,titleField);
      body.append(g1,g2);
    }else if(activeTab==='advanced'){
      const g1=E('div','ga-studio-prop-group');
      g1.append(E('h4','','Görünüm, Port/Knee Tutamaçları ve Performans'));
      const gr1=E('div','ga-studio-prop-grid');
      gr1.append(
        mkColor('Tuval Arka Plan Rengi',working.advanced,'bgColor'),
        mkSelect('Port ve Knee-Point Gösterimi',working.advanced,'portKneeVisibility',[
          ['hover','Seçili / Üzerine Gelince Göster'],['always','Her Zaman Göster'],['never','Gizle']
        ]),
        mkNumber('Knee-Point Tutamaç Boyutu (px)',working.advanced,'kneeSize',2.5,8,0.5),
        mkNumber('Hat Çizgi Kalınlığı Çarpanı',working.advanced,'lineWidthScale',0.5,2.5,0.1),
        mkNumber('Zoom Adımı (%)',working.advanced,'zoomStep',5,40,2),
        mkCheck('Anti-aliasing (Yumuşak vektör çizimi)',working.advanced,'antiAliasing'),
        mkCheck('Sıkışık etiketleri uzaklaşınca gizle',working.advanced,'hideCrowdedLabels'),
        mkCheck('Diyagram yerleşimini kilitle (Sürüklemeyi kapat)',working.advanced,'lockLayout')
      );
      g1.append(gr1);
      body.append(g1);
    }
  };

  tabBtns.forEach(b=>{
    b.onclick=()=>{activeTab=b.dataset.tab;renderTabContent();};
  });

  const originalBackup=structuredClone(activeSettings());
  state.refs.settingsResetBtn.onclick=()=>{
    Object.assign(working,defaultDiagramSettings());
    renderTabContent();
    previewLive();
    toast('Varsayılan PSS®E diyagram ayarları yüklendi.','info');
  };
  state.refs.settingsCancelBtn.onclick=()=>{
    if(state.doc)state.doc.settings=originalBackup;
    else state.globalSettings=originalBackup;
    if(state.doc?.gaSld)refreshGaSldCanvas(true);
    applyStageVisualSettings();
    backdrop.classList.remove('is-open');
  };
  state.refs.settingsApplyBtn.onclick=()=>{
    const prevOrient=originalBackup.layout.busOrientation;
    state.globalSettings=structuredClone(working);
    if(state.doc){
      state.doc.settings=structuredClone(working);
      if(working.layout.busOrientation!==prevOrient){
        setBusOrientation(working.layout.busOrientation);
      }else{
        if(working.layout.autoResolveOverlaps)resolveGaSldOverlaps(state.doc.gaSld);
        refreshGaSldCanvas(true);
      }
    }
    save();
    backdrop.classList.remove('is-open');
    toast('Diyagram ayarları uygulandı ve kaydedildi.','ok');
  };

  renderTabContent();
  backdrop.classList.add('is-open');
}

/* Contextual Object Inspector Modal (replaces permanent right panel) */
function openObjectInspectorModal(el=state.selection){
  if(!el||!state.doc?.gaSld)return;
  const sldComp=el.dataset?.sldId?findGaSldComp(el.dataset.sldId):null;
  if(!sldComp)return;
  const backdrop=state.refs.inspectorModal;if(!backdrop)return;
  const body=$('.ga-studio-modal-body',backdrop);
  body.replaceChildren();

  const match=matchSavEquipment(sldComp.map);
  const infoGrp=E('div','ga-studio-prop-group');
  infoGrp.append(
    E('h4','',uniqueId(el)),
    E('div','',`Bileşen Tipi: ${sldComp.t}${sldComp.psse?' / '+sldComp.psse:''} · ID: #${sldComp.id} · Katman: ${sldComp.layer??1}`),
    E('div','',`SAV Elektriksel Eşleşme: ${match?`✓ ${match.id} (SAV modeli salt-okunurdur)`:'— Bağsız grafik nesne'}`)
  );
  body.append(infoGrp);

  const editGrp=E('div','ga-studio-prop-group');
  editGrp.append(E('h4','','Geometrik Koordinat ve Görünüm Düzenleme'));
  const grid=E('div','ga-studio-prop-grid');

  if(sldComp.pos){
    const fX=E('label','ga-studio-field','X Koordinatı (SLD)');const inX=E('input');inX.type='number';inX.step='0.1';inX.value=String(sldComp.pos[0]);fX.append(inX);
    const fY=E('label','ga-studio-field','Y Koordinatı (SLD)');const inY=E('input');inY.type='number';inY.step='0.1';inY.value=String(sldComp.pos[1]);fY.append(inY);
    const fRot=E('label','ga-studio-field','Yön / Açı (°)');const inRot=E('input');inRot.type='number';inRot.step='90';inRot.value=String(sldComp.rot||0);fRot.append(inRot);
    grid.append(fX,fY,fRot);

    let inLen=null,inWid=null;
    if(sldComp.stype==='Busbar'){
      const fLen=E('label','ga-studio-field','Bara Uzunluğu');inLen=E('input');inLen.type='number';inLen.step='0.2';inLen.value=String(sldComp.len||2.4);fLen.append(inLen);
      const fWid=E('label','ga-studio-field','Bara Kalınlığı');inWid=E('input');inWid.type='number';inWid.step='0.01';inWid.value=String(sldComp.width||0.06);fWid.append(inWid);
      grid.append(fLen,fWid);
    }

    let inTxt=null;
    if(sldComp.t==='Label'){
      const fTxt=E('label','ga-studio-field','Etiket Metni');inTxt=E('textarea');inTxt.rows=3;inTxt.value=sldComp.text||'';fTxt.append(inTxt);
      editGrp.append(grid,fTxt);
    }else{
      editGrp.append(grid);
    }

    const colRow=E('div','ga-studio-color-row');
    colRow.append(E('span','','Nesne Rengi'));
    const inCol=E('input');inCol.type='color';inCol.value=bgrToHex(sldComp.color,'#4b9dde');
    colRow.append(inCol);
    editGrp.append(colRow);

    state.refs.inspectorApplyBtn.onclick=()=>{
      commit();
      const nx=nval(inX.value,sldComp.pos[0]),ny=nval(inY.value,sldComp.pos[1]);
      const dx=nx-sldComp.pos[0],dy=ny-sldComp.pos[1];
      if(sldComp.t==='Symbol'){
        translateGaSldSymbol(sldComp,dx,dy,state.doc.gaSld);
        if(sldComp.stype==='Busbar'){
          resizeOrRotateBusbar(sldComp,inLen?nval(inLen.value,sldComp.len):sldComp.len,inWid?nval(inWid.value,sldComp.width):sldComp.width,nval(inRot.value,sldComp.rot),state.doc.gaSld);
        }else{
          sldComp.rot=nval(inRot.value,0);
        }
      }else{
        sldComp.pos=[Number(nx.toFixed(4)),Number(ny.toFixed(4))];
        sldComp.rot=nval(inRot.value,0);
        if(inTxt)sldComp.text=safe(inTxt.value);
      }
      sldComp.color=hexToBgr(inCol.value);
      refreshGaSldCanvas(true);
      backdrop.classList.remove('is-open');
      toast('Nesne geometrisi güncellendi.','ok');
    };
  }else if(sldComp.t==='Link'){
    const kCount=sldComp.knees?.length||0;
    editGrp.append(E('div','',`Kırılma Noktası (Knee-Point) Sayısı: ${kCount}`));
    const btnOrtho=E('button','ga-studio-button','90° Dik Açılı Rotaya Dönüştür');
    btnOrtho.onclick=()=>{
      commit();
      const s1=findGaSldComp(sldComp.p1?.sym),s2=findGaSldComp(sldComp.p2?.sym);
      if(sldComp.p1?.pos&&sldComp.p2?.pos)sldComp.knees=buildOrthogonalKnees(sldComp.p1.pos,sldComp.p2.pos,s1,s2);
      refreshGaSldCanvas(true);
      backdrop.classList.remove('is-open');
    };
    const btnClearKnees=E('button','ga-studio-button','Tüm Knee-Point Noktalarını Temizle');
    btnClearKnees.onclick=()=>{
      commit();sldComp.knees=[];refreshGaSldCanvas(true);backdrop.classList.remove('is-open');
    };
    grid.append(btnOrtho,btnClearKnees);
    editGrp.append(grid);
    state.refs.inspectorApplyBtn.onclick=()=>backdrop.classList.remove('is-open');
  }

  body.append(editGrp);
  backdrop.classList.add('is-open');
}

function openLayersModal(){
  if(!state.doc?.gaSld){toast('Aktif şema yok.','warn');return;}
  const backdrop=state.refs.inspectorModal;if(!backdrop)return;
  const body=$('.ga-studio-modal-body',backdrop);
  body.replaceChildren();
  const grp=E('div','ga-studio-prop-group');
  grp.append(E('h4','','PSS®E Katman (Layer) Görünürlüğü'));
  const grid=E('div','ga-studio-prop-grid');
  const counts=new Map();
  for(const c of state.doc.gaSld.components)counts.set(c.layer,(counts.get(c.layer)||0)+1);
  for(const l of state.doc.gaSld.layers||[]){
    const lbl=E('label','ga-studio-check');
    const cb=E('input');cb.type='checkbox';cb.checked=l.vis!=='Hidden';
    cb.onchange=()=>{
      l.vis=cb.checked?'Visible':'Hidden';
      refreshGaSldCanvas(true);
    };
    lbl.append(cb,document.createTextNode(`${l.desc||`Katman ${l.n}`} (${counts.get(l.n)||0})`));
    grid.append(lbl);
  }
  grp.append(grid);body.append(grp);
  state.refs.inspectorApplyBtn.onclick=()=>backdrop.classList.remove('is-open');
  backdrop.classList.add('is-open');
}

function createModals(host){
  // 1) 4-Tab Diagram Settings Modal
  const sb=E('div','ga-studio-modal-backdrop');
  const sm=E('div','ga-studio-modal');
  const sh=E('div','ga-studio-modal-head');
  sh.append(E('strong','','⚙ PSS®E Diyagram Ayarları (Diagram Properties)'));
  const sClose=E('button','ga-studio-button','✕');sClose.onclick=()=>state.refs.settingsCancelBtn.click();
  sh.append(sClose);

  const stabs=E('div','ga-studio-modal-tabs');
  [
    ['annotations','A. Diyagram Açıklamaları'],
    ['coloring','B. Renklendirme'],
    ['layout','C. Diyagram Düzeni'],
    ['advanced','D. Gelişmiş Ayarlar']
  ].forEach(([k,label])=>{
    const b=E('button','ga-studio-modal-tab',label);b.dataset.tab=k;stabs.append(b);
  });

  const sbody=E('div','ga-studio-modal-body');
  const sfoot=E('div','ga-studio-modal-foot');
  const btnReset=E('button','ga-studio-button','↺ Varsayılanları Yükle');
  const footRight=E('div','ga-studio-modal-foot-right');
  const btnCancel=E('button','ga-studio-button','İptal');
  const btnApply=E('button','ga-studio-button is-native-btn','✓ Uygula');
  footRight.append(btnCancel,btnApply);
  sfoot.append(btnReset,footRight);
  sm.append(sh,stabs,sbody,sfoot);
  sb.append(sm);
  state.refs.settingsModal=sb;
  state.refs.settingsResetBtn=btnReset;
  state.refs.settingsCancelBtn=btnCancel;
  state.refs.settingsApplyBtn=btnApply;

  // 2) Compact Object Inspector / Layer Modal
  const ib=E('div','ga-studio-modal-backdrop');
  const im=E('div','ga-studio-modal');
  const ih=E('div','ga-studio-modal-head');
  ih.append(E('strong','','Nesne / Katman Özellikleri'));
  const iClose=E('button','ga-studio-button','✕');iClose.onclick=()=>ib.classList.remove('is-open');
  ih.append(iClose);
  const ibody=E('div','ga-studio-modal-body');
  const ifoot=E('div','ga-studio-modal-foot');
  const iCancel=E('button','ga-studio-button','Kapat');iCancel.onclick=()=>ib.classList.remove('is-open');
  const iApply=E('button','ga-studio-button is-native-btn','✓ Kaydet');
  ifoot.append(iCancel,iApply);
  im.append(ih,ibody,ifoot);
  ib.append(im);
  state.refs.inspectorModal=ib;
  state.refs.inspectorApplyBtn=iApply;

  host.append(sb,ib);
}

function controls(){
  const host=E('section','ga-sld-studio');host.id='ga-sld-studio';state.host=host;

  // Top strip: Document Tabs + Status Badges (zero wasted header height)
  const topStrip=E('div','ga-studio-topstrip');
  const tabs=E('nav','ga-studio-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','SLD doküman sekmeleri');state.tabs=tabs;
  const badges=E('div','ga-studio-badges');state.refs.badges=badges;
  topStrip.append(tabs,badges);

  // Compact Row 1: Entry Workflows (SAV -> TM/OWNER & User .sld Open/Save) + Orientation + Diagram Settings
  const toolbar=E('div','ga-studio-toolbar');
  const btn=(text,fn,cls='',tip='')=>{const b=E('button','ga-studio-button '+cls,text);b.type='button';if(tip)b.title=tip;b.onclick=fn;toolbar.append(b);return b;};
  const sep=()=>toolbar.append(E('span','ga-studio-sep'));

  const tm=E('select','ga-studio-select');tm.title='SAV modelinden Trafo Merkezi (TM) seçin';tm.setAttribute('aria-label','SLD editörü trafo merkezi');state.refs.tm=tm;toolbar.append(tm);
  btn('⚡ TM Çiz',()=>newTm(),'is-native-btn','Seçili Trafo Merkezini SAV modelinden tek tıkla çiz');

  sep();
  const owner=E('select','ga-studio-select');owner.title='SAV modelinden OWNER (23 Bölge) seçin';owner.setAttribute('aria-label','SLD editörü OWNER bölgesi');state.refs.owner=owner;toolbar.append(owner);
  const voltage=E('select','ga-studio-select');[['all','Tüm kV'],['400','400 kV'],['220','220 kV'],['154','154 kV'],['66','66 kV'],['low','≤36 kV']].forEach(([k,v])=>voltage.append(new Option(v,k)));state.refs.voltage=voltage;toolbar.append(voltage);
  btn('🗺 OWNER Çiz',()=>newOwner(),'is-native-btn','Seçili OWNER bölgesini SAV modelinden 90° ortogonal hatlarla çiz');

  sep();
  btn('📂 .sld Aç',()=>state.refs.file.click(),'','Bilgisayarınızdaki gerçek PSS®E .sld dosyasını aç');
  btn('💾 Native .sld Kaydet',()=>void exportNativeSld(),'is-native-btn','PSS®E 36.5 ile doğrudan açılabilen gerçek CArchive .sld olarak kaydet');

  sep();
  state.refs.orientHoriz=btn('▬ Yatay Bara',()=>setBusOrientation('horizontal'),'is-active','Varsayılan yatay TM bara düzeni');
  state.refs.orientVert=btn('▮ Dikey Bara',()=>setBusOrientation('vertical'),'','Dikey TM bara düzeni');

  sep();
  btn('⚙ Diyagram Ayarları',openDiagramSettingsModal,'is-settings-btn','PSS®E benzeri 4 sekmeli Diyagram Ayarları penceresini aç');

  // Secondary Row: Geometric Editing Tools ONLY (Zero creation buttons!) + Zoom + Dropdown
  const line=E('div','ga-studio-toolbar');
  const tool=(label,mode,tip='')=>{const b=E('button','ga-studio-button ga-studio-tool',label);b.type='button';b.dataset.gaTool=mode;if(tip)b.title=tip;b.onclick=()=>setMode(mode);line.append(b);return b;};
  tool('↖ Seç / Taşı','select','Bara, sembol, etiket veya knee-point seçip taşıyın');
  tool('📐 Hat Rotası (90°)','route90','Tıklanan bağlantıyı 90° dik açılı (orthogonal) rotaya dönüştürün');
  tool('◆ Knee-Point Ekle/Sil','knee','Hat üzerine tıklayarak kırılma noktası ekleyin, mevcut noktaya tıklayarak silin');
  tool('🏷 Etiket Taşı','label','Sembolleri kilitleyip yalnızca etiketleri taşıyın');

  line.append(E('span','ga-studio-sep'));
  const act=(label,fn,tip='')=>{const b=E('button','ga-studio-button',label);b.type='button';if(tip)b.title=tip;b.onclick=fn;line.append(b);return b;};

  // Alignment dropdown
  const alignDrop=E('div','ga-studio-dropdown');
  const alignBtn=E('button','ga-studio-button',' align Hizala ▾');alignBtn.type='button';
  alignBtn.onclick=(e)=>{e.stopPropagation();alignDrop.classList.toggle('is-open');};
  const alignMenu=E('div','ga-studio-menu');
  [
    ['Sola Hizala','left'],['Yatay Ortala','center-x'],['Üste Hizala','top'],
    ['Dikey Ortala','center-y'],['Yatay Eşit Dağıt','distribute-x'],['Dikey Eşit Dağıt','distribute-y']
  ].forEach(([lbl,m])=>{
    const mb=E('button','',lbl);mb.onclick=()=>{alignDrop.classList.remove('is-open');alignSelected(m);};
    alignMenu.append(mb);
  });
  alignDrop.append(alignBtn,alignMenu);
  line.append(alignDrop);

  act('↻ 90° Döndür',rotateSelected,'Seçili barayı veya sembolü 90° döndür (R)');
  act('✨ Çakışmaları Azalt',resolveOverlaps,'Etiket ve sembol çakışmalarını otomatik azalt');
  act('↶ Geri',undo,'Geri al (Ctrl+Z)');
  act('↷ İleri',redo,'İleri al (Ctrl+Y)');

  line.append(E('span','ga-studio-sep'));
  act('−',()=>zoomBy(1.18),'Uzaklaştır');
  act('+',()=>zoomBy(0.84),'Yakınlaştır');
  act('⛶ Sığdır',fit,'Tüm diyagramı ekrana sığdır');
  act('🎯 Odakla',focusSelected,'Seçili nesneye odaklan');
  act('⛶ Tam Ekran',toggleFullscreen,'Tam ekran görünümü aç/kapat');

  // Secondary export & layers dropdown
  const moreDrop=E('div','ga-studio-dropdown');
  const moreBtn=E('button','ga-studio-button','Diğer / Dışa Aktar ▾');moreBtn.type='button';
  moreBtn.onclick=(e)=>{e.stopPropagation();moreDrop.classList.toggle('is-open');};
  const moreMenu=E('div','ga-studio-menu');
  const addMenuBtn=(lbl,fn)=>{const b=E('button','',lbl);b.onclick=()=>{moreDrop.classList.remove('is-open');fn();};moreMenu.append(b);};
  addMenuBtn('🗂 Katman Görünürlüğü (Layers)...',openLayersModal);
  addMenuBtn('✎ Seçili Nesne Özellikleri...',()=>openObjectInspectorModal(state.selection));
  addMenuBtn('👥 Seçilileri Grupla',groupSelected);
  addMenuBtn('🔓 Grubu Çöz',ungroupSelected);
  moreMenu.append(E('hr'));
  addMenuBtn('💾 PSS®E Native .sld Farklı Kaydet...',exportNativeSldAs);
  addMenuBtn('📄 .gasld.json İndir',exportGaSldJson);
  addMenuBtn('📦 Proje JSON İndir',exportProject);
  addMenuBtn('🖼 SVG Vektör İndir',exportSvg);
  addMenuBtn('📷 PNG Görüntü İndir',()=>void exportPng());
  moreMenu.append(E('hr'));
  addMenuBtn('⧉ Aktif Sekmeyi Kopyala',()=>duplicateDoc());
  moreDrop.append(moreBtn,moreMenu);
  line.append(moreDrop);

  document.addEventListener('click',()=>{
    alignDrop.classList.remove('is-open');
    moreDrop.classList.remove('is-open');
  });

  // Full-width Workspace (Zero Left/Right Side Panels!)
  const work=E('div','ga-studio-workspace');
  const stage=E('div','ga-studio-stage');stage.setAttribute('aria-label','Düzenlenebilir tek hat şeması');state.stage=stage;
  stage.addEventListener('dragover',e=>{e.preventDefault();});
  stage.addEventListener('drop',async e=>{e.preventDefault();for(const f of e.dataTransfer?.files||[])await importOne(f);});

  // Compact floating context bar on bottom-right when an object is selected
  const ctxBar=E('div','ga-studio-context-bar');
  const ctxTitle=E('span','ga-studio-context-title','Seçili nesne');
  const ctxEdit=E('button','ga-studio-button is-settings-btn','✎ Düzenle');ctxEdit.onclick=()=>openObjectInspectorModal(state.selection);
  const ctxRot=E('button','ga-studio-button','↻ 90°');ctxRot.onclick=rotateSelected;
  const ctxFocus=E('button','ga-studio-button','🎯 Odakla');ctxFocus.onclick=focusSelected;
  ctxBar.append(ctxTitle,ctxEdit,ctxRot,ctxFocus);
  state.refs.contextBar=ctxBar;
  state.refs.contextTitle=ctxTitle;
  work.append(stage,ctxBar);

  const fbRow=E('div','ga-studio-feedback-row');
  const feedback=E('p','ga-studio-feedback','PSS®E 36.5 Native SLD Editörü hazır. SAV modelinden TM/OWNER çizin veya gerçek .sld dosyası açın.');
  feedback.setAttribute('role','status');
  fbRow.append(feedback);

  host.append(topStrip,toolbar,line,work,fbRow);
  createModals(host);

  const file=E('input');file.type='file';file.accept='.sld,.gasld.json,.json';file.multiple=true;file.hidden=true;
  file.onchange=async()=>{for(const f of file.files)await importOne(f);file.value='';};
  state.refs.file=file;host.append(file);

  host.addEventListener('keydown',e=>{
    if(e.target.closest('input,textarea,select'))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
    else if(e.key==='r'||e.key==='R'){e.preventDefault();rotateSelected();}
    else if(e.key==='f'||e.key==='F'){e.preventDefault();fit();}
  });
  return host;
}

function syncModel(){
  const n=network(),h=hash();if(!state.host)return;
  if(h!==state.modelHash){
    state.modelHash=h;
    restore();populateOwner();populateStations();renderTabs();
    if(state.doc)activate(state.doc.id);
    else renderEmptyStage();
  }
  if(n&&state.refs.owner.options.length<2)populateOwner();
  if(n&&(!state.refs.tm.options.length||state.refs.tm.options.length!==currentStation()?.options.length))populateStations();
  updateHeaderBadges();
}

function mount(){
  const root=$('.ga-psse-sld');if(!root)return;
  if(root!==state.root){
    state.root=root;state.modelHash=null;state.restoreAttemptedFor=null;
    const ui=controls();
    const controlsEl=$('.ga-psse-diagram-controls',root),stage=$('.ga-psse-sld-stage',root);
    controlsEl?.after(ui);
    controlsEl?.classList.add('ga-studio-native-controls');
    stage?.classList.add('ga-studio-native-source');
    root.classList.add('ga-sld-studio-ready');
    setMode('select');
    syncModel();
  }else syncModel();
}

const watcher=new MutationObserver(()=>{if(!document.body.contains(state.root)||!state.root)mount();});
function boot(){
  mount();
  watcher.observe(document.body,{childList:true,subtree:true});
  setInterval(()=>{if($('.ga-psse-sld')!==state.root)mount();else if(state.root)syncModel();},1250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

window.GASldStudio={
  getDocuments:()=>state.docs.map(d=>({id:d.id,name:d.name,origin:d.origin,modelHash:d.modelHash,stationId:d.stationId,owner:d.owner,bytes:d.svg?.length||0,hasNativeSld:Boolean(d.gaSld),componentCount:d.gaSld?.components?.length||0})),
  getActiveDoc:()=>state.doc,
  getSettings:()=>activeSettings(),
  openDiagramSettingsModal,
  setBusOrientation,
  validateSldBinary,
  parseSldBinary,
  patchSldBinary,
  importOne,
  translateSymbolById:(id,dx,dy)=>{
    const c=findGaSldComp(id);if(!c)return false;
    commit();translateGaSldSymbol(c,dx,dy,state.doc.gaSld);refreshGaSldCanvas(true);return true;
  },
  exportNativeSld,
  exportGaSldJson,
  resolveOverlaps,
  newTM:newTm,
  newOWNER:newOwner,
  undo,
  redo,
  fit,
  exportProject,
  importProject,
  active:()=>state.doc?.id||null
};
})();

}
