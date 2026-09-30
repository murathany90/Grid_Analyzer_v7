import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const model = path.resolve(root, process.argv[2] || 'kontrol1/20260928_0900_SN1_TR0.zip');
const output = path.resolve(root, process.argv[3] || 'docs/validation/20260930-v803-n1-browser-final.json');
const port = 5300 + Math.floor(Math.random() * 1000);
const url = `http://127.0.0.1:${port}/`;
const benchmarkCodeSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const artifact = {
  benchmarkCodeSha, benchmarkEngineVersion: null, benchmarkPhase: 'committed fix-branch code before release version bump',
  model: path.basename(model), scope: 'default selected screenable and islanding line/transformer candidates at >=66 kV',
  browser: 'Chromium', status: 'ERROR', wallClockMs: null, engineElapsedMs: null,
  candidateCount: null, selectedCandidateCount: null, screenedCount: null,
  islandingCount: null, unsupportedCount: null, selectedUnsupportedCount: null, violationCount: null,
  defaultSelectedIslandingCount: null,
  constraintCandidates: null, violationInstances: null,
  selectedDetailWallClockMs: null, selectedIslandDetailWallClockMs: null,
  selectedIslandComponents: null, selectedReferenceLessIslands: null,
  selectedSeparatedLoadMw: null, selectedSeparatedGenerationMw: null,
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
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1366, height: 768 } });
  page.setDefaultTimeout(180000);
  await page.goto(url);
  await page.locator('#modelFileInput').setInputFiles(model);
  await page.waitForFunction(() => Boolean(document.querySelector('.ga-head-model')?.textContent?.trim()));
  await page.getByRole('button', { name: 'Kalite & N-1', exact: true }).click();
  await page.getByRole('button', { name: 'N-1 SENARYOLARI', exact: true }).click();
  const view = page.locator('section[data-view="quality-n1"]');
  await view.locator('.ga-card-grid .ga-card').first().waitFor({ state: 'visible' });
  const readCatalog = () => page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-view="quality-n1"] .ga-card')];
    const count = label => {
      const card = cards.find(item => item.querySelector('small')?.textContent?.trim() === label);
      return card ? Number(card.querySelector('strong')?.textContent?.replace(/\D/g, '')) : null;
    };
    return { total: count('Toplam aday'), screenable: count('DC taranabilir'), islanding: count('Ada ayıran'), unsupported: count('Taranamayan'), defaultSelected: count('Seçili') };
  });
  const before = await readCatalog();
  artifact.catalogCandidateCount = before.total;
  artifact.screenableCandidateCount = before.screenable;
  artifact.screenableCount = before.screenable;
  artifact.catalogIslandingCount = before.islanding;
  artifact.unsupportedCount = before.unsupported;
  artifact.defaultSelectedCandidateCount = before.defaultSelected;
  artifact.defaultScreenabilityFilter = await view.locator('select[aria-label="Taranabilirlik filtresi"]').inputValue();
  artifact.selectedCandidateCount = before.defaultSelected;
  if (!before.total || before.defaultSelected !== before.screenable + before.islanding || before.total !== before.screenable + before.islanding + before.unsupported) throw new Error(`Default N-1 selection is inconsistent: ${JSON.stringify(before)}`);
  const run = view.getByRole('button', { name: 'Seçili senaryoları tara' });
  if (await run.isDisabled()) throw new Error('N-1 run button is disabled for the default selection.');

  started = performance.now();
  await run.click();
  artifact.progressVisibleAtFirstCheck = await view.locator('progress').first().isVisible();
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
  await view.locator('[data-n1-result-ready="true"]').waitFor({ state: 'visible' });
  artifact.wallClockMs = performance.now() - started;
  artifact.renderAfterCompletionSignalMs = artifact.wallClockMs - artifact.completionSignalMs;
  artifact.resultRendered = true;
  console.log(`N-1 browser completion: ${(artifact.wallClockMs / 1000).toFixed(2)} s`);

  const downloadEvent = page.waitForEvent('download');
  await view.locator('summary[aria-label="N-1 sonuçlarını dışa aktar"]').click();
  await view.getByRole('button', { name: 'JSON indir' }).click();
  const download = await downloadEvent;
  if (download.suggestedFilename() !== 'GridAnalyzer-n1-screening.json') throw new Error('N-1 technical JSON export is missing.');
  const result = JSON.parse(await readFile(await download.path(), 'utf8'));
  artifact.engineElapsedMs = result.elapsedMs;
  artifact.candidateCount = result.candidateCount;
  artifact.screenedCount = result.screenedCount;
  artifact.islandingCount = result.islandingCount;
  artifact.defaultSelectedIslandingCount = result.islandingCount;
  artifact.selectedUnsupportedCount = result.unsupportedCount;
  artifact.benchmarkEngineVersion = result.identity.engineVersion;
  artifact.violationCount = result.candidates.filter(candidate => candidate.status === 'SCREENED_VIOLATION').length;
  artifact.constraintCandidates = result.candidates.filter(candidate => candidate.violationImpacts?.length).length;
  artifact.violationInstances = result.candidates.reduce((count, candidate) => count + (candidate.violationImpacts?.length || 0), 0);
  artifact.kluFactorizationCount = result.dcDiagnostics.factorizationCount;
  artifact.kluRhsCount = result.dcDiagnostics.rhsCount;
  artifact.kluMaxTrueResidual = result.dcDiagnostics.maxTrueResidual;
  artifact.kluMatrices = result.dcDiagnostics.matrices;
  artifact.resultIdentity = {
    modelHash: result.identity.modelHash,
    scenarioHash: result.identity.scenarioHash,
    engineVersion: result.identity.engineVersion,
  };
  if (result.candidateCount !== artifact.selectedCandidateCount) throw new Error('Result candidate count does not match the selected catalog.');
  if (result.islandingCount !== artifact.catalogIslandingCount || result.unsupportedCount !== 0) throw new Error('Default run must include every islanding candidate and no unsupported candidate.');
  if (!(artifact.kluFactorizationCount > 0 && artifact.kluRhsCount > 0 && Number.isFinite(artifact.kluMaxTrueResidual))) throw new Error('KLU diagnostics are incomplete.');
  const firstViolation = result.candidates.find(candidate => candidate.status === 'SCREENED_VIOLATION');
  const firstIsland = result.candidates.find(candidate => candidate.status === 'ISLANDING');
  async function measureDetail(candidate, metricName) {
    if (!candidate) return;
    const filter = view.locator('select[aria-label="N-1 sonuç durumu"]');
    await filter.selectOption(candidate.status);
    const row = view.locator(`.ga-panel .ga-table tbody tr[data-id="${candidate.candidateId}"]`);
    if (!await row.isVisible()) {
      await view.locator('input[aria-label="N-1 sonuçlarında ara"]').fill(candidate.equipmentId);
    }
    const visibleRow = view.locator(`.ga-panel .ga-table tbody tr[data-id="${candidate.candidateId}"]`);
    await visibleRow.waitFor({ state: 'visible' });
    const detailStart = performance.now();
    await visibleRow.click();
    await view.locator(`[data-n1-detail-id="${candidate.candidateId}"]`).waitFor({ state: 'visible', timeout: 30000 });
    artifact[metricName] = performance.now() - detailStart;
  }
  await measureDetail(firstViolation, 'selectedDetailWallClockMs');
  if (firstIsland) {
    await view.locator('input[aria-label="N-1 sonuçlarında ara"]').fill('');
    await measureDetail(firstIsland, 'selectedIslandDetailWallClockMs');
    await view.getByRole('button', { name: 'ADA / KAYIP', exact: true }).click();
    const islandSummary = view.locator('[data-n1-island-summary="true"]');
    await islandSummary.waitFor({ state: 'visible' });
    const summary = await islandSummary.evaluate(element => ({ ...element.dataset }));
    artifact.selectedIslandComponents = Number(summary.componentCount);
    artifact.selectedReferenceLessIslands = Number(summary.referenceLessCount);
    artifact.selectedSeparatedLoadMw = Number(summary.separatedLoadMw);
    artifact.selectedSeparatedGenerationMw = Number(summary.separatedGenerationMw);
  }
  if (path.basename(model) === '20260928_0900_SN1_TR0.zip') {
    await view.locator('select[aria-label="N-1 sonuç durumu"]').selectOption('');
    await view.locator('input[aria-label="N-1 sonuçlarında ara"]').fill('');
    await view.getByRole('button', { name: 'KISIT YÜKLENMELERİ', exact: true }).click();
    await view.locator('.ga-n1-violation-table tbody tr[data-id]').first().waitFor({ state: 'visible' });
    artifact.uiReview = [];
    for (const width of [1366, 1920]) {
      await page.setViewportSize({ width, height: 768 });
      const metrics = await page.evaluate(() => {
        const wrap = document.querySelector('.ga-n1-violation-wrap');
        const context = wrap?.querySelector('tbody td.ga-n1-sticky-context');
        const toolbar = document.querySelector('.ga-n1-results-controls');
        return {
          viewportWidth: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          tableViewportWidth: wrap?.clientWidth ?? null,
          tableContentWidth: wrap?.scrollWidth ?? null,
          stickyContextPosition: context ? getComputedStyle(context).position : null,
          toolbarHeight: toolbar?.getBoundingClientRect().height ?? null,
        };
      });
      const screenshot = output.replace(/\.json$/i, `-${width}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      artifact.uiReview.push({ ...metrics, screenshot: path.basename(screenshot) });
      if (metrics.documentWidth > width + 2 || metrics.stickyContextPosition !== 'sticky') throw new Error(`N-1 results layout review failed at ${width}px: ${JSON.stringify(metrics)}`);
    }
  }
  artifact.status = artifact.wallClockMs < 5000 ? 'PASS' : 'PERFORMANCE_FAIL';
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
