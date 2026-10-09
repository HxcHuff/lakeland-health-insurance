/*
 * First-touch lead source capture (session + localStorage, 90-day TTL).
 * Stores Google click IDs (gclid, gbraid, wbraid) for offline conversion relay;
 * never stores fbclid values — click_id_type only for Meta.
 */
(function (w, d) {
  'use strict';

  var STORAGE_KEY = 'lhi_first_touch';
  var TTL_MS = 90 * 86400000;
  var UTM_CAPTURE_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];
  var GOOGLE_CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid'];
  var CLICK_TYPE_ORDER = GOOGLE_CLICK_ID_KEYS.concat(['fbclid']);
  var CLICK_ID_MAX_LENGTH = 512;
  var UTM_VALUE_MAX_LENGTH = 64;
  var UTM_TERM_MAX_LENGTH = 80;

  function approvedCampaignValue(value) {
    var text = String(value || '').trim().toLowerCase();
    if (!text) return null;
    if (/^cid_\d{8,20}$/.test(text)) {
      return text.length <= UTM_VALUE_MAX_LENGTH ? text : text.slice(0, UTM_VALUE_MAX_LENGTH);
    }
    if (/@|(?:\d[\s().-]*){7,}/.test(text)) return null;
    text = text.replace(/[^a-z0-9_-]/g, '').slice(0, UTM_VALUE_MAX_LENGTH);
    return text || null;
  }

  function approvedCampaignTerm(value) {
    var text = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!text || text.length > UTM_TERM_MAX_LENGTH) return null;
    if (/@|(?:\d[\s().-]*){7,}/.test(text)) return null;
    return /^[a-z0-9][a-z0-9 ._~+\-]*$/.test(text) ? text : null;
  }

  function sanitizeUtmKey(key, value) {
    if (key === 'utm_term') return approvedCampaignTerm(value);
    return approvedCampaignValue(value);
  }

  function sanitizeGoogleClickId(value) {
    var text = String(value || '').trim();
    if (!text || text.length > CLICK_ID_MAX_LENGTH) return null;
    return /^[a-z0-9._~-]+$/i.test(text) ? text : null;
  }

  function iso8601WithOffset(date) {
    var d = date || new Date();
    var tzo = -d.getTimezoneOffset();
    var dif = tzo >= 0 ? '+' : '-';
    var pad = function (num) {
      var n = Math.floor(Math.abs(num));
      return (n < 10 ? '0' : '') + n;
    };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T'
      + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
      + dif + pad(tzo / 60) + ':' + pad(tzo % 60);
  }

  function pathnameOnly() {
    try {
      var path = String(w.location && w.location.pathname || '/');
      return path.slice(0, 160) || '/';
    } catch (e) {
      return '/';
    }
  }

  function landingSearch() {
    try {
      return String(w.location && w.location.search || '');
    } catch (e) {
      return '';
    }
  }

  function detectClickIdType(qs) {
    if (!qs || typeof qs.get !== 'function') return 'none';
    for (var i = 0; i < CLICK_TYPE_ORDER.length; i++) {
      var key = CLICK_TYPE_ORDER[i];
      var raw = qs.get(key);
      if (!raw) continue;
      if (key === 'fbclid') {
        if (String(raw).trim()) return 'fbclid';
        continue;
      }
      if (sanitizeGoogleClickId(raw)) return key;
    }
    return 'none';
  }

  function readGoogleClickIdsFromQuery(qs) {
    var out = { hasIncoming: false };
    if (!qs || typeof qs.get !== 'function') return out;
    GOOGLE_CLICK_ID_KEYS.forEach(function (key) {
      var val = sanitizeGoogleClickId(qs.get(key));
      if (val) {
        out[key] = val;
        out.hasIncoming = true;
      }
    });
    return out;
  }

  function hasStoredGoogleClickId(record) {
    if (!record || typeof record !== 'object') return false;
    return GOOGLE_CLICK_ID_KEYS.some(function (key) {
      return Boolean(record[key]);
    });
  }

  function hasAnyUtm(record) {
    return UTM_CAPTURE_KEYS.some(function (key) {
      return Boolean(record && record[key]);
    });
  }

  function googleReferrer(domain) {
    return domain === 'google.com' || /\.google\.com$/.test(domain);
  }

  function facebookReferrer(domain) {
    return domain === 'facebook.com' || domain === 'instagram.com'
      || /\.facebook\.com$/.test(domain) || /\.instagram\.com$/.test(domain);
  }

  function chatgptReferrer(domain) {
    return domain === 'chatgpt.com' || domain === 'openai.com'
      || /\.chatgpt\.com$/.test(domain) || /\.openai\.com$/.test(domain);
  }

  function deriveLeadChannel(record) {
    var data = record || {};
    var clickType = String(data.click_id_type || 'none');
    var source = String(data.utm_source || '').toLowerCase();
    var medium = String(data.utm_medium || '').toLowerCase();
    var ref = String(data.referrer || '').toLowerCase();

    if (clickType === 'gclid' || clickType === 'gbraid' || clickType === 'wbraid') return 'google_ads';
    if ((medium === 'cpc' || medium === 'ppc') && source === 'google') return 'google_ads';

    if (clickType === 'fbclid') return 'facebook';
    if (source === 'facebook' || source === 'instagram' || source === 'fb' || source === 'ig') return 'facebook';
    if (facebookReferrer(ref)) return 'facebook';

    if (source === 'chatgpt' || source === 'openai') return 'chatgpt';
    if (chatgptReferrer(ref)) return 'chatgpt';

    var adSignal = clickType !== 'none' || (medium === 'cpc' || medium === 'ppc') || hasAnyUtm(data);
    if (googleReferrer(ref) && !adSignal) return 'google_organic';

    if (!ref && !hasAnyUtm(data)) return 'direct';
    return 'other';
  }

  function readJsonStorage(storage) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeJsonStorage(storage, record) {
    if (!storage || typeof storage.setItem !== 'function') return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (e) {}
  }

  function isValidRecord(record) {
    if (!record || typeof record !== 'object') return false;
    var expires = Number(record.expires_at);
    return Number.isFinite(expires) && expires > Date.now();
  }

  function applyGoogleClickIdsToRecord(record, incoming, clickTypeFromPage) {
    if (!incoming || !incoming.hasIncoming) return record;
    var out = record;
    GOOGLE_CLICK_ID_KEYS.forEach(function (key) {
      if (incoming[key]) out[key] = incoming[key];
    });
    if (clickTypeFromPage && clickTypeFromPage !== 'none' && clickTypeFromPage !== 'fbclid') {
      out.click_id_type = clickTypeFromPage;
    } else if (incoming.gclid) {
      out.click_id_type = 'gclid';
    } else if (incoming.gbraid) {
      out.click_id_type = 'gbraid';
    } else if (incoming.wbraid) {
      out.click_id_type = 'wbraid';
    }
    out.click_timestamp = iso8601WithOffset(new Date());
    out.expires_at = Date.now() + TTL_MS;
    return out;
  }

  function normalizeRecord(record) {
    var out = {
      expires_at: Number(record.expires_at) || (Date.now() + TTL_MS),
      landing_page: String(record.landing_page || '/').slice(0, 160) || '/',
      referrer: String(record.referrer || '').slice(0, 120),
      click_id_type: 'none'
    };
    UTM_CAPTURE_KEYS.forEach(function (key) {
      var val = sanitizeUtmKey(key, record[key]);
      if (val) out[key] = val;
    });
    GOOGLE_CLICK_ID_KEYS.forEach(function (key) {
      var clickVal = sanitizeGoogleClickId(record[key]);
      if (clickVal) out[key] = clickVal;
    });
    var clickType = String(record.click_id_type || 'none');
    if (CLICK_TYPE_ORDER.indexOf(clickType) !== -1) out.click_id_type = clickType;
    var ts = String(record.click_timestamp || '').trim();
    if (ts && Number.isFinite(Date.parse(ts))) out.click_timestamp = ts.slice(0, 40);
    out.lead_channel = deriveLeadChannel(out);
    return out;
  }

  function captureFromCurrentPage() {
    var qs = new URLSearchParams(landingSearch());
    var incoming = readGoogleClickIdsFromQuery(qs);
    var clickType = detectClickIdType(qs);
    var record = {
      expires_at: Date.now() + TTL_MS,
      landing_page: pathnameOnly(),
      referrer: referrerDomain(d.referrer),
      click_id_type: clickType
    };
    UTM_CAPTURE_KEYS.forEach(function (key) {
      var val = sanitizeUtmKey(key, qs.get(key));
      if (val) record[key] = val;
    });
    applyGoogleClickIdsToRecord(record, incoming, clickType);
    return normalizeRecord(record);
  }

  function referrerDomain(referrer) {
    var raw = String(referrer || '').trim();
    if (!raw) return '';
    try {
      var host = new URL(raw).hostname.toLowerCase();
      if (host.indexOf('www.') === 0) host = host.slice(4);
      return /^[a-z0-9.-]+$/.test(host) ? host.slice(0, 120) : '';
    } catch (e) {
      return '';
    }
  }

  function mergeIncomingGoogleClicks(existing) {
    var qs = new URLSearchParams(landingSearch());
    var incoming = readGoogleClickIdsFromQuery(qs);
    if (!incoming.hasIncoming) return existing;
    var clickType = detectClickIdType(qs);
    return normalizeRecord(applyGoogleClickIdsToRecord(Object.assign({}, existing), incoming, clickType));
  }

  function captureIfNeeded() {
    var qs = new URLSearchParams(landingSearch());
    var local = readJsonStorage(w.localStorage);
    if (isValidRecord(local)) {
      var normalized = normalizeRecord(local);
      var refreshed = mergeIncomingGoogleClicks(normalized);
      writeJsonStorage(w.localStorage, refreshed);
      writeJsonStorage(w.sessionStorage, refreshed);
      return refreshed;
    }
    var fresh = captureFromCurrentPage();
    writeJsonStorage(w.localStorage, fresh);
    writeJsonStorage(w.sessionStorage, fresh);
    return fresh;
  }

  function getFirstTouch() {
    var session = readJsonStorage(w.sessionStorage);
    if (isValidRecord(session)) {
      return mergeIncomingGoogleClicks(normalizeRecord(session));
    }
    return captureIfNeeded();
  }

  function formHasVisibleLeadSource(form) {
    if (!form || !form.elements) return false;
    var field = form.elements.lead_source;
    if (!field || field.type === 'hidden') return false;
    return true;
  }

  function applyToForm(form) {
    if (!form || typeof form !== 'object') return;
    var touch = getFirstTouch();
    var map = {
      lead_medium: touch.utm_medium || '',
      lead_campaign: touch.utm_campaign || '',
      landing_page: touch.landing_page || '',
      referrer: touch.referrer || '',
      click_id_type: touch.click_id_type || 'none',
      lead_channel: touch.lead_channel || deriveLeadChannel(touch),
      gclid: touch.gclid || '',
      gbraid: touch.gbraid || '',
      wbraid: touch.wbraid || '',
      click_timestamp: touch.click_timestamp || ''
    };
    if (!formHasVisibleLeadSource(form)) {
      map.lead_source = touch.utm_source || '';
    }
    Object.keys(map).forEach(function (name) {
      var input = form.elements && form.elements[name];
      if (!input && typeof form.querySelector === 'function') {
        input = form.querySelector('input[name="' + name + '"]');
      }
      if (input) input.value = map[name];
    });
  }

  w.LHILeadFirstTouch = {
    captureIfNeeded: captureIfNeeded,
    getFirstTouch: getFirstTouch,
    applyToForm: applyToForm,
    deriveLeadChannel: deriveLeadChannel,
    detectClickIdType: detectClickIdType,
    referrerDomain: referrerDomain,
    approvedCampaignValue: approvedCampaignValue,
    approvedCampaignTerm: approvedCampaignTerm,
    sanitizeGoogleClickId: sanitizeGoogleClickId,
    iso8601WithOffset: iso8601WithOffset,
    STORAGE_KEY: STORAGE_KEY,
    TTL_MS: TTL_MS
  };

  if (w.__LHI_TEST === true) {
    w.LHILeadFirstTouch._t = {
      normalizeRecord: normalizeRecord,
      captureFromCurrentPage: captureFromCurrentPage,
      isValidRecord: isValidRecord,
      hasAnyUtm: hasAnyUtm,
      mergeIncomingGoogleClicks: mergeIncomingGoogleClicks,
      readGoogleClickIdsFromQuery: readGoogleClickIdsFromQuery,
      hasStoredGoogleClickId: hasStoredGoogleClickId
    };
  }

  captureIfNeeded();
})(window, document);
