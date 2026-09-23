/* Medicare Annual Enrollment Period countdown.
 * AEP is October 15 through December 7 (Eastern) each year.
 * Before the window: days until open.
 * During the window: days remaining through December 7.
 * After close (December 8–31): closed state. January 1 starts the next countdown.
 */
(function (root) {
  var EASTERN = 'America/New_York';

  function easternParts(date) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: EASTERN,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    var out = {};
    for (var i = 0; i < parts.length; i += 1) {
      if (parts[i].type !== 'literal') out[parts[i].type] = parts[i].value;
    }
    return {
      year: Number(out.year),
      month: Number(out.month),
      day: Number(out.day)
    };
  }

  function ymdKey(parts) {
    return parts.year * 10000 + parts.month * 100 + parts.day;
  }

  function daysBetween(fromParts, toParts) {
    var from = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
    var to = Date.UTC(toParts.year, toParts.month - 1, toParts.day);
    return Math.round((to - from) / 86400000);
  }

  function daysPhrase(count) {
    if (count === 1) return '1 day';
    return count + ' days';
  }

  function computeAepCountdown(now) {
    var today = easternParts(now || new Date());
    var start = { year: today.year, month: 10, day: 15 };
    var end = { year: today.year, month: 12, day: 7 };
    var todayKey = ymdKey(today);
    var startKey = ymdKey(start);
    var endKey = ymdKey(end);

    if (todayKey < startKey) {
      var untilOpen = daysBetween(today, start);
      return {
        phase: 'before',
        days: untilOpen,
        label: 'AEP opens in',
        number: daysPhrase(untilOpen),
        note: 'Review early so your doctors and prescriptions are verified before October 15.'
      };
    }

    if (todayKey <= endKey) {
      var remaining = daysBetween(today, end);
      if (remaining === 0) {
        return {
          phase: 'open',
          days: 0,
          label: 'AEP closes',
          number: 'Today',
          note: 'Plan changes for January 1 generally need to be submitted by December 7.'
        };
      }
      return {
        phase: 'open',
        days: remaining,
        label: 'AEP closes in',
        number: daysPhrase(remaining),
        note: 'Plan changes for January 1 generally need to be submitted by December 7.'
      };
    }

    return {
      phase: 'closed',
      days: null,
      label: 'AEP has closed',
      number: 'Next steps',
      note: 'If you are on Medicare Advantage, January 1 through March 31 may allow one additional change.'
    };
  }

  function renderAepCountdown(doc, now) {
    var documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (!documentRef) return null;
    var label = documentRef.getElementById('countdownLabel');
    var number = documentRef.getElementById('countdownNumber');
    var note = documentRef.getElementById('countdownNote');
    if (!label || !number || !note) return null;
    var state = computeAepCountdown(now);
    label.textContent = state.label;
    number.textContent = state.number;
    note.textContent = state.note;
    return state;
  }

  var api = {
    computeAepCountdown: computeAepCountdown,
    renderAepCountdown: renderAepCountdown
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.LHIAepCountdown = api;
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          renderAepCountdown(document);
        });
      } else {
        renderAepCountdown(document);
      }
    }
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
