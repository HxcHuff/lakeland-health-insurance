import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium } from 'playwright';
import { extractClientCopy, extractHtmlCopy, findContentPolicyIssues } from '../scripts/content-policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'
].filter(Boolean);
const CHROME_PATH = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));

test('precall-brief.js, provider-prescription-check, and thanks.html pass strict content policy and brand gates', () => {
  const scriptSrc = readFileSync(join(ROOT, 'js/precall-brief.js'), 'utf8');
  const worksheetHtml = readFileSync(join(ROOT, 'provider-prescription-check/index.html'), 'utf8');
  const thanksHtml = readFileSync(join(ROOT, 'thanks.html'), 'utf8');

  assert.deepEqual(findContentPolicyIssues(extractClientCopy(scriptSrc)), [], 'precall-brief.js passes content policy');
  assert.deepEqual(findContentPolicyIssues(extractHtmlCopy(worksheetHtml)), [], 'provider-prescription-check passes content policy');
  assert.deepEqual(findContentPolicyIssues(extractHtmlCopy(thanksHtml)), [], 'thanks.html passes content policy');

  for (const [label, content] of [
    ['js/precall-brief.js', scriptSrc],
    ['provider-prescription-check/index.html', worksheetHtml],
    ['thanks.html', thanksHtml]
  ]) {
    assert.doesNotMatch(content, /Florida Blue|FL Blue|HealthMarkets|Caplan|Greenleaf/i, `${label} avoids prohibited brand names`);
  }
});

test('post-form thanks.html spot-check hands off state to provider-prescription-check and caps readiness at 75% without leaking PHI', async (t) => {
  const server = createServer((req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filePath = join(ROOT, pathname.replace(/^\//, ''));
      const body = readFileSync(filePath);
      const ext = pathname.split('.').pop();
      const mime = ext === 'js' ? 'application/javascript' : ext === 'css' ? 'text/css' : 'text/html';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const browser = await chromium.launch({
    headless: true,
    ...(CHROME_PATH ? { executablePath: CHROME_PATH } : {})
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await context.newPage();

    // Simulate landing on /thanks.html right after submitting an ACA lead form
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem('__seeded_thanks_test')) {
        window.sessionStorage.setItem('__seeded_thanks_test', '1');
        window.sessionStorage.setItem('lhi_submission_completed', JSON.stringify({
          kind: 'Lead',
          event_id: 'lhi_test_precall_001',
          normalized_intent: 'aca',
          page_type: 'lp_aca',
          page_path: '/aca-health-insurance-lakeland-fl/',
          fired_at: Date.now()
        }));
      }
    });

    await page.goto(`http://127.0.0.1:${port}/thanks.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#thanksInteractiveSpotCheck');

    // Before tapping, reveal box is hidden
    assert.equal(await page.locator('#thanksSpotReveal').isHidden(), true);

    // Tap Watson Clinic + Publix on /thanks.html
    await page.click('[data-thanks-sys="watson"]');
    await page.click('[data-thanks-pharm="Publix"]');

    assert.equal(await page.locator('#thanksSpotReveal').isHidden(), false);
    const thanksWatchoutText = await page.locator('#thanksSpotWatchouts').textContent();
    assert.match(thanksWatchoutText, /Watson Clinic/i);
    assert.match(thanksWatchoutText, /Publix Pharmacy 2027/i);

    // Navigate from /thanks.html to the full worksheet
    await Promise.all([
      page.waitForURL('**/provider-prescription-check/**'),
      page.click('#thanksSpotReveal a[href*="/provider-prescription-check/"]')
    ]);

    // Verify post-lead welcome strip is visible and previous taps carried over
    assert.equal(await page.locator('#rxPostLeadWelcome').isHidden(), false, 'post-lead welcome strip shown');
    assert.equal(
      await page.locator('#rxCheckSystemChips .rx-chip[data-key="watson"]').getAttribute('aria-pressed'),
      'true',
      'Watson Clinic pre-selected from thanks.html'
    );
    assert.equal(await page.locator('#rxCheckPharmacy').inputValue(), 'Publix', 'Publix pre-filled from thanks.html');

    // Enter exact user test scenario: "Myblue bronze 2149", private doctor note, and check all 5 boxes
    await page.fill('#rxCheckPlanId', 'Myblue bronze 2149');
    await page.fill('#rxCheckDoctorNote', 'Dr. Private Cardiology Note');
    const checkboxes = page.locator('.rx-step-cb');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i += 1) {
      await checkboxes.nth(i).check();
    }

    const planDiag = await page.locator('#rxPlanDiagnostic').textContent();
    assert.match(planDiag, /#2149/, '4-digit plan variant #2149 detected');
    assert.match(planDiag, /Bronze Deductible & Sub-Network Watchout/, 'Bronze vs. Silver CSR watchout shown');

    const pharmDiag = await page.locator('#rxPharmacyDiagnostic').textContent();
    assert.match(pharmDiag, /Publix Pharmacy 2027 Preferred vs\. Standard Tier Watch/);

    const briefCode = await page.locator('#rxBriefCodeBadge').textContent();
    assert.equal(briefCode.trim(), 'Brief #2027-WC-2149');

    // Even with all 5 boxes checked, readiness stops at 75% so the 3 live carrier checks drive an immediate call
    const pctText = await page.locator('#rxReadinessPct').textContent();
    assert.match(pctText, /^75% Pre-Call Prep Ready/);
    assert.doesNotMatch(pctText, /100%/);

    // Secondary CTA switches to /book/ because lead was already submitted
    assert.equal(await page.locator('#rxSecondaryRouteBtn').getAttribute('href'), '/book/');

    // SMS link never leaks free-text doctor note
    const smsHref = await page.locator('#rxSmsBriefBtn').getAttribute('href');
    assert.match(smsHref, /^sms:\+18636403102\?body=/);
    assert.doesNotMatch(decodeURIComponent(smsHref), /Private Cardiology/i);

    // Test Humana + Watson Clinic conflict detection
    await page.fill('#rxCheckPlanId', 'Humana Gold Plus H1036-077');
    const conflictText = await page.locator('#rxPlanDiagnostic').textContent();
    assert.match(conflictText, /Confirmed 2027 Network Conflict Flagged/);

    await context.close();
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
});

test('precall-brief emits non-PHI worksheet telemetry events cleanly', () => {
  const briefSrc = readFileSync(resolve(ROOT, 'js/precall-brief.js'), 'utf8');
  assert.match(briefSrc, /precall_brief_engaged/);
  assert.match(briefSrc, /precall_brief_summary_copied/);
  assert.match(briefSrc, /precall_brief_printed/);
  assert.doesNotMatch(briefSrc, /emitPreCallEvent(?:Once)?\([^)]*(?:doctorNote|planText|pharmacyText)/i);
});
