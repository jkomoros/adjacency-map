// Playwright-based browser smoke test for the planning-workflow-improvements branch.
// Run with: node tools/smoke-test.mjs
// Expects the dev server (npm run serve) to already be running on port 8090.

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = 'http://localhost:8090';
const SCREENSHOT_DIR = '/tmp/adjacency-smoke';

const log = (msg) => console.log(`[smoke] ${msg}`);
const fail = (msg) => { console.error(`[FAIL] ${msg}`); process.exitCode = 1; };
const pass = (msg) => console.log(`[ pass ] ${msg}`);

await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
	if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

try {
	log(`navigating to ${BASE_URL}/main/default/`);
	await page.goto(`${BASE_URL}/main/default/`, { waitUntil: 'networkidle', timeout: 15000 });

	// Step 1: page rendered, SVG visible
	const svgCount = await page.locator('svg.main').count();
	if (svgCount >= 1) pass(`SVG diagram rendered (${svgCount} instance)`);
	else fail('No svg.main element found');

	// Step 2: nodes rendered
	const circleCount = await page.locator('svg.main circle').count();
	if (circleCount > 0) pass(`${circleCount} circles rendered`);
	else fail('No circles inside SVG');

	await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial-load.png'), fullPage: false });

	// Step 3: no console errors so far
	if (consoleErrors.length === 0) pass('no console errors after load');
	else fail(`console errors after load: ${consoleErrors.join(' | ')}`);

	// Step 4: error banner is NOT visible (good data)
	const banner = page.locator('.error-banner');
	const bannerVisible = await banner.isVisible().catch(() => false);
	if (!bannerVisible) pass('error banner hidden (no data error)');
	else fail('error banner unexpectedly visible on healthy data');

	// Step 5: click a node, expect selection class + URL hash updates
	const firstNode = page.locator('svg.main circle').first();
	const nodeID = await firstNode.getAttribute('id');
	log(`clicking node with id=${nodeID}`);
	await firstNode.click({ force: true });
	await page.waitForTimeout(300);

	const hashAfterClick = await page.evaluate(() => window.location.hash);
	log(`hash after click: ${hashAfterClick}`);
	if (hashAfterClick.includes(`n=${nodeID}`)) pass(`URL hash carries selection (${hashAfterClick})`);
	else fail(`URL hash missing n=${nodeID} (got: ${hashAfterClick})`);

	const selectedClassPresent = await page.locator('svg.main circle.selected').count();
	if (selectedClassPresent > 0) pass('selected class applied to a node');
	else fail('no .selected class on any node after click');

	// Step 6: neighbor highlighting — dim class present
	await page.waitForTimeout(300);
	const dimCount = await page.locator('svg.main .dim').count();
	if (dimCount > 0) pass(`${dimCount} dimmed elements (non-neighbors)`);
	else log(`no .dim elements — this is fine if the graph is small or all are neighbors`);

	await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-selected-node.png'), fullPage: false });

	// Step 7: Esc clears selection
	log('pressing Escape');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(300);

	const hashAfterEsc = await page.evaluate(() => window.location.hash);
	if (!hashAfterEsc.includes('n=')) pass(`Esc cleared selection from URL (${hashAfterEsc || '(empty)'})`);
	else fail(`Esc did not clear selection (${hashAfterEsc})`);

	const selectedAfterEsc = await page.locator('svg.main circle.selected').count();
	if (selectedAfterEsc === 0) pass('no .selected after Esc');
	else fail(`${selectedAfterEsc} nodes still have .selected after Esc`);

	// Step 8: Arrow key cycles scenarios
	log('pressing ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.waitForTimeout(400);
	const hashAfterArrow = await page.evaluate(() => window.location.hash);
	if (hashAfterArrow.includes('s=')) pass(`ArrowRight changed scenario (${hashAfterArrow})`);
	else log(`ArrowRight did not change scenario (hash: ${hashAfterArrow || 'empty'}) — may be already at last`);

	await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-scenario-switched.png'), fullPage: false });

	// Step 9: navigate back to base scenario before continuing
	await page.evaluate(() => { window.location.hash = ''; });
	await page.waitForTimeout(300);

	// Step 10: URL with stale selection should not crash
	log('navigating with stale selection ID');
	await page.goto(`${BASE_URL}/main/default/#n=node:bogus_id`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(500);
	const svgAfterStale = await page.locator('svg.main').count();
	if (svgAfterStale >= 1) pass('app survives stale selection in URL');
	else fail('app failed to render with stale selection ID');

	const bannerAfterStale = await banner.isVisible().catch(() => false);
	if (!bannerAfterStale) pass('no error banner from stale selection');
	else fail('error banner appeared on stale selection (should be silent fallback)');

	// Step 11: Final console-errors check
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
	log(`screenshots in ${SCREENSHOT_DIR}`);
}
