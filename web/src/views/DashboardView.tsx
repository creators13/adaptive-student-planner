/* Dashboard: a weekly overview, today's focus, and anything waiting on the student
   (feedback to give, tasks that are not fully scheduled). */
import type { ReactNode } from 'react';
import * as U from '../domain/util';
import * as E from '../domain/engine';
import { useAppState } from '../state/store';
import { Button } from '../ui/controls';
import { Icon, type IconName } from '../ui/Icon';
import { addTask } from '../flows/addTask';
import { report, settle } from '../flows/schedule';
import { feedbackFor } from '../flows/feedback';

function Stat({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: IconName }) {
  return (
    <div className="stat">
      <div className="stat-top"><span className="muted">{label}</span><span className="stat-ic"><Icon name={icon} size={16} /></span></div>
      <div className="stat-val">{value}</div>
      <div className="muted small">{sub}</div>
    </div>
  );
}

export function DashboardView() {
  const s = useAppState();
  const weekStart = U.startOfWeek(s.now);
  const weekEnd = U.addDays(weekStart, 7);
  const active = s.tasks.filter((t) => t.status === 'active');
  const attention = active.filter((t) => t.sched === 'partial' || t.sched === 'unscheduled');
  const doneBlocks = s.blocks.filter((b) => b.state === 'done' && b.start >= weekStart && b.start < weekEnd);
  const focus = doneBlocks.reduce((n, b) => n + (b.actualMin || E.len(b)), 0);
  const doneThisWeek = s.completed.filter((c) => c.at >= weekStart && c.at < weekEnd).length;
  const today = U.startOfDay(s.now);
  const todays = s.blocks.filter((b) => b.kind === 'session' && b.start >= today && b.start < U.addDays(today, 1)).sort((a, b) => a.start - b.start);
  const pending = s.pending.slice().sort((a, b) => a.endedAt - b.endedAt);

  const needs: ReactNode[] = [];
  for (const p of pending) {
    const b = E.block(s, p.blockId);
    if (!b) continue;
    needs.push(
      <li key={'p' + b.id}>
        <div><div className="task-title">{b.title}</div><div className="muted small">{'Ended ' + U.fmtDay(b.end) + ' ' + U.fmtTime(b.end) + ' · feedback needed'}</div></div>
        <Button small onClick={() => feedbackFor(b.id)}>Answer</Button>
      </li>,
    );
  }
  for (const t of attention) {
    needs.push(
      <li key={'t' + t.id}>
        <div><div className="task-title">{t.title}</div><div className="muted small">{t.sched === 'partial' ? U.fmtDur(t.shortfallMin) + ' still needs a slot' : 'Not scheduled'}</div></div>
        <Button small onClick={() => settle([t.id]).then((r) => report(r))}>Fix</Button>
      </li>,
    );
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p className="muted">{U.fmtDate(weekStart) + ' – ' + U.fmtDate(U.addDays(weekStart, 6))}</p></div>
        <div className="head-actions"><Button kind="primary" icon="plus" id="add-task-btn" onClick={() => addTask({ when: 'floating' })}>Add task</Button></div>
      </div>
      <div className="stats">
        <Stat label="Open tasks" value={String(active.length)} sub={attention.length ? attention.length + ' not fully scheduled' : 'All scheduled'} icon="tasks" />
        <Stat label="Completed" value={String(s.completed.length)} sub={doneThisWeek + ' this week'} icon="check" />
        <Stat label="Focus time" value={U.fmtDur(focus)} sub={U.plural(doneBlocks.length, 'session') + ' logged this week'} icon="clock" />
      </div>
      <div className="two-col">
        <section className="card">
          <div className="card-head"><h2>Today’s focus</h2><a href="#/plan" className="link">Open plan</a></div>
          {todays.length ? (
            <ul className="focus-list">
              {todays.map((b) => (
                <li key={b.id} className={b.state === 'skipped' ? 'is-skipped' : b.state === 'done' ? 'is-done' : ''}>
                  <span className="ck">{b.state === 'done' ? <Icon name="check" size={12} /> : null}</span>
                  <div><div className="task-title">{b.title}</div><div className="muted small">{U.fmtRange(b.start, b.end) + (b.anchored ? ' · anchored' : '') + (b.state === 'skipped' ? ' · skipped' : '')}</div></div>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Nothing scheduled today.</p>}
        </section>
        <section className="card">
          <div className="card-head"><h2>Needs your attention</h2></div>
          {needs.length ? <ul className="attn-list">{needs}</ul> : <p className="muted">All caught up. Feedback prompts and scheduling problems show up here.</p>}
        </section>
      </div>
    </>
  );
}
