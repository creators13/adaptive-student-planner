/* Weekly Plan: the calendar. Week and day views, click an empty slot to add an anchored
   task, drag a floating block to move it (which anchors it there) or an anchored event
   to change its time (this one or all its repeats), click a block
   for details (anchor / let it float, move, delete, feedback). Greyed blocks are skipped sessions. */
(function () {
  'use strict';
  const PF = (window.PF = window.PF || {});
  const { h, btn, icon, modal, toast, field } = PF.ui;
  const U = PF.util;
  const E = PF.engine;
  const S = () => PF.store;

  const HOUR = 52; // px per hour
  const START_H = 0; // the full 24 hours: students sometimes work through the night
  const END_H = 24;
  const view = { mode: 'week', anchor: null, scrollTop: null };

  const taskOf = (id) => E.task(S().state, id);

  function rangeLabel(days) {
    const a = days[0];
    const b = days[days.length - 1];
    if (days.length === 1) return new Date(a).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const m1 = new Date(a).toLocaleDateString('en-US', { month: 'long' });
    const m2 = new Date(b).toLocaleDateString('en-US', { month: 'long' });
    return m1 + ' ' + new Date(a).getDate() + '–' + (m1 === m2 ? '' : m2 + ' ') + new Date(b).getDate() + ', ' + new Date(b).getFullYear();
  }

  // Lay overlapping pieces side by side. A piece is the part of a block inside one day
  // ({ b, s, e }); a block that runs past midnight shows in both days.
  function lanes(pieces) {
    const sorted = pieces.slice().sort((a, b) => a.s - b.s || b.e - a.e);
    const out = [];
    let cluster = [];
    let clusterEnd = 0;
    const flush = () => {
      const ends = [];
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
      cluster.push(Object.assign({ lane: 0, lanes: 1 }, p));
      clusterEnd = Math.max(clusterEnd, p.e);
    }
    if (cluster.length) flush();
    return out;
  }

  function sessionLabel(b) {
    const mine = S().state.blocks.filter((x) => x.taskId === b.taskId && x.kind === 'session' && x.state !== 'skipped').sort((a, c) => a.start - c.start);
    const i = mine.findIndex((x) => x.id === b.id);
    return i >= 0 && mine.length > 1 ? 'Session ' + (i + 1) + ' of ' + mine.length : null;
  }

  /* ---------- block details ---------- */

  function details(blockId) {
    const s = S().state;
    const b = E.block(s, blockId);
    if (!b) return;
    const task = b.taskId ? taskOf(b.taskId) : null;
    const awaiting = s.pending.some((p) => p.blockId === b.id);
    const chips = [];
    if (b.eventType === 'class') chips.push('Class' + (b.course ? ' · ' + b.course : ''));
    else if (b.kind === 'anchored') chips.push('Anchored');
    else if (b.state === 'skipped') chips.push('Skipped');
    else if (b.state === 'done') chips.push('Done');
    else chips.push(b.anchored ? 'Anchored (you moved it)' : 'Floating');
    if (b.seriesId) chips.push('Repeats');
    if (awaiting) chips.push('Feedback needed');
    const dateIn = h('input', { type: 'date', value: U.toInputDate(b.start), id: 'mv-date' });
    const timeIn = h('input', { type: 'time', value: U.clockOf(b.start), step: 300, id: 'mv-time' });
    const movable = b.state === 'planned' && b.kind === 'session'; // anchored events use the edit pop-up
    const m = modal({
      title: b.title, subtitle: U.fmtDay(b.start) + ' · ' + U.fmtRange(b.start, b.end) + ' (' + U.fmtDur(E.len(b)) + ')', size: 'md',
      body: h('div', { class: 'stack' },
        h('div', { class: 'chip-row' }, chips.map((c) => h('span', { class: 'pill', text: c }))),
        task ? h('p', { class: 'muted', text: (task.course ? task.course + ' · ' : '') + 'Work toward “' + task.title + '”' + (task.completeBy ? ', due ' + U.fmtDay(task.completeBy) : '') + '.' }) : null,
        b.state === 'skipped' ? h('p', { class: 'muted', text: 'You marked this session as missed. It stays here, greyed out, as a record.' + (b.anchored ? ' Anchored blocks never move; the work it still needed was planned at a flexible time.' : ' The work was scheduled again.') }) : null,
        b.eventType === 'class' ? h('p', { class: 'muted', text: 'Classes stay where they are and never ask for feedback. Other events can overlap them.' }) : null,
        b.kind === 'session' && b.state === 'planned' ? h('p', { class: 'muted', text: b.anchored ? 'Anchored: Inflow plans around this time and will not move it. Choose “Let it float” to let Inflow move it again.' : 'Floating: Inflow placed this and tries not to move it. Moving it yourself anchors it at the new time.' }) : null,
        movable ? h('div', { class: 'grid-2' }, field('Move to date', dateIn), field('Start time', timeIn)) : null),
      actions: [
        b.kind === 'anchored' || (b.kind === 'session' && b.anchored && b.state === 'planned') ? btn('Delete', { kind: 'danger', icon: 'trash', onclick: () => { m.close(); removeBlock(b); } }) : null,
        awaiting ? btn('Give feedback', { onclick: () => { m.close(); PF.flow.feedbackFor(b.id); } }) : null,
        b.kind === 'anchored' && b.state === 'planned' ? btn('Edit time', { kind: 'primary', onclick: async () => {
          m.close();
          const changed = await PF.flow.editBlock(b.id);
          if (changed) await PF.flow.resolveOverlaps(changed);
        } }) : null,
        b.kind === 'session' && b.state === 'planned' ? btn(b.anchored ? 'Let it float' : 'Anchor here', { icon: 'anchor', onclick: () => { m.close(); setAnchor(b.id, !b.anchored); } }) : null,
        movable ? btn('Move', { kind: 'primary', onclick: () => {
          const day = U.fromInputDate(dateIn.value);
          if (Number.isNaN(day) || !timeIn.value) return;
          m.close();
          moveTo(b.id, U.atClock(day, timeIn.value));
        } }) : null,
      ].filter(Boolean),
    });
  }

  function setAnchor(blockId, anchored) {
    S().commit((s) => { const b = E.block(s, blockId); if (b) b.anchored = anchored; });
    toast(anchored ? 'Anchored. Inflow will plan around this time.' : 'Floating again. Inflow may move it when your schedule changes.');
  }

  // Move one occurrence of a repeating anchored event, or every repeat that has not
  // happened yet. Resolves 'this' | 'all' | null (cancelled).
  function moveScope(b) {
    return new Promise((resolve) => {
      const m = modal({
        title: 'Move “' + b.title + '”?', size: 'sm',
        subtitle: 'This event repeats. Move just this one, or every repeat that has not happened yet, by the same amount?',
        actions: [
          btn('Cancel', { onclick: () => { resolve(null); m.close(); } }),
          btn('Just this one', { onclick: () => { resolve('this'); m.close(); } }),
          btn('All events in the series', { kind: 'primary', onclick: () => { resolve('all'); m.close(); } }),
        ],
      });
      m.promise.then(() => resolve(null));
    });
  }

  async function moveTo(blockId, newStart) {
    const s0 = E.block(S().state, blockId);
    if (!s0 || newStart === s0.start) return;
    const dur = s0.end - s0.start;
    if (s0.kind === 'anchored') {
      const scope = s0.seriesId ? await moveScope(s0) : 'this';
      if (!scope) return;
      const ids = S().commit((s) => E.editBlockTime(s, blockId, newStart, newStart + dur, scope));
      toast('Moved “' + s0.title + '”' + (ids.length > 1 ? ' and its later repeats.' : '.'), { tone: 'ok' });
      await PF.flow.resolveOverlaps(ids);
      return;
    }
    const info = S().commit((s) => {
      const b = E.block(s, blockId);
      const wasAnchored = b.kind === 'anchored' || b.anchored;
      b.start = newStart;
      b.end = newStart + dur;
      if (b.kind === 'session') b.anchored = true;
      return { wasAnchored, title: b.title };
    });
    toast(info.wasAnchored ? 'Moved “' + info.title + '”.' : 'Moved “' + info.title + '” and anchored it there.', {
      tone: 'ok', action: info.wasAnchored ? null : { label: 'Let it float', onClick: () => setAnchor(blockId, false) },
    });
    await PF.flow.resolveOverlaps([blockId]); // move what it now overlaps, or keep the overlap
  }

  // Delete one occurrence, or this one and every later one in its series. Resolves
  // 'this' | 'later' | null (cancelled).
  function deleteScope(b) {
    return new Promise((resolve) => {
      const m = modal({
        title: 'Delete “' + b.title + '”?', size: 'sm',
        subtitle: b.eventType === 'class' ? 'Delete just this one, or this one and every later one of this class? Other series for the same course, like a lab, are kept.' : 'This event repeats. Delete just this one, or this one and every later one?',
        actions: [
          btn('Cancel', { onclick: () => { resolve(null); m.close(); } }),
          btn('Just this one', { kind: 'danger', onclick: () => { resolve('this'); m.close(); } }),
          btn('This and later ones', { kind: 'danger', onclick: () => { resolve('later'); m.close(); } }),
        ],
      });
      m.promise.then(() => resolve(null));
    });
  }

  async function removeBlock(b) {
    let all = false;
    if (b.seriesId) {
      const scope = await deleteScope(b);
      if (!scope) return;
      all = scope === 'later';
    }
    const taskId = b.taskId;
    S().commit((s) => {
      s.blocks = s.blocks.filter((x) => x.id !== b.id && !(all && x.seriesId === b.seriesId && x.start >= b.start));
      s.pending = s.pending.filter((p) => s.blocks.some((x) => x.id === p.blockId));
    });
    toast('Deleted “' + b.title + '”. Time you free up stays free.');
    if (taskId) PF.flow.report(await PF.flow.settle([taskId]));
  }

  /* ---------- drawing ---------- */

  function blockEl(b, info, colDay, grid) {
    const s = S().state;
    const task = b.taskId ? taskOf(b.taskId) : null;
    const awaiting = s.pending.some((p) => p.blockId === b.id);
    let kind = 'flex';
    if (b.eventType === 'class') kind = 'class';
    else if (b.kind === 'anchored') kind = 'anchored';
    else if (b.state === 'done') kind = 'done';
    else if (b.state === 'skipped') kind = 'skipped';
    else if (b.anchored) kind = 'anchored-session';
    const top = ((info.s - colDay) / U.HOUR - START_H) * HOUR;
    const height = Math.max(20, ((info.e - info.s) / U.HOUR) * HOUR - 2);
    const label = b.kind === 'session' ? sessionLabel(b) : null;
    const meta = b.state === 'done' ? 'Done · ' + U.fmtDur(b.actualMin || E.len(b)) : (label ? label + ' · ' : '') + U.fmtRange(b.start, b.end);
    const el = h('div', {
      class: 'blk blk-' + kind + (awaiting ? ' is-awaiting' : '') + (info.lanes > 1 ? ' is-narrow' : '') + (height < 40 ? ' is-short' : ''),
      style: { top: top + 'px', height: height + 'px', left: (info.lane / info.lanes) * 100 + '%', width: 100 / info.lanes + '%' },
      role: 'button', tabindex: 0,
      'aria-label': b.title + ', ' + U.fmtDay(b.start) + ' ' + U.fmtRange(b.start, b.end) + (kind === 'skipped' ? ', skipped' : '') + (awaiting ? ', feedback needed' : ''),
      'data-id': b.id,
    },
      h('div', { class: 'blk-title' },
        kind === 'anchored-session' || kind === 'anchored' ? icon('anchor', 11) : null,
        kind === 'done' ? icon('check', 12) : null,
        h('span', { text: b.title }),
        awaiting ? h('span', { class: 'blk-flag', title: 'Feedback needed', text: '?' }) : null),
      height >= 36 ? h('div', { class: 'blk-meta', text: meta }) : null,
      task && task.course && height >= 52 && kind !== 'skipped' ? h('div', { class: 'blk-meta', text: task.course }) : null);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); details(b.id); } });

    const draggable = b.state === 'planned' && (b.kind === 'session' || b.kind === 'anchored');
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const sx = e.clientX;
      const sy = e.clientY;
      let dragging = false;
      const cols = [...grid.querySelectorAll('.cal-col')];
      const startMin = U.minutesOfDay(b.start);
      const dur = E.len(b);
      const targetOf = (ev) => {
        let col = cols.find((c) => { const r = c.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX < r.right; });
        if (!col) col = ev.clientX < cols[0].getBoundingClientRect().left ? cols[0] : cols[cols.length - 1];
        const mins = U.clamp(Math.round((startMin + ((ev.clientY - sy) / HOUR) * 60) / 15) * 15, START_H * 60, END_H * 60 - dur);
        const d = new Date(Number(col.dataset.day));
        d.setHours(0, mins, 0, 0);
        return d.getTime();
      };
      el.setPointerCapture(e.pointerId);
      const move = (ev) => {
        if (!draggable) return;
        const dx = ev.clientX - sx;
        const dy = ev.clientY - sy;
        if (!dragging && Math.hypot(dx, dy) < 6) return;
        dragging = true;
        el.classList.add('dragging');
        el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        el.dataset.tip = U.fmtDay(targetOf(ev)) + ' ' + U.fmtTime(targetOf(ev));
      };
      const up = (ev) => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        try { el.releasePointerCapture(e.pointerId); } catch (x) { /* already released */ }
        el.style.transform = '';
        el.classList.remove('dragging');
        if (!dragging) { if (ev.type === 'pointerup') details(b.id); return; }
        if (ev.type === 'pointerup') moveTo(b.id, targetOf(ev));
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    return el;
  }

  function render(root) {
    const s = S().state;
    if (view.anchor == null) view.anchor = U.startOfDay(s.now);
    const days = view.mode === 'day' ? [U.startOfDay(view.anchor)] : Array.from({ length: 7 }, (_, i) => U.addDays(U.startOfWeek(view.anchor), i));
    const step = view.mode === 'day' ? 1 : 7;
    const nav = (n) => () => { view.anchor = U.addDays(view.anchor, n * step); S().commit(() => {}); };

    const head = h('div', { class: 'page-head' },
      h('div', {}, h('h1', { text: 'Weekly Plan' }), h('p', { class: 'muted', text: rangeLabel(days) })),
      h('div', { class: 'head-actions' },
        h('div', { class: 'segmented seg-sm', role: 'group', 'aria-label': 'View' },
          h('button', { type: 'button', class: view.mode === 'week' ? 'is-on' : '', 'aria-pressed': String(view.mode === 'week'), text: 'Week', onclick: () => { view.mode = 'week'; S().commit(() => {}); } }),
          h('button', { type: 'button', class: view.mode === 'day' ? 'is-on' : '', 'aria-pressed': String(view.mode === 'day'), text: 'Day', onclick: () => { view.mode = 'day'; if (U.startOfWeek(view.anchor) !== U.startOfWeek(s.now)) view.anchor = U.startOfDay(view.anchor); S().commit(() => {}); } })),
        btn('', { icon: 'chevronLeft', aria: 'Previous', onclick: nav(-1) }),
        btn('Today', { onclick: () => { view.anchor = U.startOfDay(s.now); S().commit(() => {}); } }),
        btn('', { icon: 'chevron', aria: 'Next', onclick: nav(1) }),
        btn('Add task', { kind: 'primary', icon: 'plus', id: 'add-task-btn', onclick: () => PF.flow.addTask({ when: 'floating' }) })));

    const legend = h('div', { class: 'legend' },
      h('span', { class: 'leg leg-flex' }, icon('waves', 12), ' Floating work'),
      h('span', { class: 'leg leg-anchored' }, icon('anchor', 11), ' Anchored event'),
      h('span', { class: 'leg leg-class', text: 'Class' }),
      h('span', { class: 'leg leg-anchored-session' }, icon('anchor', 11), ' Anchored by you'),
      h('span', { class: 'leg leg-skipped', text: 'Skipped' }),
      h('span', { class: 'leg leg-done' }, icon('check', 11), ' Done'),
      h('span', { class: 'muted leg-hint', text: 'Drag a block to move it. Click any block for details, or an empty slot to add an anchored task.' }));

    const attention = s.tasks.filter((t) => t.status === 'active' && (t.sched === 'partial' || t.sched === 'unscheduled'));
    const banner = attention.length
      ? h('div', { class: 'banner banner-warn', role: 'status' }, icon('warn', 16),
        h('div', { class: 'grow' }, h('strong', { text: U.plural(attention.length, 'task') + ' not fully scheduled. ' }),
          attention.map((t) => h('span', { class: 'banner-item' }, '“' + t.title + '” ' + (t.sched === 'partial' ? '(' + U.fmtDur(t.shortfallMin) + ' short)' : '(unscheduled)') + ' ',
            h('button', { type: 'button', class: 'link', text: 'Fix', onclick: () => PF.flow.settle([t.id]).then((r) => PF.flow.report(r)) })))))
      : null;

    // header row
    const colTpl = '56px repeat(' + days.length + ', minmax(' + (view.mode === 'day' ? 280 : 96) + 'px, 1fr))';
    const dayHead = h('div', { class: 'cal-head', style: { gridTemplateColumns: colTpl } }, h('div'),
      days.map((d) => {
        const isToday = U.sameDay(d, s.now);
        return h('div', { class: 'cal-dayname' + (isToday ? ' is-today' : '') }, h('span', { text: new Date(d).toLocaleDateString('en-US', { weekday: 'short' }) }), h('strong', { text: String(new Date(d).getDate()) }));
      }));

    // body
    const gutter = h('div', { class: 'cal-gutter', style: { height: (END_H - START_H) * HOUR + 'px' } },
      Array.from({ length: END_H - START_H }, (_, i) => h('span', { style: { top: i * HOUR - 7 + 'px' }, text: i === 0 ? '' : U.clockLabel(String(START_H + i).padStart(2, '0') + ':00') })));
    const grid = h('div', { class: 'cal-body', style: { gridTemplateColumns: colTpl } }, gutter);
    // Shade the hours outside work hours. Work hours may cross midnight (10 AM to 3 AM)
    // or fill the whole day.
    const ws = U.minutesOfDay(U.atClock(0, s.prefs.workStart));
    const span = E.spanMin(s.prefs.workStart, s.prefs.workEnd);
    const offBands = () => {
      if (span >= 1440) return [];
      const we = (ws + span) % 1440;
      const band = (a, b) => h('div', { class: 'cal-off', style: { top: (a / 60) * HOUR + 'px', height: ((b - a) / 60) * HOUR + 'px' } });
      return ws + span <= 1440 ? [band(0, ws), band(we, 1440)].filter((x) => x.style.height !== '0px') : [band(we, ws)];
    };
    for (const day of days) {
      const col = h('div', { class: 'cal-col', 'data-day': String(day), style: { height: (END_H - START_H) * HOUR + 'px' } });
      col.append(...offBands());
      const dayEnd = U.addDays(day, 1);
      const pieces = s.blocks.filter((b) => b.start < dayEnd && b.end > day).map((b) => ({ b, s: Math.max(b.start, day), e: Math.min(b.end, dayEnd) }));
      for (const info of lanes(pieces)) col.append(blockEl(info.b, info, day, grid));
      if (U.sameDay(day, s.now)) col.append(h('div', { class: 'cal-now', style: { top: ((U.minutesOfDay(s.now) - START_H * 60) / 60) * HOUR + 'px' }, title: 'Now: ' + U.fmtTime(s.now) }));
      col.addEventListener('click', (e) => {
        if (e.target !== col && !e.target.classList.contains('cal-off') && !e.target.classList.contains('cal-now')) return;
        const y = e.clientY - col.getBoundingClientRect().top;
        const mins = Math.floor((START_H * 60 + (y / HOUR) * 60) / 30) * 30;
        const d = new Date(day);
        d.setHours(0, mins, 0, 0);
        PF.flow.addTask({ when: 'anchored', start: d.getTime() });
      });
      grid.append(col);
    }
    const scroll = h('div', { class: 'cal-scroll' }, grid);
    scroll.addEventListener('scroll', () => { view.scrollTop = scroll.scrollTop; });

    root.replaceChildren(...[head, legend, banner, h('div', { class: 'cal' }, h('div', { class: 'cal-x' }, dayHead, scroll))].filter(Boolean));
    scroll.scrollTop = view.scrollTop != null ? view.scrollTop : Math.max(0, (Math.min(7, U.minutesOfDay(s.now) / 60 - 1) - START_H) * HOUR);
  }

  PF.views = PF.views || {};
  PF.views.plan = render;
})();
