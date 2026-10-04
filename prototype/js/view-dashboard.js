/* Dashboard: a weekly overview, today's focus, and anything waiting on the student
   (feedback to give, tasks that are not fully scheduled). */
(function () {
  'use strict';
  const PF = (window.PF = window.PF || {});
  const { h, btn, icon } = PF.ui;
  const U = PF.util;
  const E = PF.engine;
  const S = () => PF.store;

  function stat(label, value, sub, ic) {
    return h('div', { class: 'stat' }, h('div', { class: 'stat-top' }, h('span', { class: 'muted', text: label }), h('span', { class: 'stat-ic' }, icon(ic, 16))),
      h('div', { class: 'stat-val', text: value }), h('div', { class: 'muted small', text: sub }));
  }

  function render(root) {
    const s = S().state;
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

    const todayCard = h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: 'Today’s focus' }), h('a', { href: '#/plan', class: 'link', text: 'Open plan' })),
      todays.length
        ? h('ul', { class: 'focus-list' }, todays.map((b) => h('li', { class: b.state === 'skipped' ? 'is-skipped' : b.state === 'done' ? 'is-done' : '' },
          h('span', { class: 'ck' }, b.state === 'done' ? icon('check', 12) : null),
          h('div', {}, h('div', { class: 'task-title', text: b.title }), h('div', { class: 'muted small', text: U.fmtRange(b.start, b.end) + (b.anchored ? ' · anchored' : '') + (b.state === 'skipped' ? ' · skipped' : '') })))))
        : h('p', { class: 'muted', text: 'Nothing scheduled today.' }));

    const needs = [];
    for (const p of pending) {
      const b = E.block(s, p.blockId);
      if (!b) continue;
      needs.push(h('li', {}, h('div', {}, h('div', { class: 'task-title', text: b.title }), h('div', { class: 'muted small', text: 'Ended ' + U.fmtDay(b.end) + ' ' + U.fmtTime(b.end) + ' · feedback needed' })),
        btn('Answer', { small: true, onclick: () => PF.flow.feedbackFor(b.id) })));
    }
    for (const t of attention) {
      needs.push(h('li', {}, h('div', {}, h('div', { class: 'task-title', text: t.title }), h('div', { class: 'muted small', text: t.sched === 'partial' ? U.fmtDur(t.shortfallMin) + ' still needs a slot' : 'Not scheduled' })),
        btn('Fix', { small: true, onclick: () => PF.flow.settle([t.id]).then((r) => PF.flow.report(r)) })));
    }
    const attentionCard = h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: 'Needs your attention' })),
      needs.length ? h('ul', { class: 'attn-list' }, needs) : h('p', { class: 'muted', text: 'All caught up. Feedback prompts and scheduling problems show up here.' }));

    root.replaceChildren(
      h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: 'Dashboard' }), h('p', { class: 'muted', text: U.fmtDate(weekStart) + ' – ' + U.fmtDate(U.addDays(weekStart, 6)) })),
        h('div', { class: 'head-actions' }, btn('Add task', { kind: 'primary', icon: 'plus', id: 'add-task-btn', onclick: () => PF.flow.addTask({ when: 'floating' }) }))),
      h('div', { class: 'stats' },
        stat('Open tasks', String(active.length), attention.length ? attention.length + ' not fully scheduled' : 'All scheduled', 'tasks'),
        stat('Completed', String(s.completed.length), doneThisWeek + ' this week', 'check'),
        stat('Focus time', U.fmtDur(focus), U.plural(doneBlocks.length, 'session') + ' logged this week', 'clock')),
      h('div', { class: 'two-col' }, todayCard, attentionCard));
  }

  PF.views = PF.views || {};
  PF.views.dashboard = render;
})();
