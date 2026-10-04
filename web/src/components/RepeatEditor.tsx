/* Repeat settings: which days something happens on (daily / weekly / monthly, every N,
   selected weekdays, ends), kept separate from when on those days it can happen. */
import { Field } from '../ui/controls';
import { DAYS, ORD, UNIT, repeatLabel, type RepeatKind, type RuleDraft } from '../domain/repeat';

interface Props {
  kind: RepeatKind;
  rule: RuleDraft;
  anchorDay: () => number; // the first day, for the default weekday
  onChange: (rule: RuleDraft) => void;
}

export function RepeatEditor({ kind, rule, anchorDay, onChange }: Props) {
  const set = (patch: Partial<RuleDraft>) => onChange({ ...rule, ...patch });
  const setEnds = (patch: Partial<RuleDraft['ends']>) => onChange({ ...rule, ends: { ...rule.ends, ...patch } });
  const parts = [
    <Field key="freq" label="Repeat">
      <select id="rp-freq" value={rule.freq} onChange={(e) => {
        const freq = e.target.value as RuleDraft['freq'];
        set({ freq, days: freq !== 'none' && !rule.days.length ? [new Date(anchorDay()).getDay()] : rule.days });
      }}>
        <option value="none">Does not repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
    </Field>,
  ];
  if (rule.freq !== 'none') {
    const [one, many] = UNIT[rule.freq];
    parts.push(
      <div key="every" className="inline">
        <span>Every</span>
        <input type="number" min={1} max={12} defaultValue={rule.every} id="rp-every" aria-label="Repeat every" style={{ maxWidth: '80px' }}
          onChange={(e) => set({ every: Math.max(1, Number(e.target.value) || 1) })} />
        <span className="muted">{rule.every === 1 ? one : many}</span>
      </div>,
    );
    if (kind !== 'assignment' && rule.freq !== 'daily') {
      parts.push(
        <div key="days" className="field">
          <div className="label">On</div>
          <div className="day-picks" role="group" aria-label="Days">
            {DAYS.map(([name, wd]) => {
              const on = rule.days.includes(wd);
              return (
                <button key={wd} type="button" className={'day-pick' + (on ? ' is-on' : '')} aria-pressed={on} onClick={() => {
                  if (on && rule.days.length === 1) return; // keep at least one day
                  set({ days: on ? rule.days.filter((d) => d !== wd) : rule.days.concat(wd) });
                }}>{name}</button>
              );
            })}
          </div>
        </div>,
      );
      if (rule.freq === 'monthly') {
        // The Nth occurrence of each selected day in the month: "the 2nd Tuesday", "the last Friday".
        parts.push(
          <Field key="nth" label="Which one in the month" hint={repeatLabel(rule)}>
            <select id="rp-nth" value={String(rule.nth)} onChange={(e) => set({ nth: Number(e.target.value) })}>
              {ORD.map((o, i) => <option key={o} value={String(i + 1)}>{'The ' + o}</option>)}
              <option value="-1">The last</option>
            </select>
          </Field>,
        );
      }
      if (kind === 'other' && rule.days.length > 1) {
        parts.push(
          <Field key="mode" label="Selected days mean">
            <select id="rp-mode" value={rule.mode} onChange={(e) => set({ mode: e.target.value as RuleDraft['mode'] })}>
              <option value="all">All of them: once on each selected day</option>
              <option value="any">{'Any one of them: once per ' + one + ', on one of these days'}</option>
            </select>
          </Field>,
        );
      }
    }
    if (kind === 'assignment') parts.push(<p key="hint" className="hint">Each repeat moves the whole window (start after to complete by) forward.</p>);
    parts.push(
      <div key="ends" className="grid-2">
        <Field label="Ends">
          <select id="rp-ends" value={rule.ends.type} onChange={(e) => setEnds({ type: e.target.value as RuleDraft['ends']['type'] })}>
            <option value="never">Never</option>
            <option value="on">On a date</option>
            <option value="after">After a number of times</option>
          </select>
        </Field>
        {rule.ends.type === 'on' ? (
          <Field label="End date"><input type="date" id="rp-end-date" value={rule.ends.date} onChange={(e) => setEnds({ date: e.target.value })} /></Field>
        ) : null}
        {rule.ends.type === 'after' ? (
          <Field label="Times"><input type="number" min={1} max={60} id="rp-count" defaultValue={rule.ends.count} onChange={(e) => setEnds({ count: Math.max(1, Number(e.target.value) || 1) })} /></Field>
        ) : null}
      </div>,
    );
  }
  return <div className="repeat stack-sm">{parts}</div>;
}
