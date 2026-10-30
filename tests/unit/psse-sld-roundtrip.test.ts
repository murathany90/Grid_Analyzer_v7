import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseSldBinary, serializeSldBinary, validateSldBinary } from '../../src/features/psse/sld-binary-codec.js';

test('Native PSS/E SLD Codec - parseSldBinary and serializeSldBinary round-trip parity', () => {
  const testFiles = [
    'C:/Users/Murathan Yeniceli/Downloads/GA_native_work/custom_from_html.sld',
    'C:/Users/Murathan Yeniceli/Downloads/GA_native_work/sincan_tm_built.sld',
    'C:/Users/Murathan Yeniceli/Downloads/GA_native_work/owner_708_built.sld',
    'C:/Users/Murathan Yeniceli/Downloads/GA_native_work/NKN_KayseriBolge.sld',
    'C:/Users/Murathan Yeniceli/Downloads/GA_native_work/NKN_AnkaraBolge.sld',
    'C:/Users/Murathan Yeniceli/Downloads/GA_native_work/NKN_KonyaBolge.sld',
  ];

  for (const fn of testFiles) {
    if (!fs.existsSync(fn)) continue;
    const bytes = new Uint8Array(fs.readFileSync(fn));
    const val = validateSldBinary(bytes);
    assert.equal(val.valid, true, `Validation failed for ${fn}: ${val.reason}`);

    const doc = parseSldBinary(bytes);
    const syms = doc.components.filter((c) => c.t === 'Symbol');
    const links = doc.components.filter((c) => c.t === 'Link');
    const labels = doc.components.filter((c) => c.t === 'Label');

    assert.ok(syms.length > 0, `${fn} should have symbols, got 0`);
    assert.ok(links.length > 0, `${fn} should have links, got 0`);

    console.log(`[PASS] ${fn.split('/').pop()}: syms=${syms.length}, links=${links.length}, labels=${labels.length}`);

    // Re-serialize
    const ser = serializeSldBinary(doc, doc.fileVersion);
    assert.ok(ser.length > 1000, `Serialized binary too small: ${ser.length}`);

    // Re-parse serialized output
    const reDoc = parseSldBinary(ser);
    const reSyms = reDoc.components.filter((c) => c.t === 'Symbol');
    const reLinks = reDoc.components.filter((c) => c.t === 'Link');

    assert.equal(reSyms.length, syms.length, `Symbol count mismatch on ${fn}`);
    assert.equal(reLinks.length, links.length, `Link count mismatch on ${fn}`);
  }
});
