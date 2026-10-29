import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {createWorkbook} from '../src/shared/export/xlsx.js';
test('XLSX ZIP decompresses a full 6851-bus sheet and preserves numbers and XML text',()=>{
  const rows=[['Bara','V (kV)','Ad'],...Array.from({length:6851},(_,i)=>[i+1,154.25,'TM <&> "İstanbul"'])],bytes=createWorkbook([{name:'Baralar',rows},{name:'Kaynak',rows:[['RATE','RATE B']]}]),zip=unzipSync(bytes),xml=strFromU8(zip['xl/worksheets/sheet1.xml']);
  assert.equal((xml.match(/<row[\s>]/g)??[]).length,6852);assert(xml.includes('<v>154.25</v>'));assert(xml.includes('&lt;&amp;&gt;'));assert(xml.includes('İstanbul'));assert(zip['xl/worksheets/sheet2.xml']);
});
