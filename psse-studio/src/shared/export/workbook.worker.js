import {makeWorkbook} from './workbook.js';
self.onmessage=async({data})=>{try{const bytes=await makeWorkbook(data.sheets).arrayBuffer();self.postMessage({bytes},[bytes]);}catch(error){self.postMessage({error:error.message});}};
