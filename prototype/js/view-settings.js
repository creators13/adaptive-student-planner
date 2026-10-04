/* Settings: the scheduling preferences the planner needs (also asked at first run),
   temporary relaxations, and notification options. */
(function () {
  'use strict';
  const PF = (window.PF = window.PF || {});
  const { h, btn, field, modal, toast, icon } = PF.ui;
  const U = PF.util;
  const E = PF.engine;
  const S = () => PF.store;

  const hours = (from, to) => { const out = []; for (let i = from; i <= to; i++) out.push(String(i).padStart(2, '0') + ':00'); return out; };
  const ENERGY = [['morning', 'Morning', '9 AM–12 PM'], ['afternoon', 'Afternoon', '12–5 PM'], ['evening', 'Evening', '5–9 PM']];

  // Normalize "24:00" (older data) to "00:00"; work hours wrap past midnight anyway.
  const norm = (hhmm) => (hhmm === '24:00' ? '00:00' : hhmm);

  // "No work after" choices: every hour after the start, up to a full 24 hours.
  function endOptions(start, current) {
    const sMin = Number(start.split(':')[0]) * 60 + Number(start.split(':')[1] || 0);
    const opts = [];
    for (let k = 1; k <= 24; k++) {
      const m = (sMin + k * 60) % 1440;
      const v = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
      const label = k === 24 ? 'Same time next day (all 24 hours)' : U.clockLabel(v) + (sMin + k * 60 >= 1440 ? ' (next day)' : '');
      opts.push(h('option', { value: v, text: label }));
    }
    const sel = h('select', { id: 'pf-end' }, opts);
    sel.value = norm(current);
    if (sel.value !== norm(current)) sel.value = opts[Math.min(10, opts.length - 1)].value;
    return sel;
  }

  /* The preference form, shared by first-run setup and Settings. get() returns a prefs object.
     PLACEHOLDER: which preferences to collect, and their defaults, are for the team to refine. */
  PF.ui.prefsForm = function (p) {
    const sel = (id, label, options, value, fmt, hint) => {
      const el = h('select', { id }, options.map((o) => h('option', { value: String(o), text: fmt(o) })));
      el.value = String(value);
      return field(label, el, hint);
    };
    let energy = p.energy;
    const energyBtns = ENERGY.map(([k, label, sub]) => h('button', { type: 'button', class: 'choice' + (energy === k ? ' is-on' : ''), 'aria-pressed': String(energy === k), onclick: (e) => {
      energy = k;
      energyBtns.forEach((b) => { b.classList.remove('is-on'); b.setAttribute('aria-pressed', 'false'); });
      e.currentTarget.classList.add('is-on'); e.currentTarget.setAttribute('aria-pressed', 'true');
    } }, h('strong', { text: label }), h('span', { class: 'muted', text: sub })));
    const mins = (m) => m + ' minutes';
    const startSel = h('select', { id: 'pf-start' }, hours(0, 23).map((o) => h('option', { value: o, text: U.clockLabel(o) })));
    startSel.value = p.workStart;
    let endSel = endOptions(p.workStart, p.workEnd);
    const endField = field('No work after', endSel, 'Can run past midnight, up to all 24 hours. The planner never schedules past this unless you relax it.');
    startSel.addEventListener('change', () => {
      // Keep the same length of day when the start moves.
      const span = PF.engine.spanMin(p.workStart, endSel.value);
      p = Object.assign({}, p, { workStart: startSel.value });
      const m = (Number(startSel.value.split(':')[0]) * 60 + span) % 1440;
      const next = endOptions(startSel.value, String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
      endSel.replaceWith(next);
      endSel = next;
    });
    const ctl = {
      start: field('Available from', startSel),
      end: endField,
      session: sel('pf-session', 'Preferred session length', [25, 30, 45, 50, 60, 90], p.sessionMin, mins),
      min: sel('pf-min', 'Shortest session', [15, 20, 30, 45], p.minSession, mins),
      max: sel('pf-max', 'Longest session', [60, 90, 120, 180], p.maxSession, mins),
      brk: sel('pf-brk', 'Break after each session', [0, 5, 10, 15, 20], p.breakMin, (m) => (m ? m + ' minutes' : 'No break')),
      buf: sel('pf-buf', 'Finish assignments before the deadline by', [0, 1, 2, 3], p.bufferDays, (d) => (d ? U.plural(d, 'day') : 'No buffer')),
    };
    const el = h('div', { class: 'stack' },
      h('div', { class: 'grid-2' }, ctl.start, ctl.end),
      h('div', { class: 'grid-3' }, ctl.session, ctl.min, ctl.max),
      h('div', { class: 'grid-2' }, ctl.brk, ctl.buf),
      h('div', { class: 'field' }, h('div', { class: 'label', text: 'When is your energy highest?' }), h('div', { class: 'choices' }, energyBtns)));
    const v = (c) => c.querySelector('select').value;
    return {
      el,
      get: () => {
        const start = startSel.value;
        const end = endSel.value; // at or before the start means the next day
        const session = Number(v(ctl.session));
        const min = Math.min(Number(v(ctl.min)), session);
        const max = Math.max(Number(v(ctl.max)), session);
        return { workStart: start, workEnd: end, sessionMin: session, minSession: min, maxSession: max, breakMin: Number(v(ctl.brk)), bufferDays: Number(v(ctl.buf)), energy };
      },
    };
  };

  // First run: ask for preferences (or accept defaults).
  PF.flow.onboarding = function () {
    const form = PF.ui.prefsForm(S().state.prefs);
    const save = (prefs) => { S().commit((s) => { s.prefs = Object.assign({}, s.prefs, prefs); s.onboarded = true; }); m.close(); };
    const m = modal({
      eyebrow: 'Welcome to Inflow', title: 'When do you like to work?', size: 'md', dismissible: false,
      subtitle: 'Inflow uses this to place floating work in your free time. You can change it anytime in Settings.',
      body: form.el,
      actions: [btn('Use defaults', { id: 'onb-defaults', onclick: () => save({}) }), btn('Save and continue', { kind: 'primary', id: 'onb-save', onclick: () => save(form.get()) })],
    });
  };

  const toggle = (label, sub, key) => {
    const s = S().state;
    const id = 'n-' + key;
    return h('div', { class: 'toggle-row' }, h('div', {}, h('label', { for: id, text: label }), h('div', { class: 'muted small', text: sub })),
      h('input', { type: 'checkbox', role: 'switch', id, class: 'switch', checked: s.notifications[key], onchange: (e) => S().commit((st) => { st.notifications[key] = e.target.checked; }) }));
  };

  function render(root) {
    const s = S().state;
    const form = PF.ui.prefsForm(s.prefs);
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';

    const temp = s.overrides.length
      ? h('ul', { class: 'plain' }, s.overrides.map((o) => h('li', { class: 'temp-row' },
        h('span', {}, [o.workEnd ? 'Work until ' + U.clockLabel(o.workEnd) : null, o.bufferDays != null ? (o.bufferDays ? U.plural(o.bufferDays, 'day') + ' buffer' : 'no buffer') : null].filter(Boolean).join(', ') + ' · ' +
          (o.scope === 'task' ? 'one task' : o.until ? 'until ' + U.fmtDate(o.until) : 'until removed')),
        btn('Remove', { small: true, onclick: () => S().commit((st) => { st.overrides = st.overrides.filter((x) => x.id !== o.id); }) }))))
      : h('p', { class: 'muted', text: 'None. When work does not fit, you can relax a preference for a while. Those changes show up here.' });

    root.replaceChildren(
      h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: 'Settings' }), h('p', { class: 'muted', text: 'Manage your planning preferences and notifications.' })),
        h('div', { class: 'head-actions' }, btn('Save changes', { kind: 'primary', id: 'save-prefs', onclick: () => { S().commit((st) => { st.prefs = Object.assign({}, st.prefs, form.get()); }); toast('Saved. New preferences apply to work scheduled from now on.', { tone: 'ok' }); } }))),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { text: 'Work preferences' }), h('span', { class: 'muted small', text: 'Used for adaptive scheduling' })), form.el,
        h('p', { class: 'hint', text: 'Saving does not move work that is already scheduled.' })),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { text: 'Temporary changes' })), temp),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { text: 'Notifications' })),
        toggle('Session feedback', 'Ask how a session went when it ends', 'feedback'),
        h('div', { class: 'toggle-row' }, h('div', {}, h('div', { class: 'label', text: 'Browser notifications' }), h('div', { class: 'muted small', text: perm === 'granted' ? 'On. You will be notified when a session ends.' : perm === 'denied' ? 'Blocked in your browser settings.' : perm === 'unsupported' ? 'Not supported in this browser.' : 'Off. Turn on to hear about finished sessions when this tab is in the background.' })),
          perm === 'default' ? btn('Enable', { onclick: () => Notification.requestPermission().then(() => S().commit(() => {})) }) : null),
        toggle('Upcoming focus blocks', '15 minutes before', 'upcoming'),
        toggle('Deadline reminders', '24 hours before', 'deadlines'),
        toggle('Schedule changes', 'When Inflow reschedules', 'changes'),
        toggle('Weekly summary', 'Sunday evening', 'weekly'),
        h('p', { class: 'hint', text: 'Prototype note: only session feedback sends a notification. The other switches are placeholders.' })));
  }

  PF.views = PF.views || {};
  PF.views.settings = render;
})();
