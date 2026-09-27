# Local acceptance models

Keep real DGS JSON models here for local acceptance runs. All `control1/**/*.json`
files are ignored and guarded by architecture lint. Do not commit or upload them.

`npm run test:full` discovers local models; use `MODEL_FILTER` to select one.
The historical v7 baseline tracked two models with Git LFS. Their removal from
the current branch does not delete old Git history or remote LFS objects.
