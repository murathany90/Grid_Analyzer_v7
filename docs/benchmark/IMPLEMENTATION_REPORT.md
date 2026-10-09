# PowerFactory benchmark implementation

Base: `f13567add3a0d4b16d4dc164b6a9cd645d5fa2b5`.
Branch: `feat/pf-sn3-sn4-benchmark-20261009`.

## Boundaries

Full AC solver and DC N-1 screening remain unchanged. PowerFactory references
never become numerical solver inputs. Real models, workbooks, logs, hashes tied
to private files, and acceptance exports remain in ignored local directories.

## Baseline

Local `npm ci`, typecheck, lint, unit/regression, browser smoke, standard build
and portable build passed before implementation. `test:full` exited zero with
`SKIPPED / SOURCE_UNAVAILABLE`; this is not evidence of real-model execution.
Detailed logs and source inventory are in `local-benchmark-results/`.

## XML dependency

The importer uses [saxes](https://github.com/lddubeau/saxes) 6.0.0 (ISC) and
its xmlchars dependency (MIT) for strict streaming XML in workers. The parser
rejects DTDs and external relationships. Existing fflate ZIP attribution stays
in place. Dependencies are pinned by the lockfile.

Implementation and acceptance results are recorded below as phases complete.
