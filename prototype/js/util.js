/* Date, time, and formatting helpers. Timestamps are milliseconds since the epoch;
   "days" are local calendar days. Durations are integer minutes. */
(function (root) {
  'use strict';
  const PF = (root.PF = root.PF || {});
  const MIN = 60000;
  const HOUR = 3600000;
  const DAY = 86400000;
  const pad = (n) => String(n).padStart(2, '0');
  const U = (PF.util = { MIN, HOUR, DAY });

  U.startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  U.addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); };
  U.endOfDay = (ts) => U.addDays(U.startOfDay(ts), 1) - 1;
  // Weeks start on Monday.
  U.startOfWeek = (ts) => {
    const s = U.startOfDay(ts);
    return U.addDays(s, -((new Date(s).getDay() + 6) % 7));
  };
  // "HH:MM" on a given day. "24:00" means midnight at the end of that day.
  U.atClock = (day, hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(day);
    d.setHours(h, m || 0, 0, 0);
    return d.getTime();
  };
  U.clockOf = (ts) => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  U.minutesOfDay = (ts) => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
  U.roundUp = (ts, step) => Math.ceil(ts / (step * MIN)) * step * MIN;
  U.roundTo = (ts, step) => Math.round(ts / (step * MIN)) * step * MIN;
  U.clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  U.uid = (prefix) => prefix + '_' + Math.random().toString(36).slice(2, 9);
  U.sameDay = (a, b) => U.startOfDay(a) === U.startOfDay(b);

  const fmt = (ts, opts) => new Date(ts).toLocaleString('en-US', opts);
  U.fmtTime = (ts) => fmt(ts, { hour: 'numeric', minute: '2-digit' });
  U.fmtRange = (a, b) => U.fmtTime(a) + '–' + U.fmtTime(b);
  U.fmtDay = (ts) => fmt(ts, { weekday: 'short', month: 'short', day: 'numeric' });
  U.fmtDate = (ts) => fmt(ts, { month: 'short', day: 'numeric' });
  U.fmtDur = (m) => {
    m = Math.round(m);
    const h = Math.floor(m / 60);
    const r = m % 60;
    return h && r ? h + 'h ' + r + 'm' : h ? h + 'h' : r + 'm';
  };
  // "09:00" -> "9 AM", "20:30" -> "8:30 PM", "24:00" -> "12 AM"
  U.clockLabel = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    const hh = h % 24;
    const ap = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return m ? h12 + ':' + pad(m) + ' ' + ap : h12 + ' ' + ap;
  };
  U.toInputDate = (ts) => {
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  U.fromInputDate = (s) => {
    if (!s) return NaN;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  U.plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
})(typeof window !== 'undefined' ? window : globalThis);
