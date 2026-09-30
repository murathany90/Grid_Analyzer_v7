import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const model = path.resolve(root, process.argv[2] || 'kontrol1/20260928_0900_SN1_TR0.zip');
const output = path.resolve(root, process.argv[3] || 'docs/validation/20260930-v801-n1-browser-final.json');
const port = 5300 + Math.floor(Math.random() * 1000);
const url = `http://127.0.0.1:${port}/`;
const featureSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const artifact = {
  featureSha, model: path.basename(model), scope: 'all in-service line and transformer candidates at >=66 kV',
  browser: 'Chromium', status: 'ERROR', wallClockMs: null, engineElapsedMs: null,
  candidateCount: null, selectedCandidateCount: null, screenedCount: null,
  islandingCount: null, unsupportedCount: null, violationCount: null,
  kluFactorizationCount: null, kluRhsCount: null, kluMaxTrueResidual: null,
};
const server = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true });
let browser, started;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await delay(250);
  }
  if (!ready) throw new Error('Vite benchmark server did not start.');
  browser = await chromium.launch({ headless: true });
  artifact.browser = `Chromium ${browser.version()}`;
  const page = await browser.newPage({ acceptDownloads: true });
  page.setDefaultTimeout(180000);
  await page.goto(url);
  await page.locator('#modelFileInput').setInputFiles(model);
  await page.waitForFunction(() => Boolean(document.querySelector('.ga-head-model')?.textContent?.trim()));
  await page.getByRole('button', { name: 'Kalite & N-1', exact: true }).click();
  await page.getByRole('button', { name: 'N-1 SENARYOLARI', exact: true }).click();
  const view = page.locator('[data-view="quality-n1"]');
  await view.locator('.ga-card-grid .ga-card').first().waitFor({ state: 'visible' });
  const readCatalog = () => page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-view="quality-n1"] .ga-card')];
    const count = label => {
      const card = cards.find(item => item.querySelector('small')?.textContent?.trim() === label);
      return card ? Number(card.querySelector('strong')?.textContent?.replace(/\D/g, '')) : null;
    };
    return { total: count('Toplam aday'), screenable: count('Taranabilir'), defaultSelected: count('Seçili') };
  });
  const before = await readCatalog();
  artifact.catalogCandidateCount = before.total;
  artifact.screenableCandidateCount = before.screenable;
  artifact.defaultSelectedCandidateCount = before.defaultSelected;
  artifact.defaultScreenabilityFilter = await view.locator('select[aria-label="Taranabilirlik filtresi"]').inputValue();
  await view.locator('select[aria-label="Taranabilirlik filtresi"]').selectOption('ALL');
  await view.getByRole('button', { name: 'Tüm adayları seç' }).click();
  const after = await readCatalog();
  artifact.selectedCandidateCount = after.defaultSelected;
  if (!after.total || after.defaultSelected !== after.total) throw new Error(`Full-country selection is incomplete: ${after.defaultSelected}/${after.total}`);
  const run = view.getByRole('button', { name: 'Seçili senaryoları tara' });
  if (await run.isDisabled()) throw new Error('N-1 run button is disabled after selecting the full catalog.');

  started = performance.now();
  await run.click();
  artifact.progressVisible = await view.locator('progress').first().isVisible();
  await page.getByRole('button', { name: 'N-1 SONUÇLARI', exact: true }).click();
  artifact.tabSwitchMs = performance.now() - started;
  await page.waitForFunction(() => {
    const text = document.querySelector('footer [role="status"]')?.textContent || '';
    return text.startsWith('N-1 taraması ·') || text.startsWith('N-1 taraması başarısız:') || text.startsWith('N-1 taraması iptal edildi.');
  }, null, { timeout: 180000 });
  artifact.completionSignalMs = performance.now() - started;
  const footer = await page.locator('footer [role="status"]').innerText();
  if (!footer.startsWith('N-1 taraması ·')) throw new Error(footer);
  // The candidate table remains in the DOM but is hidden on the results tab.
  // Wait for the visible result summary instead of a generic table row.
  await view.locator('.ga-panel .ga-card-grid .ga-card').first().waitFor({ state: 'visible' });
  artifact.wallClockMs = performance.now() - started;
  artifact.resultRendered = true;
  console.log(`N-1 browser completion: ${(artifact.wallClockMs / 1000).toFixed(2)} s`);

  const downloadEvent = page.waitForEvent('download');
  await view.getByRole('button', { name: 'JSON indir' }).click();
  const download = await downloadEvent;
  if (download.suggestedFilename() !== 'GridAnalyzer-n1-screening.json') throw new Error('N-1 technical JSON export is missing.');
  const result = JSON.parse(await readFile(await download.path(), 'utf8'));
  artifact.engineElapsedMs = result.elapsedMs;
  artifact.candidateCount = result.candidateCount;
  artifact.screenedCount = result.screenedCount;
  artifact.islandingCount = result.islandingCount;
  artifact.unsupportedCount = result.unsupportedCount;
  artifact.violationCount = result.candidates.filter(candidate => candidate.status === 'SCREENED_VIOLATION').length;
  artifact.kluFactorizationCount = result.dcDiagnostics.factorizationCount;
  artifact.kluRhsCount = result.dcDiagnostics.rhsCount;
  artifact.kluMaxTrueResidual = result.dcDiagnostics.maxTrueResidual;
  artifact.kluMatrices = result.dcDiagnostics.matrices;
  artifact.resultIdentity = result.identity;
  if (result.candidateCount !== artifact.selectedCandidateCount) throw new Error('Result candidate count does not match the selected catalog.');
  if (!(artifact.kluFactorizationCount > 0 && artifact.kluRhsCount > 0 && Number.isFinite(artifact.kluMaxTrueResidual))) throw new Error('KLU diagnostics are incomplete.');
  artifact.status = artifact.wallClockMs < 30000 ? 'PASS' : 'PERFORMANCE_FAIL';
  if (artifact.status !== 'PASS') process.exitCode = 1;
} catch (error) {
  if (started != null && artifact.wallClockMs == null) artifact.wallClockMs = performance.now() - started;
  artifact.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(`Benchmark artifact: ${output}`);
  await browser?.close();
  server.kill('SIGTERM');
}
