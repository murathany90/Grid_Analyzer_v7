# PSS/E SDK V3 -> Grid Analyzer handoff

Verified target: `murathany90/Grid_Analyzer_v7`, main commit
`70c098a93f6cd34f5f83a3f90701dd9ef5ca5a3f` (26 October 2026).
No GA application source was modified.

The existing `src/workers/computation.worker.ts` LOAD_MODEL path parses JSON,
constructs DgsModel and calls mapCanonical. It cannot load Bridge JSON or SAV.
The included local HTML is a separate inspection harness, not a change to gridfreq.info.

Deliver `*.ga-psse.json` (Bridge 1, additive revision 1.1), the gated
`*.canonical.json`, and `*.manifest.json` together. Bridge preserves all normalized
electrical fields and source residue (`sourceTables` for RAWX/SAV,
`sourceSections` for RAW). The Canonical projection is deliberately incomplete
where GA's present types cannot express the physics. It must not be treated as
a successful electrical import when its capability is PARTIAL or BLOCKED.

Use `integration/canonical-guard.ts` at a new, explicit GA importer boundary.
Its imports resolve through `ga-network-types.ts`, a verbatim reference snapshot
of the real GA network and capacity types. In GA, point the guard import directly
to `src/domain/model/network.ts`. No `any` casts or DgsModel wrapping are needed.

Source references are arrays of actual SourceRef records, for example:

```ts
import type { SourceRef } from './ga-network-types';
const refs: Readonly<Record<string, readonly SourceRef[]>> = {
  vnKv: [{ sourceClass: 'Bus', sourceId: '101', field: 'baskv', unit: 'kV' }]
};
```

The integration agent must add a separate worker protocol and UI path; validate
unknown JSON with `readCanonical`, display diagnostics, and call `requireReady`
before each computation. PREPARE currently replaces network state, but invoking
it directly does not install a source catalog and must not bypass the importer.
Do not claim drag/drop support until that worker/UI change is implemented and tested.

Electrical mapping and restrictions:

- Lines: Zbase=kV²/system MVA, R/X -> ohm, B -> siemens. Asymmetric terminal
  shunts become explicit bus shunts. Zero source length stays zero.
- Transformers: RAW/RAWX CZ1/2/3 is normalized once to system MVA; caspy RX
  already has system-MVA normalization. CW1/2/3 turns are retained. Different
  nominal winding/bus voltage bases block the projection pending verification.
  Two winding ratios normalize as tap=t1/t2, z'=z*t2². Phase is converted from
  degrees to GA radians. Three-winding pair impedances become three star legs;
  source star buses are reused only when explicitly identified. Magnetizing
  admittance is placed once at winding-1 bus, not divided across legs.
- All 12 line and winding rating sets stay in Bridge. GA has one transformer
  rating and a separate line capacity policy: N-1 stays PARTIAL/BLOCKED until
  the integration agent binds a documented rating policy.
- P/I/Z loads, MBASE, generator P/Q limits, control buses and shunt steps remain
  in Bridge. Active ZIP or unsupported remote control blocks GA equations;
  automatic tap/shunt control is PARTIAL and cannot pass requireReady.
- Physical node, switch and terminal records remain in Bridge. They are not
  invented electrical buses. Node-breaker analysis stays BLOCKED until actual
  terminal/cubicle and switch-state equivalence is proven.
- DC, FACTS, induction and unimplemented physics/control tables block analysis.
  Area, zone, owner, interface and multisection reporting metadata are distinguished.
- Saved voltages/FDNS method are not convergence evidence. RAW, RAWX and native
  SAV report UNKNOWN, false; only a future independent solver certificate can
  set VERIFIED. Short circuit is BLOCKED and not IEC-verified.

Compile the supplied guard and tests against the reference types using the
reproduction commands in VALIDATION_V3.md. The independent audit is included
unchanged. Its 11/11 normalized comparisons do not certify complete source or
GA solver equivalence; coverage and excluded source physics are explicit.
