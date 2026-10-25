# Native RAW/RAWX parity evidence

Normalized scope: **11/11 PASS_NORMALIZED_FIELDS**.

Oriented identities, endpoints, status, source numerical/control/rating fields and derived winding impedance/ratios for core equipment, plus area/zone/owner. Display labels, star internals and encoded source residue excluded. CR/CX/CNXA winding fields reported separately because preceding normalized scope omitted them.

| Model | Core scope | Compared leaves | Additional source differences | RAW / RAWX inspection |
|---|---:|---:|---:|---|
| bench | PASS_NORMALIZED_FIELDS | 174767 | 0 | COMPLETE / COMPLETE |
| fault_calc_3wdg_auto_neutral_current | PASS_NORMALIZED_FIELDS | 360 | 0 | COMPLETE / COMPLETE |
| ieee_harmonics_test_case | PASS_NORMALIZED_FIELDS | 1853 | 0 | COMPLETE / COMPLETE |
| sample | PASS_NORMALIZED_FIELDS | 5085 | 2 | PARTIAL / PARTIAL |
| sample_nb | PASS_NORMALIZED_FIELDS | 13217 | 2 | PARTIAL / PARTIAL |
| sample_nb_sec | PASS_NORMALIZED_FIELDS | 13217 | 2 | PARTIAL / PARTIAL |
| sample_zils | PASS_NORMALIZED_FIELDS | 5685 | 2 | PARTIAL / PARTIAL |
| sample_zils_nb | PASS_NORMALIZED_FIELDS | 15235 | 2 | PARTIAL / PARTIAL |
| sample_zils_nb_sec | PASS_NORMALIZED_FIELDS | 15235 | 2 | PARTIAL / PARTIAL |
| savnw | PASS_NORMALIZED_FIELDS | 2773 | 0 | COMPLETE / COMPLETE |
| savnw_nb | PASS_NORMALIZED_FIELDS | 6789 | 0 | COMPLETE / COMPLETE |

The additional comparison preserves actual differing input values. Across six sample variants, one transformer record has RAW `cx3=0.00394` versus RAWX `cx3=0`; a second has RAW `cx3=0.00014` versus RAWX `cx3=0`. These fields were outside the preceding SDK normalized comparison. They are retained and reported; the decoder does not rewrite either input to force parity.

DC, FACTS, induction, GNE and voltage-droop source residue is retained. Different RAW/RAWX multi-line encodings are not counted as equipment parity; unsupported electrical models produce PARTIAL inspection, with every GA solver BLOCKED. Full electrical model or solver equivalence is not claimed.

Command: `node --import tsx tools/psse-raw-parity.ts [PSSE installation] [evidence output]`.

Public difference evidence hashes equipment identities; original model records and screenshots stay local.
