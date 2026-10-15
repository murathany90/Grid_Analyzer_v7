import test from 'node:test';
import assert from 'node:assert/strict';
import {pngDimensions} from '../../src/features/sld/png-export';
test('PNG keeps the complete page at 2x for ordinary station sheets',()=>{assert.deepEqual(pngDimensions(1200,2000),{width:2400,height:4000,scale:2,reduced:false});});
test('PNG bounds huge and tall sheets by both pixel area and canvas dimension without clipping',()=>{for(const [w,h]of [[20000,40000],[500,100000],[12000,12000]]){const s=pngDimensions(w,h);assert.ok(s.reduced);assert.ok(s.width<=16384&&s.height<=16384&&s.width*s.height<=32_000_000);assert.ok(Math.abs(s.width/s.height-w/h)<.002);}});
test('PNG rejects invalid source dimensions before allocating canvas memory',()=>{for(const n of [0,-1,NaN,Infinity])assert.throws(()=>pngDimensions(n,100));});
