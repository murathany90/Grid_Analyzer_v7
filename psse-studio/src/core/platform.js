// Scope retained DOM code, storage, timers and listeners to one mounted module.
export function createPlatform(root, host = {}) {
  const abort = new AbortController(), frames = new Set(), timers = new Set(), intervals = new Set();
  const privateValues = Object.create(null), memory = new Map();
  const storage = {
    getItem(key) { try { return host.storage?.getItem(key) ?? localStorage.getItem('ga.psse.' + key); } catch { return memory.get(key) ?? null; } },
    setItem(key, value) { memory.set(key, String(value)); try { if(host.storage) host.storage.setItem(key,String(value)); else localStorage.setItem('ga.psse.' + key,String(value)); } catch {} }
  };
  const listen = (target, type, fn, options = {}) => target.addEventListener(type, fn, typeof options === 'boolean' ? {capture:options, signal:abort.signal} : {...options,signal:abort.signal});
  const documentProxy = new Proxy(document, {get(target,key) {
    if(key === 'getElementById') return id => root.querySelector(`[id="${CSS.escape(id)}"]`);
    if(key === 'querySelector') return selector => root.querySelector(selector);
    if(key === 'querySelectorAll') return selector => root.querySelectorAll(selector);
    if(key === 'body') return root;
    if(key === 'addEventListener') return (type,fn,options)=>listen(target,type,fn,options);
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  const windowProxy = new Proxy(window, {get(target,key) {
    if(key in privateValues)return privateValues[key];
    if(key==='window'||key==='self')return windowProxy;
    if(key==='document')return documentProxy;
    if(key==='localStorage')return storage;
    if(key==='addEventListener')return (type,fn,options)=>listen(target,type,fn,options);
    if(key==='requestAnimationFrame')return fn=>{let id=requestAnimationFrame(t=>{frames.delete(id);if(!abort.signal.aborted)fn(t);});frames.add(id);return id;};
    if(key==='cancelAnimationFrame')return id=>{frames.delete(id);cancelAnimationFrame(id);};
    if(key==='setTimeout')return (fn,ms,...args)=>{let id=setTimeout(()=>{timers.delete(id);if(!abort.signal.aborted)fn(...args);},ms);timers.add(id);return id;};
    if(key==='clearTimeout')return id=>{timers.delete(id);clearTimeout(id);};
    if(key==='setInterval')return (fn,ms)=>{let id=setInterval(fn,ms);intervals.add(id);return id;};
    if(key==='clearInterval')return id=>{intervals.delete(id);clearInterval(id);};
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  },set(_,key,value){Reflect.set(privateValues,key,value);return true;},defineProperty(_,key,descriptor){Object.defineProperty(privateValues,key,descriptor);return true;}});
  return {window:windowProxy,document:documentProxy,dispose(){abort.abort();frames.forEach(cancelAnimationFrame);timers.forEach(clearTimeout);intervals.forEach(clearInterval);}};
}
