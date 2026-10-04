/**
 * Portable/browser Full AC benchmark for the golden fixture.
 *
 * Benchmarks the exact committed single-file portable build in headless Chromium so the
 * reported performance and provenance describe the artifact that is shipped rather than a
 * different environment. Only aggregate observations are written; no model or reference
 * data is committed.
 *
 * Usage:
 *   node tools/portable-full-ac-benchmark.mjs [portable.html] [model.zip] [control-context.csv] [out.json]
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portableArg = process.argv[2] || 'dist-portable/GridAnalyzer_v7.html';
const modelArg = process.argv[3] || 'kontrol1/20261001_1500_SN4_TR0.zip';
const contextArg = process.argv[4] || 'kontrol1/PowerFactory_ControlContext_20261001_1500_SN4_TR0_20261003_224310.csv';
const outArg = process.argv[5] || '.tmp/portable-full-ac-benchmark.json';

const portablePath = path.resolve(root, portableArg);
const portableBytes = await readFile(portablePath);
const repositoryPath = path.relative(root, portablePath).split(path.sep).join('/');
if (repositoryPath.startsWith('../') || path.isAbsolute(repositoryPath)) throw new Error('Portable path must be inside the repository.');
const committedPortableBytes = execFileSync('git', ['show', `HEAD:${repositoryPath}`], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
const committedPortableSha256 = createHash('sha256').update(committedPortableBytes).digest('hex');
const artifact = {
  tool: 'tools/portable-full-ac-benchmark.mjs',
  portableFile: portableArg,
  portableSha256: createHash('sha256').update(portableBytes).digest('hex'),
  committedPortableSha256,
  portableMatchesCommit: portableBytes.equals(committedPortableBytes),
  portableBytes: portableBytes.length,
  modelFile: path.basename(modelArg),
  controlContextFile: path.basename(contextArg),
  gitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  browser: null,
  engineElapsedMs: null,
  wallClockMs: null,
  status: 'ERROR',
  observed: null,
  error: null,
};

// The portable is a single file, but the calculation worker needs an http origin.
const server = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(portableBytes);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

let browser;
try {
  if (!artifact.portableMatchesCommit) throw new Error('Benchmark portable bytes differ from the committed HEAD artifact.');
  browser = await chromium.launch({ headless: true });
  artifact.browser = `Chromium ${browser.version()}`;
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.setDefaultTimeout(180000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}/`);

  await page.locator('#modelFileInput').setInputFiles(path.resolve(root, modelArg));
  await page.waitForFunction(() => Boolean(document.querySelector('.ga-head-model')?.textContent?.trim()));

  const openAnalysis = async () => {
    await page.getByRole('button', { name: 'Analizler', exact: true }).click();
    await page.waitForTimeout(500);
  };
  await openAnalysis();
  const contextInput = page.locator('input[aria-label^="PowerFactory ControlContext"]').first();
  if (await contextInput.count()) {
    await contextInput.setInputFiles(path.resolve(root, contextArg));
    await page.waitForTimeout(3000);
    await openAnalysis();
  }

  // Scope to the analysis control bar: a hidden settings dialog also holds a Full AC control.
  const controls = page.locator('section[data-view="analysis"] .ga-analysis-controls');
  await controls.waitFor({ state: 'visible', timeout: 120000 });
  const fullAc = controls.locator('button[title^="Tam AC"]').first();
  await fullAc.waitFor({ state: 'visible', timeout: 120000 });

  const started = Date.now();
  await fullAc.click();

  // The calculation status line reports each work counter explicitly:
  // "<engine> - <role> - <converged> - N Newton iterasyonu - M NR çözümü - T s".
  try {
    await page.waitForFunction(
      () => /\d+ Newton iterasyonu\s*.\s*\d+ NR\s.*\s[0-9.,]+ s/.test(document.body.innerText),
      null,
      { timeout: 600000 },
    );
  } catch (waitError) {
    artifact.error = waitError instanceof Error ? waitError.message : String(waitError);
    artifact.observed = await page.evaluate(() => ({ bodyExcerpt: document.body.innerText.slice(0, 1500) }));
    throw waitError;
  }
  artifact.wallClockMs = Date.now() - started;

  const observed = await page.evaluate(() => {
    const text = document.body.innerText;
    const statusLine = (text.match(/[^\n]*Newton iterasyonu[^\n]*/) || [])[0] ?? null;
    const number = pattern => {
      const match = statusLine ? statusLine.match(pattern) : null;
      return match ? Number(match[1].replace(',', '.')) : null;
    };
    return {
      statusLine,
      newtonIterations: number(/(\d+)\s+Newton/),
      fullNrSolves: number(/(\d+)\s+NR/),
      engineSeconds: number(/([0-9.,]+)\s+s\s*$/),
      converged: statusLine ? /Yakınsadı/.test(statusLine) : null,
      unsupportedSettingMarked: /UNSUPPORTED/.test(text),
      profileFidelityNotice: (text.match(/Profil sadakati:\s*(\w+)/) || [])[1] ?? null,
      pageErrors: [],
    };
  });
  observed.pageErrors = pageErrors;
  artifact.observed = observed;
  artifact.engineElapsedMs = typeof observed.engineSeconds === 'number' ? Math.round(observed.engineSeconds * 1000) : null;
  artifact.status = pageErrors.length ? 'ERROR' : 'OK';
} catch (error) {
  if (!artifact.error) artifact.error = error instanceof Error ? error.message : String(error);
} finally {
  await browser?.close();
  server.close();
}

await mkdir(path.resolve(root, path.dirname(outArg)), { recursive: true });
await writeFile(path.resolve(root, outArg), `${JSON.stringify(artifact, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
