// @ts-nocheck
/* Grid Analyzer PSS/E Native SLD Studio Module */
export function mountPsseSldStudio(): void {
  if (typeof window === 'undefined' || (window as any).__GA_SLD_STUDIO_MOUNTED__) return;
  (window as any).__GA_SLD_STUDIO_MOUNTED__ = true;
  if (typeof document !== 'undefined' && !document.getElementById('ga-sld-studio-style')) {
    const st = document.createElement('style');
    st.id = 'ga-sld-studio-style';
    st.textContent = "/* Grid Analyzer native PSS/E SLD Studio \u2014 scoped to the PSSE SLD view */\n.ga-psse-sld.ga-sld-studio-ready{max-height:none!important;min-height:0;overflow:visible;position:relative;display:block}\n.ga-psse-sld.ga-sld-studio-ready>.ga-psse-sld-stage.ga-studio-native-source{position:absolute!important;visibility:hidden!important;pointer-events:none!important;width:99%!important;height:1px!important;overflow:hidden!important;z-index:-1}\n.ga-sld-studio-ready>.ga-feature-heading{padding:0 4px 5px}\n.ga-sld-studio-ready>.ga-psse-diagram-controls{margin-bottom:6px}\n.ga-sld-studio{border:1px solid var(--edge,#33465a);border-radius:9px;background:var(--panel,#13273a);padding:9px;min-height:640px;display:flex;flex-direction:column;gap:6px;max-width:100%;overflow:hidden;font-family:system-ui,'Segoe UI',sans-serif}\n.ga-studio-header{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--text,#eaf1f9);padding:4px 2px;flex-wrap:wrap}\n.ga-studio-title{font-size:14px;letter-spacing:.1px}\n.ga-studio-model{font-size:11px;color:var(--muted,#9dafbf)}\n.ga-studio-badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap}\n.ga-studio-badge{font-size:10px;padding:2px 7px;border-radius:10px;background:#1b3952;border:1px solid #3c6282;color:#cbe4f9}\n.ga-studio-badge.is-native{background:#153e35;border-color:#2f8f72;color:#9ef2d5}\n.ga-studio-tabs{display:flex;align-items:end;gap:3px;overflow-x:auto;min-height:36px;white-space:nowrap;scrollbar-width:thin;border-bottom:1px solid var(--edge,#33465a);padding:0 3px}\n.ga-studio-tab{display:flex;align-items:center;gap:1px;border:1px solid var(--edge,#33465a);border-bottom:0;border-radius:6px 6px 0 0;background:var(--panel2,#182f44);height:31px}\n.ga-studio-tab.is-active{background:var(--panel,#13273a);box-shadow:inset 0 2px 0 var(--accent,#5bb5dc)}\n.ga-studio-tabs button{border:0;background:transparent;color:var(--text,#eaf1f9);cursor:pointer;padding:5px 8px;font-size:11px;white-space:nowrap}\n.ga-studio-tab-close,.ga-studio-tab-rename,.ga-studio-tab-dup{font-size:12px!important;color:var(--muted,#a6bace)!important;padding:4px 4px!important}\n.ga-studio-tab-add{height:28px;font-size:17px!important}\n.ga-studio-toolbar,.ga-studio-tools-line{display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:thin;padding:3px 2px;min-height:36px;flex-shrink:0;flex-wrap:wrap}\n.ga-studio-button{display:inline-flex;align-items:center;justify-content:center;gap:3px;background:var(--panel2,#1a334a);border:1px solid var(--edge,#42586a);border-radius:5px;color:var(--text,#eaf1fa);padding:5px 8px;font:11px system-ui,'Segoe UI',sans-serif;white-space:nowrap;cursor:pointer;min-height:28px}\n.ga-studio-button:hover:not(:disabled),.ga-studio-button.is-active{border-color:var(--accent,#50afd3);background:color-mix(in srgb,var(--accent,#43a6d8) 22%,var(--panel2,#1a334a))}\n.ga-studio-button.is-native-btn{border-color:#35997a;background:#163d35;color:#b8f7e0;font-weight:600}\n.ga-studio-button.is-native-btn:hover:not(:disabled){background:#1f564a;border-color:#4cd3a9}\n.ga-studio-button:disabled{opacity:.45;cursor:not-allowed}\n.ga-studio-select{background:var(--panel2,#1a334a);border:1px solid var(--edge,#42586a);border-radius:5px;color:var(--text,#eaf1fa);font:11px system-ui;padding:4px 6px;min-height:28px;max-width:185px;flex-shrink:0}\n.ga-studio-workspace{display:grid;grid-template-columns:210px minmax(0,1fr) 245px;gap:6px;min-height:560px;height:clamp(560px,72vh,900px)}\n.ga-studio-left,.ga-studio-right{border:1px solid var(--edge,#33465a);border-radius:6px;background:var(--panel2,#162e43);overflow-y:auto;padding:8px;min-width:0;scrollbar-width:thin}\n.ga-studio-left h3,.ga-studio-right h3{font-size:11px;margin:4px 0 8px;color:var(--text,#f1f6fa);font-weight:600}\n.ga-studio-right h3:not(:first-child),.ga-studio-left h3:not(:first-child){margin-top:12px;border-top:1px solid var(--edge,#3f5262);padding-top:8px}\n.ga-studio-search,.ga-studio-field input,.ga-studio-field select,.ga-studio-field textarea{display:block;width:100%;min-width:0;padding:5px 6px;border-radius:4px;border:1px solid var(--edge,#42586a);background:var(--panel,#152a3a);color:var(--text,#eaf1fa);font:11px system-ui;box-sizing:border-box}\n.ga-studio-field-row{display:grid;grid-template-columns:1fr 1fr;gap:5px}\n.ga-studio-entity-list{display:flex;flex-direction:column;gap:2px;margin-top:6px;max-height:210px;overflow-y:auto}\n.ga-studio-entity-list button{background:transparent;border:0;border-bottom:1px solid var(--edge,#2c4153);padding:4px 5px;text-align:left;color:var(--text,#e4eff7);font:10px system-ui;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ga-studio-entity-list button:hover{color:var(--accent,#52bde1);background:rgba(82,189,225,.08)}\n.ga-studio-layer-list{display:flex;flex-direction:column;gap:3px;max-height:165px;overflow-y:auto}\n.ga-studio-layer-item{display:flex;align-items:center;justify-content:space-between;gap:5px;font-size:10px;color:var(--text,#dde8f2);padding:2px 3px;border-radius:3px}\n.ga-studio-layer-item:hover{background:rgba(255,255,255,.04)}\n.ga-studio-layer-item label{display:flex;align-items:center;gap:5px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ga-studio-stage{position:relative;border:1px solid var(--edge,#3a566a);border-radius:6px;overflow:hidden;min-height:0;background:radial-gradient(circle at 50% 50%,#142b40 0%,#0b1927 92%)}\n.ga-studio-stage.is-grid{background-image:radial-gradient(rgba(130,175,215,.18) 1px,transparent 1px),radial-gradient(circle at 50% 50%,#142b40 0%,#0b1927 92%);background-size:18px 18px,100% 100%}\n.ga-studio-stage svg.ga-studio-drawing{display:block;width:100%;height:100%;background:transparent;touch-action:none;user-select:none}\n.ga-studio-stage .ga-studio-selected{filter:drop-shadow(0 0 5px #f5d161)!important}\n.ga-studio-stage .ga-studio-multi-selected{filter:drop-shadow(0 0 4px #52d1ff)!important}\n.ga-studio-stage .ga-sld-bus,.ga-studio-stage .ga-sld-branch,.ga-studio-stage [data-ga-node],.ga-studio-stage [data-sld-id]{cursor:pointer}\n.ga-studio-stage .ga-studio-sld-label{cursor:move;pointer-events:all}\n.ga-studio-stage .ga-studio-sld-label text{pointer-events:all}\n.ga-studio-stage .ga-studio-knee{fill:#f5d161;stroke:#0c1c2c;stroke-width:1.5;cursor:grab;opacity:0;transition:opacity .15s}\n.ga-studio-stage .ga-studio-sld-link:hover .ga-studio-knee,.ga-studio-stage .ga-studio-selected .ga-studio-knee{opacity:1}\n.ga-studio-stage .ga-studio-region-link{pointer-events:stroke}\n.ga-studio-empty{display:grid;place-items:center;text-align:center;height:100%;color:var(--muted,#9bafc1);font-size:13px;padding:30px}\n.ga-studio-feedback{margin:0;font-size:11px;line-height:1.3;color:var(--muted,#a7b8c8);border-top:1px solid var(--edge,#42586a);padding:6px 5px;min-height:23px;white-space:normal!important}\n.ga-studio-feedback[data-kind='warn']{color:#e7bb70}\n.ga-studio-feedback[data-kind='error']{color:#fa8080}\n.ga-studio-feedback[data-kind='ok']{color:#7ce8be}\n.ga-studio-result{font-size:10px;line-height:1.45;color:var(--muted,#a7b8c8);overflow-wrap:anywhere}\n.ga-studio-property{font-size:10px;line-height:1.4;overflow-wrap:anywhere;margin-bottom:5px;color:#c9d9e8}\n.ga-studio-field{display:block;font-size:10px;color:var(--muted,#a7b8c8);margin-top:6px}\n.ga-studio-field input,.ga-studio-field select,.ga-studio-field textarea{margin-top:3px}\n.ga-studio-solver-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px}\n.ga-sld-studio-ready>.ga-psse-diagram-controls.ga-studio-native-controls,.ga-psse-sld.ga-sld-studio-ready>.ga-psse-diagram-controls.ga-studio-native-controls{position:absolute!important;visibility:hidden!important;pointer-events:none!important;left:0!important;top:30px!important;width:99%!important;min-height:0!important;max-height:1px!important;overflow:hidden!important;z-index:-1}\n.ga-studio-region-link:hover{opacity:.9!important;stroke-width:3!important}\n.ga-studio-region-site:hover rect{stroke-width:3;filter:drop-shadow(0 0 5px #70b9dd)}\n.ga-studio-model-search{max-height:150px;overflow-y:auto;border-bottom:1px solid var(--edge,#42586a);margin-bottom:8px}\n.ga-studio-bound-bus{cursor:move}\n@media(max-width:1000px){.ga-studio-workspace{grid-template-columns:150px minmax(0,1fr) 180px}.ga-studio-left,.ga-studio-right{padding:5px}}\n";
    document.head.appendChild(st);
  }
/* Grid Analyzer PSS/E Studio - Native .sld + Multi-Tab Engineering SLD Studio
 * Preserves all existing SAV/TM/OWNER/solver features and adds bidirectional PSS(R)E 36.5 native .sld support.
 */
(() => {
'use strict';
const NS='http://www.w3.org/2000/svg', KEY='ga.psse.sld.documents.v3', MAX_SAVE=3_900_000, SLD_SCALE=90;
const $=(sel,root=document)=>root.querySelector(sel);
const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
const E=(tag,cls='',text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
const S=(tag,attrs={})=>{const x=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))if(v!==undefined&&v!==null)x.setAttribute(k,String(v));return x;};
const num=(n,d=1)=>Number.isFinite(n)?Number(n).toLocaleString('tr-TR',{maximumFractionDigits:d}):'—';
const safe=(x)=>String(x??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,240);
const nval=(x,def=0)=>{const v=Number(x);return Number.isFinite(v)?v:def;};
const uid=()=>`sld-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const formatBytes=n=>n>1e6?`${num(n/1e6,2)} MB`:`${num(n/1000,1)} kB`;
const controller=()=>window.psseStudio?.controller??window.__GA_BRIDGE__;

const CP1254_HIGH={0xd0:'Ğ',0xdd:'İ',0xde:'Ş',0xf0:'ğ',0xfd:'ı',0xfe:'ş',0xc7:'Ç',0xe7:'ç',0xd6:'Ö',0xf6:'ö',0xdc:'Ü',0xfc:'ü'};
const UNICODE_TO_CP1254={'Ğ':0xd0,'İ':0xdd,'Ş':0xde,'ğ':0xf0,'ı':0xfd,'ş':0xfe,'Ç':0xc7,'ç':0xe7,'Ö':0xd6,'ö':0xf6,'Ü':0xdc,'ü':0xfc};
function decodeCp1254(bytes){let s='';for(let i=0;i<bytes.length;i++){const b=bytes[i];s+=CP1254_HIGH[b]??String.fromCharCode(b);}return s;}
function encodeCp1254(text){const a=[];for(let i=0;i<text.length;i++){const c=text[i];if(c in UNICODE_TO_CP1254)a.push(UNICODE_TO_CP1254[c]);else{const k=text.charCodeAt(i);a.push(k<256?k:0x3f);}}return new Uint8Array(a);}
function bgrToHex(c,fb='#7cb7f0'){if(c===undefined||c===null||!Number.isFinite(c)||c<0)return fb;const r=c&0xff,g=(c>>8)&0xff,b=(c>>16)&0xff;if(r===0&&g===0&&b===0)return '#dce7f3';if(r===128&&g===128&&b===64)return '#72a7d0';return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;}
function hexToBgr(hex){const s=String(hex||'').replace(/^#/,'');if(s.length!==6)return 0xffffff;const r=parseInt(s.slice(0,2),16)||0,g=parseInt(s.slice(2,4),16)||0,b=parseInt(s.slice(4,6),16)||0;return r|(g<<8)|(b<<16);}

const state={
  root:null,host:null,tabs:null,doc:null,docs:[],modelHash:null,drag:null,
  selection:null,multiSelect:new Set(),mode:'select',linkDraft:null,
  gridSnap:false,showOverlay:true,dirty:false,undo:[],redo:[],svg:null,stage:null,
  refs:{},nativeBytes:new Map(),profiles:null,rawTemplates:new Map(),
  restoreAttemptedFor:null,bridgeOnline:false
};

function toast(msg,kind='info'){if(!state.host)return;const t=$('.ga-studio-feedback',state.host);if(t){t.textContent=msg;t.dataset.kind=kind;}}
function model(){return controller()?.psseInspection??null;}
function network(){return controller()?.psseNetwork??null;}
function hash(){return network()?.modelHash??'standalone';}
function sourceRows(){const m=model();return new Map((m?.equipment||[]).map(e=>[e.id,e]));}

async function gunzipBase64(b64){
  if(!b64)return null;
  const bin=atob(b64),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  if(typeof DecompressionStream!=='undefined'){
    const ds=new DecompressionStream('gzip');
    const w=ds.writable.getWriter();w.write(bytes);w.close();
    const buf=await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buf);
  }
  return bytes;
}

async function ensureProfiles(){
  if(state.profiles)return state.profiles;
  const b64=window.__GA_SLD_PROFILES_GZ_B64__;
  if(!b64){state.profiles={};return state.profiles;}
  try{
    const raw=await gunzipBase64(b64);
    state.profiles=JSON.parse(new TextDecoder('utf-8').decode(raw));
  }catch(e){console.warn('SLD profile decode warn:',e);state.profiles={};}
  return state.profiles;
}

async function getRawTemplateBytes(key){
  if(state.rawTemplates.has(key))return state.rawTemplates.get(key);
  const map=window.__GA_SLD_RAW_TEMPLATES_GZ_B64__||{};
  if(map[key]){
    const bytes=await gunzipBase64(map[key]);
    if(bytes){state.rawTemplates.set(key,bytes);return bytes;}
  }
  return null;
}

function findSymbolHeaderOffset(bytes,dv,cid,expectedLayer,symPad){
  const b0=cid&0xff,b1=(cid>>8)&0xff,b2=(cid>>16)&0xff,b3=(cid>>24)&0xff,limit=bytes.length-150;
  for(let i=500;i<=limit;i++){
    if(bytes[i]===b0&&bytes[i+1]===b1&&bytes[i+2]===b2&&bytes[i+3]===b3){
      if(bytes[i+4]!==0||bytes[i+5]!==0||bytes[i+6]!==0||bytes[i+7]!==0)continue;
      const mlen=bytes[i+45];if(mlen!==0x1c&&mlen!==0x20)continue;
      const lyr=dv.getUint32(i+12,true);
      if(expectedLayer!==undefined&&lyr!==expectedLayer&&lyr>64)continue;
      const adOff=i+46+mlen;if(adOff+8>=bytes.length)continue;
      if(bytes[adOff+3]!==0x41||bytes[adOff+4]!==0x4e||bytes[adOff+5]!==0x4e||bytes[adOff+6]!==0x4f||bytes[adOff+7]!==0x54)continue;
      const adCnt=dv.getUint16(adOff,true);if(adCnt<1||adCnt>10)continue;
      let p=adOff+2,ok=true;
      for(let k=0;k<adCnt;k++){if(p>=bytes.length){ok=false;break;}p+=1+bytes[p];}
      if(ok&&p+symPad+24<=bytes.length)return i;
    }
  }
  return -1;
}

function findLabelHeaderOffset(bytes,dv,cid,expectedLayer,lblTxtOff){
  const b0=cid&0xff,b1=(cid>>8)&0xff,b2=(cid>>16)&0xff,b3=(cid>>24)&0xff,limit=bytes.length-(lblTxtOff+4);
  for(let i=500;i<=limit;i++){
    if(bytes[i]===b0&&bytes[i+1]===b1&&bytes[i+2]===b2&&bytes[i+3]===b3){
      if(bytes[i+4]!==0||bytes[i+5]!==0||bytes[i+6]!==0||bytes[i+7]!==0)continue;
      const hasTag=(bytes[i-2]===0x03&&bytes[i-1]===0x80)||(i>=9&&bytes[i-9]===0x43&&bytes[i-8]===0x53&&bytes[i-1]===0x6c);
      if(!hasTag)continue;
      const lyr=dv.getUint32(i+12,true);
      if((expectedLayer===undefined||lyr===expectedLayer)&&lyr<=64&&bytes[i+16]===0)return i;
    }
  }
  return -1;
}

function decodeMapRecord(mapType,bus1,bus2,bus3,ckt){
  const c=(ckt||'1').trim()||'1';
  switch(mapType){
    case 1:return {map:bus1?`BU ${bus1}`:'',stype:'Busbar',psse:'Busbar',sdef:1};
    case 2:return {map:bus1?`LO ${bus1} ${c} `:'',stype:'Radial',psse:'Load',sdef:2};
    case 3:return {map:bus1?`ME ${bus1} ${c} `:'',stype:'Radial',psse:'Machine',sdef:4};
    case 4:return {map:bus1?`FXS ${bus1} ${c} `:'',stype:'Radial',psse:'FixedShunt',sdef:5};
    case 5:return {map:bus1&&bus2?`TR ${bus1} ${bus2}${bus3?' '+bus3:''} ${c} `:'',stype:'Branch',psse:bus3?'TWTransformer':'Transformer',sdef:bus3?11:10};
    case 9:return {map:bus1&&bus2?`LI ${bus1} ${bus2} ${c} `:'',stype:'Branch',psse:'Branch',sdef:32};
    case 12:return {map:bus1&&bus2?`SYS ${bus1} ${bus2} ${c} `:'',stype:'Branch',psse:'SwitchingDev',sdef:3};
    case 13:return {map:bus1?`SWS ${bus1} ${c} `:'',stype:'Radial',psse:'SwitchedShunt',sdef:13};
    default:return {map:bus1?`BU ${bus1}`:'',stype:'Node',psse:'BusNode',sdef:0};
  }
}

async function parseSldBinary(bytes,fileName=''){
  const profiles=await ensureProfiles();
  const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const headText=decodeCp1254(bytes.subarray(0,Math.min(bytes.length,4096)));
  const isV36=headText.includes('2.0.51.');
  const fileVersion=isV36?'2.0.51.1':'2.0.49.3';
  const symPad=isV36?37:33,lblPosOff=isV36?85:81,lblTxtOff=isV36?119:115;

  // Match profile by filename or by component ID overlap
  const lowName=fileName.toLowerCase();
  let matchedProfile=null;
  if(lowName.includes('ankara')&&profiles.ankara)matchedProfile=profiles.ankara;
  else if(lowName.includes('kayseri')&&profiles.kayseri)matchedProfile=profiles.kayseri;
  else if(lowName.includes('konya')&&profiles.konya)matchedProfile=profiles.konya;
  else if(lowName.includes('oaytm')&&profiles.oaytm)matchedProfile=profiles.oaytm;
  else{
    // Auto-detect profile by sampling 12 symbol IDs in the binary
    for(const [k,prof] of Object.entries(profiles)){
      const sample=prof.components.filter(c=>c.t==='Symbol').slice(0,12);
      let hits=0;
      for(const s of sample)if(findSymbolHeaderOffset(bytes,dv,s.id,s.layer,symPad)>=0)hits++;
      if(hits>=Math.min(8,sample.length)){matchedProfile=prof;break;}
    }
  }

  if(matchedProfile){
    const out=structuredClone(matchedProfile);
    out.fileVersion=fileVersion;
    const symShift=new Map();
    for(const c of out.components){
      if(c.t==='Symbol'){
        const idx=findSymbolHeaderOffset(bytes,dv,c.id,c.layer,symPad);
        if(idx>=0){
          c.layer=dv.getUint32(idx+12,true);
          c.color=dv.getUint32(idx+29,true);
          const mlen=bytes[idx+45],adOff=idx+46+mlen,adCnt=dv.getUint16(adOff,true);
          let p=adOff+2;for(let k=0;k<adCnt;k++)p+=1+bytes[p];
          const dx=dv.getFloat64(p+symPad,true),dy=dv.getFloat64(p+symPad+8,true),dr=dv.getFloat64(p+symPad+16,true);
          if(Number.isFinite(dx)&&Number.isFinite(dy)&&Math.abs(dx)<1e5&&Math.abs(dy)<1e5){
            const sx=dx-(c.pos?.[0]??dx),sy=dy-(c.pos?.[1]??dy);
            if(Math.abs(sx)>1e-4||Math.abs(sy)>1e-4){
              symShift.set(c.id,[sx,sy]);
              if(c.ends&&c.ends.length===2){
                c.ends=[[Number((c.ends[0][0]+sx).toFixed(4)),Number((c.ends[0][1]+sy).toFixed(4))],[Number((c.ends[1][0]+sx).toFixed(4)),Number((c.ends[1][1]+sy).toFixed(4))]];
              }
            }
            c.pos=[Number(dx.toFixed(4)),Number(dy.toFixed(4))];
            c.rot=Number(dr.toFixed(2));
          }
        }
      }else if(c.t==='Label'){
        const idx=findLabelHeaderOffset(bytes,dv,c.id,c.layer,lblTxtOff);
        if(idx>=0){
          c.layer=dv.getUint32(idx+12,true);
          c.color=dv.getUint32(idx+29,true);
          const dx=dv.getFloat64(idx+lblPosOff,true),dy=dv.getFloat64(idx+lblPosOff+8,true),dr=dv.getFloat64(idx+lblPosOff+16,true);
          if(Number.isFinite(dx)&&Number.isFinite(dy)&&Math.abs(dx)<1e4&&Math.abs(dy)<1e4&&(Math.abs(dx)>1e-5||Math.abs(dy)>1e-5)){
            c.pos=[Number(dx.toFixed(4)),Number(dy.toFixed(4))];
            c.rot=Number(dr.toFixed(2));
          }else if(c.owner&&symShift.has(c.owner)&&c.pos){
            const [sx,sy]=symShift.get(c.owner);
            c.pos=[Number((c.pos[0]+sx).toFixed(4)),Number((c.pos[1]+sy).toFixed(4))];
          }
          const tlen=bytes[idx+lblTxtOff];
          if(tlen>0&&tlen<250&&idx+lblTxtOff+1+tlen<=bytes.length){
            c.text=decodeCp1254(bytes.subarray(idx+lblTxtOff+1,idx+lblTxtOff+1+tlen));
          }
        }
      }
    }
    for(const c of out.components){
      if(c.t==='Link'){
        if(c.p1?.sym&&symShift.has(c.p1.sym)){const [sx,sy]=symShift.get(c.p1.sym);c.p1.pos=[Number((c.p1.pos[0]+sx).toFixed(4)),Number((c.p1.pos[1]+sy).toFixed(4))];}
        if(c.p2?.sym&&symShift.has(c.p2.sym)){const [sx,sy]=symShift.get(c.p2.sym);c.p2.pos=[Number((c.p2.pos[0]+sx).toFixed(4)),Number((c.p2.pos[1]+sy).toFixed(4))];}
      }
    }
    return out;
  }

  // Standalone binary scanner for arbitrary .sld files
  const components=[],seenIds=new Set();
  const layers=[{n:0,desc:'Background',vis:'Visible'},{n:1,desc:'Foreground',vis:'Visible'},{n:2,desc:'BaseVoltage 154,0',vis:'Visible'},{n:4,desc:'BaseVoltage 400,0',vis:'Visible'}];
  for(let i=500;i<bytes.length-160;i++){
    if(bytes[i+4]===0&&bytes[i+5]===0&&bytes[i+6]===0&&bytes[i+7]===0&&(bytes[i+45]===0x1c||bytes[i+45]===0x20)){
      const mlen=bytes[i+45],adOff=i+46+mlen;if(adOff+12>=bytes.length)continue;
      const adCnt=dv.getUint16(adOff,true);if(adCnt<1||adCnt>6)continue;
      const slen=bytes[adOff+2];if(slen<5||slen>32||adOff+8>bytes.length)continue;
      if(bytes[adOff+3]!==0x41||bytes[adOff+4]!==0x4e||bytes[adOff+5]!==0x4e||bytes[adOff+6]!==0x4f||bytes[adOff+7]!==0x54)continue;
      const cid=dv.getUint32(i,true),layer=dv.getUint32(i+12,true);
      if(cid===0||cid>500000||layer>64||seenIds.has(cid))continue;
      let p=adOff+2;for(let k=0;k<adCnt;k++)p+=1+bytes[p];
      if(p+symPad+24>bytes.length)continue;
      const dx=dv.getFloat64(p+symPad,true),dy=dv.getFloat64(p+symPad+8,true),dr=dv.getFloat64(p+symPad+16,true);
      if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)>5000||Math.abs(dy)>5000)continue;
      const color=dv.getUint32(i+29,true),mapType=dv.getUint32(i+49,true),bus1=dv.getUint32(i+58,true),bus2=dv.getUint32(i+62,true),bus3=dv.getUint32(i+66,true);
      const ckt=decodeCp1254(bytes.subarray(i+70,i+74));
      const dec=decodeMapRecord(mapType,bus1,bus2,bus3,ckt);
      seenIds.add(cid);
      components.push({id:cid,t:'Symbol',stype:dec.stype,psse:dec.psse,sdef:dec.sdef,layer,color,map:dec.map,pos:[Number(dx.toFixed(4)),Number(dy.toFixed(4))],rot:Number(dr.toFixed(2)),len:dec.stype==='Busbar'?2.4:undefined,width:dec.stype==='Busbar'?0.05:undefined});
      let cursor=p+symPad+24;
      for(let s=cursor;s<Math.min(bytes.length-140,cursor+900);s++){
        if((bytes[s]===0x03&&bytes[s+1]===0x80)||(s>=7&&bytes[s-7]===0x43&&bytes[s-6]===0x53&&bytes[s+1]===0x6c)){
          const lIdx=s+2,lid=dv.getUint32(lIdx,true),lLayer=dv.getUint32(lIdx+12,true);
          if(lid>0&&lid<500000&&lLayer<=64&&lIdx+lblTxtOff+2<bytes.length){
            const tlen=bytes[lIdx+lblTxtOff];
            if(tlen>0&&tlen<120&&lIdx+lblTxtOff+1+tlen<=bytes.length){
              const txt=decodeCp1254(bytes.subarray(lIdx+lblTxtOff+1,lIdx+lblTxtOff+1+tlen));
              const lx=dv.getFloat64(lIdx+lblPosOff,true),ly=dv.getFloat64(lIdx+lblPosOff+8,true),lr=dv.getFloat64(lIdx+lblPosOff+16,true);
              const usePos=Number.isFinite(lx)&&Number.isFinite(ly)&&Math.abs(lx)<5000&&Math.abs(ly)<5000&&(Math.abs(lx)>1e-4||Math.abs(ly)>1e-4)?[Number(lx.toFixed(4)),Number(ly.toFixed(4))]:[Number(dx.toFixed(4)),Number((dy+0.35).toFixed(4))];
              if(!seenIds.has(lid)&&txt.trim()){
                seenIds.add(lid);
                components.push({id:lid,t:'Label',layer:lLayer,color:dv.getUint32(lIdx+29,true),pos:usePos,rot:Number.isFinite(lr)?Number(lr.toFixed(2)):0,text:txt,fh:9,owner:cid});
              }
            }
          }
        }
      }
    }
  }
  // Synthesize topological links between busbars and branches sharing bus numbers
  const busSymByNum=new Map();
  for(const c of components){
    if(c.t==='Symbol'&&c.map?.startsWith('BU ')){
      const bn=c.map.slice(3).trim().split(/\s+/)[0];
      if(bn&&!busSymByNum.has(bn))busSymByNum.set(bn,c);
    }
  }
  let linkSeq=90000;
  for(const c of components){
    if(c.t==='Symbol'&&c.stype==='Branch'&&c.map){
      const parts=c.map.trim().split(/\s+/);
      const b1=busSymByNum.get(parts[1]),b2=busSymByNum.get(parts[2]);
      if(b1)components.push({id:linkSeq++,t:'Link',layer:c.layer,color:c.color,lwidth:0.02,p1:{sym:b1.id,pos:[...b1.pos]},p2:{sym:c.id,pos:[...c.pos],idx:0},knees:[[b1.pos[0],c.pos[1]]]});
      if(b2)components.push({id:linkSeq++,t:'Link',layer:c.layer,color:c.color,lwidth:0.02,p1:{sym:c.id,pos:[...c.pos],idx:1},p2:{sym:b2.id,pos:[...b2.pos]},knees:[[b2.pos[0],c.pos[1]]]});
    }else if(c.t==='Symbol'&&c.stype==='Radial'&&c.map){
      const parts=c.map.trim().split(/\s+/);
      const b1=busSymByNum.get(parts[1]);
      if(b1)components.push({id:linkSeq++,t:'Link',layer:c.layer,color:c.color,lwidth:0.02,p1:{sym:b1.id,pos:[...b1.pos]},p2:{sym:c.id,pos:[...c.pos],idx:0}});
    }
  }
  return {format:'ga-sld-v1',fileVersion,layers,components};
}

function patchSldBinary(baseBytes,gaSld){
  const work=new Uint8Array(baseBytes);
  const dv=new DataView(work.buffer,work.byteOffset,work.byteLength);
  const headText=decodeCp1254(work.subarray(0,Math.min(work.length,256)));
  const isV36=headText.includes('2.0.51.');
  const symPad=isV36?37:33,lblPosOff=isV36?85:81,lblTxtOff=isV36?119:115;

  for(const c of gaSld.components||[]){
    if(c.t!=='Symbol'||!c.pos)continue;
    const idx=findSymbolHeaderOffset(work,dv,c.id,c.layer,symPad);
    if(idx>=0){
      if(c.layer!==undefined&&dv.getUint32(idx+12,true)!==c.layer)dv.setUint32(idx+12,c.layer,true);
      if(c.color!==undefined&&dv.getUint32(idx+29,true)!==c.color)dv.setUint32(idx+29,c.color,true);
      if(c.map){
        const parts=c.map.trim().split(/\s+/);
        const b1=parseInt(parts[1],10)||0,b2=parseInt(parts[2],10)||0;
        if(b1>0&&dv.getUint32(idx+58,true)!==b1)dv.setUint32(idx+58,b1,true);
        if(b2>0&&parts[0]!=='BU'&&parts[0]!=='ME'&&parts[0]!=='LO'&&parts[0]!=='FXS'&&dv.getUint32(idx+62,true)!==b2)dv.setUint32(idx+62,b2,true);
      }
      const mlen=work[idx+45],adOff=idx+46+mlen,adCnt=dv.getUint16(adOff,true);
      let p=adOff+2;for(let k=0;k<adCnt;k++)p+=1+work[p];
      const curX=dv.getFloat64(p+symPad,true),curY=dv.getFloat64(p+symPad+8,true),curR=dv.getFloat64(p+symPad+16,true);
      if(Math.abs(curX-Number(c.pos[0]))>1e-3||Math.abs(curY-Number(c.pos[1]))>1e-3){
        dv.setFloat64(p+symPad,Number(c.pos[0]),true);
        dv.setFloat64(p+symPad+8,Number(c.pos[1]),true);
      }
      if(c.rot!==undefined&&Math.abs(curR-Number(c.rot||0))>1e-2){
        dv.setFloat64(p+symPad+16,Number(c.rot||0),true);
      }
    }
  }

  const splices=[];
  for(const c of gaSld.components||[]){
    if(c.t!=='Label')continue;
    const idx=findLabelHeaderOffset(work,dv,c.id,c.layer,lblTxtOff);
    if(idx>=0){
      if(c.layer!==undefined&&dv.getUint32(idx+12,true)!==c.layer)dv.setUint32(idx+12,c.layer,true);
      if(c.color!==undefined&&dv.getUint32(idx+29,true)!==c.color)dv.setUint32(idx+29,c.color,true);
      if(c.pos){
        const curX=dv.getFloat64(idx+lblPosOff,true),curY=dv.getFloat64(idx+lblPosOff+8,true),curR=dv.getFloat64(idx+lblPosOff+16,true);
        if(Math.abs(curX-Number(c.pos[0]))>1e-3||Math.abs(curY-Number(c.pos[1]))>1e-3){
          dv.setFloat64(idx+lblPosOff,Number(c.pos[0]),true);
          dv.setFloat64(idx+lblPosOff+8,Number(c.pos[1]),true);
        }
        if(c.rot!==undefined&&Math.abs(curR-Number(c.rot||0))>1e-2){
          dv.setFloat64(idx+lblPosOff+16,Number(c.rot||0),true);
        }
      }
      if(c.text!==undefined){
        const oldLen=work[idx+lblTxtOff];
        if(oldLen<250&&idx+lblTxtOff+1+oldLen<=work.length){
          const encoded=encodeCp1254(String(c.text)).subarray(0,250);
          const cur=work.subarray(idx+lblTxtOff+1,idx+lblTxtOff+1+oldLen);
          let diff=encoded.length!==cur.length;
          if(!diff){for(let k=0;k<encoded.length;k++)if(encoded[k]!==cur[k]){diff=true;break;}}
          if(diff)splices.push({offset:idx+lblTxtOff,oldLen,newBytes:encoded});
        }
      }
    }
  }
  if(!splices.length)return work;
  splices.sort((a,b)=>a.offset-b.offset);
  let delta=0;for(const sp of splices)delta+=sp.newBytes.length-sp.oldLen;
  const out=new Uint8Array(work.length+delta);
  let sc=0,dc=0;
  for(const sp of splices){
    const len=sp.offset-sc;
    out.set(work.subarray(sc,sp.offset),dc);dc+=len;
    out[dc++]=sp.newBytes.length;
    out.set(sp.newBytes,dc);dc+=sp.newBytes.length;
    sc=sp.offset+1+sp.oldLen;
  }
  out.set(work.subarray(sc),dc);
  return out;
}

function kvColor(kv){return kv>=300?'#ec6767':kv>=180?'#eebc69':kv>=100?'#4b9dde':kv>36?'#58c5a0':'#b49ee1';}
function layerColor(layerNum,layers=[]){
  const l=layers.find(x=>Number(x.n)===Number(layerNum));
  const d=(l?.desc||'').toLowerCase();
  if(d.includes('400')||d.includes('380'))return '#ec6767';
  if(d.includes('220'))return '#eebc69';
  if(d.includes('154'))return '#4b9dde';
  if(d.includes('66')||d.includes('33')||d.includes('31')||d.includes('15'))return '#58c5a0';
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

function getCalculationResults(){
  const c=controller(),calc=c?.psseCalculation,sc=c?.psseScenario;
  const valid=Boolean(calc&&calc.status==='CONVERGED'&&calc.scenarioHash===sc?.hash);
  return {
    valid,calc,
    busMap:new Map((valid?calc.busResults:[]).map(r=>[String(r.connectionKey),r])),
    branchMap:new Map((valid?calc.branchResults:[]).map(r=>[r.id,r])),
    scenarioOps:new Map((sc?.operations||[]).map(o=>[o.equipmentId,o.value]))
  };
}

function renderGaSldToSvg(gaSld){
  const comps=gaSld.components||[],layers=gaSld.layers||[];
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
  const svg=S('svg',{xmlns:NS,viewBox:`${vbX} ${vbY} ${vbW} ${vbH}`,class:'ga-studio-drawing ga-studio-native-sld','data-sld-version':gaSld.fileVersion||'2.0.51.1'});
  svg.append(S('rect',{x:vbX-vbW,y:vbY-vbH,width:vbW*3,height:vbH*3,fill:'transparent','data-bg':'1'}));

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

  const {valid,busMap,branchMap,scenarioOps}=getCalculationResults();
  const eqRows=sourceRows();

  // 1) Render Links first (under symbols)
  for(const c of comps){
    if(c.t!=='Link'||!c.p1?.pos||!c.p2?.pos)continue;
    const lg=getLayerGroup(c.layer??2);
    const pts=[c.p1.pos,...(c.knees||[]),c.p2.pos].map(p=>[Number((p[0]*SLD_SCALE).toFixed(2)),Number((-p[1]*SLD_SCALE).toFixed(2))]);
    const d='M '+pts.map(p=>`${p[0]} ${p[1]}`).join(' L ');
    const stroke=bgrToHex(c.color,layerColor(c.layer,layers));
    const sw=Math.max(1.3,Math.min(4.5,(c.lwidth||0.02)*SLD_SCALE*0.8));
    const g=S('g',{
      class:'ga-studio-sld-link',
      'data-sld-id':c.id,
      'data-sld-type':'Link',
      'data-sld-layer':c.layer??2,
      'data-ga-node':`link:${c.id}`
    });
    const path=S('path',{d,fill:'none',stroke,'stroke-width':sw.toFixed(2),class:'ga-sld-line'});
    if(c.lstyle&&c.lstyle>0)path.setAttribute('stroke-dasharray','5 3');
    g.append(path);
    (c.knees||[]).forEach((kp,idx)=>{
      const kx=Number((kp[0]*SLD_SCALE).toFixed(2)),ky=Number((-kp[1]*SLD_SCALE).toFixed(2));
      g.append(S('circle',{cx:kx,cy:ky,r:3.5,class:'ga-studio-knee','data-link-id':c.id,'data-knee-idx':idx}));
    });
    lg.append(g);
  }

  // 2) Render Symbols
  for(const c of comps){
    if(c.t!=='Symbol'||!c.pos)continue;
    const lg=getLayerGroup(c.layer??1);
    const x=Number((c.pos[0]*SLD_SCALE).toFixed(2)),y=Number((-c.pos[1]*SLD_SCALE).toFixed(2));
    const rot=Number(c.rot||0);
    const stype=c.stype||'Node',psse=c.psse||stype;
    const match=matchSavEquipment(c.map);
    const isOut=match?.sourceEquipmentId&&scenarioOps.has(match.sourceEquipmentId)?Number(scenarioOps.get(match.sourceEquipmentId))===0:(match?.branch?.status===0||match?.bus?.status===0);
    let stroke=bgrToHex(c.color,layerColor(c.layer,layers));
    if(match?.bus?.baseKv)stroke=kvColor(match.bus.baseKv);

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
        const half=((c.len||2.0)*SLD_SCALE)/2;
        const rad=(-rot*Math.PI)/180;
        x1=Number((x-Math.cos(rad)*half).toFixed(2));y1=Number((y-Math.sin(rad)*half).toFixed(2));
        x2=Number((x+Math.cos(rad)*half).toFixed(2));y2=Number((y+Math.sin(rad)*half).toFixed(2));
      }
      const bw=Math.max(4.5,Math.min(11,(c.width||0.06)*SLD_SCALE));
      const bar=S('line',{x1,y1,x2,y2,stroke,'stroke-width':bw.toFixed(1),'stroke-linecap':'round',class:'ga-sld-busbar'});
      if(isOut)bar.setAttribute('stroke-dasharray','6 4');
      g.append(bar);
      if(state.showOverlay&&match?.bus){
        const b=match.bus,eq=eqRows.get(b.sourceEquipmentId),calcBus=busMap.get(String(b.connectionKey));
        const vm=valid&&calcBus?calcBus.vmPu:b.initialVm;
        const va=valid&&calcBus?calcBus.vaDeg:(b.initialVa??0);
        const kvVal=(b.baseKv&&Number.isFinite(vm))?(b.baseKv*vm):null;
        const badge=S('text',{x,y:y+(Math.abs(y2-y1)>Math.abs(x2-x1)?-10:13),'text-anchor':'middle',fill:'#9ee6c9','font-size':7.5,class:'ga-studio-pf-badge'});
        badge.textContent=`${num(vm,3)} pu · ${kvVal?num(kvVal,1)+' kV':num(b.baseKv,0)+' kV'}${valid?` · ${num(va,1)}°`:''}`;
        g.append(badge);
      }
    }else if(psse==='Transformer'||psse==='TWTransformer'){
      const r=9.5;
      const symG=S('g',{transform:`translate(${x} ${y}) rotate(${-rot})`});
      symG.append(
        S('circle',{cx:0,cy:-r*0.65,r,fill:'#102336',stroke,'stroke-width':2,class:'ga-sld-xfmr-coil'}),
        S('circle',{cx:0,cy:r*0.65,r,fill:'#102336',stroke,'stroke-width':2,class:'ga-sld-xfmr-coil'})
      );
      if(psse==='TWTransformer'){
        symG.append(S('circle',{cx:r*0.95,cy:0,r:r*0.85,fill:'#102336',stroke:'#e6b85c','stroke-width':1.8}));
      }
      g.append(symG);
    }else if(psse==='SwitchingDev'){
      const symG=S('g',{transform:`translate(${x} ${y}) rotate(${-rot})`});
      symG.append(S('rect',{x:-6.5,y:-6.5,width:13,height:13,rx:1.5,fill:isOut?'#102336':stroke,stroke,'stroke-width':1.8}));
      if(isOut)symG.append(S('line',{x1:-5,y1:-5,x2:5,y2:5,stroke:'#fa8080','stroke-width':1.6}));
      g.append(symG);
    }else if(psse==='Machine'){
      const symG=S('g',{transform:`translate(${x} ${y})`});
      symG.append(S('circle',{cx:0,cy:0,r:11.5,fill:'#102336',stroke:'#53cf9d','stroke-width':2}));
      const t=S('text',{x:0,y:4,'text-anchor':'middle',fill:'#d9fbee','font-size':10,'font-weight':'700'});t.textContent='G';
      symG.append(t);g.append(symG);
    }else if(psse==='Load'){
      const symG=S('g',{transform:`translate(${x} ${y}) rotate(${-rot})`});
      symG.append(S('path',{d:'M -9 -8 H 9 L 0 11 Z',fill:'#142c42',stroke:'#eab863','stroke-width':1.8}));
      g.append(symG);
    }else if(psse==='FixedShunt'||psse==='SwitchedShunt'){
      const symG=S('g',{transform:`translate(${x} ${y}) rotate(${-rot})`});
      symG.append(
        S('line',{x1:-8,y1:-3,x2:8,y2:-3,stroke:'#c79bf2','stroke-width':2}),
        S('line',{x1:-8,y1:3,x2:8,y2:3,stroke:'#c79bf2','stroke-width':2}),
        S('line',{x1:-5,y1:8,x2:5,y2:8,stroke:'#c79bf2','stroke-width':1.5})
      );
      g.append(symG);
    }else if(stype==='Branch'){
      const symG=S('g',{transform:`translate(${x} ${y}) rotate(${-rot})`});
      symG.append(
        S('line',{x1:0,y1:-9,x2:0,y2:9,stroke,'stroke-width':2.2}),
        S('circle',{cx:0,cy:0,r:3.2,fill:stroke})
      );
      g.append(symG);
    }else{
      g.append(S('circle',{cx:x,cy:y,r:3.8,fill:stroke,stroke:'#0d1e2e','stroke-width':1.2}));
    }

    if(state.showOverlay&&match?.branch){
      const br=match.branch,r=branchMap.get(br.id);
      if(r){
        const pct=Math.max(nval(r.loadingFromPct,0),nval(r.loadingToPct,0));
        const pfTxt=S('text',{x:x+12,y:y-6,fill:pct>=100?'#ff7b7b':pct>=80?'#f7c266':'#8be9c1','font-size':7.5,class:'ga-studio-pf-badge'});
        pfTxt.textContent=`${num(r.pFromMw,1)} MW · ${num(r.qFromMvar,1)} MVAr${pct>0?` (${num(pct,0)}%)`:''}`;
        g.append(pfTxt);
      }
    }

    const tip=S('title');
    tip.textContent=`[${psse}] id=${c.id} · map="${c.map||'—'}" · katman=${c.layer??1}${match?` · SAV=${match.id}`:' · (SAV eşleşmesi yok)'}`;
    g.append(tip);
    lg.append(g);
  }

  // 3) Render Labels
  for(const c of comps){
    if(c.t!=='Label'||!c.pos||!c.text||c.vis===false)continue;
    const lg=getLayerGroup(c.layer??1);
    const x=Number((c.pos[0]*SLD_SCALE).toFixed(2)),y=Number((-c.pos[1]*SLD_SCALE).toFixed(2));
    const rot=Number(c.rot||0);
    const fh=Math.max(6.5,Math.min(15,(c.fh||9)*0.82));
    const fill=bgrToHex(c.color,'#e4eef8');
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
    const textEl=S('text',{x,y,fill,'font-size':fh.toFixed(1),'font-family':'Arial, system-ui, sans-serif'});
    const lines=String(c.text).split(/\r?\n/);
    lines.forEach((ln,idx)=>{
      const tsp=S('tspan',{x,dy:idx===0?'0':`${(fh*1.15).toFixed(1)}`});
      tsp.textContent=ln;
      textEl.append(tsp);
    });
    g.append(textEl);
    lg.append(g);
  }

  return svg;
}

function save(){
  if(!hash())return;
  try{
    const data=JSON.stringify({
      schema:'ga.sld.workspace.v2',
      modelHash:hash(),
      active:state.doc?.id,
      documents:state.docs.map(d=>{const {rawFile,gaSld,...rest}=d;return {...rest,rawRetained:false};})
    });
    if(data.length<=MAX_SAVE)localStorage.setItem(KEY,data);
    state.dirty=false;
  }catch(e){}
}

function restore(){
  const h=hash();if(!h||state.restoreAttemptedFor===h)return;
  state.restoreAttemptedFor=h;
  try{
    const j=JSON.parse(localStorage.getItem(KEY)||'null');
    if(j?.schema!=='ga.sld.workspace.v2'||j.modelHash!==h||!Array.isArray(j.documents))return;
    state.docs=j.documents.filter(d=>d&&typeof d.id==='string'&&typeof d.svg==='string').slice(0,30);
    state.doc=state.docs.find(d=>d.id===j.active)??state.docs[0]??null;
  }catch(e){}
}

function createDoc({name,origin,svg,stationId='',owner='',notice='',nativeInfo=null,rawBytes=null,gaSld=null,templateKey=''}){
  const doc={
    id:uid(),name:safe(name),origin,modelHash:hash(),stationId,owner,svg,notice,nativeInfo,
    gaSld,templateKey,structModified:false,
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
    gaSld:state.doc.gaSld?structuredClone(state.doc.gaSld):null
  });
  if(state.undo.length>45)state.undo.shift();
  state.redo=[];
}

function sanitizeSvg(node){
  const allowed=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','title','defs','marker','style','metadata']);
  for(const el of [...node.querySelectorAll('*')]){
    if(!allowed.has(el.localName)){el.remove();continue;}
    for(const a of [...el.attributes]){
      const name=a.name.toLowerCase(),v=a.value;
      if(name.startsWith('on')||name==='href'||name.endsWith(':href')||(/javascript:|url\s*\(/i.test(v)&&name!=='style'))el.removeAttribute(a.name);
    }
  }
  return node;
}

function replaceSvg(text,doSnap=false){
  try{
    let node=new DOMParser().parseFromString(text,'image/svg+xml').documentElement;
    if(node.nodeName.toLowerCase()!=='svg'||node.querySelector('parsererror'))throw Error('Geçersiz SVG');
    node=sanitizeSvg(node);
    node.classList.add('ga-studio-drawing');
    const old=state.stage.querySelector('svg');
    if(old)old.replaceWith(document.importNode(node,true));
    else state.stage.append(document.importNode(node,true));
    state.svg=state.stage.querySelector('svg');
    bindSvg();
    if(doSnap)snapshot();
    return true;
  }catch(e){toast('Şema açılamadı: '+e.message,'error');return false;}
}

function activate(id){
  state.doc=state.docs.find(d=>d.id===id)||null;
  state.selection=null;state.multiSelect.clear();state.linkDraft=null;state.undo=[];state.redo=[];
  renderTabs();
  if(!state.doc){
    state.stage?.replaceChildren(E('div','ga-studio-empty','Ankara / Kayseri / Konya .sld açın, TM veya OWNER diyagramı oluşturun.'));
    refreshSidebar();
    return;
  }
  state.stage.replaceChildren();
  if(state.doc.gaSld){
    const svg=renderGaSldToSvg(state.doc.gaSld);
    state.stage.append(svg);
    state.svg=svg;
    bindSvg();
    state.doc.svg=new XMLSerializer().serializeToString(svg);
  }else{
    replaceSvg(state.doc.svg);
  }
  $('#ga-studio-title',state.host).textContent=state.doc.name;
  updateHeaderBadges();
  toast(state.doc.notice||`${state.doc.name} · ${state.doc.origin}`,'info');
  refreshSidebar();
  save();
}

function updateHeaderBadges(){
  const host=state.refs.badges;if(!host)return;
  host.replaceChildren();
  if(!state.doc)return;
  const b1=E('span','ga-studio-badge'+(state.doc.gaSld?' is-native':''),state.doc.origin);
  host.append(b1);
  if(state.doc.gaSld){
    const syms=state.doc.gaSld.components.filter(c=>c.t==='Symbol');
    const links=state.doc.gaSld.components.filter(c=>c.t==='Link');
    const lbls=state.doc.gaSld.components.filter(c=>c.t==='Label');
    let matched=0;for(const s of syms)if(matchSavEquipment(s.map))matched++;
    host.append(
      E('span','ga-studio-badge is-native',`PSS®E ${state.doc.gaSld.fileVersion||'2.0.51.1'}`),
      E('span','ga-studio-badge',`${syms.length} sembol · ${links.length} bağ · ${lbls.length} etiket`),
      E('span','ga-studio-badge',`SAV eşleşen: ${matched}/${syms.length}`)
    );
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
  const add=E('button','ga-studio-tab-add','＋');
  add.title='Yeni boş SLD sekmesi';
  add.onclick=()=>newBlank();
  state.tabs.append(add);
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
    gaSld:d.gaSld?structuredClone(d.gaSld):null,
    rawBytes:raw?new Uint8Array(raw):null,
    templateKey:d.templateKey,
    notice:'Kopya diyagram oluşturuldu.'
  });
}

async function openBuiltinSld(key,label){
  const profiles=await ensureProfiles();
  const prof=profiles[key];
  if(!prof){toast(`${label} profili bulunamadı.`,'warn');return;}
  const rawBytes=await getRawTemplateBytes(key);
  const gaSld=rawBytes?await parseSldBinary(rawBytes,label):structuredClone(prof);
  const svgEl=renderGaSldToSvg(gaSld);
  createDoc({
    name:prof.name||label,
    origin:'NATIVE_SLD',
    svg:new XMLSerializer().serializeToString(svgEl),
    gaSld,
    rawBytes:rawBytes?new Uint8Array(rawBytes):null,
    templateKey:key,
    notice:`Gerçek PSS®E 36.5 native SLD yüklendi (${gaSld.components.length} bileşen). Koordinatlar, katmanlar ve bağlantılar korunmaktadır.`
  });
}

function nativeSvg(){return $('.ga-psse-sld-svg',state.root);}
function currentStation(){return $('[aria-label="Trafo merkezi"]',state.root);}
function fromStationId(stationId){
  const select=currentStation();if(!select)return false;
  const opt=[...select.options].find(o=>o.value===stationId);if(!opt)return false;
  select.value=stationId;select.dispatchEvent(new Event('change',{bubbles:true}));return true;
}

function convertDomSvgToGaSld(svgEl,title='GA_Diagram'){
  const comps=[],layers=[
    {n:0,desc:'Background',vis:'Visible'},
    {n:1,desc:'Foreground',vis:'Visible'},
    {n:2,desc:'BaseVoltage 154,0',vis:'Visible'},
    {n:4,desc:'BaseVoltage 400,0',vis:'Visible'}
  ];
  let idSeq=100;
  const busSymMap=new Map();
  // 1) Convert busbars (.ga-sld-bus or [data-bus-id])
  for(const busG of $$('.ga-sld-bus, .ga-studio-bound-bus, [data-kind="bus-h"], [data-kind="bus-v"]',svgEl)){
    const line=$('line',busG);if(!line)continue;
    const x1=nval(line.getAttribute('x1')),y1=nval(line.getAttribute('y1')),x2=nval(line.getAttribute('x2')),y2=nval(line.getAttribute('y2'));
    const cx=((x1+x2)/2)/SLD_SCALE,cy=-((y1+y2)/2)/SLD_SCALE;
    const len=Math.max(0.8,Math.hypot(x2-x1,y2-y1)/SLD_SCALE);
    const rot=Math.abs(y2-y1)>Math.abs(x2-x1)?90:0;
    const busId=busG.dataset.busId||'';
    const busNum=busId.replace(/^bus:/,'').trim();
    const cid=idSeq++;
    comps.push({
      id:cid,t:'Symbol',stype:'Busbar',psse:'Busbar',sdef:1,layer:4,
      map:busNum?`BU ${busNum}`:'',
      pos:[Number(cx.toFixed(4)),Number(cy.toFixed(4))],
      rot,len:Number(len.toFixed(4)),width:0.06,color:hexToBgr(line.getAttribute('stroke')||'#4b9dde'),
      ends:[[Number((x1/SLD_SCALE).toFixed(4)),Number((-y1/SLD_SCALE).toFixed(4))],[Number((x2/SLD_SCALE).toFixed(4)),Number((-y2/SLD_SCALE).toFixed(4))]]
    });
    if(busId)busSymMap.set(busId,{id:cid,pos:[Number(cx.toFixed(4)),Number(cy.toFixed(4))]});
    const txt=$('text',busG)?.textContent?.trim();
    if(txt){
      comps.push({id:idSeq++,t:'Label',owner:cid,layer:4,color:0xffffff,pos:[Number(cx.toFixed(4)),Number((cy+0.28).toFixed(4))],rot:0,text:txt,fh:9});
    }
  }
  // 2) Convert branches (.ga-sld-branch, .ga-sld-feeder)
  for(const brG of $$('.ga-sld-branch, .ga-sld-feeder',svgEl)){
    const path=$('path',brG);if(!path)continue;
    const nums=(path.getAttribute('d')||'').match(/-?\d+(\.\d+)?/g)?.map(Number)||[];
    if(nums.length<4)continue;
    const x1=nums[0]/SLD_SCALE,y1=-nums[1]/SLD_SCALE,x2=nums[nums.length-2]/SLD_SCALE,y2=-nums[nums.length-1]/SLD_SCALE;
    const mx=Number(((x1+x2)/2).toFixed(4)),my=Number(((y1+y2)/2).toFixed(4));
    const isTr=Boolean($('.ga-sld-xfmr-coil',brG));
    const cid=idSeq++;
    const fId=brG.dataset.fromBusId||'',tId=brG.dataset.toBusId||'';
    const b1=fId.replace(/^bus:/,''),b2=tId.replace(/^bus:/,'');
    comps.push({
      id:cid,t:'Symbol',stype:'Branch',psse:isTr?'Transformer':'Branch',sdef:isTr?10:32,layer:2,
      map:b1&&b2?`${isTr?'TR':'LI'} ${b1} ${b2} 1 `:'',
      pos:[mx,my],rot:0,color:hexToBgr(path.getAttribute('stroke')||'#59a9ed')
    });
    const s1=busSymMap.get(fId),s2=busSymMap.get(tId);
    if(s1)comps.push({id:idSeq++,t:'Link',layer:2,color:0xff8844,lwidth:0.02,p1:{sym:s1.id,pos:[x1,y1]},p2:{sym:cid,pos:[mx,my],idx:0}});
    if(s2)comps.push({id:idSeq++,t:'Link',layer:2,color:0xff8844,lwidth:0.02,p1:{sym:cid,pos:[mx,my],idx:1},p2:{sym:s2.id,pos:[x2,y2]}});
  }
  return {format:'ga-sld-v1',fileVersion:'2.0.51.1',title,layers,components:comps};
}

function newTm(){
  const sel=currentStation();
  if(!network()||!sel){toast('Önce SAV modelini yükleyin ve TM seçin.','warn');return;}
  const stationId=state.refs.tm?.value||sel.value;
  if(stationId!==sel.value){fromStationId(stationId);requestAnimationFrame(()=>setTimeout(newTm,85));return;}
  if(!stationId){toast('TM seçilmedi.','warn');return;}
  const svg=nativeSvg();if(!svg){toast('Kaynak TM çizimi henüz hazır değil.','warn');return;}
  const clone=svg.cloneNode(true);clone.removeAttribute('role');clone.setAttribute('xmlns',NS);
  const name=sel.selectedOptions[0]?.textContent.split(' · ')[0]||`TM ${stationId}`;
  const gaSld=convertDomSvgToGaSld(clone,name);
  createDoc({name,stationId,origin:'TM_AUTO',svg:new XMLSerializer().serializeToString(clone),gaSld:null,notice:`${name} TM otomatik şeması oluşturuldu.`});
}

function newBlank(){
  const gaSld={
    format:'ga-sld-v1',
    fileVersion:'2.0.51.1',
    title:'Yeni SLD Şeması',
    layers:[
      {n:0,desc:'Background',vis:'Visible'},
      {n:1,desc:'Foreground',vis:'Visible'},
      {n:2,desc:'BaseVoltage 154,0',vis:'Visible'},
      {n:4,desc:'BaseVoltage 400,0',vis:'Visible'}
    ],
    components:[
      {id:101,t:'Symbol',stype:'Busbar',psse:'Busbar',sdef:1,layer:4,map:'',pos:[0,2.5],rot:0,len:5.0,width:0.07,color:hexToBgr('#ec6767'),ends:[[-2.5,2.5],[2.5,2.5]]},
      {id:102,t:'Label',owner:101,layer:4,color:0xffffff,pos:[0,2.95],rot:0,text:'400 kV ANA BARA',fh:10},
      {id:103,t:'Symbol',stype:'Busbar',psse:'Busbar',sdef:1,layer:2,map:'',pos:[0,-2.5],rot:0,len:5.0,width:0.07,color:hexToBgr('#4b9dde'),ends:[[-2.5,-2.5],[2.5,-2.5]]},
      {id:104,t:'Label',owner:103,layer:2,color:0xffffff,pos:[0,-3.05],rot:0,text:'154 kV ANA BARA',fh:10},
      {id:105,t:'Symbol',stype:'Branch',psse:'Transformer',sdef:10,layer:4,map:'',pos:[0,0],rot:0,color:hexToBgr('#55b5e4')},
      {id:106,t:'Label',owner:105,layer:4,color:0x9ee6c9,pos:[0.95,0],rot:0,text:'OTOTRAFO TR-1',fh:9},
      {id:201,t:'Link',layer:4,color:hexToBgr('#ec6767'),lwidth:0.025,p1:{sym:101,pos:[0,2.5]},p2:{sym:105,pos:[0,0.2],idx:0},knees:[]},
      {id:202,t:'Link',layer:2,color:hexToBgr('#4b9dde'),lwidth:0.025,p1:{sym:105,pos:[0,-0.2],idx:1},p2:{sym:103,pos:[0,-2.5]},knees:[]}
    ]
  };
  const svg=renderGaSldToSvg(gaSld);
  createDoc({name:'Yeni SLD Şeması',origin:'CUSTOM_NATIVE',svg:new XMLSerializer().serializeToString(svg),gaSld,notice:'Yeni native-uyumlu SLD şeması oluşturuldu. Sembol ekleyebilir, bağlantı çizebilir ve .sld olarak indirebilirsiniz.'});
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
  sel.replaceChildren(new Option('OWNER bölgesi seç (23 Bölge)',''),...ownerOptions().map(o=>new Option(`${names.get(o.code)||o.name} (${o.code}) · ${o.count} bara`,o.code)));
  if([...sel.options].some(o=>o.value===old))sel.value=old;
}

function newOwner(){
  const owner=state.refs.owner.value;if(!owner){toast('Önce OWNER bölgesi seçin.','warn');return;}
  const svg=ownerSvg(owner,state.refs.voltage.value);if(!svg)return;
  const op=ownerOptions().find(o=>o.code===owner),display=state.refs.owner.selectedOptions[0]?.textContent.split(' (')[0];
  createDoc({
    name:`${display||op?.name||'OWNER'} (${owner})`,
    origin:'OWNER_AUTO',
    owner,
    svg:new XMLSerializer().serializeToString(svg),
    notice:`OWNER ${owner} bölgesel topoloji şeması (sınır hatları ve yük akışı dahil).`
  });
}

function ownerSvg(code,voltage){
  const n=network(),m=model();if(!n||!m)return null;
  const eq=new Map(m.equipment.map(e=>[e.id,e]));
  const isAllowed=b=>b.source&&(voltage==='all'||(voltage==='400'?b.baseKv>=300:voltage==='154'?b.baseKv>=100&&b.baseKv<300:voltage==='66'?b.baseKv>36&&b.baseKv<100:b.baseKv<=36));
  const selected=n.buses.map((b,i)=>({b,i,e:eq.get(b.sourceEquipmentId)})).filter(o=>o.e&&String(o.e.fields.owner)===code&&isAllowed(o.b));
  if(!selected.length){toast('Bu filtrede ilgili OWNER barası bulunmuyor.','warn');return null;}
  const selectedIdx=new Set(selected.map(o=>o.i)),allBranches=n.branches.filter(b=>b.kind!=='three-winding-leg'&&b.status===1&&(selectedIdx.has(b.from)||selectedIdx.has(b.to)));
  const groups=new Map(),byIndex=new Map();
  for(const o of selected){
    const group=String(o.e.fields.isub??'')||String(o.e.name).split(/\s+/)[0];
    if(!groups.has(group))groups.set(group,{id:group,name:eq.get('substation:'+group)?.name||o.e.name||group,buses:[],x:0,y:0});
    groups.get(group).buses.push(o);byIndex.set(o.i,group);
  }
  const items=[...groups.values()].sort((a,b)=>Number(b.buses.some(o=>o.b.baseKv>=300))-Number(a.buses.some(o=>o.b.baseKv>=300))||a.name.localeCompare(b.name,'tr'));
  const cols=Math.min(8,Math.max(3,Math.ceil(Math.sqrt(items.length*1.5))));
  const cellW=228,cellH=124,pad=68,rows=Math.ceil(items.length/cols),width=pad*2+cols*cellW+260,height=pad*2+rows*cellH;
  const svg=S('svg',{xmlns:NS,viewBox:`0 0 ${width} ${height}`,class:'ga-studio-drawing ga-studio-region','aria-label':`OWNER ${code} bölgesel tek hat diyagramı`});
  svg.append(S('rect',{x:0,y:0,width,height,fill:'transparent'}));
  const linkLayer=S('g',{'data-ga-layer':'connections'}),siteLayer=S('g',{'data-ga-layer':'stations'});
  svg.append(linkLayer,siteLayer);
  items.forEach((g,i)=>{g.x=pad+(i%cols)*cellW+cellW/2;g.y=pad+Math.floor(i/cols)*cellH+cellH/2;});
  const gp=new Map(items.map(g=>[g.id,g])),pairs=new Map(),external=new Map();let boundary=0;
  for(const b of allBranches){
    const from=byIndex.get(b.from),to=byIndex.get(b.to);
    if(from&&to&&from!==to){
      const key=[from,to].sort().join('|'),pair=pairs.get(key)||{from:gp.get(from),to:gp.get(to),items:[]};
      pair.items.push(b);pairs.set(key,pair);
    }else if((from&&!to)||(!from&&to)){
      boundary++;
      const index=from?b.to:b.from,out=n.buses[index],ref=eq.get(out?.sourceEquipmentId);
      const station=String(ref?.fields?.isub??out?.connectionKey??index),start=gp.get(from||to);
      if(!start)continue;
      const record=external.get(station)||{name:eq.get('substation:'+station)?.name||ref?.name||station,siteId:station,branches:[],inner:new Map()};
      record.branches.push(b);record.inner.set(start.id,start);external.set(station,record);
    }
  }
  const {valid,branchMap}=getCalculationResults();
  for(const pair of pairs.values()){
    const {from:a,to:b}=pair;if(!a||!b)continue;
    const path=S('path',{d:`M ${a.x} ${a.y} L ${b.x} ${b.y}`,stroke:kvColor(Math.max(...pair.items.map(x=>n.buses[x.from]?.baseKv||154))),'stroke-width':Math.min(4,1.4+pair.items.length*0.4),fill:'none',opacity:'.26',class:'ga-studio-region-link','data-source-branch':pair.items[0]?.id});
    linkLayer.append(path);
    if(valid&&pair.items[0]&&branchMap.has(pair.items[0].id)){
      const r=branchMap.get(pair.items[0].id);
      const t=S('text',{x:(a.x+b.x)/2,y:(a.y+b.y)/2-4,'text-anchor':'middle',fill:'#9ee6c9','font-size':8});
      t.textContent=`${num(r.pFromMw,1)} MW`;
      linkLayer.append(t);
    }
  }
  const extItems=[...external.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr')),extX=pad+cols*cellW+110;
  extItems.forEach((ext,i)=>{
    const y=extItems.length<2?height/2:pad+34+(height-pad*2-68)*i/(extItems.length-1);
    for(const [,g] of ext.inner){
      const path=S('path',{d:`M ${g.x+89} ${g.y} L ${extX-67} ${y}`,fill:'none',stroke:'#eebc69','stroke-width':1.6,opacity:'.38',class:'ga-studio-region-link','data-branches':ext.branches.map(b=>b.id).join(',')});
      linkLayer.append(path);
    }
    const node=S('g',{'data-ga-node':'boundary:'+ext.siteId,'data-kind':'external-station',class:'ga-studio-region-site'});
    node.append(S('rect',{x:extX-68,y:y-15,width:135,height:30,rx:5,stroke:'#eebc69','stroke-dasharray':'5 3',fill:'#283747'}));
    const label=S('text',{x:extX,y:y+4,'text-anchor':'middle',fill:'#ffddb7','font-size':9});label.textContent=ext.name.slice(0,21);node.append(label);
    const tip=S('title');tip.textContent=`Bölge dışı: ${ext.name} · ${ext.branches.length} sınır bağlantısı`;node.append(tip);siteLayer.append(node);
  });
  for(const g of items){
    const item=S('g',{class:'ga-studio-region-site','data-ga-node':g.id,'data-kind':'station','data-isub':g.id,tabindex:'0',role:'button'});
    const v=Math.max(...g.buses.map(o=>o.b.baseKv||0));
    item.append(S('rect',{x:g.x-90,y:g.y-33,width:180,height:66,rx:8,fill:'#132d43',stroke:kvColor(v),'stroke-width':2}));
    const name=S('text',{x:g.x,y:g.y-14,'text-anchor':'middle',fill:'#eef4fa','font-size':11});name.textContent=g.name.slice(0,27);item.append(name);
    const desc=S('text',{x:g.x,y:g.y+3,'text-anchor':'middle',fill:'#bfd0de','font-size':10});desc.textContent=`${g.buses.length} bara · ${num(v,0)} kV`;item.append(desc);
    const bs=[...g.buses].sort((a,b)=>b.b.baseKv-a.b.baseKv).slice(0,4);
    bs.forEach((o,i)=>{
      const w=140/bs.length,x=g.x-70+i*w+6;
      item.append(S('line',{x1:x,y1:g.y+15,x2:x+w-12,y2:g.y+15,stroke:kvColor(o.b.baseKv),'stroke-width':3,'data-bus-id':o.b.id}));
    });
    const title=S('title');title.textContent=`${g.name} · ${g.buses.map(o=>o.b.externalNumber).join(', ')}`;item.append(title);siteLayer.append(item);
  }
  const title=S('text',{x:24,y:28,fill:'#e9f0f7','font-size':18,'font-weight':'600'});title.textContent=`OWNER ${code} · ${selected.length} bara · ${items.length} TM · ${boundary} sınır dalı`;svg.append(title);
  const subtitle=S('text',{x:24,y:45,fill:'#91a8bc','font-size':10});subtitle.textContent='Bölgesel topolojik görünüm · çift tıklayarak TM detayına geçebilirsiniz';svg.append(subtitle);
  return svg;
}

function setMode(mode){
  state.mode=mode;state.linkDraft=null;
  $$('[data-ga-tool]',state.host).forEach(b=>b.classList.toggle('is-active',b.dataset.gaTool===mode));
  toast(mode==='link'?'Bağlantı çizimi: önce başlangıç sembolüne/barasına, sonra hedef sembole tıklayın.':`Araç: ${mode==='select'?'Seç / taşı':mode}`);
}

function bounds(){const a=state.svg?.viewBox?.baseVal;return a?{x:a.x,y:a.y,w:a.width,h:a.height}:null;}
function toPoint(e){
  const svg=state.svg;if(!svg)return {x:0,y:0};
  const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
  try{
    const pt=p.matrixTransform(svg.getScreenCTM().inverse());
    if(state.gridSnap){return {x:Math.round(pt.x/9)*9,y:Math.round(pt.y/9)*9};}
    return pt;
  }catch{return {x:0,y:0};}
}

function target(e){
  const knee=e.target.closest?.('.ga-studio-knee');
  if(knee&&state.svg.contains(knee))return knee;
  const node=e.target.closest?.('[data-sld-id], [data-ga-node], .ga-sld-bus, .ga-sld-branch, .ga-sld-feeder, .ga-sld-three-winding, [data-kind="ga-shape"]');
  return node&&state.svg.contains(node)?node:null;
}

function uniqueId(el){
  if(!el)return 'öğe';
  if(el.dataset?.sldId){
    const c=findGaSldComp(el.dataset.sldId);
    if(c){
      if(c.t==='Label')return `Etiket #${c.id}: ${(c.text||'').replace(/\s+/g,' ').slice(0,32)}`;
      if(c.t==='Symbol')return `${c.psse||c.stype} #${c.id}${c.map?' · '+c.map:''}`;
      return `Bağ #${c.id}`;
    }
  }
  return el.getAttribute('data-ga-node')||el.getAttribute('data-bus-id')||el.getAttribute('data-source-branch')||el.getAttribute('aria-label')||el.getAttribute('data-kind')||'öğe';
}

function findGaSldComp(id){
  if(!state.doc?.gaSld)return null;
  const n=Number(id);
  return state.doc.gaSld.components.find(c=>c.id===n)||null;
}

function refreshGaSldCanvas(keepViewBox=true){
  if(!state.doc?.gaSld||!state.stage)return;
  const vb=keepViewBox&&state.svg?state.svg.getAttribute('viewBox'):null;
  const selId=state.selection?.dataset?.sldId;
  const newSvg=renderGaSldToSvg(state.doc.gaSld);
  if(vb)newSvg.setAttribute('viewBox',vb);
  const old=state.stage.querySelector('svg');
  if(old)old.replaceWith(newSvg);else state.stage.append(newSvg);
  state.svg=newSvg;
  bindSvg();
  if(selId){
    const nextEl=$(`[data-sld-id="${selId}"]`,state.svg);
    if(nextEl)selectNode(nextEl,false);
  }
  snapshot();
  updateHeaderBadges();
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
  renderPropertiesPanel(el);
}

function renderPropertiesPanel(el){
  const props=state.refs.properties;if(!props)return;
  props.replaceChildren();
  if(!el){
    props.append(E('p','','Bara, hat, trafo, kesici, etiket veya bağlantı seçin. (Shift+Tık ile çoklu seçim yapabilirsiniz.)'));
    if(state.refs.toggle)state.refs.toggle.disabled=true;
    return;
  }
  props.append(E('h4','',safe(uniqueId(el)).slice(0,95)));
  const sldComp=el.dataset?.sldId?findGaSldComp(el.dataset.sldId):null;

  if(sldComp){
    const match=matchSavEquipment(sldComp.map);
    props.append(E('div','ga-studio-property',`Tip: ${sldComp.t}${sldComp.psse?' / '+sldComp.psse:''} · ID: ${sldComp.id}`));
    props.append(E('div','ga-studio-property',`SAV Eşleşme: ${match?`✓ ${match.id}`:'— Eşleşmedi'}`));

    if(sldComp.t==='Symbol'||sldComp.t==='Label'){
      const rowXY=E('div','ga-studio-field-row');
      const fX=E('label','ga-studio-field','X (SLD)');const inX=E('input');inX.type='number';inX.step='0.05';inX.value=String(sldComp.pos?.[0]??0);fX.append(inX);
      const fY=E('label','ga-studio-field','Y (SLD)');const inY=E('input');inY.type='number';inY.step='0.05';inY.value=String(sldComp.pos?.[1]??0);fY.append(inY);
      rowXY.append(fX,fY);props.append(rowXY);

      const rowRL=E('div','ga-studio-field-row');
      const fRot=E('label','ga-studio-field','Açı (°)');const inRot=E('input');inRot.type='number';inRot.step='15';inRot.value=String(sldComp.rot??0);fRot.append(inRot);
      const fLyr=E('label','ga-studio-field','Katman');const inLyr=E('select');
      for(const l of state.doc.gaSld.layers||[{n:1,desc:'Foreground'}]){
        const opt=new Option(`${l.n}: ${l.desc||''}`,String(l.n));
        if(Number(l.n)===Number(sldComp.layer))opt.selected=true;
        inLyr.append(opt);
      }
      fLyr.append(inLyr);rowRL.append(fRot,fLyr);props.append(rowRL);

      const applyGeom=()=>{
        commit();
        const nx=nval(inX.value,sldComp.pos?.[0]??0),ny=nval(inY.value,sldComp.pos?.[1]??0);
        const dx=nx-(sldComp.pos?.[0]??0),dy=ny-(sldComp.pos?.[1]??0);
        if(sldComp.t==='Symbol')translateGaSldSymbol(sldComp,dx,dy);
        else sldComp.pos=[Number(nx.toFixed(4)),Number(ny.toFixed(4))];
        sldComp.rot=nval(inRot.value,0);
        sldComp.layer=Number(inLyr.value)||1;
        refreshGaSldCanvas(true);
      };
      inX.onchange=applyGeom;inY.onchange=applyGeom;inRot.onchange=applyGeom;inLyr.onchange=applyGeom;
    }

    if(sldComp.t==='Symbol'&&sldComp.stype==='Busbar'){
      const rowBW=E('div','ga-studio-field-row');
      const fLen=E('label','ga-studio-field','Bara Boyu');const inLen=E('input');inLen.type='number';inLen.step='0.2';inLen.value=String(sldComp.len??2.0);fLen.append(inLen);
      const fWid=E('label','ga-studio-field','Kalınlık');const inWid=E('input');inWid.type='number';inWid.step='0.01';inWid.value=String(sldComp.width??0.05);fWid.append(inWid);
      rowBW.append(fLen,fWid);props.append(rowBW);
      const applyBus=()=>{
        commit();
        sldComp.len=Math.max(0.2,nval(inLen.value,2.0));
        sldComp.width=Math.max(0.02,nval(inWid.value,0.05));
        const rad=(Number(sldComp.rot||0)*Math.PI)/180,half=sldComp.len/2;
        const [cx,cy]=sldComp.pos||[0,0];
        sldComp.ends=[[Number((cx-Math.cos(rad)*half).toFixed(4)),Number((cy-Math.sin(rad)*half).toFixed(4))],[Number((cx+Math.cos(rad)*half).toFixed(4)),Number((cy+Math.sin(rad)*half).toFixed(4))]];
        refreshGaSldCanvas(true);
      };
      inLen.onchange=applyBus;inWid.onchange=applyBus;
    }

    if(sldComp.t==='Symbol'){
      const fMap=E('label','ga-studio-field','PSS®E Map Bağı (BU / LI / TR / SYS / ME / LO)');
      const inMap=E('input');inMap.value=sldComp.map||'';inMap.placeholder='Örn: BU 412421 veya LI 235121 412421 1';
      inMap.onchange=()=>{
        commit();sldComp.map=safe(inMap.value);
        refreshGaSldCanvas(true);refreshSidebar();
      };
      fMap.append(inMap);props.append(fMap);
    }

    if(sldComp.t==='Label'){
      const fTxt=E('label','ga-studio-field','Etiket Metni (Çok satır destekli)');
      const inTxt=E('textarea');inTxt.rows=2;inTxt.value=sldComp.text||'';
      inTxt.onchange=()=>{
        commit();sldComp.text=safe(inTxt.value);
        refreshGaSldCanvas(true);refreshSidebar();
      };
      fTxt.append(inTxt);props.append(fTxt);
    }

    const fCol=E('label','ga-studio-field','Renk');
    const inCol=E('input');inCol.type='color';inCol.value=bgrToHex(sldComp.color,'#7cb7f0');
    inCol.onchange=()=>{commit();sldComp.color=hexToBgr(inCol.value);refreshGaSldCanvas(true);};
    fCol.append(inCol);props.append(fCol);
  }else{
    const data=el.dataset||{};
    for(const k of ['busId','fromBusId','toBusId','sourceBranch','gaNode','isub','kind'])if(data[k])props.append(E('div','ga-studio-property',`${k}: ${data[k]}`));
    const a=E('label','ga-studio-field','Etiket / Açıklama');const txt=E('input');txt.value=el.querySelector('text')?.textContent??'';
    txt.onchange=()=>{const t=el.querySelector('text');if(t){commit();t.textContent=safe(txt.value);snapshot();refreshSidebar();}};
    a.append(txt);props.append(a);
  }

  const branch=findSelectedBranch();
  if(state.refs.toggle){
    state.refs.toggle.disabled=!branch;
    state.refs.toggle.textContent=branch?`${branch.status?'Devre Dışı Bırak':'Servise Al'} (${branch.id})`:'Manevra (Aç/Kapat)';
  }
}

function findSelectedBranch(){
  const n=network(),el=state.selection;if(!n||!el)return null;
  if(el.dataset?.sldId){
    const c=findGaSldComp(el.dataset.sldId);
    const m=c&&matchSavEquipment(c.map);
    if(m?.branch)return m.branch;
  }
  const label=el.getAttribute('aria-label')||'',src=el.dataset.sourceBranch||label.split(' ')[0];
  return n.branches.find(b=>b.id===src||b.sourceEquipmentId===src)||null;
}

function scenarioToggle(){
  const branch=findSelectedBranch(),c=controller();if(!branch||!c)return;
  try{
    const orig=c.psseScenario?.operations||[];
    const isActive=orig.find(o=>o.equipmentId===branch.sourceEquipmentId&&o.action==='STATUS');
    const current=isActive?Number(isActive.value):branch.status;
    const value=current?0:1;
    const ops=orig.filter(o=>!(o.equipmentId===branch.sourceEquipmentId&&o.action==='STATUS'));
    ops.push({equipmentId:branch.sourceEquipmentId,action:'STATUS',value});
    c.setPsseScenario(ops);
    state.refs.toggle.textContent=`${value?'Devre Dışı Bırak':'Servise Al'} (${branch.id})`;
    if(state.doc?.gaSld)refreshGaSldCanvas(true);
    toast(`${branch.id}: ${value?'servise alındı':'devre dışı bırakıldı'}. Yük akışı düğmesiyle yeniden hesaplayın.`,'ok');
    state.refs.result.textContent='Senaryo değişti · yeniden hesaplama bekliyor.';
  }catch(e){toast('Manevra uygulanmadı: '+e.message,'error');}
}

async function runStudioSolver(method='NR_POLAR'){
  const c=controller();
  if(!c||!network()){toast('Önce SAV/RAW şebeke modelini yükleyin.','warn');return;}
  try{
    toast(`${method} yük akışı çözülüyor...`,'info');
    await c.runPsseCalculation(method,c.solverOptions?.[method==='LOSSLESS_DC'?'dc':'ac']);
    const calc=c.psseCalculation;
    if(state.doc?.gaSld)refreshGaSldCanvas(true);
    else chooseColorMode();
    state.refs.result.textContent=sourceLayerStatus();
    toast(`Hesap tamamlandı: ${calc?.method} · ${calc?.status} (${calc?.iterations??0} iterasyon, ${Math.round(calc?.elapsedMs??0)} ms)`,'ok');
  }catch(e){toast('Hesap hatası: '+e.message,'error');}
}

function translateGaSldSymbol(sym,dx,dy){
  if(!sym||!sym.pos)return;
  sym.pos=[Number((sym.pos[0]+dx).toFixed(4)),Number((sym.pos[1]+dy).toFixed(4))];
  if(sym.ends&&sym.ends.length===2){
    sym.ends=[
      [Number((sym.ends[0][0]+dx).toFixed(4)),Number((sym.ends[0][1]+dy).toFixed(4))],
      [Number((sym.ends[1][0]+dx).toFixed(4)),Number((sym.ends[1][1]+dy).toFixed(4))]
    ];
  }
  for(const c of state.doc?.gaSld?.components||[]){
    if(c.t==='Label'&&c.owner===sym.id&&c.pos){
      c.pos=[Number((c.pos[0]+dx).toFixed(4)),Number((c.pos[1]+dy).toFixed(4))];
    }else if(c.t==='Link'){
      if(c.p1?.sym===sym.id&&c.p1.pos)c.p1.pos=[Number((c.p1.pos[0]+dx).toFixed(4)),Number((c.p1.pos[1]+dy).toFixed(4))];
      if(c.p2?.sym===sym.id&&c.p2.pos)c.p2.pos=[Number((c.p2.pos[0]+dx).toFixed(4)),Number((c.p2.pos[1]+dy).toFixed(4))];
    }
  }
}

function drawShape(kind,at){
  const svg=state.svg;if(!svg)return;
  if(state.doc?.gaSld){
    const ga=state.doc.gaSld;
    const sx=Number((at.x/SLD_SCALE).toFixed(4)),sy=Number((-at.y/SLD_SCALE).toFixed(4));
    const maxId=ga.components.reduce((m,c)=>Math.max(m,Number(c.id)||0),1000);
    const cid=maxId+1,lid=maxId+2;
    state.doc.structModified=true;
    if(kind==='bus-h'||kind==='bus-v'){
      const rot=kind==='bus-v'?90:0,len=2.4;
      const ends=kind==='bus-v'?[[sx,Number((sy-1.2).toFixed(4))],[sx,Number((sy+1.2).toFixed(4))]]:[[Number((sx-1.2).toFixed(4)),sy],[Number((sx+1.2).toFixed(4)),sy]];
      ga.components.push(
        {id:cid,t:'Symbol',stype:'Busbar',psse:'Busbar',sdef:1,layer:4,map:'',pos:[sx,sy],rot,len,width:0.06,color:hexToBgr('#59a9ed'),ends},
        {id:lid,t:'Label',owner:cid,layer:4,color:0xffffff,pos:[sx,Number((sy+0.32).toFixed(4))],rot:0,text:`BARA_${cid}`,fh:9}
      );
    }else if(kind==='text'){
      ga.components.push({id:cid,t:'Label',layer:1,color:0xffffff,pos:[sx,sy],rot:0,text:'Yeni Etiket',fh:10});
    }else{
      const specMap={
        'line':{stype:'Branch',psse:'Branch',sdef:32,txt:'HAT'},
        'transformer':{stype:'Branch',psse:'Transformer',sdef:10,txt:'TRAFO 2S'},
        'transformer-3w':{stype:'Branch',psse:'TWTransformer',sdef:11,txt:'TRAFO 3S'},
        'breaker':{stype:'Branch',psse:'SwitchingDev',sdef:3,txt:'KESİCİ'},
        'disconnector':{stype:'Branch',psse:'SwitchingDev',sdef:3,txt:'AYIRICI'},
        'coupler':{stype:'Branch',psse:'SwitchingDev',sdef:3,txt:'KUPLAJ'},
        'generator':{stype:'Radial',psse:'Machine',sdef:4,txt:'GEN'},
        'load':{stype:'Radial',psse:'Load',sdef:2,txt:'YÜK'},
        'shunt':{stype:'Radial',psse:'FixedShunt',sdef:5,txt:'ŞÖNT'},
        'bus-node':{stype:'Node',psse:'BusNode',sdef:0,txt:'DÜĞÜM'}
      }[kind];
      if(!specMap)return;
      ga.components.push(
        {id:cid,t:'Symbol',stype:specMap.stype,psse:specMap.psse,sdef:specMap.sdef,layer:2,map:'',pos:[sx,sy],rot:0,color:hexToBgr('#59a9ed')},
        {id:lid,t:'Label',owner:cid,layer:2,color:0xdce7f3,pos:[sx,Number((sy-0.28).toFixed(4))],rot:0,text:`${specMap.txt}_${cid}`,fh:8.5}
      );
    }
    refreshGaSldCanvas(true);
    const added=$(`[data-sld-id="${cid}"]`,state.svg);
    if(added)selectNode(added);
    return;
  }

  const id=uid(),group=S('g',{'data-kind':'ga-shape','data-ga-node':id,class:'ga-studio-shape'});
  const color='#dce6ef';
  if(kind==='bus-h')group.append(S('line',{x1:at.x-80,y1:at.y,x2:at.x+80,y2:at.y,stroke:'#59a9ed','stroke-width':7,'stroke-linecap':'round'}));
  else if(kind==='bus-v')group.append(S('line',{x1:at.x,y1:at.y-65,x2:at.x,y2:at.y+65,stroke:'#59a9ed','stroke-width':7,'stroke-linecap':'round'}));
  else if(kind==='text'){const t=S('text',{x:at.x,y:at.y,fill:color,'font-size':15});t.textContent='Açıklama';group.append(t);}
  else if(kind==='transformer')group.append(S('circle',{cx:at.x,cy:at.y-10,r:14,fill:'none',stroke:'#55b5e4','stroke-width':2}),S('circle',{cx:at.x,cy:at.y+10,r:14,fill:'none',stroke:'#55b5e4','stroke-width':2}));
  else if(kind==='transformer-3w')group.append(S('circle',{cx:at.x-8,cy:at.y-9,r:12,fill:'none',stroke:'#55b5e4','stroke-width':2}),S('circle',{cx:at.x-8,cy:at.y+9,r:12,fill:'none',stroke:'#55b5e4','stroke-width':2}),S('circle',{cx:at.x+10,cy:at.y,r:12,fill:'none',stroke:'#e6b85c','stroke-width':2}));
  else if(kind==='generator'){group.append(S('circle',{cx:at.x,cy:at.y,r:18,fill:'none',stroke:'#53cf9d','stroke-width':2}));const t=S('text',{x:at.x,y:at.y+5,'text-anchor':'middle',fill:color,'font-size':14});t.textContent='G';group.append(t);}
  else if(kind==='load')group.append(S('path',{d:`M${at.x-16} ${at.y-13}h32l-16 32z`,fill:'none',stroke:'#e6c15d','stroke-width':2}));
  else if(kind==='shunt')group.append(S('line',{x1:at.x-14,y1:at.y-4,x2:at.x+14,y2:at.y-4,stroke:'#c79bf2','stroke-width':2.2}),S('line',{x1:at.x-14,y1:at.y+4,x2:at.x+14,y2:at.y+4,stroke:'#c79bf2','stroke-width':2.2}));
  else if(kind==='breaker')group.append(S('rect',{x:at.x-10,y:at.y-14,width:20,height:28,fill:'#18364a',stroke:'#e5eaf0','stroke-width':2}));
  else if(kind==='disconnector')group.append(S('line',{x1:at.x,y1:at.y-18,x2:at.x,y2:at.y-6,stroke:'#e5eaf0','stroke-width':2}),S('line',{x1:at.x,y1:at.y-6,x2:at.x+11,y2:at.y+8,stroke:'#f2c15a','stroke-width':2.2}),S('line',{x1:at.x,y1:at.y+8,x2:at.x,y2:at.y+18,stroke:'#e5eaf0','stroke-width':2}));
  else if(kind==='coupler')group.append(S('line',{x1:at.x-28,y1:at.y,x2:at.x+28,y2:at.y,stroke:'#59a9ed','stroke-width':2}),S('rect',{x:at.x-8,y:at.y-8,width:16,height:16,fill:'#1c4561',stroke:'#9ee6c9','stroke-width':2}));
  else if(kind==='bus-node')group.append(S('circle',{cx:at.x,cy:at.y,r:6,fill:'#59a9ed',stroke:'#fff','stroke-width':1.5}));
  else if(kind==='line')group.append(S('path',{d:`M${at.x-60} ${at.y} H${at.x+60}`,stroke:'#91bde0','stroke-width':2,fill:'none'}));
  else return;
  group.setAttribute('data-unbound','true');
  svg.append(group);snapshot();selectNode(group);
}

function handleLinkClick(p,el){
  if(!state.doc?.gaSld){
    toast('Önce native SLD veya Boş Şema sekmesinde bağlantı çizin.','warn');
    setMode('select');return;
  }
  const sldComp=el?.dataset?.sldId?findGaSldComp(el.dataset.sldId):null;
  const ptSld=[Number((p.x/SLD_SCALE).toFixed(4)),Number((-p.y/SLD_SCALE).toFixed(4))];
  if(!state.linkDraft){
    if(!sldComp||sldComp.t!=='Symbol'){toast('Bağlantı başlatmak için bir bara veya ekipman sembolüne tıklayın.','warn');return;}
    state.linkDraft={fromSym:sldComp.id,fromPos:[...(sldComp.pos||ptSld)],knees:[]};
    toast(`Başlangıç: #${sldComp.id}. Kırılma noktası için boşluğa, bitirmek için hedef sembole tıklayın.`,'info');
    return;
  }
  if(sldComp&&sldComp.t==='Symbol'&&sldComp.id!==state.linkDraft.fromSym){
    commit();
    const maxId=state.doc.gaSld.components.reduce((m,c)=>Math.max(m,Number(c.id)||0),2000);
    state.doc.gaSld.components.push({
      id:maxId+1,t:'Link',layer:sldComp.layer||2,color:sldComp.color||hexToBgr('#59a9ed'),lwidth:0.025,
      p1:{sym:state.linkDraft.fromSym,pos:state.linkDraft.fromPos},
      p2:{sym:sldComp.id,pos:[...(sldComp.pos||ptSld)]},
      knees:state.linkDraft.knees
    });
    state.doc.structModified=true;
    state.linkDraft=null;
    setMode('select');
    refreshGaSldCanvas(true);
    toast('Bağlantı oluşturuldu.','ok');
  }else{
    state.linkDraft.knees.push(ptSld);
    toast(`Kırılma noktası eklendi (${state.linkDraft.knees.length}). Hedef sembole tıklayarak tamamlayın.`,'info');
  }
}

function moveDomNode(el,dx,dy){
  if(!el)return;
  const prev=el.getAttribute('transform')||'';
  const m=el.dataset.gaTranslate?.split(',').map(Number)||[0,0];
  let [x,y]=m;x+=dx;y+=dy;
  const base=el.dataset.gaBaseTransform??prev.replace(/\s*translate\([^)]*\)\s*$/,'');
  if(el.dataset.gaBaseTransform===undefined)el.dataset.gaBaseTransform=base;
  el.dataset.gaTranslate=`${x},${y}`;
  el.setAttribute('transform',`${base} translate(${x} ${y})`.trim());
}

function bindSvg(){
  const svg=state.svg;if(!svg)return;
  svg.removeAttribute('width');svg.removeAttribute('height');
  svg.style.width='100%';svg.style.height='100%';svg.style.touchAction='none';

  svg.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const p=toPoint(e),el=target(e);
    if(state.mode==='link'){handleLinkClick(p,el);return;}
    if(state.mode!=='select'){commit();drawShape(state.mode,p);setMode('select');return;}
    if(el?.classList?.contains('ga-studio-knee')){
      commit();
      state.drag={id:e.pointerId,p,prev:p,el,mode:'knee',linkId:Number(el.dataset.linkId),kneeIdx:Number(el.dataset.kneeIdx),changed:false};
      svg.setPointerCapture(e.pointerId);e.preventDefault();return;
    }
    if(el)selectNode(el,e.shiftKey);else if(!e.shiftKey)selectNode(null);
    const mode=el?'move':'pan';
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
        d.el.setAttribute('cx',p.x);d.el.setAttribute('cy',p.y);
        const pts=[lk.p1.pos,...lk.knees,lk.p2.pos].map(pt=>[Number((pt[0]*SLD_SCALE).toFixed(2)),Number((-pt[1]*SLD_SCALE).toFixed(2))]);
        const path=d.el.closest('.ga-studio-sld-link')?.querySelector('path');
        if(path)path.setAttribute('d','M '+pts.map(pt=>`${pt[0]} ${pt[1]}`).join(' L '));
        d.changed=true;
      }
    }else if(Math.abs(dx)+Math.abs(dy)>0.02){
      const targets=state.multiSelect.size>1?[...state.multiSelect]:[d.el];
      for(const item of targets){
        if(state.doc?.gaSld&&item.dataset?.sldId){
          const c=findGaSldComp(item.dataset.sldId);
          if(c){
            const sdx=dx/SLD_SCALE,sdy=-dy/SLD_SCALE;
            if(c.t==='Symbol')translateGaSldSymbol(c,sdx,sdy);
            else if(c.t==='Label'&&c.pos)c.pos=[Number((c.pos[0]+sdx).toFixed(4)),Number((c.pos[1]+sdy).toFixed(4))];
          }
        }
        moveDomNode(item,dx,dy);
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
    const p=toPoint(e),scale=e.deltaY<0?0.85:1.18,nw=Math.max(20,Math.min(25000,vb.w*scale)),nh=vb.h*nw/vb.w;
    svg.setAttribute('viewBox',`${p.x-(p.x-vb.x)*nw/vb.w} ${p.y-(p.y-vb.y)*nh/vb.h} ${nw} ${nh}`);
    snapshot();
  },{passive:false});

  svg.addEventListener('dblclick',e=>{
    const el=target(e);
    if(el?.dataset?.isub){
      if(fromStationId(el.dataset.isub))setTimeout(newTm,90);
      return;
    }
    if(el){selectNode(el);state.refs.properties.querySelector('input,textarea')?.focus();}
  });
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
    }
    refreshGaSldCanvas(true);
    toast(`Hizalama uygulandı (${comps.length} nesne).`,'ok');
  }
}

function rotateSelected(){
  if(!state.selection)return;
  commit();
  if(state.doc?.gaSld&&state.selection.dataset?.sldId){
    const c=findGaSldComp(state.selection.dataset.sldId);
    if(c){
      c.rot=((Number(c.rot||0)+90)%360);
      if(c.stype==='Busbar'&&c.pos){
        const rad=(c.rot*Math.PI)/180,half=(c.len||2.0)/2;
        c.ends=[[Number((c.pos[0]-Math.cos(rad)*half).toFixed(4)),Number((c.pos[1]-Math.sin(rad)*half).toFixed(4))],[Number((c.pos[0]+Math.cos(rad)*half).toFixed(4)),Number((c.pos[1]+Math.sin(rad)*half).toFixed(4))]];
      }
      refreshGaSldCanvas(true);
    }
  }
}

function resolveOverlaps(){
  if(!state.svg)return;
  commit();
  if(state.doc?.gaSld){
    const lbls=state.doc.gaSld.components.filter(c=>c.t==='Label'&&c.pos&&c.text&&c.vis!==false);
    let moved=0;
    for(let pass=0;pass<6;pass++){
      for(let i=0;i<lbls.length;i++){
        const a=lbls[i];
        const aw=Math.max(0.45,Math.min(2.8,(a.text.length*0.055))),ah=0.26*(a.text.split('\n').length);
        for(let j=i+1;j<lbls.length;j++){
          const b=lbls[j];
          if(Math.abs(a.pos[0]-b.pos[0])>3.5||Math.abs(a.pos[1]-b.pos[1])>1.8)continue;
          const bw=Math.max(0.45,Math.min(2.8,(b.text.length*0.055))),bh=0.26*(b.text.split('\n').length);
          const ox=(aw+bw)/2-Math.abs(a.pos[0]-b.pos[0]),oy=(ah+bh)/2-Math.abs(a.pos[1]-b.pos[1]);
          if(ox>0&&oy>0){
            const pushY=(a.pos[1]>=b.pos[1]?1:-1)*(oy*0.55+0.04);
            a.pos[1]=Number((a.pos[1]+pushY).toFixed(4));
            b.pos[1]=Number((b.pos[1]-pushY).toFixed(4));
            moved++;
          }
        }
      }
    }
    refreshGaSldCanvas(true);
    toast(`Etiket ve sembol çakışma giderme tamamlandı (${moved} çakışma düzeltildi).`,'ok');
    return;
  }
  const texts=$$('text',state.svg);
  let fixed=0;
  for(let i=0;i<texts.length;i++){
    const r1=texts[i].getBoundingClientRect();if(!r1.width)continue;
    for(let j=i+1;j<texts.length;j++){
      const r2=texts[j].getBoundingClientRect();if(!r2.width)continue;
      if(!(r1.right<r2.left||r1.left>r2.right||r1.bottom<r2.top||r1.top>r2.bottom)){
        const y=nval(texts[j].getAttribute('y'),0);
        texts[j].setAttribute('y',String(y+13));fixed++;
      }
    }
  }
  snapshot();
  toast(`Etiket çakışmaları giderildi (${fixed} etiket kaydırıldı).`,'ok');
}

function undo(){
  if(!state.undo.length||!state.svg||!state.doc)return;
  state.redo.push({svg:new XMLSerializer().serializeToString(state.svg),gaSld:state.doc.gaSld?structuredClone(state.doc.gaSld):null});
  const prev=state.undo.pop();
  state.doc.gaSld=prev.gaSld;
  if(state.doc.gaSld)refreshGaSldCanvas(true);else replaceSvg(prev.svg,true);
}

function redo(){
  if(!state.redo.length||!state.svg||!state.doc)return;
  state.undo.push({svg:new XMLSerializer().serializeToString(state.svg),gaSld:state.doc.gaSld?structuredClone(state.doc.gaSld):null});
  const next=state.redo.pop();
  state.doc.gaSld=next.gaSld;
  if(state.doc.gaSld)refreshGaSldCanvas(true);else replaceSvg(next.svg,true);
}

function removeSelection(){
  if(!state.selection)return;
  commit();
  if(state.doc?.gaSld&&state.selection.dataset?.sldId){
    const ids=new Set([...state.multiSelect].map(el=>Number(el.dataset?.sldId)).filter(Boolean));
    state.doc.gaSld.components=state.doc.gaSld.components.filter(c=>!ids.has(c.id)&&!ids.has(c.owner)&&!ids.has(c.p1?.sym)&&!ids.has(c.p2?.sym));
    state.doc.structModified=true;
    selectNode(null);
    refreshGaSldCanvas(true);
    return;
  }
  state.selection.remove();selectNode(null);snapshot();
}

function exportFile(data,name,type='application/octet-stream'){
  const url=URL.createObjectURL(new Blob([data],{type}));
  const a=E('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function basename(){return (state.doc?.name||'SLD').replace(/\.sld$/i,'').replace(/[\\/:*?"<>|]/g,'_').slice(0,75);}

async function exportNativeSld(){
  if(!state.doc){toast('Dışa aktarılacak aktif şema yok.','warn');return;}
  let gaSld=state.doc.gaSld;
  if(!gaSld&&state.svg){
    gaSld=convertDomSvgToGaSld(state.svg,state.doc.name);
  }
  const rawBytes=state.nativeBytes.get(state.doc.id)||(state.doc.templateKey?await getRawTemplateBytes(state.doc.templateKey):null);

  // Try local PSS®E 36.5 sliderPy HTTP Bridge first when structural additions/deletions exist or no base binary exists
  if(!rawBytes||state.doc.structModified){
    try{
      toast('Yerel PSS®E 36.5 sliderPy köprüsü kontrol ediliyor...','info');
      const baseB64=rawBytes?btoa(Array.from(rawBytes,b=>String.fromCharCode(b)).join('')):null;
      const res=await fetch('http://127.0.0.1:18765/build-sld',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({diagram:gaSld,baseSldB64:baseB64,clean:!rawBytes})
      });
      if(res.ok){
        const j=await res.json();
        if(j.ok&&j.sldB64){
          const bin=atob(j.sldB64),out=new Uint8Array(bin.length);
          for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
          exportFile(out,basename()+'.sld','application/octet-stream');
          toast(`Gerçek PSS®E 36.5 sliderPy ile derlenmiş .sld indirildi (${formatBytes(out.length)}).`,'ok');
          return;
        }
      }
    }catch(e){}
  }

  // Direct in-browser CArchive binary patcher (100% verified in PSS®E 36.5!)
  const baseToPatch=rawBytes||(await getRawTemplateBytes('ankara'));
  if(baseToPatch&&gaSld){
    const patched=patchSldBinary(baseToPatch,gaSld);
    exportFile(patched,basename()+'.sld','application/octet-stream');
    toast(`PSS®E 36.5 uyumlu binary .sld indirildi (${formatBytes(patched.length)} · CArchive ${gaSld.fileVersion||'2.0.51.1'}).`,'ok');
    return;
  }
  toast('Binary .sld şablonu bulunamadı; .gasld.json indiriliyor.','warn');
  exportGaSldJson();
}

function exportGaSldJson(){
  if(!state.doc)return;
  const gaSld=state.doc.gaSld||(state.svg?convertDomSvgToGaSld(state.svg,state.doc.name):null);
  if(!gaSld)return;
  exportFile(JSON.stringify(gaSld,null,2),basename()+'.gasld.json','application/json;charset=utf-8');
  toast(`${basename()}.gasld.json indirildi (psse_sld_converter.py ile PSS®E 36.5'te derlenebilir).`,'ok');
}

function svgText(){
  if(!state.svg)return null;
  const copy=state.svg.cloneNode(true);
  $$('.ga-studio-selected,.ga-studio-multi-selected',copy).forEach(n=>n.classList.remove('ga-studio-selected','ga-studio-multi-selected'));
  copy.setAttribute('xmlns',NS);
  copy.setAttribute('style','background:#0c1b2a;font-family:system-ui,Segoe UI,sans-serif;color:#eaf1fa');
  return new XMLSerializer().serializeToString(copy);
}

function exportSvg(){const xml=svgText();if(xml)exportFile(xml,basename()+'.svg','image/svg+xml;charset=utf-8');}

async function exportPng(){
  const xml=svgText(),vb=bounds();if(!xml||!vb)return;
  const canvas=E('canvas'),w=Math.min(3600,Math.max(900,Math.round(vb.w*1.5)));
  canvas.width=w;canvas.height=Math.min(4500,Math.max(500,Math.round(w*vb.h/vb.w)));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#0c1b2a';ctx.fillRect(0,0,canvas.width,canvas.height);
  const img=new Image(),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));
  try{
    await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(Error('SVG resim yüklenemedi'));img.src=url;});
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    canvas.toBlob(b=>{if(b)exportFile(b,basename()+'.png','image/png');});
  }catch(e){toast(e.message,'error');}finally{URL.revokeObjectURL(url);}
}

function exportProject(){
  save();
  const work={
    schema:'ga.sld.workspace.v2',
    source:{modelHash:hash(),sourceSha256:network()?.sourceSha256,name:network()?.sourceName},
    active:state.doc?.id,
    documents:state.docs.map(d=>({id:d.id,name:d.name,origin:d.origin,modelHash:d.modelHash,stationId:d.stationId,owner:d.owner,svg:d.svg,gaSld:d.gaSld}))
  };
  exportFile(JSON.stringify(work,null,2),'GridAnalyzer_SLD_Proje.json','application/json;charset=utf-8');
}

function importProject(json){
  if(json?.format==='ga-sld-v1'&&Array.isArray(json.components)){
    const svg=renderGaSldToSvg(json);
    createDoc({name:json.title||'SLD_Diagram.sld',origin:'NATIVE_SLD',svg:new XMLSerializer().serializeToString(svg),gaSld:json,notice:'ga-sld-v1 native diyagram içe aktarıldı.'});
    return;
  }
  if(json?.schema!=='ga.sld.workspace.v2'||!Array.isArray(json.documents))throw Error('Geçersiz SLD proje/diyagram JSON dosyası.');
  let count=0;
  for(const d of json.documents.slice(0,30)){
    if(d.gaSld){
      const svg=renderGaSldToSvg(d.gaSld);
      createDoc({name:d.name||'Aktarılan',origin:d.origin||'NATIVE_SLD',svg:new XMLSerializer().serializeToString(svg),gaSld:d.gaSld});
      count++;
    }else if(typeof d.svg==='string'){
      createDoc({name:d.name||'Aktarılan',origin:d.origin||'GA_PROJECT',svg:d.svg,owner:d.owner,stationId:d.stationId});
      count++;
    }
  }
  toast(`${count} şema sekmesi içe aktarıldı.`,'ok');
}

async function importOne(file){
  const suffix=file.name.split('.').pop()?.toLowerCase();
  if(suffix==='json'){
    try{importProject(JSON.parse(await file.text()));}catch(e){toast(e.message,'error');}
    return;
  }
  if(suffix==='sld'||suffix==='sldxml'){
    const bytes=new Uint8Array(await file.arrayBuffer());
    const gaSld=await parseSldBinary(bytes,file.name);
    const svg=renderGaSldToSvg(gaSld);
    createDoc({
      name:file.name,
      origin:'NATIVE_SLD',
      svg:new XMLSerializer().serializeToString(svg),
      gaSld,
      rawBytes:bytes,
      notice:`Gerçek PSS®E .sld yüklendi: ${file.name} (${formatBytes(bytes.length)} · ${gaSld.components.length} bileşen). Düzenleyip doğrudan .sld olarak kaydedebilirsiniz.`
    });
    toast(`${file.name} başarıyla çözümlendi ve açıldı (${gaSld.components.length} bileşen).`,'ok');
    return;
  }
  toast('Desteklenmeyen dosya uzantısı: '+suffix,'warn');
}

function addBoundBus(bus){
  if(!state.svg)return;
  const rows=sourceRows(),e=rows.get(bus.sourceEquipmentId),vb=bounds(),x=vb?vb.x+vb.w*0.5:0,y=vb?vb.y+vb.h*0.5:0;
  commit();
  if(state.doc?.gaSld){
    const sx=Number((x/SLD_SCALE).toFixed(4)),sy=Number((-y/SLD_SCALE).toFixed(4));
    const maxId=state.doc.gaSld.components.reduce((m,c)=>Math.max(m,Number(c.id)||0),1000);
    const cid=maxId+1,lid=maxId+2;
    state.doc.gaSld.components.push(
      {id:cid,t:'Symbol',stype:'Busbar',psse:'Busbar',sdef:1,layer:4,map:`BU ${bus.externalNumber||bus.connectionKey}`,pos:[sx,sy],rot:0,len:2.4,width:0.06,color:hexToBgr(kvColor(bus.baseKv||154)),ends:[[Number((sx-1.2).toFixed(4)),sy],[Number((sx+1.2).toFixed(4)),sy]]},
      {id:lid,t:'Label',owner:cid,layer:4,color:0xffffff,pos:[sx,Number((sy+0.32).toFixed(4))],rot:0,text:`${bus.externalNumber||bus.connectionKey}\n${(e?.name||'').slice(0,22)}`,fh:9}
    );
    state.doc.structModified=true;
    refreshGaSldCanvas(true);
    toast(`SAV barası ${bus.connectionKey} native SLD şemasına eklendi.`,'ok');
    return;
  }
  const g=S('g',{'data-ga-node':uid(),'data-bus-id':bus.id,'data-kind':'bound-bus',class:'ga-studio-bound-bus'});
  const color=kvColor(bus.baseKv||0);
  g.append(S('line',{x1:x-68,y1:y,x2:x+68,y2:y,stroke:color,'stroke-width':7}));
  const name=S('text',{x,y:y-16,'text-anchor':'middle',fill:'#eef4fa','font-size':13});name.textContent=(e?.name||bus.connectionKey).slice(0,35);g.append(name);
  const detail=S('text',{x,y:y+22,'text-anchor':'middle',fill:'#b6cbdb','font-size':11});detail.textContent=`${bus.connectionKey} · ${num(bus.baseKv,0)} kV · ${num(bus.initialVm,3)} pu`;g.append(detail);
  state.svg.append(g);snapshot();selectNode(g);
}

function refreshSidebar(){
  const box=state.refs.equipment;if(!box)return;
  box.replaceChildren();
  if(!state.doc)return;

  // 1) Layer Management Section
  box.append(E('h3','','Katman Yönetimi (Layers)'));
  const layerList=E('div','ga-studio-layer-list');
  if(state.doc.gaSld){
    const counts=new Map();
    for(const c of state.doc.gaSld.components)counts.set(c.layer,(counts.get(c.layer)||0)+1);
    for(const l of state.doc.gaSld.layers||[]){
      const row=E('div','ga-studio-layer-item');
      const lbl=E('label');
      const cb=E('input');cb.type='checkbox';cb.checked=l.vis!=='Hidden';
      cb.onchange=()=>{
        l.vis=cb.checked?'Visible':'Hidden';
        const g=$(`.ga-sld-layer-group[data-sld-layer="${l.n}"]`,state.svg);
        if(g)g.style.display=cb.checked?'':'none';
        snapshot();
      };
      lbl.append(cb,document.createTextNode(`${l.desc||`Katman ${l.n}`}`));
      row.append(lbl,E('span','',String(counts.get(l.n)||0)));
      layerList.append(row);
    }
  }
  const ovRow=E('div','ga-studio-layer-item');
  const ovLbl=E('label');const ovCb=E('input');ovCb.type='checkbox';ovCb.checked=state.showOverlay;
  ovCb.onchange=()=>{state.showOverlay=ovCb.checked;if(state.doc?.gaSld)refreshGaSldCanvas(true);};
  ovLbl.append(ovCb,document.createTextNode('Yük Akışı (MW/MVAr/pu)'));
  ovRow.append(ovLbl);layerList.append(ovRow);
  box.append(layerList);

  // 2) SAV Model Equipment Search & Placement
  box.append(E('h3','','SAV Modelden Bara Ekle'));
  const modelSearch=E('input','ga-studio-search');modelSearch.placeholder='SAV bara no veya adı ara...';box.append(modelSearch);
  const matchHost=E('div','ga-studio-entity-list ga-studio-model-search');box.append(matchHost);
  modelSearch.oninput=()=>{
    const q=modelSearch.value.trim().toLocaleLowerCase('tr');matchHost.replaceChildren();if(q.length<2)return;
    const eq=sourceRows();let count=0;
    for(const bus of network()?.buses||[]){
      const item=eq.get(bus.sourceEquipmentId);
      if(!bus.source||!(bus.connectionKey.includes(q)||(item?.name||'').toLocaleLowerCase('tr').includes(q)))continue;
      const b=E('button','',`${item?.name||bus.connectionKey} · ${bus.connectionKey} (${num(bus.baseKv,0)} kV)`);
      b.onclick=()=>addBoundBus(bus);matchHost.append(b);
      if(++count>=25)break;
    }
  };

  // 3) Diagram Component Search
  box.append(E('h3','','Şemadaki Nesneler'));
  const text=E('input','ga-studio-search');text.placeholder='Şemada bara / hat / etiket ara...';box.append(text);
  const items=state.svg?$$('[data-sld-id], [data-bus-id], [data-ga-node], [data-source-branch]',state.svg).slice(0,400):[];
  const list=E('div','ga-studio-entity-list');
  const show=()=>{
    const q=text.value.toLocaleLowerCase('tr');list.replaceChildren();
    let shown=0;
    for(const el of items){
      const label=uniqueId(el);
      if(q&&!label.toLocaleLowerCase('tr').includes(q))continue;
      const btn=E('button','',label.slice(0,52));btn.title=label;
      btn.onclick=()=>{
        selectNode(el);
        if(state.doc?.gaSld&&el.dataset?.sldId){
          const c=findGaSldComp(el.dataset.sldId);
          if(c?.pos&&state.svg){
            const cx=c.pos[0]*SLD_SCALE,cy=-c.pos[1]*SLD_SCALE,vb=bounds();
            if(vb)state.svg.setAttribute('viewBox',`${cx-vb.w/2} ${cy-vb.h/2} ${vb.w} ${vb.h}`);
          }
        }
      };
      list.append(btn);
      if(++shown>=120)break;
    }
  };
  text.oninput=show;show();box.append(list);
  if(state.refs.result)state.refs.result.textContent=sourceLayerStatus();
}

function sourceLayerStatus(){
  const c=controller(),calc=c?.psseCalculation,sc=c?.psseScenario;
  if(!c||!network())return 'SAV modeli henüz yüklenmedi (Native .sld dosyalarını bağımsız açıp düzenleyebilirsiniz).';
  const base=`SOURCE_SAVED · ${num(network().buses.length,0)} bara · ${num(network().branches.length,0)} dal`;
  if(!calc)return base+' · GA hesabı çalıştırılmadı';
  const valid=calc.status==='CONVERGED'&&calc.scenarioHash===sc?.hash;
  return `${base} · ${valid?`✓ ${calc.method} CONVERGED`:`⚠ ${calc.status}`}`;
}

function fit(){
  const svg=state.svg;if(!svg)return;
  try{
    const bb=svg.getBBox();
    if(bb.width>1&&bb.height>1){svg.setAttribute('viewBox',`${bb.x-45} ${bb.y-45} ${bb.width+90} ${bb.height+90}`);snapshot();}
  }catch{toast('Sığdırma hesaplanamadı.','warn');}
}

function useOriginal(){
  if(!state.doc)return;
  if(state.doc.templateKey){openBuiltinSld(state.doc.templateKey,state.doc.name);return;}
  const id=state.doc.stationId;
  if(id&&currentStation()?.value!==id){fromStationId(id);requestAnimationFrame(()=>setTimeout(takeOriginal,60));return;}
  takeOriginal();
}

function takeOriginal(){
  const src=nativeSvg();if(!src){toast('Kaynak otomatik çizim bulunamadı.','warn');return;}
  commit();replaceSvg(new XMLSerializer().serializeToString(src),true);toast('TM şeması kaynak otomatik yerleşimden yenilendi.');
}

function chooseColorMode(){
  if(!state.svg)return;
  const mode=state.refs.layer.value,{valid,busMap,branchMap}=getCalculationResults();
  for(const el of $$('.ga-sld-branch, .ga-studio-sld-symbol',state.svg)){
    const id=el.dataset.sourceBranch||(el.getAttribute('aria-label')||'').split(' ')[0];
    const r=branchMap.get(id),path=$('path, line, circle',el);if(!path)continue;
    let color=path.dataset.gaOriginalStroke||path.getAttribute('stroke')||'#68a6d5';
    if(!path.dataset.gaOriginalStroke)path.dataset.gaOriginalStroke=color;
    if(mode==='loading'&&valid&&r){
      const v=Math.max(nval(r.loadingFromPct,-1),nval(r.loadingToPct,-1));
      color=v>=100?'#ee5d63':v>=80?'#f7b24f':'#49ba8f';
    }
    path.setAttribute('stroke',color);
  }
  for(const el of $$('.ga-sld-bus',state.svg)){
    const id=el.dataset.busId,entry=network()?.buses.find(b=>b.id===id),r=entry&&busMap.get(String(entry.connectionKey)),bar=$('.ga-sld-busbar',el);if(!bar)continue;
    let color=bar.dataset.gaOriginalStroke||bar.getAttribute('stroke');
    if(!bar.dataset.gaOriginalStroke)bar.dataset.gaOriginalStroke=color;
    if(mode==='voltage'&&valid&&r){
      const v=r.vmPu;color=v<0.95||v>1.05?'#ed6969':v<0.98||v>1.02?'#f2b75f':'#60c5a2';
    }
    bar.setAttribute('stroke',color);
  }
  state.refs.result.textContent=sourceLayerStatus();snapshot();
}

function controls(){
  const host=E('section','ga-sld-studio');host.id='ga-sld-studio';state.host=host;
  const row=E('div','ga-studio-header');
  const title=E('strong','ga-studio-title','PSS®E Native SLD & Tek Hat Çizim Stüdyosu');title.id='ga-studio-title';
  const badges=E('div','ga-studio-badges');state.refs.badges=badges;
  const status=E('span','ga-studio-model','Model bekleniyor');state.refs.model=status;
  row.append(title,badges,status);

  const tabs=E('nav','ga-studio-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','SLD doküman sekmeleri');state.tabs=tabs;

  const toolbar=E('div','ga-studio-toolbar');
  const btn=(text,fn,cls='',tip='')=>{const b=E('button','ga-studio-button '+cls,text);b.type='button';if(tip)b.title=tip;b.onclick=fn;toolbar.append(b);return b;};

  btn('📂 Ankara .sld',()=>void openBuiltinSld('ankara','ÜNKN_AnkaraBolge.sld'),'is-native-btn','Gerçek PSS®E 36.5 Ankara Bölge .sld diyagramını aç');
  btn('📂 Kayseri .sld',()=>void openBuiltinSld('kayseri','ÜNKN_KayseriBolge.sld'),'is-native-btn','Gerçek PSS®E 36.5 Kayseri Bölge .sld diyagramını aç');
  btn('📂 Konya .sld',()=>void openBuiltinSld('konya','ÜNKN_KonyaBolge.sld'),'is-native-btn','Gerçek PSS®E 36.5 Konya Bölge .sld diyagramını aç');
  btn('📂 OAYTM .sld',()=>void openBuiltinSld('oaytm','OAYTM_GUNCEL_SLD.sld'),'is-native-btn','Gerçek PSS®E 36.5 OAYTM .sld diyagramını aç');

  const tm=E('select','ga-studio-select');tm.title='Trafo merkezi seçimi (SAV model)';tm.setAttribute('aria-label','SLD editörü trafo merkezi');state.refs.tm=tm;toolbar.append(tm);
  tm.onchange=()=>{if(fromStationId(tm.value))toast('TM seçildi. TM Çiz ile yeni sekmede açın.');};

  const owner=E('select','ga-studio-select');owner.title='OWNER (23 Bölge) bazlı bölgesel şema';state.refs.owner=owner;toolbar.append(owner);
  const voltage=E('select','ga-studio-select');[['all','Tüm kV'],['400','400 kV'],['154','154/220 kV'],['66','66 kV'],['low','≤36 kV']].forEach(([k,v])=>voltage.append(new Option(v,k)));state.refs.voltage=voltage;toolbar.append(voltage);

  btn('OWNER Çiz',newOwner);btn('TM Çiz',newTm);btn('Boş Şema',newBlank);btn('Kopyala',()=>duplicateDoc());
  btn('Dosya Aç (.sld/JSON)',()=>state.refs.file.click());
  btn('💾 .sld İndir (Native)',()=>void exportNativeSld(),'is-native-btn','PSS®E 36.5 ile doğrudan açılabilen native binary .sld olarak kaydet');
  btn('.gasld.json',exportGaSldJson,'','PSS®E sliderPy dönüştürücü JSON formatında indir');
  btn('Proje JSON',exportProject);btn('SVG',exportSvg);btn('PNG',()=>void exportPng());

  const line=E('div','ga-studio-tools-line');
  const tool=(label,mode)=>{const b=E('button','ga-studio-button ga-studio-tool',label);b.dataset.gaTool=mode;b.onclick=()=>setMode(mode);line.append(b);};
  [
    ['Seç / Taşı','select'],
    ['Bağlantı Çiz','link'],
    ['Yatay Bara','bus-h'],
    ['Dikey Bara','bus-v'],
    ['Düğüm','bus-node'],
    ['AC Hat','line'],
    ['2S Trafo','transformer'],
    ['3S Trafo','transformer-3w'],
    ['Kesici (CB)','breaker'],
    ['Ayırıcı (DS)','disconnector'],
    ['Kuplaj (BC)','coupler'],
    ['Jeneratör','generator'],
    ['Yük','load'],
    ['Şönt','shunt'],
    ['Metin','text']
  ].forEach(([a,b])=>tool(a,b));

  const act=(label,fn,tip='')=>{const b=E('button','ga-studio-button',label);b.type='button';if(tip)b.title=tip;b.onclick=fn;line.append(b);return b;};
  act('left Sola',()=>alignSelected('left'),'Seçili nesneleri sola hizala');
  act('center Ortala X',()=>alignSelected('center-x'),'Seçili nesneleri yatay ortala');
  act('top Üste',()=>alignSelected('top'),'Seçili nesneleri üste hizala');
  act('⇄ Dağıt',()=>alignSelected('distribute-x'),'Seçili nesneleri eşit aralıkla dağıt');
  act('↻ 90°',rotateSelected,'Seçili sembolü/barayı 90° döndür');
  const snapBtn=act('⊞ Izgara',()=>{state.gridSnap=!state.gridSnap;snapBtn.classList.toggle('is-active',state.gridSnap);state.stage.classList.toggle('is-grid',state.gridSnap);},'Izgaraya kenetleme (Grid Snap)');
  act('✨ Çakışmaları Çöz',resolveOverlaps,'Etiket ve sembol çakışmalarını otomatik gider');
  act('↶ Geri',undo,'Geri al (Ctrl+Z)');
  act('↷ İleri',redo,'İleri al (Ctrl+Y)');
  act('🗑 Sil',removeSelection,'Seçili nesneyi sil (Delete)');
  act('⛶ Sığdır',fit,'Tüm diyagramı ekrana sığdır');

  const layer=E('select','ga-studio-select');
  [['source','Kaynak / Katman Rengi'],['loading','Yüklenme % (Isı)'],['voltage','Gerilim pu']].forEach(([v,t])=>layer.append(new Option(t,v)));
  layer.onchange=chooseColorMode;state.refs.layer=layer;line.append(layer);

  const work=E('div','ga-studio-workspace');
  const left=E('aside','ga-studio-left');state.refs.equipment=left;
  const stage=E('div','ga-studio-stage');stage.setAttribute('aria-label','Düzenlenebilir tek hat şeması');state.stage=stage;
  stage.addEventListener('dragover',e=>{e.preventDefault();});
  stage.addEventListener('drop',async e=>{e.preventDefault();for(const f of e.dataTransfer?.files||[])await importOne(f);});

  const right=E('aside','ga-studio-right');
  right.append(E('h3','','Ekipman Özellik Paneli'));
  const props=E('div','ga-studio-properties','Nesne seçin.');state.refs.properties=props;right.append(props);
  right.append(E('h3','','Manevra & Yük Akışı Simülasyonu'));
  state.refs.toggle=E('button','ga-studio-button','Manevra (Aç/Kapat)');state.refs.toggle.disabled=true;state.refs.toggle.style.width='100%';state.refs.toggle.onclick=scenarioToggle;
  right.append(state.refs.toggle);
  const solverGrid=E('div','ga-studio-solver-grid');
  const bNr=E('button','ga-studio-button is-native-btn','⚡ NR Çöz (AC)');bNr.onclick=()=>void runStudioSolver('NR_POLAR');
  const bFdns=E('button','ga-studio-button','⚡ FDNS Çöz');bFdns.onclick=()=>void runStudioSolver('FDNS_XB');
  const bDc=E('button','ga-studio-button','⚡ DC Çöz');bDc.onclick=()=>void runStudioSolver('LOSSLESS_DC');
  const bOrig=E('button','ga-studio-button','↺ Sıfırla');bOrig.onclick=useOriginal;
  solverGrid.append(bNr,bFdns,bDc,bOrig);right.append(solverGrid);
  right.append(E('h3','','Model & Sonuç Durumu'));
  state.refs.result=E('p','ga-studio-result','SOURCE_SAVED / hesap yok');right.append(state.refs.result);

  work.append(left,stage,right);
  const feedback=E('p','ga-studio-feedback','PSS®E 36.5 Native SLD Stüdyosu hazır.');feedback.setAttribute('role','status');
  host.append(row,tabs,toolbar,line,work,feedback);

  const file=E('input');file.type='file';file.accept='.sld,.sldxml,.gasld.json,.json';file.multiple=true;file.hidden=true;
  file.onchange=async()=>{for(const f of file.files)await importOne(f);file.value='';};
  state.refs.file=file;host.append(file);

  host.addEventListener('keydown',e=>{
    if(e.target.closest('input,textarea,select'))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
    else if(e.key==='Delete'&&state.selection){e.preventDefault();removeSelection();}
    else if(e.key==='r'||e.key==='R'){e.preventDefault();rotateSelected();}
  });
  return host;
}

function syncModel(){
  const n=network(),h=hash();if(!state.host)return;
  state.refs.model.textContent=n?`Model ${h.slice(0,10)} · ${num(n.buses.length,0)} bara · ${num(n.branches.length,0)} dal`:'Bağımsız SLD Modu (SAV modeli yüklenebilir)';
  if(h!==state.modelHash){
    state.modelHash=h;
    restore();populateOwner();populateStations();renderTabs();
    if(state.doc)activate(state.doc.id);
    else if(!state.docs.length){
      openBuiltinSld('ankara','ÜNKN_AnkaraBolge.sld');
    }
  }
  if(n&&state.refs.owner.options.length<2)populateOwner();
  if(n&&(!state.refs.tm.options.length||state.refs.tm.options.length!==currentStation()?.options.length))populateStations();
  if(state.refs.result)state.refs.result.textContent=sourceLayerStatus();
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
  openBuiltinSld,
  parseSldBinary,
  patchSldBinary,
  exportNativeSld,
  exportGaSldJson,
  resolveOverlaps,
  newTM:newTm,
  newOWNER:newOwner,
  newBlank,
  exportProject,
  importProject,
  active:()=>state.doc?.id||null
};
})();

}
