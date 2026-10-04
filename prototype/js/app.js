/* App shell: sidebar navigation, hash routing, the feedback badge, and the
   "Prototype controls" panel that fast-forwards the demo clock so you can see flow 2
   without waiting for a real session to end. */
(function () {
  'use strict';
  const PF = (window.PF = window.PF || {});
  const { h, btn, icon, toast, confirm } = PF.ui;
  const U = PF.util;
  const E = PF.engine;

  PF.store.init();
  const S = () => PF.store;

  // Browser notification when a session ends (only if the student has allowed them).
  PF.notify = (title, body) => {
    try {
      if (S().state.notifications.feedback && 'Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
    } catch (e) { /* notifications are best effort */ }
  };

  const routes = [['dashboard', 'Dashboard', 'grid'], ['plan', 'Weekly Plan', 'calendar'], ['tasks', 'Tasks', 'tasks'], ['settings', 'Settings', 'settings']];
  const current = () => { const k = (location.hash || '').replace(/^#\/?/, ''); return routes.some((r) => r[0] === k) ? k : 'plan'; };

  /* ---------- shell ---------- */
  const view = h('main', { id: 'view', class: 'main', tabindex: '-1' });
  const navLinks = routes.map(([k, label, ic]) => h('a', { href: '#/' + k, class: 'nav-item', 'data-route': k }, icon(ic, 18), h('span', { text: label })));
  const badge = h('span', { class: 'count', 'aria-label': 'waiting for feedback' });
  const feedbackNav = h('button', { type: 'button', class: 'nav-item nav-btn', id: 'nav-feedback', onclick: () => PF.flow.openPending() }, icon('bell', 18), h('span', { text: 'Session feedback' }), badge);
  const user = h('div', { class: 'user' }, h('div', { class: 'avatar', 'aria-hidden': 'true', text: 'MC' }), h('div', {}, h('div', { class: 'task-title', text: 'Maya Chen' }), h('div', { class: 'muted small', text: 'Student plan' })));
  const sidebar = h('nav', { class: 'sidebar', 'aria-label': 'Main' },
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, icon('inflow', 20)), h('span', { class: 'brand-name' }, h('span', { class: 'brand-in', text: 'in' }), h('span', { class: 'brand-flow', text: 'flow' }))),
    h('div', { class: 'nav' }, navLinks, feedbackNav), user);
  // (the prototype controls panel is added to the sidebar below, above the user card)

  /* ---------- prototype controls ---------- */
  const clockEl = h('div', { class: 'demo-clock', id: 'demo-clock', 'aria-live': 'polite' });

  function afterAdvance(added) {
    if (!added.length) return;
    const s = S().state;
    const first = E.block(s, added[0]);
    PF.notify('Session ended', (first ? first.title : 'A session') + ': how did it go?' + (added.length > 1 ? ' (+' + (added.length - 1) + ' more)' : ''));
    // In real use the pop-up appears when the student next opens the app. The demo shows it right away.
    if (!document.body.classList.contains('modal-open')) setTimeout(() => PF.flow.openPending(), 300);
  }
  const advanceTo = (ts) => afterAdvance(S().advance(ts));
  function endNext() {
    const s = S().state;
    const next = s.blocks.filter((b) => b.end > s.now && E.promptKind(s, b) !== 'none' && !s.pending.some((p) => p.blockId === b.id)).sort((a, b) => a.end - b.end)[0];
    if (!next) { toast('No more sessions with feedback prompts in the plan.'); return; }
    advanceTo(next.end + U.MIN);
  }
  const demo = h('aside', { class: 'demo', 'aria-label': 'Prototype controls' },
    h('details', { open: window.innerWidth > 900 },
      h('summary', {}, 'Prototype controls ', h('span', { class: 'tag', text: 'sample data' })),
      clockEl,
      h('div', { class: 'demo-btns' },
        btn('End next session', { kind: 'primary', small: true, id: 'demo-end', onclick: endNext }),
        btn('+1 hour', { small: true, id: 'demo-hour', onclick: () => advanceTo(S().state.now + U.HOUR) }),
        btn('+1 day', { small: true, id: 'demo-day', onclick: () => advanceTo(U.addDays(S().state.now, 1)) }),
        btn('Reset', { small: true, id: 'demo-reset', onclick: async () => {
          if (!(await confirm({ title: 'Reset sample data?', message: 'This clears everything you added and restarts the demo clock.', confirmLabel: 'Reset', danger: true }))) return;
          const was = S().state.onboarded;
          S().reset();
          S().commit((s) => { s.onboarded = was; });
          location.hash = '#/plan';
        } })),
      h('p', { class: 'hint', text: 'Real sessions end on their own. These buttons move a demo clock forward so you can try the after-session flow now.' })));

  sidebar.insertBefore(demo, user);
  document.getElementById('app').append(h('div', { class: 'app' }, sidebar, view));

  /* ---------- render ---------- */
  function refresh() {
    const s = S().state;
    const r = current();
    navLinks.forEach((a) => { const on = a.dataset.route === r; a.classList.toggle('is-on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    badge.textContent = String(s.pending.length);
    badge.hidden = s.pending.length === 0;
    clockEl.textContent = 'Demo time: ' + U.fmtDay(s.now) + ', ' + U.fmtTime(s.now);
    PF.views[r](view);
  }
  S().subscribe(refresh);
  window.addEventListener('hashchange', refresh);
  refresh();

  if (!S().state.onboarded) PF.flow.onboarding();
  else if (S().state.pending.length) setTimeout(() => PF.flow.openPending(), 600); // "next visit" pop-up
})();
