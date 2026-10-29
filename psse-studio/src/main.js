import {mount} from './modules/psse/index.js';
export {mount};
// Only the standalone host publishes a handle; embedded mounts own their instance.
window.GridAnalyzerPSSE={mount};
window.psseStudio=mount(document.getElementById('psse-host'));
