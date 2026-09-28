# 20260928 DGS source audit

Source: ignored local `20260928_0900_SN1_TR0.zip`; one JSON entry, 143,737,437 uncompressed bytes. This audit records counts and field coverage only. It does not include model rows or assert numeric control-mode semantics.

| Source | Observation |
| --- | --- |
| ElmStactrl | 483 total; 372 in service. `i_ctrl=0` and `imode=0` on all 483; `i_droop`: 0 on 250, 1 on 233. Numeric enum meanings unverified. |
| Remote bus | `rembar` populated 483/483; 483/483 FIDs resolve to ElmTerm; 435 distinct targets. Electrical-bus resolution depends on active topology. |
| Units | 860 `psym:*` entries; 860/860 resolve to ElmSym or ElmGenStat FIDs. 371 references point to out-of-service units. |
| Setpoints | `usetp` 483/483, range 0.990–1.066883 pu, 271 distinct; most common 1.0 (27) and 1.038961 (23). `qsetp` 483/483 but all zero. |
| Droop and measurements | `Srated`, `ddroop`, `pQmeas` each 233/483; `p_cub` 0/483; `iQorient` 483/483 and all zero. `ddroop` values: −2 (1), −4 (193), −5 (33), −6 (1), −7 (5). Units/formula/sign unverified. |
| TypTr2 | 3,684 rows. No explicit phase, clock, vector-clock, or displacement field. Connection codes are not converted to an angle. |
| ElmXnet | One in-service source (SL1), `bus1=fsl0-1` → ElmTerm B116132, `bustp=SL`, `mode_inp=PQ`, `pgini=qgini=0`, `usetp=1`. It is in the observed external-grid component rooted at B4823. Priority semantics unverified. |
| ComLdf | `iopt_lim=1`, `itrlx=100`, `ictrlx=50`, `errlf=5`, `erreq=0.2`, `iPbalancing=3`. Meaning/unit mapping unverified. |

The application preserves raw controller and reference fields with provenance. Until source documentation proves control-mode and distribution semantics, remote voltage, droop, and Q-control behavior remain `PARTIAL` or `UNSUPPORTED`; a numerical loop would otherwise impose unverified electrical constraints.

The exact `TypTr2` attribute list is: `FID`, `loc_name`, `fold_id`, `strn`, `utrn_h`, `utrn_l`, `pcutr`, `uktr`, `uk0tr`, `x0tor0`, `tr2cn_h`, `tr2cn_l`, `itapch`, `tapchtype`, `tap_side`, `dutap`, `ntpmx`, `ntpmn`, `nntap0`, `curmg`, `pfe`, `manuf`, `oltc`.
