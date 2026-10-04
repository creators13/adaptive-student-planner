/* Weekly Plan: the calendar. Week and day views, click an empty slot to add an anchored
   task, drag a floating block to move it (which anchors it there) or an anchored event
   to change its time (this one or all its repeats), click a block for details (anchor /
   let it float, move, delete, feedback). Greyed blocks are skipped sessions. */
import { useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import * as U from '../domain/util';
import * as E from '../domain/engine';
import type { Block, State } from '../domain/types';
import { store, useAppState } from '../state/store';
import { Button, Field } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { DISMISSED, Modal, openDialog } from '../ui/dialog';
import { toast } from '../ui/toast';
import { addTask } from '../flows/addTask';
import { editBlock, report, resolveOverlaps, settle } from '../flows/schedule';
import { feedbackFor } from '../flows/feedback';

const HOUR = 52; // px per hour
const START_H = 0; // the full 24 hours: students sometimes work through the night
const END_H = 24;
// Kept between visits to the page, like the rest of the app's state.
const kept: { mode: 'week' | 'day'; anchor: number | null; scrollTop: number | null } = { mode: 'week', anchor: null, scrollTop: null };

const S = () => store.state;
const taskOf = (id: string | undefined) => E.task(S(), id);

function rangeLabel(days: number[]) {
  const a = days[0];
  const b = days[days.length - 1];
  if (days.length === 1) return new Date(a).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const m1 = new Date(a).toLocaleDateString('en-US', { month: 'long' });
  const m2 = new Date(b).toLocaleDateString('en-US', { month: 'long' });
  return m1 + ' ' + new Date(a).getDate() + '–' + (m1 === m2 ? '' : m2 + ' ') + new Date(b).getDate() + ', ' + new Date(b).getFullYear();
}

interface Piece { b: Block; s: number; e: number; lane: number; lanes: number }

// Lay overlapping pieces side by side. A piece is the part of a block inside one day;
// a block that runs past midnight shows in both days.
function lanes(pieces: { b: Block; s: number; e: number }[]): Piece[] {
  const sorted = pieces.slice().sort((a, b) => a.s - b.s || b.e - a.e);
  const out: Piece[] = [];
  let cluster: Piece[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const ends: number[] = [];
    for (const c of cluster) {
      let i = ends.findIndex((e) => e <= c.s);
      if (i < 0) { i = ends.length; ends.push(0); }
      ends[i] = c.e;
      c.lane = i;
    }
    cluster.forEach((c) => { c.lanes = ends.length; });
    out.push(...cluster);
    cluster = [];
  };
  for (const p of sorted) {
    if (cluster.length && p.s >= clusterEnd) { flush(); clusterEnd = 0; }
    cluster.push({ lane: 0, lanes: 1, ...p });
    clusterEnd = Math.max(clusterEnd, p.e);
  }
  if (cluster.length) flush();
  return out;
}

function sessionLabel(s: State, b: Block) {
  const mine = s.blocks.filter((x) => x.taskId === b.taskId && x.kind === 'session' && x.state !== 'skipped').sort((a, c) => a.start - c.start);
  const i = mine.findIndex((x) => x.id === b.id);
  return i >= 0 && mine.length > 1 ? 'Session ' + (i + 1) + ' of ' + mine.length : null;
}

/* ---------- actions on blocks ---------- */

function setAnchor(blockId: string, anchored: boolean) {
  store.commit((s) => { const b = E.block(s, blockId); if (b) b.anchored = anchored; });
  toast(anchored ? 'Anchored. Inflow will plan around this time.' : 'Floating again. Inflow may move it when your schedule changes.');
}

// Move one occurrence of a repeating anchored event, or every repeat that has not
// happened yet. Resolves 'this' | 'all' | null (cancelled).
async function moveScope(b: Block) {
  const r = await openDialog<'this' | 'all' | null>((done) => (
    <Modal title={'Move “' + b.title + '”?'} size="sm"
      subtitle="This event repeats. Move just this one, or every repeat that has not happened yet, by the same amount?"
      actions={[
        <Button key="c" onClick={() => done(null)}>Cancel</Button>,
        <Button key="this" onClick={() => done('this')}>Just this one</Button>,
        <Button key="all" kind="primary" onClick={() => done('all')}>All events in the series</Button>,
      ]} />
  ));
  return r === DISMISSED ? null : r;
}

// Move a block to a new start time, keeping its length. A floating session becomes
// anchored where it lands; an anchored event changes its time (this one or all repeats).
// Either way, the overlap check runs next.
export async function moveTo(blockId: string, newStart: number) {
  const s0 = E.block(S(), blockId);
  if (!s0 || newStart === s0.start) return;
  const dur = s0.end - s0.start;
  if (s0.kind === 'anchored') {
    const scope = s0.seriesId ? await moveScope(s0) : 'this';
    if (!scope) return;
    const ids = store.commit((s) => E.editBlockTime(s, blockId, newStart, newStart + dur, scope));
    toast('Moved “' + s0.title + '”' + (ids.length > 1 ? ' and its later repeats.' : '.'), { tone: 'ok' });
    await resolveOverlaps(ids);
    return;
  }
  const info = store.commit((s) => {
    const b = E.block(s, blockId)!;
    const wasAnchored = b.kind === 'anchored' || b.anchored;
    b.start = newStart;
    b.end = newStart + dur;
    if (b.kind === 'session') b.anchored = true;
    return { wasAnchored, title: b.title };
  });
  toast(info.wasAnchored ? 'Moved “' + info.title + '”.' : 'Moved “' + info.title + '” and anchored it there.', {
    tone: 'ok', action: info.wasAnchored ? null : { label: 'Let it float', onClick: () => setAnchor(blockId, false) },
  });
  await resolveOverlaps([blockId]); // move what it now overlaps, or keep the overlap
}

// Delete one occurrence, or this one and every later one in its series.
async function deleteScope(b: Block) {
  const r = await openDialog<'this' | 'later' | null>((done) => (
    <Modal title={'Delete “' + b.title + '”?'} size="sm"
      subtitle={b.eventType === 'class' ? 'Delete just this one, or this one and every later one of this class? Other series for the same course, like a lab, are kept.' : 'This event repeats. Delete just this one, or this one and every later one?'}
      actions={[
        <Button key="c" onClick={() => done(null)}>Cancel</Button>,
        <Button key="this" kind="danger" onClick={() => done('this')}>Just this one</Button>,
        <Button key="later" kind="danger" onClick={() => done('later')}>This and later ones</Button>,
      ]} />
  ));
  return r === DISMISSED ? null : r;
}

async function removeBlock(b: Block) {
  let all = false;
  if (b.seriesId) {
    const scope = await deleteScope(b);
    if (!scope) return;
    all = scope === 'later';
  }
  const taskId = b.taskId;
  store.commit((s) => {
    s.blocks = s.blocks.filter((x) => x.id !== b.id && !(all && x.seriesId === b.seriesId && x.start >= b.start));
    s.pending = s.pending.filter((p) => s.blocks.some((x) => x.id === p.blockId));
  });
  toast('Deleted “' + b.title + '”. Time you free up stays free.');
  if (taskId) report(await settle([taskId]));
}

/* ---------- block details ---------- */

type DetailAction = 'delete' | 'feedback' | 'edit' | 'anchor' | { move: number };

function Details({ b, done }: { b: Block; done: (a: DetailAction | null) => void }) {
  const s = S();
  const task = b.taskId ? taskOf(b.taskId) : null;
  const awaiting = s.pending.some((p) => p.blockId === b.id);
  const [date, setDate] = useState(U.toInputDate(b.start));
  const [time, setTime] = useState(U.clockOf(b.start));
  const chips: string[] = [];
  if (b.eventType === 'class') chips.push('Class' + (b.course ? ' · ' + b.course : ''));
  else if (b.kind === 'anchored') chips.push('Anchored');
  else if (b.state === 'skipped') chips.push('Skipped');
  else if (b.state === 'done') chips.push('Done');
  else chips.push(b.anchored ? 'Anchored (you moved it)' : 'Floating');
  if (b.seriesId) chips.push('Repeats');
  if (awaiting) chips.push('Feedback needed');
  const movable = b.state === 'planned' && b.kind === 'session'; // anchored events use the edit pop-up
  const actions = [
    b.kind === 'anchored' || (b.kind === 'session' && b.anchored && b.state === 'planned') ? <Button key="del" kind="danger" icon="trash" onClick={() => done('delete')}>Delete</Button> : null,
    awaiting ? <Button key="fb" onClick={() => done('feedback')}>Give feedback</Button> : null,
    b.kind === 'anchored' && b.state === 'planned' ? <Button key="edit" kind="primary" onClick={() => done('edit')}>Edit time</Button> : null,
    b.kind === 'session' && b.state === 'planned' ? <Button key="anchor" icon="anchor" onClick={() => done('anchor')}>{b.anchored ? 'Let it float' : 'Anchor here'}</Button> : null,
    movable ? <Button key="move" kind="primary" onClick={() => {
      const day = U.fromInputDate(date);
      if (Number.isNaN(day) || !time) return;
      done({ move: U.atClock(day, time) });
    }}>Move</Button> : null,
  ].filter((x) => x != null);
  return (
    <Modal title={b.title} subtitle={U.fmtDay(b.start) + ' · ' + U.fmtRange(b.start, b.end) + ' (' + U.fmtDur(E.len(b)) + ')'} size="md" actions={actions}>
      <div className="stack">
        <div className="chip-row">{chips.map((c) => <span key={c} className="pill">{c}</span>)}</div>
        {task ? <p className="muted">{(task.course ? task.course + ' · ' : '') + 'Work toward “' + task.title + '”' + (task.completeBy ? ', due ' + U.fmtDay(task.completeBy) : '') + '.'}</p> : null}
        {b.state === 'skipped' ? <p className="muted">{'You marked this session as missed. It stays here, greyed out, as a record.' + (b.anchored ? ' Anchored blocks never move; the work it still needed was planned at a flexible time.' : ' The work was scheduled again.')}</p> : null}
        {b.eventType === 'class' ? <p className="muted">Classes stay where they are and never ask for feedback. Other events can overlap them.</p> : null}
        {b.kind === 'session' && b.state === 'planned' ? <p className="muted">{b.anchored ? 'Anchored: Inflow plans around this time and will not move it. Choose “Let it float” to let Inflow move it again.' : 'Floating: Inflow placed this and tries not to move it. Moving it yourself anchors it at the new time.'}</p> : null}
        {movable ? (
          <div className="grid-2">
            <Field label="Move to date"><input type="date" id="mv-date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Start time"><input type="time" id="mv-time" step={300} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export async function details(blockId: string) {
  const b = E.block(S(), blockId);
  if (!b) return;
  const a = await openDialog<DetailAction | null>((done) => <Details b={b} done={done} />);
  if (a === DISMISSED || a == null) return;
  if (a === 'delete') await removeBlock(b);
  else if (a === 'feedback') await feedbackFor(b.id);
  else if (a === 'edit') {
    const changed = await editBlock(b.id);
    if (changed) await resolveOverlaps(changed);
  } else if (a === 'anchor') setAnchor(b.id, !b.anchored);
  else await moveTo(b.id, a.move);
}

/* ---------- drawing ---------- */

function BlockEl({ s, info, colDay, gridRef }: { s: State; info: Piece; colDay: number; gridRef: RefObject<HTMLDivElement | null> }) {
  const b = info.b;
  const task = b.taskId ? E.task(s, b.taskId) : null;
  const awaiting = s.pending.some((p) => p.blockId === b.id);
  let kind = 'flex';
  if (b.eventType === 'class') kind = 'class';
  else if (b.kind === 'anchored') kind = 'anchored';
  else if (b.state === 'done') kind = 'done';
  else if (b.state === 'skipped') kind = 'skipped';
  else if (b.anchored) kind = 'anchored-session';
  const top = ((info.s - colDay) / U.HOUR - START_H) * HOUR;
  const height = Math.max(20, ((info.e - info.s) / U.HOUR) * HOUR - 2);
  const label = b.kind === 'session' ? sessionLabel(s, b) : null;
  const meta = b.state === 'done' ? 'Done · ' + U.fmtDur(b.actualMin || E.len(b)) : (label ? label + ' · ' : '') + U.fmtRange(b.start, b.end);
  const draggable = b.state === 'planned' && (b.kind === 'session' || b.kind === 'anchored');

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const sx = e.clientX;
    const sy = e.clientY;
    let dragging = false;
    const cols = [...(gridRef.current?.querySelectorAll<HTMLElement>('.cal-col') || [])];
    const startMin = U.minutesOfDay(b.start);
    const dur = E.len(b);
    const targetOf = (ev: PointerEvent) => {
      let col = cols.find((c) => { const r = c.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX < r.right; });
      if (!col) col = ev.clientX < cols[0].getBoundingClientRect().left ? cols[0] : cols[cols.length - 1];
      const mins = U.clamp(Math.round((startMin + ((ev.clientY - sy) / HOUR) * 60) / 15) * 15, START_H * 60, END_H * 60 - dur);
      const d = new Date(Number(col.dataset.day));
      d.setHours(0, mins, 0, 0);
      return d.getTime();
    };
    try { el.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    const move = (ev: PointerEvent) => {
      if (!draggable) return;
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!dragging && Math.hypot(dx, dy) < 6) return;
      dragging = true;
      el.classList.add('dragging');
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      el.dataset.tip = U.fmtDay(targetOf(ev)) + ' ' + U.fmtTime(targetOf(ev));
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      el.style.transform = '';
      el.classList.remove('dragging');
      if (!dragging) { if (ev.type === 'pointerup') details(b.id); return; }
      if (ev.type === 'pointerup') moveTo(b.id, targetOf(ev));
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  return (
    <div
      className={'blk blk-' + kind + (awaiting ? ' is-awaiting' : '') + (info.lanes > 1 ? ' is-narrow' : '') + (height < 40 ? ' is-short' : '')}
      style={{ top: top + 'px', height: height + 'px', left: (info.lane / info.lanes) * 100 + '%', width: 100 / info.lanes + '%' }}
      role="button" tabIndex={0}
      aria-label={b.title + ', ' + U.fmtDay(b.start) + ' ' + U.fmtRange(b.start, b.end) + (kind === 'skipped' ? ', skipped' : '') + (awaiting ? ', feedback needed' : '')}
      data-id={b.id}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); details(b.id); } }}
      onPointerDown={onPointerDown}
    >
      <div className="blk-title">
        {kind === 'anchored-session' || kind === 'anchored' ? <Icon name="anchor" size={11} /> : null}
        {kind === 'done' ? <Icon name="check" size={12} /> : null}
        <span>{b.title}</span>
        {awaiting ? <span className="blk-flag" title="Feedback needed">?</span> : null}
      </div>
      {height >= 36 ? <div className="blk-meta">{meta}</div> : null}
      {task && task.course && height >= 52 && kind !== 'skipped' ? <div className="blk-meta">{task.course}</div> : null}
    </div>
  );
}

export function PlanView() {
  const s = useAppState();
  const [mode, setModeState] = useState(kept.mode);
  const [anchor, setAnchorDay] = useState(kept.anchor ?? U.startOfDay(s.now));
  const setMode = (m: 'week' | 'day') => { kept.mode = m; setModeState(m); };
  const goTo = (d: number) => { kept.anchor = d; setAnchorDay(d); };
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // The scroll position is kept between visits. The first view scrolls to 7 AM, or to
    // an hour before now if that is earlier.
    if (scrollRef.current) scrollRef.current.scrollTop = kept.scrollTop != null ? kept.scrollTop : Math.max(0, (Math.min(7, U.minutesOfDay(store.state.now) / 60 - 1) - START_H) * HOUR);
  }, []);

  const days = mode === 'day' ? [U.startOfDay(anchor)] : Array.from({ length: 7 }, (_, i) => U.addDays(U.startOfWeek(anchor), i));
  const step = mode === 'day' ? 1 : 7;
  const attention = s.tasks.filter((t) => t.status === 'active' && (t.sched === 'partial' || t.sched === 'unscheduled'));
  const fix = (id: string) => settle([id]).then((r) => report(r));

  const colTpl = '56px repeat(' + days.length + ', minmax(' + (mode === 'day' ? 280 : 96) + 'px, 1fr))';
  // Shade the hours outside work hours. Work hours may cross midnight (10 AM to 3 AM)
  // or fill the whole day.
  const ws = U.minutesOfDay(U.atClock(0, s.prefs.workStart));
  const span = E.spanMin(s.prefs.workStart, s.prefs.workEnd);
  // (Work hours that end exactly at midnight leave nothing to shade after them.)
  const bands: [number, number][] = span >= 1440 ? [] : ws + span <= 1440 ? ([[0, ws], [ws + span, 1440]] as [number, number][]).filter(([a, b]) => b - a > 0) : [[(ws + span) % 1440, ws]];

  const onColClick = (day: number) => (e: MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t !== e.currentTarget && !t.classList.contains('cal-off') && !t.classList.contains('cal-now')) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const mins = Math.floor((START_H * 60 + (y / HOUR) * 60) / 30) * 30;
    const d = new Date(day);
    d.setHours(0, mins, 0, 0);
    addTask({ when: 'anchored', start: d.getTime() });
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Weekly Plan</h1><p className="muted">{rangeLabel(days)}</p></div>
        <div className="head-actions">
          <div className="segmented seg-sm" role="group" aria-label="View">
            <button type="button" className={mode === 'week' ? 'is-on' : ''} aria-pressed={mode === 'week'} onClick={() => setMode('week')}>Week</button>
            <button type="button" className={mode === 'day' ? 'is-on' : ''} aria-pressed={mode === 'day'} onClick={() => { setMode('day'); if (U.startOfWeek(anchor) !== U.startOfWeek(s.now)) goTo(U.startOfDay(anchor)); }}>Day</button>
          </div>
          <Button icon="chevronLeft" aria="Previous" onClick={() => goTo(U.addDays(anchor, -step))} />
          <Button onClick={() => goTo(U.startOfDay(s.now))}>Today</Button>
          <Button icon="chevron" aria="Next" onClick={() => goTo(U.addDays(anchor, step))} />
          <Button kind="primary" icon="plus" id="add-task-btn" onClick={() => addTask({ when: 'floating' })}>Add task</Button>
        </div>
      </div>
      <div className="legend">
        <span className="leg leg-flex"><Icon name="waves" size={12} /> Floating work</span>
        <span className="leg leg-anchored"><Icon name="anchor" size={11} /> Anchored event</span>
        <span className="leg leg-class">Class</span>
        <span className="leg leg-anchored-session"><Icon name="anchor" size={11} /> Anchored by you</span>
        <span className="leg leg-skipped">Skipped</span>
        <span className="leg leg-done"><Icon name="check" size={11} /> Done</span>
        <span className="muted leg-hint">Drag a block to move it. Click any block for details, or an empty slot to add an anchored task.</span>
      </div>
      {attention.length ? (
        <div className="banner banner-warn" role="status">
          <Icon name="warn" size={16} />
          <div className="grow">
            <strong>{U.plural(attention.length, 'task') + ' not fully scheduled. '}</strong>
            {attention.map((t) => (
              <span key={t.id} className="banner-item">
                {'“' + t.title + '” ' + (t.sched === 'partial' ? '(' + U.fmtDur(t.shortfallMin) + ' short)' : '(unscheduled)') + ' '}
                <button type="button" className="link" onClick={() => fix(t.id)}>Fix</button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="cal">
        <div className="cal-x">
          <div className="cal-head" style={{ gridTemplateColumns: colTpl }}>
            <div />
            {days.map((d) => (
              <div key={d} className={'cal-dayname' + (U.sameDay(d, s.now) ? ' is-today' : '')}>
                <span>{new Date(d).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <strong>{String(new Date(d).getDate())}</strong>
              </div>
            ))}
          </div>
          <div className="cal-scroll" ref={scrollRef} onScroll={(e) => { kept.scrollTop = e.currentTarget.scrollTop; }}>
            <div className="cal-body" ref={gridRef} style={{ gridTemplateColumns: colTpl }}>
              <div className="cal-gutter" style={{ height: (END_H - START_H) * HOUR + 'px' }}>
                {Array.from({ length: END_H - START_H }, (_, i) => (
                  <span key={i} style={{ top: i * HOUR - 7 + 'px' }}>{i === 0 ? '' : U.clockLabel(String(START_H + i).padStart(2, '0') + ':00')}</span>
                ))}
              </div>
              {days.map((day) => {
                const dayEnd = U.addDays(day, 1);
                const pieces = s.blocks.filter((b) => b.start < dayEnd && b.end > day).map((b) => ({ b, s: Math.max(b.start, day), e: Math.min(b.end, dayEnd) }));
                return (
                  <div key={day} className="cal-col" data-day={String(day)} style={{ height: (END_H - START_H) * HOUR + 'px' }} onClick={onColClick(day)}>
                    {bands.map(([a, b]) => <div key={a} className="cal-off" style={{ top: (a / 60) * HOUR + 'px', height: ((b - a) / 60) * HOUR + 'px' }} />)}
                    {lanes(pieces).map((info) => <BlockEl key={info.b.id} s={s} info={info} colDay={day} gridRef={gridRef} />)}
                    {U.sameDay(day, s.now) ? <div className="cal-now" style={{ top: ((U.minutesOfDay(s.now) - START_H * 60) / 60) * HOUR + 'px' }} title={'Now: ' + U.fmtTime(s.now)} /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
