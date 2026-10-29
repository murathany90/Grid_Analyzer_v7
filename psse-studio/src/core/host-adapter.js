/** Explicit whitelist prevents accidentally passing the DGS AppContext into PSS/E. */
export function createHostAdapter(input={}){
  const adapter={};
  for(const name of ['onStateChange','onModelLoaded','onNavigate','onError'])if(typeof input[name]==='function')adapter[name]=input[name].bind(input);
  if(input.storage&&typeof input.storage.getItem==='function'&&typeof input.storage.setItem==='function')adapter.storage=input.storage;
  return Object.freeze(adapter);
}
