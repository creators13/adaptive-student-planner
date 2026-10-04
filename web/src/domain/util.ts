/* Date, time, and formatting helpers. Timestamps are milliseconds since the epoch;
   "days" are local calendar days. Durations are integer minutes. */

export const MIN = 60000;
export const HOUR = 3600000;
export const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');

export const startOfDay = (ts: number) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addDays = (ts: number, n: number) => { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); };
export const endOfDay = (ts: number) => addDays(startOfDay(ts), 1) - 1;
// Weeks start on Monday.
export const startOfWeek = (ts: number) => {
  const s = startOfDay(ts);
  return addDays(s, -((new Date(s).getDay() + 6) % 7));
};
// "HH:MM" on a given day. "24:00" means midnight at the end of that day.
export const atClock = (day: number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m || 0, 0, 0);
  return d.getTime();
};
export const clockOf = (ts: number) => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
export const minutesOfDay = (ts: number) => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
export const roundUp = (ts: number, step: number) => Math.ceil(ts / (step * MIN)) * step * MIN;
export const roundTo = (ts: number, step: number) => Math.round(ts / (step * MIN)) * step * MIN;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const uid = (prefix: string) => prefix + '_' + Math.random().toString(36).slice(2, 9);
export const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);

const fmt = (ts: number, opts: Intl.DateTimeFormatOptions) => new Date(ts).toLocaleString('en-US', opts);
export const fmtTime = (ts: number) => fmt(ts, { hour: 'numeric', minute: '2-digit' });
export const fmtRange = (a: number, b: number) => fmtTime(a) + '–' + fmtTime(b);
export const fmtDay = (ts: number) => fmt(ts, { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtDate = (ts: number) => fmt(ts, { month: 'short', day: 'numeric' });
export const fmtDur = (minutes: number) => {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h && r ? h + 'h ' + r + 'm' : h ? h + 'h' : r + 'm';
};
// "09:00" -> "9 AM", "20:30" -> "8:30 PM", "24:00" -> "12 AM"
export const clockLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const hh = h % 24;
  const ap = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return m ? h12 + ':' + pad(m) + ' ' + ap : h12 + ' ' + ap;
};
export const toInputDate = (ts: number) => {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};
export const fromInputDate = (s: string) => {
  if (!s) return NaN;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};
export const plural = (n: number, one: string, many?: string) => n + ' ' + (n === 1 ? one : many || one + 's');
