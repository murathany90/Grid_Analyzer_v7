import {mount} from './modules/psse/index.js';
import '../../tools/psse-sld/studio_runtime.js';
export {mount};
// Only the standalone host publishes a handle; embedded mounts own their instance.
window.GridAnalyzerPSSE={mount};
window.psseStudio=mount(document.getElementById('psse-host'));
