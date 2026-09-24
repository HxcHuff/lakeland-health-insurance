import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COUNTDOWN_SRC = readFileSync(resolve(ROOT, 'js/aep-countdown.js'), 'utf8');
const BROKER_HTML = readFileSync(resolve(ROOT, 'medicare-broker-lakeland-fl/index.html'), 'utf8');

function loadCountdown() {
  const sandbox = { console, Date, Math, Intl, Number, String, Object };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(COUNTDOWN_SRC, sandbox, { filename: 'aep-countdown.js' });
  return sandbox.LHIAepCountdown;
}

function easternDate(year, month, day, hour = 12) {
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00-04:00`);
}

test('primary broker page ships a no-JS AEP default instead of -- days', () => {
  assert.match(BROKER_HTML, /id="countdownNumber">October 15</);
  assert.doesNotMatch(BROKER_HTML, /id="countdownNumber">-- days</);
  assert.match(BROKER_HTML, /src="\/js\/aep-countdown\.js\?v=20260923-aep-countdown"/);
  assert.match(BROKER_HTML, /<title>Review Medicare Advantage Plans in Lakeland, FL<\/title>/);
  assert.match(
    BROKER_HTML,
    /content="Who can help review Medicare Advantage plans in Lakeland, FL\? Licensed broker \(FL #W371813\) compares Advantage, Medigap &amp; Part D\. No separate broker fee\."/
  );
});

test('AEP countdown is before, open, or closed from Eastern calendar dates', () => {
  const api = loadCountdown();

  const before = api.computeAepCountdown(easternDate(2026, 9, 23));
  assert.equal(before.phase, 'before');
  assert.equal(before.days, 22);
  assert.equal(before.label, 'AEP opens in');
  assert.equal(before.number, '22 days');

  const open = api.computeAepCountdown(new Date('2026-11-01T12:00:00-04:00'));
  assert.equal(open.phase, 'open');
  assert.equal(open.days, 36);
  assert.equal(open.label, 'AEP closes in');
  assert.equal(open.number, '36 days');

  const lastDay = api.computeAepCountdown(new Date('2026-12-07T15:00:00-05:00'));
  assert.equal(lastDay.phase, 'open');
  assert.equal(lastDay.days, 0);
  assert.equal(lastDay.number, 'Today');

  const closed = api.computeAepCountdown(new Date('2026-12-08T12:00:00-05:00'));
  assert.equal(closed.phase, 'closed');
  assert.equal(closed.label, 'AEP has closed');
  assert.equal(closed.number, 'Next steps');

  const nextYear = api.computeAepCountdown(new Date('2027-01-15T12:00:00-05:00'));
  assert.equal(nextYear.phase, 'before');
  assert.equal(nextYear.days, 273);
});
