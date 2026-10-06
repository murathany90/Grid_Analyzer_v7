# Local acceptance models

Keep the real DGS JSON/ZIP models here for local acceptance runs. The directory is
git-ignored (`.gitignore` ignores both `kontrol1/` and `control1/`, so a model placed
in either name is never committed). Do not commit or upload real models.

The README validation table refers to this directory as `kontrol1`; both names are
ignored so the naming inconsistency cannot cause a model to be committed.

`npm run test:full` discovers local models; use `MODEL_FILTER` to select one.
The historical v7 baseline tracked two models with Git LFS. Their removal from
the current branch does not delete old Git history or remote LFS objects.