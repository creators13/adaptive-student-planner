/* Tasks: the to-do list. Every floating task with its status, estimate, milestones and
   sessions. "Log progress" is how a student reports work done outside a planned session. */
(function () {
  'use strict';
  const PF = (window.PF = window.PF || {});
  const { h, btn, icon } = PF.ui;
  const U = PF.util;
  const E = PF.engine;
  const S = () => PF.store;

  const ui = { q: '', course: '', sort: 'deadline', expanded: new Set(), showDone: false };

  function status(t) {
    if (t.sched === 'unscheduled') return ['bad', 'Unscheduled'];
    if (t.sched === 'partial') return ['warn', 'Partly scheduled'];
    if (t.loggedMin > 0 || t.milestones.some((m) => m.done)) return ['info', 'In progress'];
    return ['ok', 'Scheduled'];
  }

  function sessionsOf(t) {
    const s = S().state;
    return s.blocks.filter((b) => b.taskId === t.id && b.kind === 'session' && b.state === 'planned').sort((a, b) => a.start - b.start);
  }

  function detail(t) {
    const s = S().state;
    const sess = sessionsOf(t);
    return h('div', { class: 'task-detail' },
      h('div', {},
        h('h4', { text: 'Sessions' }),
        sess.length
          ? h('ul', { class: 'plain' }, sess.map((b) => h('li', {}, b.anchored ? icon('anchor', 12) : null, ' ' + U.fmtDay(b.start) + ' · ' + U.fmtRange(b.start, b.end) + (b.anchored ? ' (anchored)' : ''))))
          : h('p', { class: 'muted', text: t.sched === 'unscheduled' ? 'Nothing is scheduled yet.' : 'No sessions left.' })),
      t.milestones.length
        ? h('div', {},
          h('h4', { text: 'Milestones' }),
          h('ul', { class: 'plain' }, t.milestones.map((m) => h('li', { class: m.done ? 'is-done' : '' }, icon(m.done ? 'check' : 'clock', 12), ' ' + m.title + ' · ' + U.fmtDur(m.estMin)))),
          t.pace && t.pace !== 1 ? h('p', { class: 'hint', text: 'Your pace on this one: ' + (t.pace < 1 ? 'faster' : 'slower') + ' than estimated (×' + t.pace + '). Remaining time is scaled to match.' }) : null)
        : null,
      h('div', {},
        h('h4', { text: 'Estimate' }),
        h('p', { class: 'muted', text: 'Total ' + U.fmtDur(t.totalMin) + ', ' + U.fmtDur(t.needMin) + ' left, ' + U.fmtDur(t.loggedMin) + ' logged. Source: ' + (t.prediction ? t.prediction.model : 'your estimate') + ' (placeholder, no trained model yet).' }),
        (() => {
          const ov = h('input', { type: 'number', min: 5, step: 5, value: t.needMin, id: 'ov-' + t.id, 'aria-label': 'Minutes left for ' + t.title });
          // A repeating task can change just this one or every upcoming one, like events.
          const scope = t.seriesId ? h('select', { id: 'ovs-' + t.id, 'aria-label': 'Apply to' }, h('option', { value: 'this', text: 'This one' }), h('option', { value: 'all', text: 'All upcoming' })) : null;
          return h('div', { class: 'inline' }, ov, h('span', { class: 'muted', text: 'min left' }), scope, btn('Override', { small: true, onclick: async () => {
            const v = Math.round(Number(ov.value));
            if (!(v > 0)) return;
            const ids = S().commit((st) => {
              const me = E.task(st, t.id);
              const targets = scope && scope.value === 'all'
                ? st.tasks.filter((x) => x.seriesId === t.seriesId && x.status === 'active' && x.startAfter >= me.startAfter)
                : [me];
              targets.forEach((x) => { E.overrideEstimate(st, x, v); if (!x.loggedMin) x.totalMin = x.needMin; });
              return targets.map((x) => x.id);
            });
            PF.flow.report(await PF.flow.settle(ids), { prefix: 'Estimate changed to ' + U.fmtDur(v) + (ids.length > 1 ? ' for ' + ids.length + ' upcoming.' : '.') });
          } }));
        })(),
        null),
      h('div', { class: 'row' }, btn('Delete task', { kind: 'danger', small: true, icon: 'trash', onclick: async () => {
        if (!(await PF.ui.confirm({ title: 'Delete “' + t.title + '”?', message: 'Its sessions are removed from your plan too.', confirmLabel: 'Delete', danger: true }))) return;
        S().commit((st) => { st.tasks = st.tasks.filter((x) => x.id !== t.id); st.blocks = st.blocks.filter((b) => b.taskId !== t.id); st.pending = st.pending.filter((p) => st.blocks.some((b) => b.id === p.blockId)); });
      } })));
  }

  function row(t, more) {
    const s = S().state;
    const [tone, label] = status(t);
    const open = ui.expanded.has(t.id);
    const doneMs = t.milestones.filter((m) => m.done).length;
    // Progress: milestones done, or (assignments without milestones) the slider, even at 0%.
    const pct = t.milestones.length ? Math.round((doneMs / t.milestones.length) * 100) : t.type === 'assignment' ? t.progressPct || 0 : null;
    const anchoredN = sessionsOf(t).filter((b) => b.anchored).length;
    const sub = t.type === 'assignment' && t.completeBy
      ? 'Target finish ' + U.fmtDate(E.deadlineFor(s, t)) + (E.prefsFor(s, t, s.now).bufferDays ? ' (' + U.plural(E.prefsFor(s, t, s.now).bufferDays, 'day') + ' early)' : '')
      : t.type === 'other' ? 'Window ' + U.fmtDate(t.startAfter) + (t.completeBy && !U.sameDay(t.startAfter, t.completeBy) ? '–' + U.fmtDate(t.completeBy) : '') +
        (t.dayWindow ? ', ' + U.clockLabel(t.dayWindow.from) + '–' + U.clockLabel(t.dayWindow.to) : '') : 'No deadline';
    return h('div', { class: 'task-card' },
      h('div', { class: 'task-row' },
        h('div', { class: 'tr-main' },
          h('button', { type: 'button', class: 'icon-btn chev' + (open ? ' is-open' : ''), 'aria-label': (open ? 'Hide' : 'Show') + ' details for ' + t.title, 'aria-expanded': String(open), onclick: () => { if (open) ui.expanded.delete(t.id); else ui.expanded.add(t.id); S().commit(() => {}); } }, icon('chevron', 16)),
          h('div', {},
            h('div', { class: 'task-title', text: t.title }),
            h('div', { class: 'muted small', text: sub }),
            t.rule ? h('div', { class: 'muted small' }, icon('repeat', 11), ' ' + PF.ui.repeatLabel(t.rule) + (more > 0 ? ' · ' + more + ' more upcoming' : '')) : null)),
        h('div', { class: 'tr-course' }, t.course ? h('span', { class: 'pill pill-blue', text: t.course }) : h('span', { class: 'muted', text: '—' })),
        h('div', { class: 'tr-due' }, t.completeBy ? U.fmtDate(t.completeBy) : 'Anytime'),
        h('div', { class: 'tr-est' }, h('strong', { text: U.fmtDur(t.needMin) + ' left' }), pct != null ? h('div', { class: 'bar', role: 'img', 'aria-label': pct + ' percent done' }, h('span', { style: { width: pct + '%' } })) : h('div', { class: 'muted small', text: 'of ' + U.fmtDur(t.totalMin) })),
        h('div', { class: 'tr-status' }, h('span', { class: 'badge badge-' + tone, text: label }), anchoredN ? h('span', { class: 'pill', title: 'Has anchored sessions' }, icon('anchor', 10), ' ' + anchoredN + ' anchored') : h('span', { class: 'pill pill-blue' }, icon('waves', 11), ' Floating')),
        h('div', { class: 'tr-act' },
          t.sched === 'partial' || t.sched === 'unscheduled' ? btn('Fix', { small: true, onclick: () => PF.flow.settle([t.id]).then((r) => PF.flow.report(r)) }) : null,
          t.type === 'assignment' ? btn('Log progress', { small: true, id: 'log-' + t.id, onclick: () => PF.flow.logProgress(t.id) }) : btn('Mark done', { small: true, id: 'done-' + t.id, onclick: () => PF.flow.markOtherDone(t.id) }))),
      open ? detail(t) : null);
  }

  function render(root) {
    const s = S().state;
    const active = s.tasks.filter((t) => t.status === 'active');
    const courses = [...new Set(active.map((t) => t.course).filter(Boolean))].sort();

    const list = h('div', { class: 'task-list' });
    function drawList() {
      let rows = active.filter((t) => (!ui.course || t.course === ui.course) && (!ui.q || (t.title + ' ' + t.course).toLowerCase().includes(ui.q.toLowerCase())));
      const key = (t) => (ui.sort === 'title' ? t.title.toLowerCase() : ui.sort === 'status' ? ['unscheduled', 'partial', 'scheduled'].indexOf(t.sched) : E.deadlineFor(s, t));
      rows.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
      // Repeating tasks collapse to their next occurrence.
      const seen = new Map();
      rows = rows.filter((t) => {
        if (!t.seriesId) return true;
        if (seen.has(t.seriesId)) { seen.set(t.seriesId, seen.get(t.seriesId) + 1); return false; }
        seen.set(t.seriesId, 0);
        return true;
      });
      const head = h('div', { class: 'task-head', role: 'row' }, ['Task', 'Course', 'Deadline', 'Remaining', 'Status', ''].map((x) => h('div', { role: 'columnheader', text: x })));
      list.replaceChildren(head, ...(rows.length ? rows.map((t) => row(t, t.seriesId ? seen.get(t.seriesId) : 0)) : [h('div', { class: 'empty', text: active.length ? 'No tasks match.' : 'No tasks yet. Add one and Inflow will schedule it.' })]));
    }

    const search = h('input', { type: 'search', placeholder: 'Search tasks', value: ui.q, 'aria-label': 'Search tasks', oninput: (e) => { ui.q = e.target.value; drawList(); } });
    const courseSel = h('select', { 'aria-label': 'Filter by course', onchange: (e) => { ui.course = e.target.value; drawList(); } }, h('option', { value: '', text: 'All courses' }), courses.map((c) => h('option', { value: c, text: c })));
    courseSel.value = ui.course;
    const sortSel = h('select', { 'aria-label': 'Sort', onchange: (e) => { ui.sort = e.target.value; drawList(); } }, h('option', { value: 'deadline', text: 'Sort: Deadline' }), h('option', { value: 'title', text: 'Sort: Name' }), h('option', { value: 'status', text: 'Sort: Needs attention' }));
    sortSel.value = ui.sort;
    drawList();

    const done = s.completed.slice().sort((a, b) => b.at - a.at);
    const doneSection = h('section', { class: 'card' },
      h('button', { type: 'button', class: 'section-toggle', 'aria-expanded': String(ui.showDone), onclick: () => { ui.showDone = !ui.showDone; S().commit(() => {}); } }, icon('chevron', 14), ' Completed (' + done.length + ')'),
      ui.showDone ? (done.length
        ? h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['Task', 'Predicted', 'Actual', 'Difference'].map((x) => h('th', { text: x })))),
          h('tbody', {}, done.map((c) => {
            const d = c.actualMin - c.predictedMin;
            return h('tr', {}, h('td', { text: c.title + (c.sample ? ' (sample)' : '') }), h('td', { text: U.fmtDur(c.predictedMin) }), h('td', { text: U.fmtDur(c.actualMin) }),
              h('td', {}, h('span', { class: 'badge badge-' + (Math.abs(d) <= 10 ? 'ok' : d > 0 ? 'warn' : 'info'), text: (d > 0 ? '+' : d < 0 ? '−' : '') + U.fmtDur(Math.abs(d)) })));
          }))),
          h('p', { class: 'hint', text: 'Each finished task is stored as a training example: the prediction, and the real total time. Time logged on unfinished work is never used as a label.' }))
        : h('p', { class: 'muted', text: 'Finished tasks appear here with predicted and actual time.' })) : null);

    root.replaceChildren(
      h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: 'Tasks' }), h('p', { class: 'muted', text: 'Manage deadlines and let Inflow build your schedule.' })),
        h('div', { class: 'head-actions' }, btn('Add task', { kind: 'primary', icon: 'plus', id: 'add-task-btn', onclick: () => PF.flow.addTask({ when: 'floating' }) }))),
      h('div', { class: 'toolbar' }, search, courseSel, sortSel),
      list, doneSection);
  }

  PF.views = PF.views || {};
  PF.views.tasks = render;
})();
