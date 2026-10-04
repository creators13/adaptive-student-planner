/* Repeat settings: which days something happens on (daily / weekly / monthly, every N,
   selected weekdays, ends), kept separate from when on those days it can happen.
   "All of them" = one occurrence on each selected day (gym Mon, Wed, Fri).
   "Any one of them" = one occurrence per week or month on one of the selected days
   (laundry Sat or Sun); offered for floating "other" tasks only.
   Assignments repeat by shifting their whole window, so they get no day picker. */
(function () {
  'use strict';
  const PF = (window.PF = window.PF || {});
  const { h, field } = PF.ui;
  const U = PF.util;

  const DAYS = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]];
  const NAMES = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
  const ordName = (n) => (n === -1 ? 'last' : ORD[(n || 1) - 1]);
  const UNIT = { daily: ['day', 'days'], weekly: ['week', 'weeks'], monthly: ['month', 'months'] };

  PF.ui.newRule = () => ({ freq: 'none', every: 1, days: [], mode: 'all', nth: 1, ends: { type: 'never', date: '', count: 4 } });

  // "Every 2 weeks on Sat or Sun", "Weekly on Mon, Wed, Fri", "Monthly on the 2nd Tue"
  PF.ui.repeatLabel = (r) => {
    if (!r || r.freq === 'none') return '';
    const n = Math.max(1, r.every || 1);
    const many = UNIT[r.freq][1];
    let s = n === 1 ? { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[r.freq] : 'Every ' + n + ' ' + many;
    if (r.freq !== 'daily' && r.days && r.days.length) {
      const order = DAYS.map((d) => d[1]).filter((d) => r.days.includes(d)).map((d) => NAMES[d]);
      const list = r.mode === 'any' ? order.join(' or ') : order.join(', ');
      s += r.freq === 'monthly' ? ' on the ' + ordName(r.nth) + ' ' + list : ' on ' + list; // "the 2nd Tue", "the last Fri"
    }
    return s;
  };

  /* kind: 'anchored' | 'other' | 'assignment'. `rule` is mutated in place so a redraw of the
     surrounding form keeps it. anchorDay() returns the first day, for default weekdays. */
  PF.ui.repeatEditor = function (kind, rule, anchorDay, onChange) {
    const el = h('div', { class: 'repeat stack-sm' });
    const changed = () => { draw(); if (onChange) onChange(); };
    function draw() {
      const freq = h('select', { id: 'rp-freq', onchange: (e) => { rule.freq = e.target.value; if (rule.freq !== 'none' && !rule.days.length) rule.days = [new Date(anchorDay()).getDay()]; changed(); } },
        [['none', 'Does not repeat'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([v, l]) => h('option', { value: v, text: l })));
      freq.value = rule.freq;
      const parts = [field('Repeat', freq)];
      if (rule.freq !== 'none') {
        const [one, many] = UNIT[rule.freq];
        parts.push(h('div', { class: 'inline' }, h('span', { text: 'Every' }),
          h('input', { type: 'number', min: 1, max: 12, value: rule.every, id: 'rp-every', 'aria-label': 'Repeat every', style: { maxWidth: '80px' }, oninput: (e) => { rule.every = Math.max(1, Number(e.target.value) || 1); } }),
          h('span', { class: 'muted', text: rule.every === 1 ? one : many })));
        if (kind !== 'assignment' && rule.freq !== 'daily') {
          parts.push(h('div', { class: 'field' }, h('div', { class: 'label', text: 'On' }),
            h('div', { class: 'day-picks', role: 'group', 'aria-label': 'Days' }, DAYS.map(([name, wd]) => {
              const on = rule.days.includes(wd);
              return h('button', { type: 'button', class: 'day-pick' + (on ? ' is-on' : ''), 'aria-pressed': String(on), text: name, onclick: () => {
                if (on && rule.days.length === 1) return; // keep at least one day
                rule.days = on ? rule.days.filter((d) => d !== wd) : rule.days.concat(wd);
                changed();
              } });
            }))));
          if (rule.freq === 'monthly') {
            // The Nth occurrence of each selected day in the month: "the 2nd Tuesday", "the last Friday".
            const nth = h('select', { id: 'rp-nth', onchange: (e) => { rule.nth = Number(e.target.value); changed(); } },
              ORD.map((o, i) => h('option', { value: String(i + 1), text: 'The ' + o })), h('option', { value: '-1', text: 'The last' }));
            nth.value = String(rule.nth);
            parts.push(field('Which one in the month', nth, PF.ui.repeatLabel(rule)));
          }
          if (kind === 'other' && rule.days.length > 1) {
            const mode = h('select', { id: 'rp-mode', onchange: (e) => { rule.mode = e.target.value; changed(); } },
              h('option', { value: 'all', text: 'All of them: once on each selected day' }),
              h('option', { value: 'any', text: 'Any one of them: once per ' + one + ', on one of these days' }));
            mode.value = rule.mode;
            parts.push(field('Selected days mean', mode));
          }
        }
        if (kind === 'assignment') parts.push(h('p', { class: 'hint', text: 'Each repeat moves the whole window (start after to complete by) forward.' }));
        const endType = h('select', { id: 'rp-ends', onchange: (e) => { rule.ends.type = e.target.value; changed(); } },
          h('option', { value: 'never', text: 'Never' }), h('option', { value: 'on', text: 'On a date' }), h('option', { value: 'after', text: 'After a number of times' }));
        endType.value = rule.ends.type;
        const endRow = [field('Ends', endType)];
        if (rule.ends.type === 'on') endRow.push(field('End date', h('input', { type: 'date', id: 'rp-end-date', value: rule.ends.date, oninput: (e) => { rule.ends.date = e.target.value; } })));
        if (rule.ends.type === 'after') endRow.push(field('Times', h('input', { type: 'number', min: 1, max: 60, id: 'rp-count', value: rule.ends.count, oninput: (e) => { rule.ends.count = Math.max(1, Number(e.target.value) || 1); } })));
        parts.push(h('div', { class: 'grid-2' }, endRow));
      }
      el.replaceChildren(...parts);
    }
    draw();
    return el;
  };

  // The rule in engine form (end date as a timestamp), or an error message.
  PF.ui.ruleForEngine = (rule, kind) => {
    if (rule.freq === 'none') return { rule: { freq: 'none' } };
    if (rule.ends.type === 'on' && Number.isNaN(U.fromInputDate(rule.ends.date))) return { error: 'Choose the date the repeat ends.' };
    return {
      rule: {
        freq: rule.freq, every: rule.every, days: rule.days.slice(), nth: rule.nth,
        mode: kind === 'other' ? rule.mode : 'all',
        ends: { type: rule.ends.type, date: rule.ends.type === 'on' ? U.fromInputDate(rule.ends.date) : null, count: rule.ends.count },
      },
    };
  };
})();
