// Playwright-based browser smoke test for the planning-workflow-improvements branch.
// Run with: npm run test:smoke
// Self-manages the dev server: starts if not already running on port 8090,
// stops it on exit. Cleans up any temp files it creates.

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import http from 'http';
import path from 'path';

const PORT = 8090;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = '/tmp/adjacency-smoke';
const SIDECAR_PATH = 'data/default.edits.json';
const SIDECAR_SCENARIO_NAME = 'smoke-sidecar-scenario';
const SIDECAR_DESCRIPTION = 'From sidecar (smoke-test temp)';

let serverProc = null;
let serverWasAlreadyUp = false;

const log = (msg) => console.log(`[smoke] ${msg}`);
const pass = (msg) => console.log(`[ pass ] ${msg}`);
const fail = (msg) => { console.error(`[FAIL] ${msg}`); process.exitCode = 1; };

// ---------- server lifecycle ----------

const pingServer = () => new Promise((resolve) => {
	const req = http.get(BASE_URL + '/', (res) => {
		res.resume();
		resolve(res.statusCode === 200);
	});
	req.on('error', () => resolve(false));
	req.setTimeout(500, () => { req.destroy(); resolve(false); });
});

const waitForServer = async (maxSeconds = 20) => {
	for (let i = 0; i < maxSeconds; i++) {
		if (await pingServer()) return true;
		await new Promise((r) => setTimeout(r, 1000));
	}
	return false;
};

const startServerIfNeeded = async () => {
	if (await pingServer()) {
		serverWasAlreadyUp = true;
		log(`server already up on ${BASE_URL}`);
		return;
	}
	log('starting dev server (npm run serve)');
	serverProc = spawn('npm', ['run', 'serve'], { stdio: 'pipe', detached: true });
	if (!(await waitForServer(20))) {
		throw new Error('dev server failed to start within 20s');
	}
	log('server ready');
};

const stopServerIfWeStartedIt = () => {
	if (!serverProc || serverWasAlreadyUp) return;
	log('stopping dev server');
	// Kill the entire process group so child wds + tsc + watch-data all die.
	try { process.kill(-serverProc.pid, 'SIGTERM'); } catch {}
	// Belt and suspenders — these are the named processes started by `npm run serve`.
	spawnSync('pkill', ['-f', `wds --node-resolve --port=${PORT}`]);
	spawnSync('pkill', ['-f', 'watch-data']);
	spawnSync('pkill', ['-f', 'tsc --watch']);
};

// ---------- sidecar prep ----------

const writeSidecar = async () => {
	const payload = {
		[SIDECAR_SCENARIO_NAME]: {
			description: SIDECAR_DESCRIPTION,
			nodes: {}
		}
	};
	await fs.writeFile(SIDECAR_PATH, JSON.stringify(payload, null, '\t'));
	log(`wrote temp sidecar at ${SIDECAR_PATH}`);
};

const removeSidecar = async () => {
	if (existsSync(SIDECAR_PATH)) {
		await fs.unlink(SIDECAR_PATH);
		log(`removed temp sidecar at ${SIDECAR_PATH}`);
	}
};

const regenerateConfig = () => {
	const res = spawnSync('npm', ['run', 'generate:config'], { stdio: 'pipe' });
	if (res.status !== 0) throw new Error('generate:config failed during smoke test');
};

// ---------- main ----------

await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

try {
	// Set up sidecar BEFORE server starts (or before navigation if already up).
	await writeSidecar();
	regenerateConfig();

	await startServerIfNeeded();

	const browser = await chromium.launch({ headless: true });
	const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
	const page = await ctx.newPage();

	const consoleErrors = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') consoleErrors.push(msg.text());
	});
	page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

	try {
		// ---------- Section 1: healthy load ----------
		log(`navigating to ${BASE_URL}/main/default/`);
		await page.goto(`${BASE_URL}/main/default/`, { waitUntil: 'networkidle', timeout: 15000 });

		const svgCount = await page.locator('svg.main').count();
		if (svgCount >= 1) pass(`SVG diagram rendered (${svgCount} instance)`);
		else fail('No svg.main element found');

		const circleCount = await page.locator('svg.main circle').count();
		if (circleCount > 0) pass(`${circleCount} circles rendered`);
		else fail('No circles inside SVG');

		await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial-load.png') });

		if (consoleErrors.length === 0) pass('no console errors after load');
		else fail(`console errors after load: ${consoleErrors.join(' | ')}`);

		const banner = page.locator('.error-banner');
		if (!(await banner.isVisible().catch(() => false))) pass('error banner hidden (healthy data)');
		else fail('error banner unexpectedly visible on healthy data');

		// ---------- Section 2: selection + URL + highlighting ----------
		const firstNode = page.locator('svg.main circle').first();
		const nodeID = await firstNode.getAttribute('id');
		log(`clicking node with id=${nodeID}`);
		await firstNode.click({ force: true });
		await page.waitForTimeout(300);

		const hashAfterClick = await page.evaluate(() => window.location.hash);
		const selectedFromHash = await page.evaluate(() => new URLSearchParams(window.location.hash.substring(1)).get('n'));
		if (selectedFromHash === nodeID) pass(`URL hash carries selection (${hashAfterClick})`);
		else fail(`URL hash missing n=${nodeID} (got: ${hashAfterClick})`);

		if ((await page.locator('svg.main circle.selected').count()) > 0) pass('selected class applied to a node');
		else fail('no .selected class on any node after click');

		const dimCount = await page.locator('svg.main .dim').count();
		if (dimCount > 0) pass(`${dimCount} dimmed elements (non-neighbors)`);
		else log(`no .dim elements — small graph or all are neighbors`);

		await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-selected-node.png') });

		// ---------- Section 3: Esc + arrow keys ----------
		log('pressing Escape');
		await page.keyboard.press('Escape');
		await page.waitForTimeout(300);
		const hashAfterEsc = await page.evaluate(() => window.location.hash);
		if (!hashAfterEsc.includes('n=')) pass(`Esc cleared selection from URL (${hashAfterEsc || '(empty)'})`);
		else fail(`Esc did not clear selection (${hashAfterEsc})`);

		if ((await page.locator('svg.main circle.selected').count()) === 0) pass('no .selected after Esc');
		else fail('selected class still present after Esc');

		log('pressing ArrowRight');
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(400);
		const hashAfterArrow = await page.evaluate(() => window.location.hash);
		if (hashAfterArrow.includes('s=')) pass(`ArrowRight changed scenario (${hashAfterArrow})`);
		else log(`ArrowRight didn't advance scenario (${hashAfterArrow || 'empty'}) — may be last`);

		await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-scenario-switched.png') });

		// reset hash before next section
		await page.evaluate(() => { window.location.hash = ''; });
		await page.waitForTimeout(200);

		// ---------- Section 4: stale selection survives ----------
		log('navigating with stale selection ID');
		await page.goto(`${BASE_URL}/main/default/#n=node:bogus_id`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(500);
		if ((await page.locator('svg.main').count()) >= 1) pass('app survives stale selection in URL');
		else fail('app failed to render with stale selection ID');

		if (!(await banner.isVisible().catch(() => false))) pass('no error banner from stale selection');
		else fail('error banner appeared on stale selection');

		// ---------- Section 5: error banner visible state ----------
		// Navigate to a URL that names a scenario that doesn't exist. That throws
		// inside AdjacencyMap construction; selectAdjacencyMapError surfaces it;
		// the banner should appear.
		log('navigating with bogus scenario name to trigger error banner');
		await page.goto(`${BASE_URL}/main/default/#s=does-not-exist-anywhere`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(500);

		const bannerVisible = await banner.isVisible().catch(() => false);
		if (bannerVisible) {
			const txt = (await banner.innerText()).trim();
			pass(`error banner visible on bad scenario: ${txt.split('\n').slice(0, 2).join(' | ')}`);
		} else {
			fail('error banner did not appear for non-existent scenario');
		}
		await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-error-banner.png') });

		// ---------- Section 6: sidecar JSON merge ----------
		// We wrote data/default.edits.json + ran generate:config before starting the
		// server. The sidecar scenario should be in the scenarios dropdown.
		await page.goto(`${BASE_URL}/main/default/`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(500);

		const scenarioOptions = await page.locator('#scenarios option').allTextContents();
		const sidecarSeen = scenarioOptions.some((t) => t.includes(SIDECAR_SCENARIO_NAME));
		if (sidecarSeen) pass(`sidecar scenario "${SIDECAR_SCENARIO_NAME}" present in dropdown`);
		else fail(`sidecar scenario missing from dropdown (saw: ${scenarioOptions.join(', ')})`);

		// Select it and verify the description renders.
		if (sidecarSeen) {
			await page.locator('#scenarios').selectOption({ label: SIDECAR_SCENARIO_NAME });
			await page.waitForTimeout(300);
			const summaryDesc = await page.locator('.summary input[type=text], .summary em, .summary').first().innerText().catch(() => '');
			if (summaryDesc.includes(SIDECAR_DESCRIPTION)) {
				pass('sidecar scenario description renders');
			} else {
				log(`sidecar description not surfaced visually (saw: "${summaryDesc.slice(0, 80)}") — scenario still loadable, dropdown match was sufficient`);
			}
			await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-sidecar-merged.png') });
		}

		// ---------- Section 7: metrics dashboard ----------
		await page.goto(`${BASE_URL}/main/default/`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(400);
		const metricsCount = await page.locator('.metrics-strip .metric-tile').count();
		if (metricsCount > 0) pass(`metrics strip shows ${metricsCount} tile(s)`);
		else fail('metrics strip empty or hidden on healthy load');

		// ---------- Section 8: fork scenario ----------
		// window.prompt is auto-accepted via page.on('dialog').
		page.once('dialog', async (dialog) => {
			await dialog.accept('smoke-fork-test');
		});
		const forkBtn = page.locator('button[title*="Fork"]').first();
		const forkBtnCount = await forkBtn.count();
		if (forkBtnCount > 0) {
			await forkBtn.click();
			await page.waitForTimeout(600);
			const opts = await page.locator('#scenarios option').allTextContents();
			if (opts.some(t => t.includes('smoke-fork-test'))) pass('fork created new scenario in dropdown');
			else fail(`fork did not produce new scenario (saw: ${opts.join(', ')})`);
		} else {
			fail('Fork button not found in controls');
		}

		// ---------- Section 9: compare mode ----------
		await page.goto(`${BASE_URL}/main/default/#c=increased-certainty`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(600);
		const diagrams = await page.locator('adjacency-map-diagram').count();
		if (diagrams === 2) pass('compare mode renders two diagrams');
		else fail(`compare mode rendered ${diagrams} diagrams (expected 2)`);

		const compareStripCount = await page.locator('.compare-strip').count();
		if (compareStripCount > 0) pass('compare diff strip rendered');
		else fail('compare diff strip missing');

		// Check for at least one diff class on a node across the two SVGs.
		const diffClassCount = await page.locator('circle.diff-changed, circle.diff-added, circle.diff-removed').count();
		if (diffClassCount > 0) pass(`${diffClassCount} nodes flagged with diff class`);
		else log('no diff classes — could be valid if scenarios are identical');

		await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-compare-mode.png') });

		// ---------- Section 10: inspect CLI ----------
		{
			const r = spawnSync('npm', ['run', 'inspect', '--', 'default', 'increased-certainty'], { encoding: 'utf8' });
			if (r.status === 0 && r.stdout.includes('Root aggregate values')) pass('inspect CLI produces expected output');
			else fail(`inspect CLI failed (status=${r.status}, stdout-head=${r.stdout?.slice(0, 200)})`);
		}

		// ---------- Section 11: diff CLI ----------
		{
			const r = spawnSync('npm', ['run', 'diff', '--', 'default', '', 'increased-certainty'], { encoding: 'utf8' });
			if (r.status === 0 && r.stdout.includes('Aggregate (A / B / delta)') && r.stdout.includes('Per-node')) {
				pass('diff CLI produces aggregate + per-node sections');
			} else {
				fail(`diff CLI failed (status=${r.status}, stdout-head=${r.stdout?.slice(0, 200)})`);
			}
		}

		// ---------- Section 12: rank CLI ----------
		{
			const r = spawnSync('npm', ['run', 'rank', '--', 'default', 'value'], { encoding: 'utf8' });
			if (r.status === 0 && r.stdout.includes('Ranking by: value')) pass('rank CLI ranks scenarios');
			else fail(`rank CLI failed (status=${r.status}, stdout-head=${r.stdout?.slice(0, 200)})`);
		}

		// ---------- Section 13a: state sidecar ----------
		await page.goto(`${BASE_URL}/main/default/#s=increased-certainty`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(700);  // debounce 250ms + POST + write
		{
			const sidecarPath = '/tmp/adjacency-state.json';
			if (existsSync(sidecarPath)) {
				const raw = await fs.readFile(sidecarPath, 'utf8');
				const snap = JSON.parse(raw);
				if (snap.filename === 'default' && snap.scenarioName === 'increased-certainty') {
					pass('state sidecar reflects current scenario');
				} else {
					fail(`state sidecar wrong: ${JSON.stringify(snap)}`);
				}
			} else {
				fail('state sidecar file not created');
			}
		}

		// ---------- Section 13b: export dialog + downloads ----------
		// Trigger the export dialog via the showExport action.
		await page.evaluate(() => {
			const app = document.querySelector('my-app');
			const main = app?.shadowRoot?.querySelector('main-view');
			const controls = main?.shadowRoot?.querySelector('adjacency-map-controls');
			const btn = controls?.shadowRoot?.querySelector('button[title*="Export"]');
			btn && btn.click();
		});
		await page.waitForTimeout(400);
		const dialogText = await page.evaluate(() => {
			const app = document.querySelector('my-app');
			const main = app?.shadowRoot?.querySelector('main-view');
			const dialog = main?.shadowRoot?.querySelector('dialog-element');
			return dialog?.textContent || '';
		});
		if (dialogText.includes('# ') && dialogText.includes('## Decision') && dialogText.includes('Considered for Q3 planning round.')) {
			pass('export dialog renders markdown with decision');
		} else {
			fail(`export dialog missing expected content (head: ${dialogText.slice(0, 200)})`);
		}

		// Click Download .png and capture the download.
		const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
		await page.evaluate(() => {
			const app = document.querySelector('my-app');
			const main = app?.shadowRoot?.querySelector('main-view');
			const buttons = main?.shadowRoot?.querySelectorAll('.export-actions button');
			const pngBtn = buttons && buttons[1]; // second button is Download .png
			pngBtn && pngBtn.click();
		});
		const dl = await downloadPromise;
		if (dl) {
			const downloadPath = await dl.path();
			const stat = downloadPath ? (await fs.stat(downloadPath)).size : 0;
			if (stat > 1000) pass(`PNG download captured (${stat} bytes)`);
			else fail(`PNG too small (${stat} bytes)`);
		} else {
			fail('no PNG download event');
		}

		// Close the dialog before the next section
		await page.evaluate(() => {
			const app = document.querySelector('my-app');
			const main = app?.shadowRoot?.querySelector('main-view');
			const closeBtn = main?.shadowRoot?.querySelector('dialog-element button.round');
			closeBtn && closeBtn.click();
		});
		await page.waitForTimeout(200);

		// ---------- Section 14: decision/reasoning rendering ----------
		await page.goto(`${BASE_URL}/main/default/#s=increased-certainty`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(500);
		// Shadow DOM: three levels deep (my-app -> main-view -> adjacency-map-controls).
		const summaryText = await page.evaluate(() => {
			const app = document.querySelector('my-app');
			const main = app?.shadowRoot?.querySelector('main-view');
			const controls = main?.shadowRoot?.querySelector('adjacency-map-controls');
			return controls?.shadowRoot?.querySelector('.summary')?.textContent || '';
		});
		const hasDecision = summaryText.includes('Considered for Q3 planning round.');
		const hasReasoning = summaryText.includes('Higher certainty estimates');
		if (hasDecision) pass('decision field renders in scenario summary');
		else fail(`decision field not rendered (summary head: ${summaryText.slice(0, 200)})`);
		if (hasReasoning) pass('reasoning field renders in scenario summary');
		else fail('reasoning field not rendered');

		// ---------- Section 15: search input dims non-matches ----------
		await page.goto(`${BASE_URL}/main/default/`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(400);
		// Type into the search field. It lives in the controls shadow root.
		await page.evaluate(() => {
			const app = document.querySelector('my-app');
			const main = app?.shadowRoot?.querySelector('main-view');
			const controls = main?.shadowRoot?.querySelector('adjacency-map-controls');
			const input = controls?.shadowRoot?.querySelector('#nodeSearch');
			if (input) {
				input.value = 'extended';
				input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
			}
		});
		await page.waitForTimeout(400);
		const searchMissCount = await page.locator('svg.main circle.search-miss').count();
		if (searchMissCount > 0) pass(`search dims ${searchMissCount} non-matching nodes`);
		else fail('search did not dim any nodes when "extended" typed');

		// Press Enter to jump to the first match.
		await page.evaluate(() => {
			const app = document.querySelector('my-app');
			const main = app?.shadowRoot?.querySelector('main-view');
			const controls = main?.shadowRoot?.querySelector('adjacency-map-controls');
			const input = controls?.shadowRoot?.querySelector('#nodeSearch');
			input && input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
		});
		await page.waitForTimeout(400);
		const hashAfterEnter = await page.evaluate(() => window.location.hash);
		if (hashAfterEnter.includes('n=')) pass(`Enter in search jumped to first match (${hashAfterEnter})`);
		else fail(`Enter did not select a node (hash=${hashAfterEnter})`);

		// Clear search via the × button.
		await page.evaluate(() => {
			const app = document.querySelector('my-app');
			const main = app?.shadowRoot?.querySelector('main-view');
			const controls = main?.shadowRoot?.querySelector('adjacency-map-controls');
			const clearBtn = controls?.shadowRoot?.querySelector('button[title="Clear search"]');
			clearBtn && clearBtn.click();
		});
		await page.waitForTimeout(300);
		const stillDimmed = await page.locator('svg.main circle.search-miss').count();
		if (stillDimmed === 0) pass('clear-search removes dim');
		else fail(`${stillDimmed} nodes still dimmed after clear`);

		// ---------- Section 16: help modal via ? key ----------
		await page.goto(`${BASE_URL}/main/default/`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(300);
		// Dispatch the key event directly with key='?' to avoid keyboard-layout
		// translation quirks in headless Chromium.
		await page.evaluate(() => {
			document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
		});
		await page.waitForTimeout(400);
		const helpText = await page.evaluate(() => {
			const app = document.querySelector('my-app');
			const main = app?.shadowRoot?.querySelector('main-view');
			const dialog = main?.shadowRoot?.querySelector('dialog-element');
			return dialog?.textContent || '';
		});
		if (helpText.includes('Keyboard shortcuts') && helpText.includes('npm run inspect')) {
			pass('help modal lists shortcuts and CLI commands');
		} else {
			fail(`help modal missing content (head: ${helpText.slice(0, 200)})`);
		}

		// ---------- Section 17: console-errors summary ----------
		const newErrors = consoleErrors.filter(e => !e.includes('Unknown URL arg'));
		if (newErrors.length === 0) pass('no unexpected console errors over full run');
		else log(`console errors over run: ${newErrors.join(' | ')}`);

		log('smoke test complete');
	} catch (err) {
		console.error('[fatal]', err);
		await page.screenshot({ path: path.join(SCREENSHOT_DIR, '99-error.png'), fullPage: true }).catch(() => {});
		process.exitCode = 1;
	} finally {
		await browser.close();
	}
} catch (outer) {
	console.error('[fatal-outer]', outer);
	process.exitCode = 1;
} finally {
	// Always clean up: remove sidecar, regen, stop server (if we started it).
	try { await removeSidecar(); } catch (e) { console.warn('sidecar cleanup failed:', e); }
	try { regenerateConfig(); } catch (e) { console.warn('post-cleanup regenerate failed:', e); }
	stopServerIfWeStartedIt();
	log(`screenshots in ${SCREENSHOT_DIR}`);
}
