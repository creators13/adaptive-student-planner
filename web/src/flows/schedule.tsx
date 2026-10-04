/* Flow 1, the back half: run the fit check for tasks, and when something does not fit,
   ask the student whether to relax a preference (and for how long) or accept a partial
   or unscheduled result. Every path ends with each task scheduled, partially scheduled,
   or unscheduled. Also the overlap check that runs after the student's own changes. */
import { useState } from 'react';
import * as U from '../domain/util';
import * as E from '../domain/engine';
import type { Block, OverrideDraft, Task } from '../domain/types';
import { store } from '../state/store';
import { Button, Field } from '../ui/controls';
import { Modal, openDialog } from '../ui/dialog';
import { toast } from '../ui/toast';

const pad2 = (n: number) => String(n).padStart(2, '0');
const S = () => store.state;

type RelaxChoice = { action: 'relax'; override: OverrideDraft } | { action: 'keep' };

function DoesntFit({ taskId, result, done }: { taskId: string; result: E.FitResult; done: (c: RelaxChoice) => void }) {
  const s = S();
  const task = E.task(s, taskId)!;
  const cur = E.prefsFor(s, task, s.now);
  const deadline = E.deadlineFor(s, task);
  const hasBuffer = task.type === 'assignment' && cur.bufferDays > 0;
  const [workEnd, setWorkEnd] = useState(cur.workEnd);
  const [buffer, setBuffer] = useState(cur.bufferDays);
  const [scope, setScope] = useState<OverrideDraft['scope']>('task');
  const needMin = result.needMin || 0;
  const placedMin = result.placedMin || 0;

  // Later cut-offs, an hour at a time, up to a full 24-hour day (it can cross midnight).
  const startMin = Number(cur.workStart.split(':')[0]) * 60 + Number(cur.workStart.split(':')[1] || 0);
  const curSpan = E.spanMin(cur.workStart, cur.workEnd);
  const endOptions = [{ value: cur.workEnd, label: U.clockLabel(cur.workEnd) + (startMin + curSpan > 1440 ? ' (next day)' : '') + ' (current)' }];
  for (let span = (Math.floor(curSpan / 60) + 1) * 60; span <= 1440; span += 60) {
    const m = (startMin + span) % 1440;
    const v = pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
    endOptions.push({ value: v, label: span === 1440 ? 'All 24 hours' : U.clockLabel(v) + (startMin + span >= 1440 ? ' (next day)' : '') });
  }

  const draft: OverrideDraft = { scope, taskId: task.id };
  if (workEnd !== cur.workEnd) draft.workEnd = workEnd;
  if (hasBuffer && buffer !== cur.bufferDays) draft.bufferDays = buffer;
  const changed = draft.workEnd != null || draft.bufferDays != null;
  const preview = changed ? store.preview((st) => E.previewFit(st, taskId, draft, needMin)) : null;

  const partial = task.canSplit && placedMin > 0;
  return (
    <Modal
      eyebrow="Does not fit"
      title="This doesn’t fit your preferences"
      subtitle={'“' + task.title + '” needs ' + U.fmtDur(needMin) + (task.completeBy ? ' before ' + U.fmtDay(deadline) : '') + '. ' +
        (placedMin > 0 ? U.fmtDur(placedMin) + ' fits' : 'None of it fits') + ' inside your work hours' + (task.canSplit ? '' : ' as one block') + ', breaks' + (hasBuffer ? ', and deadline buffer' : '') + '.'}
      size="md"
      actions={[
        <Button key="keep" onClick={() => done({ action: 'keep' })}>{partial ? 'Schedule what fits (' + U.fmtDur(placedMin) + ')' : 'Leave unscheduled'}</Button>,
        <Button key="apply" kind="primary" disabled={!changed} onClick={() => done({ action: 'relax', override: draft })}>Apply and schedule</Button>,
      ]}
    >
      <div className="stack">
        <p className="muted">Your anchored events and work that is already scheduled stay where they are. To make room, loosen a preference:</p>
        <Field label="Work until">
          <select id="rx-end" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)}>
            {endOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        {hasBuffer ? (
          <Field label="Finish before the deadline by">
            <select id="rx-buf" value={String(buffer)} onChange={(e) => setBuffer(Number(e.target.value))}>
              {Array.from({ length: cur.bufferDays + 1 }, (_, i) => cur.bufferDays - i).map((d) => (
                <option key={d} value={String(d)}>{(d === 0 ? 'No buffer' : U.plural(d, 'day') + ' before') + (d === cur.bufferDays ? ' (current)' : '')}</option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Apply this change for">
          <select id="rx-scope" value={scope} onChange={(e) => setScope(e.target.value as OverrideDraft['scope'])}>
            <option value="task">Just for this task</option>
            <option value="week">This week</option>
            <option value="fortnight">The next two weeks</option>
            <option value="always">Until I change it in Settings</option>
          </select>
        </Field>
        <div className={'preview' + (preview ? (preview.fits ? ' is-ok' : ' is-warn') : '')} aria-live="polite">
          {!preview ? 'Change at least one setting to see whether it fits.'
            : preview.fits ? 'With these settings it fits.'
              : 'Still ' + U.fmtDur(preview.shortfallMin) + ' short with these settings. You can apply them anyway and loosen more.'}
        </div>
      </div>
    </Modal>
  );
}

// Closing the does-not-fit pop-up counts as keeping the preferences.
async function doesntFitDialog(taskId: string, result: E.FitResult): Promise<RelaxChoice> {
  const r = await openDialog<RelaxChoice>((done) => <DoesntFit taskId={taskId} result={result} done={done} />);
  return r === 'dismissed' ? { action: 'keep' } : r;
}

// Fit check for one task. Loops through the dialog until it fits or the student keeps their preferences.
export async function ensureScheduled(taskId: string, opts: { quiet?: boolean } = {}) {
  const run = (partial: boolean) => store.commit((s) => E.reconcile(s, E.task(s, taskId)!, { allowPartial: partial }));
  let res = run(!!opts.quiet);
  while (res.status === 'nofit') {
    const choice = await doesntFitDialog(taskId, res);
    if (choice.action === 'relax') {
      store.commit((s) => E.addOverride(s, choice.override));
      res = run(false);
    } else {
      res = run(true);
    }
  }
  return res;
}

export interface Settled { task: Task; res: E.FitResult }

// Fit check for several tasks, most urgent first.
export async function settle(taskIds: string[], opts: { quiet?: boolean } = {}): Promise<Settled[]> {
  const ids = E.byUrgency(S(), [...new Set(taskIds)]).filter((id) => E.task(S(), id)!.status === 'active');
  const out: Settled[] = [];
  for (const id of ids) {
    const res = await ensureScheduled(id, opts);
    out.push({ task: E.task(S(), id)!, res });
  }
  return out;
}

// One toast summarising what happened. Repeats of the same series collapse into one line.
export function report(results: Settled[], opts: { prefix?: string } = {}) {
  if (!results.length) return;
  const groups = new Map<string, Settled[]>();
  for (const r of results) {
    const k = r.task.seriesId || r.task.id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const lines: string[] = [];
  let tone: 'ok' | 'warn' = 'ok';
  const movedNames = new Set<string>();
  for (const list of groups.values()) {
    const t = list[0].task;
    const name = '“' + t.title + '”' + (list.length > 1 ? ' (' + list.length + ' times)' : '');
    const bad = list.filter((x) => x.res.status === 'unscheduled');
    const part = list.filter((x) => x.res.status === 'partial');
    list.forEach((x) => (x.res.moved || []).forEach((m) => movedNames.add(m.title)));
    if (bad.length) { tone = 'warn'; lines.push(name + ' could not be scheduled. It stays on your to-do list.'); }
    else if (part.length) { tone = 'warn'; lines.push(name + ' is partly scheduled. ' + U.fmtDur(part.reduce((n, x) => n + x.res.shortfallMin, 0)) + ' still needs a slot.'); }
    else lines.push(name + ' scheduled.');
  }
  if (movedNames.size) lines.push('Moved later to make room: ' + [...movedNames].join(', ') + '.');
  toast((opts.prefix ? opts.prefix.trim() + ' ' : '') + lines.join(' '), {
    tone, ms: 9000,
    action: location.hash.indexOf('plan') < 0 ? { label: 'View plan', onClick: () => { location.hash = '#/plan'; } } : null,
  });
}

/* ---------- overlaps the student creates ----------
   Whenever the student's own action (adding, dragging, or moving an event) makes it
   overlap something, ask: move the existing event, or keep the overlap? An anchored event
   opens its edit pop-up (this event or all its repeats); a floating session is taken
   off and re-placed by the fit check. Classes are overlapped silently. */

const when = (b: Block) => U.fmtDay(b.start) + ', ' + U.fmtRange(b.start, b.end);

// Closing the overlap pop-up counts as keeping the overlap.
async function overlapPrompt(mine: Block, other: Block): Promise<'move' | 'keep'> {
  const r = await openDialog<'move' | 'keep'>((done) => (
    <Modal eyebrow="Overlap" title={'“' + mine.title + '” overlaps “' + other.title + '”'} size="sm"
      subtitle={'“' + other.title + '” is ' + when(other) + (E.isFloating(other) ? '. Inflow can find it another time.' : '. You can pick it a new time.')}
      actions={[
        <Button key="keep" onClick={() => done('keep')}>Keep the overlap</Button>,
        <Button key="move" kind="primary" onClick={() => done('move')}>{'Move “' + other.title + '”'}</Button>,
      ]} />
  ));
  return r === 'move' ? 'move' : 'keep';
}

function EditBlock({ b, eyebrow, done }: { b: Block; eyebrow?: string; done: (ids: string[] | null) => void }) {
  const [date, setDate] = useState(U.toInputDate(b.start));
  const [start, setStart] = useState(U.clockOf(b.start));
  const [end, setEnd] = useState(U.clockOf(b.end));
  const [scope, setScope] = useState<'this' | 'all'>('this');
  const [err, setErr] = useState('');
  const save = () => {
    const day = U.fromInputDate(date);
    if (Number.isNaN(day) || !start || !end) { setErr('Choose a date and times.'); return; }
    const s0 = U.atClock(day, start);
    const e0 = U.atClock(day, end);
    if (e0 <= s0) { setErr('The end time must be after the start time.'); return; }
    done(store.commit((s) => E.editBlockTime(s, b.id, s0, e0, b.seriesId ? scope : 'this')));
  };
  return (
    <Modal eyebrow={eyebrow || 'Edit event'} title={b.title} subtitle={'Now ' + when(b)} size="md" actions={[
      <Button key="cancel" onClick={() => done(null)}>Cancel</Button>,
      <Button key="save" kind="primary" id="ed-save" onClick={save}>Save</Button>,
    ]}>
      <div className="stack">
        <div className="grid-3">
          <Field label="Date"><input type="date" id="ed-date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Starts"><input type="time" id="ed-start" step={60} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Ends"><input type="time" id="ed-end" step={60} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        {b.seriesId ? (
          <Field label="Apply to" hint="“All events” changes every repeat that has not happened yet, by the same amount.">
            <select id="ed-scope" value={scope} onChange={(e) => setScope(e.target.value as 'this' | 'all')}>
              <option value="this">This event</option>
              <option value="all">All events in the series</option>
            </select>
          </Field>
        ) : null}
        <div className="form-error" role="alert">{err}</div>
      </div>
    </Modal>
  );
}

// Edit pop-up for an anchored block. Resolves the ids of the blocks that changed, or null.
export async function editBlock(blockId: string, opts: { eyebrow?: string } = {}) {
  const b = E.block(S(), blockId);
  if (!b) return null;
  const r = await openDialog<string[] | null>((done) => <EditBlock b={b} eyebrow={opts.eyebrow} done={done} />);
  return r === 'dismissed' ? null : r;
}

export async function resolveOverlaps(blockIds: string[]) {
  const asked = new Set<string>();
  const queue = blockIds.slice();
  while (queue.length) {
    const id = queue.shift()!;
    for (const other of E.overlapsOf(S(), id)) {
      const key = [id, other.id].sort().join('|');
      if (asked.has(key)) continue;
      asked.add(key);
      const mine = E.block(S(), id);
      const live = E.block(S(), other.id);
      if (!mine || !live || !(live.start < mine.end && live.end > mine.start)) continue; // already moved
      if ((await overlapPrompt(mine, live)) !== 'move') continue;
      if (E.isFloating(live)) {
        const taskId = store.commit((s) => E.unplaceSession(s, live.id));
        if (taskId) report(await settle([taskId]), { prefix: 'Moved “' + live.title + '”.' });
      } else {
        const changed = await editBlock(live.id, { eyebrow: 'Move the existing event' });
        if (changed) queue.push(...changed); // the edited event is checked for overlaps too
      }
    }
  }
}
