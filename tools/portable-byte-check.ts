import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, mkdirSync, statSync, copyFileSync, writeFileSync, symlinkSync } from 'node:fs';
import path from 'node:path';

/**
 * Verifies that the committed portable artifact is byte-identical to a fresh CI build.
 *
 * The check is on RAW BYTES, because the artifact is hashed as a release artifact and a
 * text comparison would hide a line-ending difference. Two properties are asserted:
 *
 *   COMMITTED_PORTABLE_BYTES  the committed blob hashes to the CI build's SHA-256
 *   PLATFORM_INDEPENDENT      rebuilding from LF-normalised sources reproduces those bytes,
 *                             so a CRLF checkout cannot produce a different artifact
 *
 * The second property is what previously failed: source line endings survived into the
 * inlined HTML/JS/CSS, so the artifact depended on the platform that built it.
 */

const root = process.cwd();
const portablePath = path.join(root, 'dist-portable/GridAnalyzer_v7.html');
const relativePortable = 'dist-portable/GridAnalyzer_v7.html';
const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
const countCrlf = (bytes: Buffer): number => {
  let count = 0;
  for (let i = 1; i < bytes.length; i++) if (bytes[i] === 10 && bytes[i - 1] === 13) count++;
  return count;
};

/**
 * Runs the portable build.
 *
 * `npm run` is a shell script on Windows, so it must go through the shell there. The
 * arguments are fixed and contain no user input, so the shell invocation is not a
 * injection surface; `shell:false` fails on Windows with EINVAL.
 */
const build = (cwd: string): Buffer => {
  execFileSync('npm', ['run', 'build:portable'], { cwd, stdio: 'pipe', shell: process.platform === 'win32' });
  return readFileSync(path.join(cwd, relativePortable));
};

const trackedFiles = (): string[] =>
  execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter(file => file !== relativePortable);

const toLf = (bytes: Buffer): Buffer => {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 13 && i + 1 < bytes.length && bytes[i + 1] === 10) continue;
    out.push(bytes[i]);
  }
  return Buffer.from(out);
};

/** Copies the tracked tree with LF endings into a scratch directory, to emulate a Linux checkout. */
const materialiseLfCheckout = (target: string): void => {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const file of trackedFiles()) {
    const source = path.join(root, file);
    try {
      if (!statSync(source).isFile()) continue;
    } catch {
      continue; // A tracked path absent from the working tree (for example a gitignored model) is skipped.
    }
    const destination = path.join(target, file);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    const bytes = readFileSync(destination);
    const lf = toLf(bytes);
    if (lf.length !== bytes.length) writeFileSync(destination, lf);
  }
  // The build needs dependencies; a directory junction avoids copying them per check.
  const modules = path.join(target, 'node_modules');
  rmSync(modules, { recursive: true, force: true });
  if (process.platform === 'win32') execFileSync('cmd', ['/c', 'mklink', '/J', modules, path.join(root, 'node_modules')], { stdio: 'pipe' });
  else symlinkSync(path.join(root, 'node_modules'), modules, 'dir');
};

const built = build(root);
const committed = execFileSync('git', ['show', `HEAD:${relativePortable}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const builtSha = sha256(built);
const committedSha = sha256(committed);
const failures: string[] = [];
const report = {
  builtSha256: builtSha,
  committedSha256: committedSha,
  builtBytes: built.length,
  committedBytes: committed.length,
  builtCrlf: countCrlf(built),
  committedCrlf: countCrlf(committed),
};
if (builtSha !== committedSha) failures.push(`COMMITTED_PORTABLE_BYTES: built ${builtSha} != committed ${committedSha}`);

const scratch = path.join(root, '.tmp', 'portable-byte-check');
let platformIndependent: boolean | null = null;
try {
  materialiseLfCheckout(scratch);
  const fromLfSources = build(scratch);
  platformIndependent = sha256(fromLfSources) === builtSha;
  if (!platformIndependent) {
    failures.push(`PLATFORM_INDEPENDENT: LF-source build ${sha256(fromLfSources)} != committed ${committedSha}`);
  }
} catch (error) {
  failures.push(`PLATFORM_INDEPENDENT: could not verify an LF checkout (${error instanceof Error ? error.message : String(error)})`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

// The artifact must be LF-only, so no checkout can reintroduce CRLF.
if (report.builtCrlf > 0) failures.push(`LF_ONLY: built artifact contains ${report.builtCrlf} CRLF sequences`);
if (report.committedCrlf > 0) failures.push(`LF_ONLY: committed blob contains ${report.committedCrlf} CRLF sequences`);

const result = {
  ...report,
  platformIndependentBuildMatchesCommitted: platformIndependent,
  gates: {
    COMMITTED_PORTABLE_BYTES: builtSha === committedSha,
    PLATFORM_INDEPENDENT: platformIndependent,
    PORTABLE_LF_ONLY: report.builtCrlf === 0 && report.committedCrlf === 0,
  },
  mergeReady: failures.length === 0,
  failures,
};
process.stdout.write(`${JSON.stringify(result, null, 1)}\n`);
if (failures.length) process.exitCode = 1;