/* Tasks: the to-do list. Every floating task with its status, estimate, milestones and
   sessions. "Log progress" is how a student reports work done outside a planned session. */
import { useEffect, useState } from 'react';
import * as U from '../domain/util';
import * as E from '../domain/engine';
import type { State, Task } from '../domain/types';
import { repeatLabel } from '../domain/repeat';
import { store, useAppState } from '../state/store';
import { Button } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { confirmDialog } from '../ui/dialog';
import { addTask } from '../flows/addTask';
import { report, settle } from '../flows/schedule';
import { logProgress, markOtherDone } from '../flows/feedback';

// Kept between visits to the page.
const kept = { q: '', course: '', sort: 'deadline', expanded: new Set<string>(), showDone: false };

function status(t: Task): ['bad' | 'warn' | 'info' | 'ok', string] {
  if (t.sched === 'unscheduled') return ['bad', 'Unscheduled'];
  if (t.sched === 'partial') return ['warn', 'Partly scheduled'];
  if (t.loggedMin > 0 || t.milestones.some((m) => m.done)) return ['info', 'In progress'];
  return ['ok', 'Scheduled'];
}

const sessionsOf = (s: State, t: Task) => s.blocks.filter((b) => b.taskId === t.id && b.kind === 'session' && b.state === 'planned').sort((a, b) => a.start - b.start);
const fix = (id: string) => settle([id]).then((r) => report(r));

function Override({ t }: { t: Task }) {
  const [value, setValue] = useState(String(t.needMin));
  // A repeating task can change just this one or every upcoming one, like events.
  const [scope, setScope] = useState<'this' | 'all'>('this');
  const apply = async () => {
    const v = Math.round(Number(value));
    if (!(v > 0)) return;
    const ids = store.commit((st) => {
      const me = E.task(st, t.id)!;
      const targets = t.seriesId && scope === 'all'
        ? st.tasks.filter((x) => x.seriesId === t.seriesId && x.status === 'active' && (x.startAfter || 0) >= (me.startAfter || 0))
        : [me];
      targets.forEach((x) => { E.overrideEstimate(st, x, v); if (!x.loggedMin) x.totalMin = x.needMin; });
      return targets.map((x) => x.id);
    });
    report(await settle(ids), { prefix: 'Estimate changed to ' + U.fmtDur(v) + (ids.length > 1 ? ' for ' + ids.length + ' upcoming.' : '.') });
  };
  return (
    <div className="inline">
      <input type="number" min={5} step={5} value={value} id={'ov-' + t.id} aria-label={'Minutes left for ' + t.title} onChange={(e) => setValue(e.target.value)} />
      <span className="muted">min left</span>
      {t.seriesId ? (
        <select id={'ovs-' + t.id} aria-label="Apply to" value={scope} onChange={(e) => setScope(e.target.value as 'this' | 'all')}>
          <option value="this">This one</option>
          <option value="all">All upcoming</option>
        </select>
      ) : null}
      <Button small onClick={apply}>Override</Button>
    </div>
  );
}

function Detail({ s, t }: { s: State; t: Task }) {
  const sess = sessionsOf(s, t);
  const remove = async () => {
    if (!(await confirmDialog({ title: 'Delete “' + t.title + '”?', message: 'Its sessions are removed from your plan too.', confirmLabel: 'Delete', danger: true }))) return;
    store.commit((st) => { st.tasks = st.tasks.filter((x) => x.id !== t.id); st.blocks = st.blocks.filter((b) => b.taskId !== t.id); st.pending = st.pending.filter((p) => st.blocks.some((b) => b.id === p.blockId)); });
  };
  return (
    <div className="task-detail">
      <div>
        <h4>Sessions</h4>
        {sess.length ? (
          <ul className="plain">
            {sess.map((b) => <li key={b.id}>{b.anchored ? <Icon name="anchor" size={12} /> : null}{' ' + U.fmtDay(b.start) + ' · ' + U.fmtRange(b.start, b.end) + (b.anchored ? ' (anchored)' : '')}</li>)}
          </ul>
        ) : <p className="muted">{t.sched === 'unscheduled' ? 'Nothing is scheduled yet.' : 'No sessions left.'}</p>}
      </div>
      {t.milestones.length ? (
        <div>
          <h4>Milestones</h4>
          <ul className="plain">
            {t.milestones.map((m) => <li key={m.id} className={m.done ? 'is-done' : ''}><Icon name={m.done ? 'check' : 'clock'} size={12} />{' ' + m.title + ' · ' + U.fmtDur(m.estMin)}</li>)}
          </ul>
          {t.pace && t.pace !== 1 ? <p className="hint">{'Your pace on this one: ' + (t.pace < 1 ? 'faster' : 'slower') + ' than estimated (×' + t.pace + '). Remaining time is scaled to match.'}</p> : null}
        </div>
      ) : null}
      <div>
        <h4>Estimate</h4>
        <p className="muted">{'Total ' + U.fmtDur(t.totalMin) + ', ' + U.fmtDur(t.needMin) + ' left, ' + U.fmtDur(t.loggedMin) + ' logged. Source: ' + (t.prediction ? t.prediction.model : 'your estimate') + ' (placeholder, no trained model yet).'}</p>
        <Override key={t.needMin} t={t} />
      </div>
      <div className="row"><Button kind="danger" small icon="trash" onClick={remove}>Delete task</Button></div>
    </div>
  );
}

function Row({ s, t, more, open, toggle }: { s: State; t: Task; more: number; open: boolean; toggle: () => void }) {
  const [tone, label] = status(t);
  const doneMs = t.milestones.filter((m) => m.done).length;
  // Progress: milestones done, or (assignments without milestones) the slider, even at 0%.
  const pct = t.milestones.length ? Math.round((doneMs / t.milestones.length) * 100) : t.type === 'assignment' ? t.progressPct || 0 : null;
  const anchoredN = sessionsOf(s, t).filter((b) => b.anchored).length;
  const buffer = E.prefsFor(s, t, s.now).bufferDays;
  const sub = t.type === 'assignment' && t.completeBy
    ? 'Target finish ' + U.fmtDate(E.deadlineFor(s, t)) + (buffer ? ' (' + U.plural(buffer, 'day') + ' early)' : '')
    : t.type === 'other' ? 'Window ' + U.fmtDate(t.startAfter || 0) + (t.completeBy && !U.sameDay(t.startAfter || 0, t.completeBy) ? '–' + U.fmtDate(t.completeBy) : '') +
      (t.dayWindow ? ', ' + U.clockLabel(t.dayWindow.from) + '–' + U.clockLabel(t.dayWindow.to) : '') : 'No deadline';
  return (
    <div className="task-card">
      <div className="task-row">
        <div className="tr-main">
          <button type="button" className={'icon-btn chev' + (open ? ' is-open' : '')} aria-label={(open ? 'Hide' : 'Show') + ' details for ' + t.title} aria-expanded={open} onClick={toggle}><Icon name="chevron" size={16} /></button>
          <div>
            <div className="task-title">{t.title}</div>
            <div className="muted small">{sub}</div>
            {t.rule ? <div className="muted small"><Icon name="repeat" size={11} />{' ' + repeatLabel(t.rule) + (more > 0 ? ' · ' + more + ' more upcoming' : '')}</div> : null}
          </div>
        </div>
        <div className="tr-course">{t.course ? <span className="pill pill-blue">{t.course}</span> : <span className="muted">—</span>}</div>
        <div className="tr-due">{t.completeBy ? U.fmtDate(t.completeBy) : 'Anytime'}</div>
        <div className="tr-est">
          <strong>{U.fmtDur(t.needMin) + ' left'}</strong>
          {pct != null ? <div className="bar" role="img" aria-label={pct + ' percent done'}><span style={{ width: pct + '%' }} /></div> : <div className="muted small">{'of ' + U.fmtDur(t.totalMin)}</div>}
        </div>
        <div className="tr-status">
          <span className={'badge badge-' + tone}>{label}</span>
          {anchoredN ? <span className="pill" title="Has anchored sessions"><Icon name="anchor" size={10} />{' ' + anchoredN + ' anchored'}</span> : <span className="pill pill-blue"><Icon name="waves" size={11} /> Floating</span>}
        </div>
        <div className="tr-act">
          {t.sched === 'partial' || t.sched === 'unscheduled' ? <Button small onClick={() => fix(t.id)}>Fix</Button> : null}
          {t.type === 'assignment' ? <Button small id={'log-' + t.id} onClick={() => logProgress(t.id)}>Log progress</Button> : <Button small id={'done-' + t.id} onClick={() => markOtherDone(t.id)}>Mark done</Button>}
        </div>
      </div>
      {open ? <Detail s={s} t={t} /> : null}
    </div>
  );
}

export function TasksView() {
  const s = useAppState();
  const [q, setQ] = useState(kept.q);
  const [course, setCourse] = useState(kept.course);
  const [sort, setSort] = useState(kept.sort);
  const [expanded, setExpanded] = useState(kept.expanded);
  const [showDone, setShowDone] = useState(kept.showDone);
  useEffect(() => { Object.assign(kept, { q, course, sort, expanded, showDone }); }, [q, course, sort, expanded, showDone]);

  const active = s.tasks.filter((t) => t.status === 'active');
  const courses = [...new Set(active.map((t) => t.course).filter(Boolean))].sort();
  let rows = active.filter((t) => (!course || t.course === course) && (!q || (t.title + ' ' + t.course).toLowerCase().includes(q.toLowerCase())));
  const key = (t: Task) => (sort === 'title' ? t.title.toLowerCase() : sort === 'status' ? ['unscheduled', 'partial', 'scheduled'].indexOf(t.sched) : E.deadlineFor(s, t));
  rows.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  // Repeating tasks collapse to their next occurrence.
  const seen = new Map<string, number>();
  rows = rows.filter((t) => {
    if (!t.seriesId) return true;
    if (seen.has(t.seriesId)) { seen.set(t.seriesId, seen.get(t.seriesId)! + 1); return false; }
    seen.set(t.seriesId, 0);
    return true;
  });
  const toggle = (id: string) => { const next = new Set(expanded); if (next.has(id)) next.delete(id); else next.add(id); setExpanded(next); };

  const done = s.completed.slice().sort((a, b) => b.at - a.at);
  return (
    <>
      <div className="page-head">
        <div><h1>Tasks</h1><p className="muted">Manage deadlines and let Inflow build your schedule.</p></div>
        <div className="head-actions"><Button kind="primary" icon="plus" id="add-task-btn" onClick={() => addTask({ when: 'floating' })}>Add task</Button></div>
      </div>
      <div className="toolbar">
        <input type="search" placeholder="Search tasks" aria-label="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by course" value={course} onChange={(e) => setCourse(e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="deadline">Sort: Deadline</option>
          <option value="title">Sort: Name</option>
          <option value="status">Sort: Needs attention</option>
        </select>
      </div>
      <div className="task-list">
        <div className="task-head" role="row">{['Task', 'Course', 'Deadline', 'Remaining', 'Status', ''].map((x, i) => <div key={i} role="columnheader">{x}</div>)}</div>
        {rows.length
          ? rows.map((t) => <Row key={t.id} s={s} t={t} more={t.seriesId ? seen.get(t.seriesId)! : 0} open={expanded.has(t.id)} toggle={() => toggle(t.id)} />)
          : <div className="empty">{active.length ? 'No tasks match.' : 'No tasks yet. Add one and Inflow will schedule it.'}</div>}
      </div>
      <section className="card">
        <button type="button" className="section-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}><Icon name="chevron" size={14} />{' Completed (' + done.length + ')'}</button>
        {showDone ? (done.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr>{['Task', 'Predicted', 'Actual', 'Difference'].map((x) => <th key={x}>{x}</th>)}</tr></thead>
              <tbody>
                {done.map((c) => {
                  const d = c.actualMin - c.predictedMin;
                  return (
                    <tr key={c.taskId + c.at}>
                      <td>{c.title + (c.sample ? ' (sample)' : '')}</td>
                      <td>{U.fmtDur(c.predictedMin)}</td>
                      <td>{U.fmtDur(c.actualMin)}</td>
                      <td><span className={'badge badge-' + (Math.abs(d) <= 10 ? 'ok' : d > 0 ? 'warn' : 'info')}>{(d > 0 ? '+' : d < 0 ? '−' : '') + U.fmtDur(Math.abs(d))}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="hint">Each finished task is stored as a training example: the prediction, and the real total time. Time logged on unfinished work is never used as a label.</p>
          </div>
        ) : <p className="muted">Finished tasks appear here with predicted and actual time.</p>) : null}
      </section>
    </>
  );
}
