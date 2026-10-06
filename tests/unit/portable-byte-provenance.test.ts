import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The committed portable artifact is a release artifact compared by RAW BYTE hash.
 *
 * A text comparison would hide the failure that actually occurred: source line endings
 * survive into the inlined HTML/JS/CSS, so a CRLF checkout produced different bytes than an
 * LF checkout and the committed hash could never match a CI build.
 */

const root = process.cwd();
const portablePath = path.join(root, 'dist-portable/GridAnalyzer_v7.html');
const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
const countCrlf = (bytes: Buffer): number => {
  let count = 0;
  for (let i = 1; i < bytes.length; i++) if (bytes[i] === 10 && bytes[i - 1] === 13) count++;
  return count;
};

/** The portable build must exist for these assertions; the release order builds it first. */
const built = (() => {
  try {
    return readFileSync(portablePath);
  } catch {
    return null;
  }
})();

test('the portable artifact is LF-only, so no checkout can reintroduce CRLF', { skip: built ? false : 'portable build not present; run npm run build:portable first' }, () => {
  assert.ok(built);
  assert.equal(countCrlf(built!), 0, `artifact contains ${countCrlf(built!)} CRLF sequences`);
});

test('the committed portable blob matches the built artifact by raw byte hash', { skip: built ? false : 'portable build not present; run npm run build:portable first' }, () => {
  assert.ok(built);
  const committed = execFileSync('git', ['show', 'HEAD:dist-portable/GridAnalyzer_v7.html'], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  // Raw bytes, deliberately not a text comparison.
  assert.equal(sha256(built!), sha256(committed));
  assert.equal(built!.length, committed.length);
  assert.equal(countCrlf(committed), 0);
});

test('the portable build is deterministic: two consecutive builds hash identically', { skip: built ? false : 'portable build not present; run npm run build:portable first' }, () => {
  assert.ok(built);
  execFileSync('npm', ['run', 'build:portable'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  const rebuilt = readFileSync(portablePath);
  assert.equal(sha256(rebuilt), sha256(built!));
});

test('the portable build normalises line endings in its plugin', () => {
  // The build itself must not inherit the checkout's endings; assert the helper exists in
  // the config rather than trusting a platform-specific rebuild inside a unit test.
  const config = readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
  assert.match(config, /toLf/);
  assert.match(config, /replace\(/);
});

test('.gitattributes pins the artifact and source text to LF', () => {
  const attributes = readFileSync(path.join(root, '.gitattributes'), 'utf8');
  assert.match(attributes, /dist-portable\/\*\.html text eol=lf/);
  // Source text is pinned too, so the bundled code that goes into the artifact is identical
  // on every platform.
  assert.match(attributes, /\*\.ts text eol=lf/);
  // Binary paths must never be line-ending normalised.
  assert.match(attributes, /licenses\/\*\* binary/);
});