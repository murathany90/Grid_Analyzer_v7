# AC/FDNS root cause and status — V4 session (2026-10-28)

**Branch** `fix/psse-v1-real-model-parity`; session start HEAD `acd6d8660b406794e43f4734b9a57adf537a3ff1` (remote-verified), milestone commit **`ace166996ba66d1643d2da07af44c15673c854a4`** (pushed and `git ls-remote`-verified). Working tree for all measurements = this commit unless noted.

## Sources used (real models, private/ignored, never committed)

| Model | SHA-256 | Location |
|---|---|---|
| 20261026_1600_SN1_TR0.sav (6.875 bara) | `8cc8ccfeca14001c392d2bebf578caafe61589c431f071f64db235a81dbbe60b` | `private-re/ac-v3-reference/` |
| 20261014_1200_SN3_TR0.sav (6.851 bara) | `b57af8d4990a61d530db72276b3e89016d134bf670008da0c28c93b78df20cbf` | `C:\Program Files\PTI\PSSE36\36.5\control1\` |

Licensed oracle: PSS/E 36.5 (February 3, 2026 build), psspy via `PSSPY314` + Python 3.14, `psspy.psseinit(20000)`, profiles from `tools/psse-v4-control-reference.py` and `tools/psse-v4-scenario-reference.py` (both committed; case data stays in `private-re/ac-v4-reference/`). Convergence judged by `psspy.solved()`, `psspy.iterat()`, `psspy.sysmsm()` — never by `ierr` alone.

## New vendor facts established this session (evidence: `private-re/ac-v4-reference/control-reference.json`)

1. **No automatic tap or switched-shunt control is active in either real snapshot.** RAWX export shows `cod1=0`, `cnxa1=0` for all 2.916/2.881 active transformers and **zero** switched-shunt records (`swshunt` table empty). Vendor fnsl-automatic vs fnsl-fixed final voltages differ by max `1.49e-6` pu (6.875) and exactly `0` (6.851). Consequence: the missing tap/shunt adjustment is a **fixture-level** completeness item for these models, not a base-solution error source; it was implemented this session anyway (below).
2. **FDNS strict/operational tolerance behavior is vendor-reproducible**: vendor FDNS with automatic profile at 0,001 MVA is **unsolved** (`solved=3`) on **both** models (max mismatch ~0,050/0,016 MVA) and **solves** at 0,1 MVA on both. GA FDNS matches this shape: 6.875 strict `NON_CONVERGED` (residual 2,69e-5 pu = 2,69e-3 MVA), operational `CONVERGED`; 6.851 strict `CONVERGED` (3,96e-6 pu), operational `CONVERGED`. No tolerance widening was applied anywhere.
3. **Vendor +20% uniform load scaling does not converge in PSS/E either** (`solved=2/3`, system mismatch ~80.000–102.000 MVA) — GA must not claim a solved +20% case where the vendor reference is unsolved; both sides are reported unsolved.

## Root cause of the remaining scenario divergence (measured, not assumed)

With the V3 `FIXED_CONTROLS` profile (442/460 remote-IREG machines held at source QG; WMOD 3/4 fixed Q), a **+10% uniform load increase** diverges from the vendor solution by **dVm max 0,463 pu / mean 0,177 pu** (6.875; GA converged, 14 NR iterations, residual ~1e-9 pu). Vendor movement under the same scenario is only mean 0,0035 pu because PSS/E redistributes +4.792 MVAr across 144 regulating machines. GA's profile leaves only ~24 genuinely regulating units, so the perturbation cannot be absorbed. The same profile **does not converge at all** on 6.851 +10%. This is the quantified root cause: **remote IREG control enforcement is the single remaining physics gap that matters under perturbation.**

## What was implemented this session (commit ace1669)

- **Automatic tap adjustment** (`newton.ts` outer loop, one step per device per pass, `tapControl` normalized from SAV `windings[0]` (Tpnabl/Pqcont/Rmax/Rmin/Vmax/Vmin/Ntapos + sign) and RAW `cod1/cont1/rma1/rmi1/vma1/vmi1/ntp1` incl. CW=2/3 ratio-limit conversion; `retapPsseBranch` rebuilds primitives preserving magnetizing data; non-convergent pass rolls back). Direction rule verified numerically: far-side regulation lowers the winding-1 ratio to raise the controlled bus. No-op on both real models (no active controls), exercised by fixture (`tests/unit/psse-auto-adjust.test.ts`, 3/3 pass).
- **Switched-shunt block stepping** (discrete `modsw=1`, ordered blocks, switch-out before reactor-in; continuous mode explicitly not adjusted with a finding). No real-model records exist; fixture-tested.
- **`remoteRegulation` opt-in profile**: local PV setpoints enforced at VS; remote machines start at source Q. Two sub-modes: terminal-PV approximation (remote setpoint used as terminal setpoint — disclosed by `REMOTE_REGULATION_TERMINAL_PV_APPROXIMATION`) and a guarded sensitivity Q-chasing loop (`remoteChasing`, WIP: did **not** settle on the real models within 15 rounds — all-or-nothing revert guarantees it never publishes a worse solution than the loop start).

## Verification commands

```
npm run typecheck
node --import tsx --test tests/unit/psse-auto-adjust.test.ts          # 3/3
node --import tsx --test tests/unit/*.test.ts tests/regression/*.test.ts
node --import tsx tools/psse-v4-scenario-parity.ts                    # writes evidence/psse-v4/scenario-parity.json
GA_PSSE_REMOTE=1 node --import tsx tools/psse-v4-scenario-parity.ts   # WIP profile aggregate
```

## Honest status matrix

| Item | Status |
|---|---|
| Base NR parity vs vendor FNSL (both models) | PROVEN (V3 evidence unchanged; 1,8e-5 pu max Vm) |
| FDNS strict/operational vs vendor, both models | MATCHED SHAPE (both strict-fail on 6.875, operational solves) |
| Line-out scenario parity (fixed-controls profile) | MEASURED: dVm mean 1,99e-3 / 2,72e-3 pu vs vendor |
| +10% load parity | **OPEN GAP**: fixed-controls mean 0,177 pu; remote-regulation WIP profile does not settle (load10 `BLOCKED` on slack-Q-limit breach, lineout mean 1,4e-2..2,1e-2 pu) |
| Auto tap/shunt adjustment | IMPLEMENTED + fixture-tested; no-op on real models (no active controls) |
| Exact Jacobian remote regulation (control-equation formulation) | NOT IMPLEMENTED — WIP, see `AGENT_HANDOFF.md` |

Nothing in this report should be read as PASS where the table says otherwise.
