# Bank winding entry necks

The shared horizontal HV/LV winding leads are inset into the existing bank rectangle. A short vertical neck separates each native feeder/transfer junction from the winding fan-out. Normal length is 16 drawing units; the routed switch conductors and glyph/label obstacles can require a shorter 8–14 unit neck. A shared group uses one common height. No safe inset means preserving the established route, rather than adding space or a false electrical connection.

The source junctions, physical rails, switch contacts, transformer glyphs, winding contacts, feeder compartments and page geometry stay fixed. The rule groups actual shared terminal FIDs and winding sides, never station names or bank captions. Physical bus sections, boundary windings, real cubicle chains and established intermediate-voltage corridors retain their own routing.

`bank-entry.ts` plans only equipment lead waypoints after switch routing has settled. No source, canonical, scenario or solver data changes. The SVG `data-bank-entry` attribute records the unchanged native point and the inset collector point; it is drawing provenance, not a new node/device.

Validation reuses the existing SN3 graph cache. `tools/sld-bank-entry-audit.mjs` compares the previous `1b11cc6` geometry against the new normal/LF geometry for every shared-winding candidate, including exact page dimensions, feeder compartments, rails, source ports and glyph contacts. `sld-v38-browser.mjs --all-oracles` additionally checks actual visible SVG contacts, open gaps, intervals, inventory, overlaps and foreign terminal touches on the affected stations. Other stations have no shared bank lead to modify.

Six new unit tests cover the unchanged footprint, actual routed necks, separate terminal identities, physical rail/cubicle/corridor exclusions and a foreign transfer conductor on the preferred inset level and overlapping banks with different terminal FIDs. Browser acceptance checks visible shared-conductor intervals after SVG deduplication. Kayaş before/after images use exactly the same crop, with fixed source and glyph positions.

The stricter SVG scan also finds an existing LV side-corridor overlap in Pamukören JES, LF view: T9121/B142963 versus T11779/B148759. Rendering the old `1b11cc6` code reproduces the identical overlap and foreign touches. It remains a separate PARTIAL finding; a successful compartment/port-size check must not be reported as full visual engineering acceptance.

No main merge; visual acceptance remains with the user.
