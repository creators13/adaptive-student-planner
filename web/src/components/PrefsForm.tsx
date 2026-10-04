/* The preference form, shared by first-run setup and Settings.
   PLACEHOLDER: which preferences to collect, and their defaults, are for the team to refine. */
import * as U from '../domain/util';
import * as E from '../domain/engine';
import type { Energy, Prefs } from '../domain/types';
import { Field } from '../ui/controls';

const ENERGY: [Energy, string, string][] = [['morning', 'Morning', '9 AM–12 PM'], ['afternoon', 'Afternoon', '12–5 PM'], ['evening', 'Evening', '5–9 PM']];
const pad2 = (n: number) => String(n).padStart(2, '0');
const hhmm = (m: number) => pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
const startMinOf = (s: string) => Number(s.split(':')[0]) * 60 + Number(s.split(':')[1] || 0);
// Normalize "24:00" (older data) to "00:00"; work hours wrap past midnight anyway.
const norm = (v: string) => (v === '24:00' ? '00:00' : v);

// "No work after" choices: every hour after the start, up to a full 24 hours.
function endChoices(start: string) {
  const sMin = startMinOf(start);
  const out: { value: string; label: string }[] = [];
  for (let k = 1; k <= 24; k++) {
    const v = hhmm((sMin + k * 60) % 1440);
    out.push({ value: v, label: k === 24 ? 'Same time next day (all 24 hours)' : U.clockLabel(v) + (sMin + k * 60 >= 1440 ? ' (next day)' : '') });
  }
  return out;
}

// Keep the value only if it is one of the choices; otherwise the 10th hour after the start.
const validEnd = (start: string, end: string) => {
  const choices = endChoices(start);
  return choices.some((c) => c.value === norm(end)) ? norm(end) : choices[Math.min(10, choices.length - 1)].value;
};

// The values the form would save: a shortest session above the preferred one is lowered
// to match, and a longest below it is raised.
export const cleanPrefs = (p: Prefs): Prefs => ({
  ...p,
  workEnd: validEnd(p.workStart, p.workEnd),
  minSession: Math.min(p.minSession, p.sessionMin),
  maxSession: Math.max(p.maxSession, p.sessionMin),
});

export function PrefsForm({ value: p, onChange }: { value: Prefs; onChange: (p: Prefs) => void }) {
  const set = (patch: Partial<Prefs>) => onChange({ ...p, ...patch });
  const end = validEnd(p.workStart, p.workEnd);
  const select = (id: string, label: string, options: number[], key: 'sessionMin' | 'minSession' | 'maxSession' | 'breakMin' | 'bufferDays', fmt: (n: number) => string) => (
    <Field label={label}>
      <select id={id} value={String(p[key])} onChange={(e) => set({ [key]: Number(e.target.value) })}>
        {options.map((o) => <option key={o} value={String(o)}>{fmt(o)}</option>)}
      </select>
    </Field>
  );
  const mins = (m: number) => m + ' minutes';
  return (
    <div className="stack">
      <div className="grid-2">
        <Field label="Available from">
          <select id="pf-start" value={p.workStart} onChange={(e) => {
            // Keep the same length of day when the start moves.
            const span = E.spanMin(p.workStart, end);
            set({ workStart: e.target.value, workEnd: hhmm((startMinOf(e.target.value) + span) % 1440) });
          }}>
            {Array.from({ length: 24 }, (_, i) => pad2(i) + ':00').map((o) => <option key={o} value={o}>{U.clockLabel(o)}</option>)}
          </select>
        </Field>
        <Field label="No work after" hint="Can run past midnight, up to all 24 hours. The planner never schedules past this unless you relax it.">
          <select id="pf-end" value={end} onChange={(e) => set({ workEnd: e.target.value })}>
            {endChoices(p.workStart).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid-3">
        {select('pf-session', 'Preferred session length', [25, 30, 45, 50, 60, 90], 'sessionMin', mins)}
        {select('pf-min', 'Shortest session', [15, 20, 30, 45], 'minSession', mins)}
        {select('pf-max', 'Longest session', [60, 90, 120, 180], 'maxSession', mins)}
      </div>
      <div className="grid-2">
        {select('pf-brk', 'Break after each session', [0, 5, 10, 15, 20], 'breakMin', (m) => (m ? m + ' minutes' : 'No break'))}
        {select('pf-buf', 'Finish assignments before the deadline by', [0, 1, 2, 3], 'bufferDays', (d) => (d ? U.plural(d, 'day') : 'No buffer'))}
      </div>
      <div className="field">
        <div className="label">When is your energy highest?</div>
        <div className="choices">
          {ENERGY.map(([k, label, sub]) => (
            <button key={k} type="button" className={'choice' + (p.energy === k ? ' is-on' : '')} aria-pressed={p.energy === k} onClick={() => set({ energy: k })}>
              <strong>{label}</strong><span className="muted">{sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
