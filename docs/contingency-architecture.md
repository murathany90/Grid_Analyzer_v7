# N-1 contingency architecture

N-1 analysis is not implemented and the current capability is blocked. This
roadmap describes a future screening-and-verification flow; it does not claim
that a network is secure or define an operator's planning criteria.

## Inputs and identity

Start from a converged base AC result whose model, scenario, engine and options
identity still match the current network. Let the user or a separately
approved policy choose the outage set. A candidate may represent a line,
transformer or other supported branch. Keep each candidate outage in an
immutable temporary case; do not modify the base model or overwrite the user's
scenario.

Each result should retain the base-result identity, candidate ID, affected
equipment, settings, ratings basis and any limits used. A rating or voltage
limit that is missing, unitless or unverified must be reported as unavailable,
not silently treated as an accepted limit.

## Candidate screening

For a valid base state, use a linear sensitivity screen based on PTDF/LODF
factors to estimate candidate flow changes and identify candidates that may
violate selected limits. Screening is a prioritization step only; it does not
certify a case as safe. It must report excluded candidates and the assumptions
behind any estimate.

Candidates that are critical, close to a limit, or outside the screening
method's valid range go to a full AC verification using the same
`AnalysisEngine` contract and the candidate outage overlay. Verify branch
flows, bus voltages, reactive limits, convergence and applicable user-selected
criteria. Record the AC result separately from the linear estimate.

## Islands and failures

Check topology after every candidate outage before applying a sensitivity
factor. If the outage islands the system, creates a component without a slack
or supported source, or produces an ill-conditioned sensitivity denominator,
classify that case explicitly. Do not discard an islanded case or report the
linear screen as a converged AC result. A future policy may run independent
island analyses where the model has valid references for those islands.

## Execution and presentation

Run candidate screening and AC verification away from the main UI thread. A
browser worker pool can batch independent candidates while preserving
cancellation and per-candidate progress. A future WASM or native engine can use
the same typed requests and result identities. Bound concurrency and release
per-case buffers when each candidate completes.

Show candidate status, estimated impacts, verified violations, convergence,
warnings and missing data separately. Provide links back to the affected
equipment and the base result. Never label a screened-but-unverified case as
“safe.”

## Current validation limits

The current engine interface has only an optional untyped contingency
placeholder; there is no implemented N-1 calculation. PowerFactory reference
results are unavailable. The inspected v6.8 source maps station-controller
data but does not implement its outer loop, so that behavior has not been
migrated. The full-model report is an engine run, not an N-1 acceptance result
or PowerFactory comparison.
