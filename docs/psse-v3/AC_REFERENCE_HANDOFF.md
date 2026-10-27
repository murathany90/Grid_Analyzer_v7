# PSS/E 36.5 AC reference handoff

Measured locally on 2026-10-27 using the licensed PSS/E 36.5.0 build dated February 3, 2026 and Python 3.14. This work reran the source cases; historical reports were context, not substituted evidence. Production TypeScript was not changed by this reference task.

## Reproduce

From the repository root in PowerShell:

```powershell
node --import tsx tools/psse-synthetic-cases.ts
py -3.14 tools/psse-v3-control-reference.py
py -3.14 tools/psse-v3-reference.py 'private-re/ac-v3-reference/20261026_1600_SN1_TR0.sav' 'C:/Program Files/PTI/PSSE36/36.5/control1/20261014_1200_SN3_TR0.sav'
py -3.14 tools/psse-reference.py 'private-re/ac-v3-reference/20261026_1600_SN1_TR0.sav' --method fnsl --q-limits 0 --force
py -3.14 tools/psse-reference.py 'C:/Program Files/PTI/PSSE36/36.5/control1/20261014_1200_SN3_TR0.sav' --method fnsl --q-limits 0 --force
```

The first SAV is extracted locally from the user's `Downloads/20261026_1600_SN1_TR0.zip`. Inputs and full outputs remain ignored under `private-re/`. Public aggregate evidence is `evidence/psse-v3/licensed-ac-reference-summary.json`; original public tiny-fixture outputs are `evidence/psse-v3/tiny-control-reference.json`. Each source is reloaded before every solver profile. The harness sets iterations and mismatch tolerance explicitly; source control state cannot leak between runs.

| Source | SHA-256 |
|---|---|
| 6,875 buses, 20261026_1600_SN1_TR0.sav | `8cc8ccfeca14001c392d2bebf578caafe61589c431f071f64db235a81dbbe60b` |
| 6,851 buses, 20261014_1200_SN3_TR0.sav | `b57af8d4990a61d530db72276b3e89016d134bf670008da0c28c93b78df20cbf` |

## Licensed full-case results

Both original SAVs load with `solved()=0`. Saved maximum complex mismatch is 0.010308130 MVA / 0.002259375 MVA respectively. Their stored TOLN is about 0.1 MVA. A loaded solved flag is provenance, not an independent GA residual certificate.

The fixed-control FNSL/FDNS options are `[0,0,0,0,0,0,qLimit,nondiv]`. Zero tap/shunt/control options freeze adjustments while retaining the electrical devices. The Q-limit and nondivergence options materially change results. All calls below return API `ierr=0`; only `solved=0` certifies the reference reached its configured tolerance.

| Buses | Method | qLimit / nondiv | Tolerance MVA | solved / iterations | max complex mismatch MVA | system absolute mismatch MVA |
|---:|---|---|---:|---|---:|---:|
| 6,875 | FNSL | 0 / 1 | .001 | 0 / 9 | .000700355 | .012178526 |
| 6,875 | FNSL | 0 / 0 | .001 | 1 / 100 | .010238588 | .060166258 |
| 6,875 | FDNS | 0 / 1 | .001 | 3 / 1 | .010207188 | .050456055 |
| 6,875 | FDNS | 0 / 0 | .001 | 1 / 100 | .010309064 | .061492864 |
| 6,875 | FNSL | 0 / 0 | source .1 | 0 / 1 | .009813905 | .044461731 |
| 6,875 | FDNS | 0 / 0 | source .1 | 0 / 1 | .010309614 | .048599169 |
| 6,851 | FNSL | 0 / 1 | .001 | 0 / 2 | .000882614 | .012989253 |
| 6,851 | FNSL | 0 / 0 | .001 | 0 / 2 | .000882614 | .012989253 |
| 6,851 | FDNS | 0 / 1 | .001 | 3 / 1 | .001350439 | .016172048 |
| 6,851 | FDNS | 0 / 0 | .001 | 0 / 2 | .000809363 | .012891338 |
| 6,851 | FNSL | 0 / 0 | source .1 | 0 / 1 | .001538265 | .016718334 |
| 6,851 | FDNS | 0 / 0 | source .1 | 0 / 1 | .001350439 | .016172046 |

Ignoring Q limits (`qLimit=-1,nondiv=1`) fails both original cases: FNSL system mismatch rises to 3,745.516 / 6,033.238 MVA, FDNS to 219.744 / 402.210 MVA. Do not interpret this as broken Ybus or a source failure. The source Q boundary conditions are essential. Automatic-control profiles `[1,1,1,1,1,0,0,1]` produced the same reference results as fixed controls with Q limits on these snapshots; this does not prove general control equivalence.

Full matched FNSL outputs, including bus IDs/Vm/angle, generator IDs/P/Q and both branch terminals, are cached at:

```text
private-re/solver-reference/<source-sha>-fnsl-414d5d7ca070ca60f0abc24f3a0fa653c505385b119bd53b778544a91eb3b981/reference.json
```

The legacy reference schema records API `ANGLE` in radians and adds `ANGLED` in degrees. Compare by identities and terminal direction, not array positions. Three-winding flows use the separate winding table.

## Independently checked scope and overlap

| Quantity | 6,875 SAV | 6,851 SAV |
|---|---:|---:|
| Machines, all / active | 2,932 / 1,568 | 2,920 / 1,900 |
| Active WMOD 0 / 1 / 2 / 3 / 4 | 305 / 161 / 0 / 768 / 334 | 271 / 225 / 0 / 975 / 429 |
| Active nonzero WMOD | 1,263 | 1,629 |
| Active machines with nonlocal IREG | 454 | 473 |
| Voltage-droop records, all / status=1 | 231 / 161 | 236 / 227 |
| Machines with nonblank DROOPNAME, API and RAWX | **0** | **0** |
| In-service ideal system switches | 926 | 928 |
| Ideal components with multiple buses / cycle rank | 860 / 18 | 861 / 17 |
| All physical source buses after ideal union | 5,967 | 5,940 |
| Actual loaded IDE=2 without active local generator | 1 | 0 |

These categories overlap; their counts must not be added. In particular, 161 enabled droop *records* are not evidence of 161 assigned droop machines. The loaded API `amachchar(-1,4,['DROOPNAME'])` succeeds and returns blank associations for both real SAVs. A controlled assigned-droop fixture returns its nonblank name and follows the Q(V) curve, so this is not an unsupported-field artifact. Unreferenced droop records are metadata and should not block AC.

The 454 remote machines in the 6,875 case comprise 289 mode-0, 153 mode-1 and 12 mode-3 machines. The 473 in the 6,851 case comprise 252 mode-0, 208 mode-1 and 13 mode-3 machines. No active mode-4 machine has nonlocal IREG. These intersections are derived from the same licensed source export.

`writerawx` restores four disconnected source-intent IDE=2 buses in each case while the loaded SAV API reports them as actual IDE=4. Thus exported RAWX has 5 / 4 apparently generatorless type-2 buses. Preserve actual SAV isolation; do not energize these four buses based on the export. The genuine connected generatorless type-2 case can use an effective PQ boundary condition (proved below).

The source THRSHZ is Float32 `9.999999747378752e-5`. `writerawx` emits switch X as decimal `0.0001`; direct double comparison against the SAV threshold wrongly classifies all switches as nonideal. Compare within a consistent source representation. The reference count rounds exported reactance back to its SAV Float32 representation. This is a representation issue, not permission to introduce a broad arbitrary impedance tolerance.

## Physical rules and architectural decisions

Installed primary source: `C:/Program Files/PTI/PSSE36/36.5/DOCS/DataFormats.pdf`, Power Flow Data File chapter. Printed page references follow the document footer. Sphinx API signatures/options are under `DOCS/Sphinx/psspy/_as_gen/`.

- **IDE and machine control:** pp.11-12 define IDE=2 as a generator/plant bus that may regulate voltage or hold Mvar; it is not synonymous with an unconstrained PV equation. In the original public three-bus fixture, switching off the sole bus-2 machine keeps reported TYPE=2 but FNSL solves with Q=0 and freely varying Vm2=1.020171285. Demote such connected numerical buses to PQ; never create synthetic Q generation.
- **WMOD:** pp.23-24: mode 0 conventional; mode 1 renewable with QT/QB limits; mode 2 symmetric limits from Pg and WPF; mode 3 fixed Q derived from Pg/WPF; mode 4 fixed saved QG. For mode 3, `Q=Pg*sign(WPF)*sqrt(1/WPF^2-1)` with valid nonzero absolute PF at most one. Mode-2 limits use the absolute magnitude. At Pg=60 and WPF=±.95 the controlled reference produces Q=±19.721048 Mvar; mode 4 retains Q=12. Mode 1 hits its QT=5 limit. An IDE=2 bus containing only fixed-Q machines is numerically PQ.
- **Remote setpoint regulation:** pp.22-25: VS, IREG and RMPCT are plant quantities, so machines at one plant must agree. RMPCT coordinates reactive contribution when multiple devices regulate one bus. Localizing IREG changes physics. The tiny remote reference holds regulated Vm3=1.01 while terminal Vm2=1.039137125. A practical approximation may explicitly freeze remote Q or use the saved local voltage with an omission finding; it cannot claim full remote-control parity.
- **Droop:** pp.19-21 give decreasing Q(V) segments through `(VLOW,QMAX)`, `(VDBLOW,QDB)`, `(VDBHIGH,QDB)`, `(VHIGH,QMIN)`. STATUS=0 restores ordinary setpoint behavior. Nonzero REGBUS replaces machine IREG. Q at a remote regulated bus need not equal generator-terminal Q because intervening network elements consume/supply reactive power. The public assigned local-droop replay yields Vm=1.026284337 and Q=3.201911688 for QDB=12, deadband upper=1.02, VHIGH=1.1 and QMIN=-100, agreeing with the upper linear segment within Float32 precision and configured tolerance.
- **Ideal links:** pp.32-33: nontransformer R=0 and `abs(X)<=THRSHZ`, or nonzero bypass, form equal-complex-voltage components. THRSHZ=0 disables special ideal modeling. Preserve line charging and terminal shunts when dropping the ideal series stamp. Reconcile bus boundaries after contraction and expand voltages to every source bus. Ideal loop individual flows require a recovery convention based on source reactances; report KCL residuals and do not claim uniqueness. Tiny/zero cyclic weights and bypass semantics need their own supported profile.
- **Bases and transformers:** pp.38-43 distinguish CW ratios, CZ impedance bases and CM magnetization units. CM=1 magnetizing admittance is on system MVA/winding-1 bus voltage base and connected to ground at bus I; do not divide this external shunt by tap squared again. CM=2 uses no-load watts and exciting current on SBASE1-2/NOMV1, requiring conversion before stamping. CW=1 uses bus-base ratios, CW=2 actual kV, CW=3 ratios on winding nominal voltage. CZ=2 uses winding MVA base, CZ=3 uses load-loss watts plus impedance magnitude. ANG1 is positive when winding-1 voltage leads winding-2 voltage. Existing `network.ts` explicitly puts magnetization at external winding 1 and retains both winding ratios; replacing it with an unqualified textbook one-tap stamp would lose these conventions.
- **Three-winding:** pp.40-44 require pair impedances converted to a common base before the star transform, winding-specific tap/phase/status, one internal zero-injection node, and saved star voltage as a warm start. Numerical star nodes are not physical substations/buses for the UI.
- **Residual contract:** compute `S=V*conj(YV)` on the contracted network and enforce P at nonreference nodes/Q at PQ nodes using consumption-signed ZIP loads and system-base powers. Recompute the final original-equation residual after any Q-limit round or voltage expansion. A genuine converged simplified model may be `SOLVED_APPROXIMATE`; the PSS/E comparison is a separate status. A warm-start voltage, reference flag or small step is insufficient.

Recommended P0 order remains topology/contraction, source WMOD boundary conditions, genuine fixed-profile NR residual, branch recovery, then remote/droop controllers and FDNS. For remote/local controllers with frozen source conditions, use the saved local voltage rather than overwriting a warm-start local Vm with a remote VS. Every simplification needs an equipment count and clear physics-coverage finding.

## Focused REA evidence and limits

REA MCP `inspect_native_exports` checked installed `PSSBIN/psseng.dll` without launching or decompiling it. SHA-256 is `ef0f59dd8a6ce9c75330ea4159e863d99bccb5016063cc24b1da3c1eca4d146f`; complete PE export inventory has 39,197 entries. Selected native boundaries are `FNSLAPI` at `0x1808aa310`, `FDNSAPI` at `0x180787c60`, and `VOLTAGE_DROOP_DATA` at `0x1808433f0`. Inventory Evidence: `ev_131641e180c16602aa6a4f87232e28c203bf0435f5cbf037822e5ed3f94165cd`; selected view: `ev_ba850c476f0fd058955342e24898151c7acc34f08e6e5aa2cb17d14cac497538`. REA session was closed.

This proves shipped API boundaries, not numerical algorithms or runtime reachability. The licensed Python replays and official documentation establish the behavioral claims. No licensing paths were examined. Broad decompilation would add little to the immediate physical model decisions and is not required to build an independent solver.

## Remaining validation work

Native Ybus and final source-equation residuals must still be compared after implementation; this reference task does not certify GA convergence. Full remote multi-device RMPCT distribution, remote droop reactive metering, signed/zero ideal-cycle flow recovery, and active tap/shunt outer loops remain separate validation targets. The 6,875 FDNS reference has a demonstrated strict-tolerance termination floor around .0103 MVA; retain that failed strict reference alongside the solved source-tolerance result. Do not silently widen native tolerance or label either strict run converged.
