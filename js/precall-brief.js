/*
 * Lakeland Health Insurance - Browser-Only 2027 Pre-Call Readiness & Diagnostic Engine
 * Powers:
 *   1. /thanks.html post-submission 30-second 2027 Spot-Check & Fast-Track Call Brief
 *   2. /provider-prescription-check/#interactive-verification-worksheet full analyzer
 *
 * Privacy boundary:
 *   - 100% client-side in tab-scoped sessionStorage ('lhi_precall_brief_v1').
 *   - Never transmitted to analytics, ad pixels, URL query strings, or server endpoints.
 *   - SMS fast-track links include only non-PHI structural routing tags (facility system,
 *     coverage track, retail pharmacy chain, and brief code) - never prescriptions or notes.
 */
(function (w, d) {
  'use strict';

  if (w.__LHI_PRECALL_BRIEF_LOADED__) return;
  w.__LHI_PRECALL_BRIEF_LOADED__ = true;

  var STORAGE_KEY = 'lhi_precall_brief_v1';
  var POST_LEAD_KEY = 'lhi_post_lead_ctx';
  var PHONE_E164 = '+18636403102';
  var PHONE_DISPLAY = '(863) 640-3102';
  var POST_LEAD_TTL_MS = 2 * 60 * 60 * 1000;

  var SYSTEMS = {
    watson: {
      code: 'WC',
      shortLabel: 'Watson Clinic',
      fullLabel: 'Watson Clinic (Main / Bartow Rd / Highlands / South)',
      html: '<strong>Watson Clinic:</strong> Starting January 1, 2027, Watson Clinic no longer accepts Humana plans, and some Medicare Advantage HMOs contract for specialty care only (no Watson Clinic PCP). Verify your doctor by exact 2027 plan ID or call Patient Relations at (863) 680-7213. <a href="/blog/watson-clinic-humana-2027.html">Read the 2027 Watson Clinic Humana guide</a>.',
      text: 'Watson Clinic: No longer accepts Humana starting Jan 1, 2027; verify full PCP + specialist participation vs. specialty-only sub-network.',
      pendingCheck: 'Confirm whether your 2027 plan ID includes Watson Clinic for both Primary Care and Specialists (not specialty-only referral access).'
    },
    lrh: {
      code: 'LRH',
      shortLabel: 'Lakeland Regional Health',
      fullLabel: 'Lakeland Regional Health (Medical Center & Physician Group)',
      html: '<strong>Lakeland Regional Health:</strong> Hospital facility contracts (1324 Lakeland Hills Blvd) and LRH Physician Group doctors bill under separate tax IDs and are verified separately. <a href="/local-health-insurance-answers/lakeland-regional-unitedhealthcare-2027/">See LRH &amp; 2027 network check</a>.',
      text: 'Lakeland Regional Health: Verify hospital facility and LRH Physician Group doctors separately on the 2027 plan ID.',
      pendingCheck: 'Match both Lakeland Regional Health Medical Center facility access and your LRH Physician Group doctor NPI on the 2027 contract.'
    },
    baycare: {
      code: 'BC',
      shortLabel: 'BayCare / Winter Haven Hospital',
      fullLabel: 'BayCare (Winter Haven Hospital / Bartow Regional / BayCare Medical Group)',
      html: '<strong>BayCare / Winter Haven Hospital:</strong> Confirm Winter Haven Hospital, Bartow Regional Medical Center, and BayCare Medical Group (including former Gessler Clinic doctors) under the exact 2027 plan ID. <a href="/blog/baycare-medicare-advantage-plans-2027-polk-county.html">See BayCare 2027 Polk County guide</a>.',
      text: 'BayCare / Winter Haven Hospital: Verify hospital facility and BayCare Medical Group (including former Gessler Clinic doctors) by 2027 plan ID.',
      pendingCheck: 'Verify Winter Haven / Bartow Regional hospital tier alongside BayCare Medical Group office addresses.'
    },
    orlando: {
      code: 'OH',
      shortLabel: 'Orlando Health',
      fullLabel: 'Orlando Health (Lakeland Highlands Hospital)',
      html: '<strong>Orlando Health Lakeland Highlands Hospital:</strong> The hospital at 4000 Lakeland Highlands Rd holds separate facility contracts from Watson Clinic physicians. Confirm both the hospital and your attending specialist. <a href="/blog/orlando-health-watson-clinic-insurance-2026.html">Read the Orlando Health &amp; Watson Clinic guide</a>.',
      text: 'Orlando Health Lakeland Highlands Hospital: Verify hospital facility contract (4000 Lakeland Highlands Rd) separately from attending clinic physicians.',
      pendingCheck: 'Cross-check Orlando Health Lakeland Highlands facility contract separately from your attending specialist group.'
    },
    advent: {
      code: 'AH',
      shortLabel: 'AdventHealth',
      fullLabel: 'AdventHealth (Heart of Florida / Lake Wales / Bond Clinic / Centra Care)',
      html: '<strong>AdventHealth:</strong> Check AdventHealth Heart of Florida (Davenport), AdventHealth Lake Wales, Bond Clinic, and Centra Care walk-in addresses separately on your 2027 directory.',
      text: 'AdventHealth: Verify Heart of Florida, Lake Wales, Bond Clinic, and Centra Care locations separately.',
      pendingCheck: 'Confirm East Polk AdventHealth hospital, Bond Clinic, and Centra Care urgent-care participation on the 2027 plan ID.'
    },
    moffitt: {
      code: 'TPA',
      shortLabel: 'Tampa Specialty (Moffitt / TGH)',
      fullLabel: 'Out-of-County Specialty Facilities (Tampa / Hillsborough)',
      html: '<strong>Out-of-County Specialty Care (Tampa / Orlando):</strong> Many county-based HMO and narrow EPO plan IDs restrict out-of-county tertiary hospitals or require prior network authorization before specialty visits.',
      text: 'Out-of-County Specialty Care: Verify whether Polk County HMO/EPO rules restrict Hillsborough or Orange County specialty centers.',
      pendingCheck: 'Verify out-of-county referral rules and tertiary hospital network status before choosing a county-locked HMO.'
    }
  };

  var PRIORITIES = {
    rx_tier: 'Brand-name or Tier 3+ prescriptions',
    multi_spec: '2+ specialists to keep aligned',
    procedure: 'Planned 2027 procedure or imaging',
    cost_compare: 'Comparing deductible vs. monthly premium'
  };

  function safeReadSession(key) {
    try {
      var raw = w.sessionStorage && w.sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function safeWriteSession(key, value) {
    try {
      if (w.sessionStorage) {
        w.sessionStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {}
  }

  function recordPostLeadContext(intent) {
    var cleanIntent = String(intent || 'generic').trim().toLowerCase();
    var lane = 'unsure';
    if (cleanIntent.indexOf('aca') !== -1 || cleanIntent === 'under-65' || cleanIntent === 'lost-coverage' || cleanIntent === 'self-employed' || cleanIntent === 'turning-26') {
      lane = 'aca';
    } else if (cleanIntent.indexOf('medicare') !== -1) {
      lane = 'medicare';
    }
    safeWriteSession(POST_LEAD_KEY, {
      submitted: true,
      intent: cleanIntent,
      lane: lane,
      ts: Date.now()
    });
  }

  function getPostLeadContext() {
    var ctx = safeReadSession(POST_LEAD_KEY);
    if (!ctx || !ctx.submitted || !ctx.ts) return null;
    if (Date.now() - ctx.ts > POST_LEAD_TTL_MS) return null;
    return ctx;
  }

  function defaultState() {
    var postCtx = getPostLeadContext();
    return {
      lane: (postCtx && postCtx.lane) || 'unsure',
      systems: [],
      planText: '',
      pharmacyText: '',
      doctorNote: '',
      priorities: [],
      checkedSteps: []
    };
  }

  function loadState() {
    var base = defaultState();
    var saved = safeReadSession(STORAGE_KEY);
    if (!saved || typeof saved !== 'object') return base;
    if (saved.lane === 'aca' || saved.lane === 'medicare' || saved.lane === 'unsure') {
      base.lane = saved.lane;
    }
    if (Array.isArray(saved.systems)) {
      base.systems = saved.systems.filter(function (k) { return Object.prototype.hasOwnProperty.call(SYSTEMS, k); });
    }
    if (typeof saved.planText === 'string') base.planText = saved.planText.slice(0, 120);
    if (typeof saved.pharmacyText === 'string') base.pharmacyText = saved.pharmacyText.slice(0, 120);
    if (typeof saved.doctorNote === 'string') base.doctorNote = saved.doctorNote.slice(0, 140);
    if (Array.isArray(saved.priorities)) {
      base.priorities = saved.priorities.filter(function (k) { return Object.prototype.hasOwnProperty.call(PRIORITIES, k); });
    }
    if (Array.isArray(saved.checkedSteps)) {
      base.checkedSteps = saved.checkedSteps.filter(function (n) { return typeof n === 'number' && n >= 0 && n < 10; });
    }
    return base;
  }

  function saveState(state) {
    safeWriteSession(STORAGE_KEY, state);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function inferLaneFromPlan(rawPlan) {
    var text = String(rawPlan || '').trim().toLowerCase();
    if (!text) return null;
    if (/\b(?:medigap|supplement|plan\s*[gnf]|part\s*d|ma-pd|mapd|d-snp|dsnp|c-snp|csnp|giveback|give-back|medicare)\b/.test(text)) {
      return 'medicare';
    }
    if (/\b[hrs]\d{4}\b/.test(text)) {
      return 'medicare';
    }
    if (/\b(?:bronze|silver|catastrophic|marketplace|aca|obamacare|csr)\b/.test(text)) {
      return 'aca';
    }
    if (/\bgold\b/.test(text) && !/\bgold\s+plus\b/.test(text)) {
      return 'aca';
    }
    var fourDigit = text.match(/\b(\d{4}[a-z]?)\b/);
    if (fourDigit && fourDigit[1] !== '2026' && fourDigit[1] !== '2027') {
      return 'aca';
    }
    return null;
  }

  function analyzePlan(rawPlan, lane, systems) {
    var text = String(rawPlan || '').trim();
    var lower = text.toLowerCase();
    var findings = [];
    var hasConflict = false;
    var variantCode = '';

    if (!text) return { findings: findings, hasConflict: false, variantCode: '' };

    if (systems.indexOf('watson') !== -1 && /\bhumana\b/.test(lower)) {
      hasConflict = true;
      findings.push({
        tone: 'conflict',
        title: 'Confirmed 2027 Network Conflict Flagged',
        body: 'Watson Clinic ends Humana participation across plans starting January 1, 2027. Call David at ' + PHONE_DISPLAY + ' before keeping or selecting this option so he can compare 2027 alternatives in your ZIP code.'
      });
    }

    var medContract = lower.match(/\b([hrs]\d{4})(?:[-\s]?(\d{3}))?\b/);
    if (medContract) {
      variantCode = medContract[1].toUpperCase() + (medContract[2] ? '-' + medContract[2] : '');
      findings.push({
        tone: 'info',
        title: '2027 Medicare Contract ID (' + escapeHtml(variantCode) + ') Detected',
        body: 'Even under the same contract prefix, county segment numbers (such as -001 vs. -002) change Maximum Out-of-Pocket caps, specialist copays, Part B premium reduction rules, and whether local clinics accept the plan for Primary Care vs. Specialty-only.'
      });
    }

    var fourDigitMatches = text.match(/\b(\d{4}[A-Za-z]?)\b/g) || [];
    for (var i = 0; i < fourDigitMatches.length; i += 1) {
      var candidate = fourDigitMatches[i];
      if (candidate !== '2026' && candidate !== '2027' && !medContract) {
        variantCode = candidate.toUpperCase();
        findings.push({
          tone: 'info',
          title: 'Specific 4-Digit Plan Variant (#' + escapeHtml(variantCode) + ') Captured',
          body: 'Entering the 4-digit plan number is critical: two plans with similar brand names can use different provider sub-networks, referral rules, and hospital tiers based on this exact variant ID.'
        });
        break;
      }
    }

    if (/\bbronze\b/.test(lower)) {
      findings.push({
        tone: 'watch',
        title: 'Bronze Deductible & Sub-Network Watchout',
        body: 'Bronze variants carry high medical and prescription deductibles before full plan cost-sharing starts, and HMO variants often require an assigned PCP and referrals. If the Marketplace determines you qualify based on projected 2027 household income, an enhanced Silver Cost-Sharing Reduction tier (73%, 87%, or 94%) in the same ZIP may carry a lower deductible and out-of-pocket limit.'
      });
    } else if (/\bsilver\b/.test(lower)) {
      findings.push({
        tone: 'watch',
        title: 'Silver Cost-Sharing Reduction (CSR) Band Watchout',
        body: 'Standard Silver and enhanced CSR Silver (73% / 87% / 94%) share the same plan name on paper, yet actual deductibles and copays change sharply across narrow 2027 household-income bands.'
      });
    } else if (/\bgold\b/.test(lower) && !/\bgold\s+plus\b/.test(lower)) {
      findings.push({
        tone: 'info',
        title: 'Gold Tier Total-Exposure Check',
        body: 'Gold plans trade higher monthly premiums for a lower base deductible. Compare 12-month total premium plus expected copay exposure against Silver CSR and HSA-compatible options in your ZIP.'
      });
    }

    if (/\bhsa\b/.test(lower)) {
      findings.push({
        tone: 'info',
        title: 'HSA-Compatible Deductible Rule',
        body: 'On HSA-compatible plans, non-preventive prescriptions and specialist visits generally apply toward the combined deductible before copays apply.'
      });
    }

    if (/\b(?:medigap|supplement|plan\s*[gnf])\b/.test(lower)) {
      findings.push({
        tone: 'watch',
        title: 'Medigap Pairing & Underwriting Window Check',
        body: 'Medigap plans work with providers accepting Original Medicare, but do not include 2027 retail drug coverage (pair with a separate 2027 standalone Part D formulary check). Medical underwriting rules can apply outside open-enrollment or guaranteed-issue windows.'
      });
    } else if (!medContract && /\b(?:advantage|ma-pd|mapd|giveback|give-back|d-snp|dsnp|c-snp|csnp)\b/.test(lower)) {
      findings.push({
        tone: 'watch',
        title: '2027 Medicare Advantage Sub-Network & MOOP Check',
        body: 'Match your doctors and hospital facilities to the exact 2027 H-contract and 3-digit segment ID, and compare Maximum Out-of-Pocket exposure alongside any Part B giveback or extra-benefit allowances.'
      });
    }

    if (/\b(?:hmo|epo)\b/.test(lower)) {
      findings.push({
        tone: 'watch',
        title: 'HMO / EPO Gatekeeper & Out-of-Network Rule',
        body: 'Non-emergency care outside the plan sub-network is generally not covered, and HMO contracts typically require an assigned Primary Care Physician and electronic referrals before specialist visits.'
      });
    }

    if (/\b(?:auto[-\s]*renew|current|same\s+plan|keep)\b/.test(lower)) {
      findings.push({
        tone: 'watch',
        title: '2027 Auto-Renewal Drift Check',
        body: 'Letting a 2026 plan roll automatically into 2027 can miss January 1 clinic contract exits, formulary tier shifts, or updated benchmark tax-credit calculations.'
      });
    }

    if (!findings.length) {
      findings.push({
        tone: 'info',
        title: 'Plan Label Recorded for Live 2027 Contract Match',
        body: 'Marketing plan titles often group multiple county segments or metal variants together. David will match "' + escapeHtml(text.slice(0, 60)) + '" to the exact 2027 filing ID in your ZIP code.'
      });
    }

    return { findings: findings, hasConflict: hasConflict, variantCode: variantCode };
  }

  function analyzePharmacy(rawPharm) {
    var text = String(rawPharm || '').trim();
    var lower = text.toLowerCase();
    if (!text) return null;

    if (/\bpublix\b/.test(lower)) {
      return {
        chain: 'Publix',
        code: 'PUB',
        title: 'Publix Pharmacy 2027 Preferred vs. Standard Tier Watch',
        body: 'Across 2027 Florida plan filings, Publix Pharmacy shifts between Preferred Retail, Standard Retail, and out-of-network status depending on the exact plan ID. Filling recurring Tier 2 or Tier 3 medications at a Standard vs. Preferred counter changes your 30-day and 90-day copays.'
      };
    }
    if (/\bcvs\b/.test(lower)) {
      return {
        chain: 'CVS',
        code: 'CVS',
        title: 'CVS Pharmacy 2027 Contract Alignment Watch',
        body: 'Select 2027 plans designate CVS as Preferred Retail while competing carriers place CVS on Standard Retail or exclude it from the pharmacy network. Confirm exact 2027 plan-ID pharmacy tiering.'
      };
    }
    if (/\bwalgreens\b/.test(lower)) {
      return {
        chain: 'Walgreens',
        code: 'WAL',
        title: 'Walgreens 2027 Retail Tier Watch',
        body: 'Walgreens moves between Preferred Retail and Standard or out-of-network status across several 2027 Florida Medicare Part D and Marketplace formularies. Verify both 30-day and 90-day retail status on your exact plan ID.'
      };
    }
    if (/\b(?:walmart|sam'?s)\b/.test(lower)) {
      return {
        chain: 'Walmart',
        code: 'WMT',
        title: 'Walmart Pharmacy 2027 Value-Tier Watch',
        body: 'Walmart often holds Preferred Retail status on select value-focused 2027 plans while pricing as Standard Retail on others. Compare 90-day retail copays against mail-order rules on the exact plan ID.'
      };
    }
    if (/\b(?:costco|winn|mail|express|optum|caremark)\b/.test(lower)) {
      return {
        chain: 'Mail / Specialty',
        code: 'MAIL',
        title: '90-Day Mail & Specialty Pharmacy Watch',
        body: 'Confirm whether 90-day maintenance fills require the carrier designated mail-order vendor and verify 2027 prior-authorization or quantity-limit rules.'
      };
    }
    return {
      chain: 'Selected Pharmacy',
      code: 'RX',
      title: '2027 Pharmacy Network & Tier Check Queued',
      body: 'Retail pharmacies can participate as Preferred Retail, Standard Retail, or out-of-network depending on the exact 2027 plan ID and ZIP code.'
    };
  }

  function computeReadiness(state, planResult, pharmResult) {
    var score = 15;
    if (state.systems.length > 0) score += 25;
    if (state.lane !== 'unsure') score += 5;
    if (state.planText.trim()) score += 17;
    if (state.pharmacyText.trim()) score += 10;
    if (state.priorities.length > 0 || state.doctorNote.trim()) score += 3;
    if (state.checkedSteps.length > 0) score = Math.min(75, score + Math.min(5, state.checkedSteps.length));
    if (score > 75) score = 75;
    var hasEngagement = state.systems.length > 0 || Boolean(state.planText.trim()) || Boolean(state.pharmacyText.trim()) || state.priorities.length > 0;
    return {
      score: hasEngagement ? Math.max(42, score) : 15,
      hasEngagement: hasEngagement,
      hasConflict: Boolean(planResult && planResult.hasConflict),
      pharmChain: pharmResult ? pharmResult.chain : ''
    };
  }

  function buildBriefCode(state, planResult, pharmResult) {
    var parts = ['2027'];
    if (state.systems.length) {
      var sysKey = state.systems[0];
      parts.push(SYSTEMS[sysKey] ? SYSTEMS[sysKey].code : 'FL');
      if (state.systems.length > 1) parts.push('+' + (state.systems.length - 1));
    } else {
      parts.push(state.lane === 'medicare' ? 'MED' : state.lane === 'aca' ? 'ACA' : 'FL');
    }
    if (planResult && planResult.variantCode) {
      parts.push(planResult.variantCode.replace(/[^A-Z0-9-]/g, '').slice(0, 8));
    } else if (pharmResult && pharmResult.code) {
      parts.push(pharmResult.code);
    }
    return parts.join('-');
  }

  function getLakelandDeskStatus() {
    try {
      var fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      });
      var parts = fmt.formatToParts(new Date());
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      var day = map.weekday || '';
      var hr = parseInt(map.hour || '12', 10);
      var min = parseInt(map.minute || '0', 10);
      var mins = hr * 60 + min;
      var isWeekdayOpen = (day === 'Mon' || day === 'Tue' || day === 'Wed' || day === 'Thu' || day === 'Fri') && mins >= 510 && mins <= 1110;
      var isSatOpen = day === 'Sat' && mins >= 570 && mins <= 930;
      if (isWeekdayOpen || isSatOpen) {
        return {
          open: true,
          label: 'Lakeland Desk Window Open · Call now to run the remaining 2027 checks live in ~5 to 10 minutes'
        };
      }
    } catch (e) {}
    return {
      open: false,
      label: 'Priority Callback Queue · Text your Brief Code below or lock in a 15-minute slot on David\'s calendar'
    };
  }

  function buildCallOpener(state, briefCode, pharmResult) {
    var sysNames = state.systems.map(function (k) { return SYSTEMS[k] ? SYSTEMS[k].shortLabel : ''; }).filter(Boolean);
    var sysPart = sysNames.length ? ' for ' + sysNames.slice(0, 2).join(' + ') + (sysNames.length > 2 ? ' (+' + (sysNames.length - 2) + ' more)' : '') : '';
    var planPart = state.planText.trim() ? ' on ' + state.planText.trim().slice(0, 42) : '';
    var pharmPart = pharmResult ? ' with ' + pharmResult.chain : '';
    return '"Hi David, I ran the 2027 pre-check on your site (Brief #' + briefCode + ')' + sysPart + planPart + pharmPart + '. Can we run the live 2027 plan-ID and cost cross-check?"';
  }

  function buildPhiSafeSmsHref(state, briefCode, pharmResult, isPostLead) {
    /* Strictly non-PHI structural routing tags only: never user free-text notes or medications. */
    var laneLabel = state.lane === 'aca' ? 'Under-65 Marketplace' : state.lane === 'medicare' ? 'Medicare' : '2027 Plan Check';
    var sysNames = state.systems.map(function (k) { return SYSTEMS[k] ? SYSTEMS[k].shortLabel : ''; }).filter(Boolean);
    var tags = ['Brief #' + briefCode, laneLabel];
    if (sysNames.length) tags.push(sysNames.slice(0, 2).join(' + '));
    if (pharmResult && pharmResult.chain && pharmResult.chain !== 'Selected Pharmacy') tags.push(pharmResult.chain + ' Pharmacy');
    var intro = isPostLead
      ? 'Hi David, I just submitted my request and built my 2027 pre-check (' + tags.join(' · ') + '). '
      : 'Hi David, I built my 2027 pre-check on your site (' + tags.join(' · ') + '). ';
    var body = intro + 'When you have a few minutes, can we run the live 2027 plan-ID lookup?';
    return 'sms:' + PHONE_E164 + '?body=' + encodeURIComponent(body);
  }

  function buildPendingLiveChecks(state, pharmResult) {
    var items = [];
    if (state.systems.length) {
      var firstKey = state.systems[0];
      items.push({
        tag: 'Pending Live NPI & Tax-ID Lookup',
        text: SYSTEMS[firstKey].pendingCheck + (state.systems.length > 1 ? ' Plus cross-checking facility vs. physician contracts across your ' + state.systems.length + ' selected systems.' : '')
      });
    } else {
      items.push({
        tag: 'Pending Live NPI & Office Street Match',
        text: 'Matching your doctors\' exact practice addresses and hospital admitting facilities to the active 2027 plan sub-network.'
      });
    }

    if (pharmResult) {
      items.push({
        tag: 'Pending 2027 Formulary & ' + pharmResult.chain + ' Tier Pricing',
        text: 'Checking whether ' + pharmResult.chain + ' prices as Preferred vs. Standard Retail on your 2027 contract ID, plus prior-authorization or step-therapy rules.'
      });
    } else {
      items.push({
        tag: 'Pending 2027 Formulary & Pharmacy Counter Tier',
        text: 'Checking 2027 medication tiers, prior authorization, quantity limits, and Preferred vs. Standard retail pharmacy status.'
      });
    }

    if (state.lane === 'aca') {
      items.push({
        tag: 'Pending Side-by-Side 2027 Deductible & Silver CSR Comparison',
        text: 'Comparing whether a competing 2027 Marketplace plan ID or Silver CSR tier in your ZIP keeps the same doctors with lower deductible and out-of-pocket exposure.'
      });
    } else if (state.lane === 'medicare') {
      items.push({
        tag: 'Pending Side-by-Side 2027 County Segment & MOOP Comparison',
        text: 'Comparing competing 2027 Medicare options in your ZIP code for Maximum Out-of-Pocket limits, specialist copays, and prescription costs.'
      });
    } else {
      items.push({
        tag: 'Pending Side-by-Side 2027 Plan & Total-Cost Comparison',
        text: 'Comparing competing 2027 plan IDs in your ZIP code to verify whether another option covers the same providers with lower annual out-of-pocket exposure.'
      });
    }
    return items;
  }

  /* ------------------------------------------------------------------------
   * Surface A: Full Interactive Worksheet on /provider-prescription-check/
   * ------------------------------------------------------------------------ */
  function initFullWorksheet() {
    var root = d.getElementById('interactive-verification-worksheet');
    var chipContainer = d.getElementById('rxCheckSystemChips');
    var statusEl = d.getElementById('rxCheckStatusText');
    if (!root || !chipContainer || !statusEl) return;

    var state = loadState();
    var postLead = getPostLeadContext();

    var chips = Array.prototype.slice.call(chipContainer.querySelectorAll('.rx-chip'));
    var laneBtns = Array.prototype.slice.call(root.querySelectorAll('[data-rx-lane]'));
    var planQuickBtns = Array.prototype.slice.call(root.querySelectorAll('[data-rx-plan-sample]'));
    var pharmQuickBtns = Array.prototype.slice.call(root.querySelectorAll('[data-rx-pharm-sample]'));
    var priorityBtns = Array.prototype.slice.call(root.querySelectorAll('[data-rx-priority]'));
    var cbs = Array.prototype.slice.call(root.querySelectorAll('.rx-step-cb'));

    var postLeadBanner = d.getElementById('rxPostLeadWelcome');
    var watchoutBox = d.getElementById('rxSystemWatchouts');
    var watchoutList = d.getElementById('rxSystemWatchoutList');
    var planInput = d.getElementById('rxCheckPlanId');
    var planDiagBox = d.getElementById('rxPlanDiagnostic');
    var pharmInput = d.getElementById('rxCheckPharmacy');
    var pharmDiagBox = d.getElementById('rxPharmacyDiagnostic');
    var doctorInput = d.getElementById('rxCheckDoctorNote');

    var meterPctEl = d.getElementById('rxReadinessPct');
    var meterFillEl = d.getElementById('rxReadinessFill');
    var meterHeadlineEl = d.getElementById('rxReadinessHeadline');
    var briefBadgeEl = d.getElementById('rxBriefCodeBadge');
    var deskStatusEl = d.getElementById('rxDeskStatusText');
    var deskDotEl = d.getElementById('rxDeskStatusDot');
    var pendingListEl = d.getElementById('rxPendingLiveList');
    var openerTextEl = d.getElementById('rxCallOpenerText');
    var smsBtn = d.getElementById('rxSmsBriefBtn');
    var secondaryActionBtn = d.getElementById('rxSecondaryRouteBtn');
    var copyBtn = d.getElementById('rxCopySummaryBtn');
    var printBtn = d.getElementById('rxPrintWorksheetBtn');

    if (postLeadBanner) {
      postLeadBanner.hidden = !postLead;
    }

    if (planInput && state.planText) planInput.value = state.planText;
    if (pharmInput && state.pharmacyText) pharmInput.value = state.pharmacyText;
    if (doctorInput && state.doctorNote) doctorInput.value = state.doctorNote;

    cbs.forEach(function (cb, idx) {
      cb.checked = state.checkedSteps.indexOf(idx) !== -1;
    });

    function styleTogglePill(btn, active, activeBg, activeBorder) {
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.style.background = active ? (activeBg || '#1B2A4A') : '#F8FAFC';
      btn.style.color = active ? '#FFFFFF' : '#1B2A4A';
      btn.style.borderColor = active ? (activeBorder || '#1B2A4A') : '#CBD5E1';
    }

    function render() {
      var inferredLane = inferLaneFromPlan(state.planText);
      if (inferredLane && state.lane === 'unsure') {
        state.lane = inferredLane;
      }

      laneBtns.forEach(function (btn) {
        var isActive = btn.getAttribute('data-rx-lane') === state.lane;
        styleTogglePill(btn, isActive, '#1E3A8A', '#1E3A8A');
      });

      chips.forEach(function (chip) {
        var key = chip.getAttribute('data-key');
        var label = chip.getAttribute('data-label') || (SYSTEMS[key] && SYSTEMS[key].shortLabel) || '';
        var active = state.systems.indexOf(key) !== -1;
        chip.textContent = (active ? '\u2713 ' : '+ ') + label;
        styleTogglePill(chip, active, '#1B2A4A', '#1B2A4A');
      });

      priorityBtns.forEach(function (btn) {
        var pKey = btn.getAttribute('data-rx-priority');
        var label = btn.getAttribute('data-label') || '';
        var active = state.priorities.indexOf(pKey) !== -1;
        btn.textContent = (active ? '\u2713 ' : '+ ') + label;
        styleTogglePill(btn, active, '#1E40AF', '#1E40AF');
      });

      if (watchoutBox && watchoutList) {
        watchoutList.innerHTML = '';
        state.systems.forEach(function (key) {
          if (SYSTEMS[key]) {
            var li = d.createElement('li');
            li.innerHTML = SYSTEMS[key].html;
            watchoutList.appendChild(li);
          }
        });
        if (state.systems.length >= 2) {
          var multiLi = d.createElement('li');
          multiLi.innerHTML = '<strong>Multi-System Tax-ID Split Alert:</strong> Because you selected ' + state.systems.length + ' systems, one 2027 plan ID can include your clinic physician while treating your preferred hospital or outpatient surgical facility as out of network.';
          watchoutList.appendChild(multiLi);
        }
        watchoutBox.hidden = state.systems.length === 0;
      }

      var planResult = analyzePlan(state.planText, state.lane, state.systems);
      if (planDiagBox) {
        if (!planResult.findings.length) {
          planDiagBox.hidden = true;
          planDiagBox.innerHTML = '';
        } else {
          planDiagBox.hidden = false;
          planDiagBox.style.background = planResult.hasConflict ? '#FEF2F2' : '#FFFBEB';
          planDiagBox.style.borderColor = planResult.hasConflict ? '#FCA5A5' : '#FCD34D';
          planDiagBox.style.borderLeftColor = planResult.hasConflict ? '#DC2626' : '#D97706';
          planDiagBox.innerHTML = planResult.findings.map(function (f) {
            var headColor = f.tone === 'conflict' ? '#991B1B' : '#1B2A4A';
            return '<div style="margin-bottom:0.45rem;"><strong style="color:' + headColor + ';">' + f.title + ':</strong> <span style="color:#1E293B;">' + f.body + '</span></div>';
          }).join('');
        }
      }

      var pharmResult = analyzePharmacy(state.pharmacyText);
      if (pharmDiagBox) {
        if (!pharmResult) {
          pharmDiagBox.hidden = true;
          pharmDiagBox.innerHTML = '';
        } else {
          pharmDiagBox.hidden = false;
          pharmDiagBox.innerHTML = '<strong style="color:#1B2A4A;">' + escapeHtml(pharmResult.title) + ':</strong> <span style="color:#1E293B;">' + escapeHtml(pharmResult.body) + '</span>';
        }
      }

      var readiness = computeReadiness(state, planResult, pharmResult);
      var briefCode = buildBriefCode(state, planResult, pharmResult);
      var desk = getLakelandDeskStatus();

      var checkedCount = state.checkedSteps.length;
      statusEl.textContent = checkedCount + ' of ' + cbs.length + ' self-checks marked' +
        (state.systems.length ? ' · ' + state.systems.length + ' facility system(s) staged' : '') +
        ' · Final 2027 carrier cross-check pending';

      if (meterPctEl) {
        meterPctEl.textContent = readiness.score + '% Pre-Call Prep Ready · 25% Live Carrier Lookup Remaining';
      }
      if (meterFillEl) {
        meterFillEl.style.width = readiness.score + '%';
        meterFillEl.style.background = readiness.hasConflict
          ? 'linear-gradient(90deg, #DC2626 0%, #D97706 100%)'
          : 'linear-gradient(90deg, #2563EB 0%, #D4A843 100%)';
      }
      if (meterHeadlineEl) {
        if (readiness.hasConflict) {
          meterHeadlineEl.textContent = '2027 Network Conflict Flagged: Call David before locking in your 2027 plan';
        } else if (readiness.hasEngagement) {
          meterHeadlineEl.textContent = 'Your 2027 Pre-Call Brief is staged, with 3 contract-level checks queued for David\'s live lookup';
        } else {
          meterHeadlineEl.textContent = 'Tap your clinics, 2027 plan name, or pharmacy above to build your Pre-Call Brief';
        }
      }
      if (briefBadgeEl) {
        briefBadgeEl.textContent = 'Brief #' + briefCode;
      }
      if (deskStatusEl) {
        deskStatusEl.textContent = desk.label;
      }
      if (deskDotEl) {
        deskDotEl.style.background = desk.open ? '#10B981' : '#D4A843';
      }

      if (pendingListEl) {
        var pendingItems = buildPendingLiveChecks(state, pharmResult);
        pendingListEl.innerHTML = pendingItems.map(function (item) {
          return '<li style="margin-bottom:0.45rem;"><strong style="color:#FDE68A;">[' + escapeHtml(item.tag) + ']</strong> <span style="color:rgba(255,255,255,0.92);">' + escapeHtml(item.text) + '</span></li>';
        }).join('');
      }

      if (openerTextEl) {
        openerTextEl.textContent = buildCallOpener(state, briefCode, pharmResult);
      }

      if (smsBtn) {
        smsBtn.setAttribute('href', buildPhiSafeSmsHref(state, briefCode, pharmResult, Boolean(postLead)));
      }

      if (secondaryActionBtn) {
        if (postLead) {
          secondaryActionBtn.setAttribute('href', '/book/');
          secondaryActionBtn.textContent = 'Or Pick Exact 15-Min Calendar Slot';
        } else if (state.lane === 'aca') {
          secondaryActionBtn.setAttribute('href', '/get-help/?intent=provider-check');
          secondaryActionBtn.textContent = 'Or Request Callback Online';
        } else {
          secondaryActionBtn.setAttribute('href', '#lhi-site-lead-form');
          secondaryActionBtn.textContent = 'Or Request Callback Form';
        }
      }

      saveState(state);
    }

    laneBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.lane = btn.getAttribute('data-rx-lane') || 'unsure';
        render();
      });
    });

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var key = chip.getAttribute('data-key');
        if (!key) return;
        var idx = state.systems.indexOf(key);
        if (idx === -1) state.systems.push(key);
        else state.systems.splice(idx, 1);
        render();
      });
    });

    planQuickBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sample = btn.getAttribute('data-rx-plan-sample') || '';
        if (planInput && sample) {
          planInput.value = sample;
          state.planText = sample;
          var nextLane = inferLaneFromPlan(sample);
          if (nextLane) state.lane = nextLane;
          render();
          planInput.focus();
        }
      });
    });

    pharmQuickBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sample = btn.getAttribute('data-rx-pharm-sample') || '';
        if (pharmInput && sample) {
          var current = pharmInput.value.trim();
          var zipMatch = current.match(/\b(\d{5})\b/);
          pharmInput.value = zipMatch ? (sample + ' · ' + zipMatch[1]) : sample;
          state.pharmacyText = pharmInput.value;
          render();
        }
      });
    });

    priorityBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pKey = btn.getAttribute('data-rx-priority');
        if (!pKey) return;
        var idx = state.priorities.indexOf(pKey);
        if (idx === -1) state.priorities.push(pKey);
        else state.priorities.splice(idx, 1);
        render();
      });
    });

    if (planInput) {
      planInput.addEventListener('input', function () {
        state.planText = planInput.value.slice(0, 120);
        var nextLane = inferLaneFromPlan(state.planText);
        if (nextLane) state.lane = nextLane;
        render();
      });
    }

    if (pharmInput) {
      pharmInput.addEventListener('input', function () {
        state.pharmacyText = pharmInput.value.slice(0, 120);
        render();
      });
    }

    if (doctorInput) {
      doctorInput.addEventListener('input', function () {
        state.doctorNote = doctorInput.value.slice(0, 140);
        render();
      });
    }

    cbs.forEach(function (cb, idx) {
      cb.addEventListener('change', function () {
        var next = [];
        cbs.forEach(function (box, boxIdx) {
          if (box.checked) next.push(boxIdx);
        });
        state.checkedSteps = next;
        render();
      });
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var planResult = analyzePlan(state.planText, state.lane, state.systems);
        var pharmResult = analyzePharmacy(state.pharmacyText);
        var briefCode = buildBriefCode(state, planResult, pharmResult);
        var selectedSystems = state.systems.map(function (k) { return SYSTEMS[k] ? SYSTEMS[k].fullLabel : ''; }).filter(Boolean);
        var selectedPriorities = state.priorities.map(function (k) { return PRIORITIES[k] || ''; }).filter(Boolean);
        var laneText = state.lane === 'aca' ? 'Under-65 / ACA Marketplace' : state.lane === 'medicare' ? 'Medicare' : 'Not specified yet';

        var lines = [
          '2027 Provider, Plan-ID & Pharmacy Pre-Call Brief (Lakeland Health Insurance)',
          'Reference Code: Brief #' + briefCode + ' | Date: ' + new Date().toISOString().slice(0, 10),
          'Direct Lakeland Review Desk: David Huff, Licensed FL Health Agent #W371813 · ' + PHONE_DISPLAY,
          '',
          'Coverage Track: ' + laneText,
          '2027 Plan Name / Contract ID: ' + (state.planText.trim() || 'Not entered yet'),
          'Preferred Pharmacy & ZIP: ' + (state.pharmacyText.trim() || 'Not entered yet'),
          'Health Systems Selected: ' + (selectedSystems.length ? selectedSystems.join('; ') : 'None selected'),
          'Specific Doctor / Location Note: ' + (state.doctorNote.trim() || 'None noted'),
          'Priority Review Focus: ' + (selectedPriorities.length ? selectedPriorities.join('; ') : 'General 2027 plan check')
        ];

        if (state.systems.length) {
          lines.push('', '2027 Local Facility Watchouts:');
          state.systems.forEach(function (key) {
            if (SYSTEMS[key]) lines.push('- ' + SYSTEMS[key].text);
          });
        }
        if (planResult.findings.length) {
          lines.push('', '2027 Plan Structure Notes:');
          planResult.findings.forEach(function (f) {
            lines.push('- ' + f.title + ': ' + f.body);
          });
        }
        if (pharmResult) {
          lines.push('', '2027 Pharmacy Tier Note:', '- ' + pharmResult.title + ': ' + pharmResult.body);
        }

        lines.push('', '3 Live Contract Checks to Run on the Phone With David ' + PHONE_DISPLAY + ':');
        buildPendingLiveChecks(state, pharmResult).forEach(function (item) {
          lines.push('[Pending Live Check] ' + item.tag + ' - ' + item.text);
        });

        lines.push('', 'Self-Verification Notes:');
        cbs.forEach(function (cb) {
          lines.push((cb.checked ? '[x] ' : '[ ] ') + cb.value);
        });

        var text = lines.join('\n');
        if (w.navigator && w.navigator.clipboard && w.navigator.clipboard.writeText) {
          w.navigator.clipboard.writeText(text).then(function () {
            copyBtn.textContent = 'Copied Brief to Clipboard';
            w.setTimeout(function () { copyBtn.textContent = 'Copy Verification Summary'; }, 2400);
          });
        }
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', function () {
        w.print();
      });
    }

    render();
  }

  /* ------------------------------------------------------------------------
   * Surface B: Instant Post-Form 30-Second Spot-Check on /thanks.html
   * ------------------------------------------------------------------------ */
  function initThanksSpotCheck() {
    var box = d.getElementById('thanksInteractiveSpotCheck');
    if (!box) return;

    var marker = w.__LHI_THANKS_SUBMISSION;
    var kind = marker && marker.kind ? marker.kind : 'generic';
    var isLead = Boolean(marker && (kind === 'Lead' || !marker.kind));
    if (kind === 'Subscriber') {
      box.hidden = true;
      return;
    }

    if (isLead) {
      var markerIntent = (marker && (marker.normalized_intent || marker.intent || marker.page_type)) || 'generic';
      recordPostLeadContext(markerIntent);
    }

    var state = loadState();
    var sysBtns = Array.prototype.slice.call(box.querySelectorAll('[data-thanks-sys]'));
    var pharmBtns = Array.prototype.slice.call(box.querySelectorAll('[data-thanks-pharm]'));
    var planInput = d.getElementById('thanksSpotPlanInput');
    var planSampleBtns = Array.prototype.slice.call(box.querySelectorAll('[data-thanks-plan-sample]'));

    var revealPanel = d.getElementById('thanksSpotReveal');
    var watchoutList = d.getElementById('thanksSpotWatchouts');
    var pendingList = d.getElementById('thanksSpotPending');
    var meterPct = d.getElementById('thanksSpotPct');
    var meterFill = d.getElementById('thanksSpotFill');
    var briefBadge = d.getElementById('thanksSpotBriefCode');
    var openerEl = d.getElementById('thanksSpotOpener');
    var smsBtn = d.getElementById('thanksSpotSmsBtn');
    var deskEl = d.getElementById('thanksSpotDeskStatus');

    if (planInput && state.planText) {
      planInput.value = state.planText;
    }

    function renderThanks() {
      var nextLane = inferLaneFromPlan(state.planText);
      if (nextLane) state.lane = nextLane;

      sysBtns.forEach(function (btn) {
        var key = btn.getAttribute('data-thanks-sys');
        var label = btn.getAttribute('data-label') || '';
        var active = state.systems.indexOf(key) !== -1;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.textContent = (active ? '\u2713 ' : '+ ') + label;
        btn.classList.toggle('is-active', active);
      });

      pharmBtns.forEach(function (btn) {
        var sample = btn.getAttribute('data-thanks-pharm') || '';
        var active = Boolean(sample && state.pharmacyText.toLowerCase().indexOf(sample.toLowerCase()) !== -1);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.classList.toggle('is-active', active);
      });

      planSampleBtns.forEach(function (btn) {
        var sample = btn.getAttribute('data-thanks-plan-sample') || '';
        var active = Boolean(sample && state.planText.toLowerCase() === sample.toLowerCase());
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.classList.toggle('is-active', active);
      });

      var planResult = analyzePlan(state.planText, state.lane, state.systems);
      var pharmResult = analyzePharmacy(state.pharmacyText);
      var readiness = computeReadiness(state, planResult, pharmResult);
      var briefCode = buildBriefCode(state, planResult, pharmResult);
      var desk = getLakelandDeskStatus();

      if (meterPct) {
        meterPct.textContent = readiness.score + '% Pre-Call Prep Staged · 3 Live Contract Cross-Checks Remaining';
      }
      if (meterFill) {
        meterFill.style.width = readiness.score + '%';
      }
      if (briefBadge) {
        briefBadge.textContent = 'Brief #' + briefCode;
      }
      if (deskEl) {
        deskEl.textContent = desk.label;
      }

      if (revealPanel) {
        revealPanel.hidden = !readiness.hasEngagement;
      }

      if (watchoutList) {
        var alertsHtml = [];
        state.systems.forEach(function (k) {
          if (SYSTEMS[k]) alertsHtml.push('<li>' + SYSTEMS[k].html + '</li>');
        });
        if (state.systems.length >= 2) {
          alertsHtml.push('<li><strong>Multi-System Split Alert:</strong> Selecting multiple health systems requires verifying physician NPIs and hospital facility tax IDs separately on the 2027 contract.</li>');
        }
        planResult.findings.forEach(function (f) {
          var badgeColor = f.tone === 'conflict' ? '#991B1B' : '#1B2A4A';
          alertsHtml.push('<li><strong style="color:' + badgeColor + ';">' + f.title + ':</strong> ' + f.body + '</li>');
        });
        if (pharmResult) {
          alertsHtml.push('<li><strong>' + escapeHtml(pharmResult.title) + ':</strong> ' + escapeHtml(pharmResult.body) + '</li>');
        }
        watchoutList.innerHTML = alertsHtml.join('');
      }

      if (pendingList) {
        pendingList.innerHTML = buildPendingLiveChecks(state, pharmResult).map(function (item) {
          return '<li><strong>[' + escapeHtml(item.tag) + ']</strong> ' + escapeHtml(item.text) + '</li>';
        }).join('');
      }

      if (openerEl) {
        openerEl.textContent = buildCallOpener(state, briefCode, pharmResult);
      }

      if (smsBtn) {
        smsBtn.setAttribute('href', buildPhiSafeSmsHref(state, briefCode, pharmResult, true));
      }

      saveState(state);
    }

    sysBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-thanks-sys');
        if (!key) return;
        var idx = state.systems.indexOf(key);
        if (idx === -1) state.systems.push(key);
        else state.systems.splice(idx, 1);
        renderThanks();
      });
    });

    pharmBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sample = btn.getAttribute('data-thanks-pharm') || '';
        if (!sample) return;
        if (state.pharmacyText.toLowerCase() === sample.toLowerCase()) {
          state.pharmacyText = '';
        } else {
          state.pharmacyText = sample;
        }
        renderThanks();
      });
    });

    planSampleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sample = btn.getAttribute('data-thanks-plan-sample') || '';
        if (!sample) return;
        state.planText = state.planText.toLowerCase() === sample.toLowerCase() ? '' : sample;
        if (planInput) planInput.value = state.planText;
        renderThanks();
      });
    });

    if (planInput) {
      planInput.addEventListener('input', function () {
        state.planText = planInput.value.slice(0, 120);
        renderThanks();
      });
    }

    renderThanks();
  }

  w.LHIPreCallBrief = {
    recordPostLeadContext: recordPostLeadContext,
    getPostLeadContext: getPostLeadContext
  };

  function boot() {
    initFullWorksheet();
    initThanksSpotCheck();
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window, document);
