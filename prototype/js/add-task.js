/* Flow 1, the front half: the Add Task dialog.
   "Pick a time" makes an anchored task (an event or a class, like a Google Calendar event).
   "Let Inflow schedule it" makes floating work: a class assignment (instructions,
   milestones, estimate) or an "other" task (earliest and latest time, duration).
   Times are to the minute; a date alone means the whole day. Submitting an anchored task
   runs the overlap check; floating work runs the fit check (flow-schedule.js). */
(function () {
  'use strict';
  const PF = (window.PF = window.PF || {});
  const { h, btn, field, modal, toast, icon } = PF.ui;
  const U = PF.util;
  const E = PF.engine;
  const S = () => PF.store;

  // opts: { when: 'anchored' | 'floating', start: ts }
  PF.flow.addTask = function (opts) {
    opts = opts || {};
    const s0 = S().state;
    const today = U.startOfDay(s0.now);
    const seedStart = opts.start || U.roundUp(s0.now + 60 * U.MIN, 30);
    const f = {
      when: opts.when || 'floating', type: 'assignment', title: '', rule: PF.ui.newRule(),
      // anchored
      evType: 'event', fDate: U.toInputDate(seedStart), fStart: U.clockOf(seedStart), fEnd: U.clockOf(seedStart + 60 * U.MIN), link: '',
      // assignment (empty times mean the whole day)
      course: '', startAfter: U.toInputDate(today), startTime: '', due: '', dueTime: '', canSplit: true,
      instrKind: 'text', instrText: '', instrFile: '', instrLink: '', durH: '', durM: '', override: '',
      // other
      winStart: U.toInputDate(today), winStartTime: '', winEnd: '', winEndTime: '', otherMin: '', otherSplit: false,
    };
    let editor = null; // milestone editor, created on demand
    let editorOrigin = ''; // 'generated' | 'manual'

    const body = h('div', { class: 'stack' });
    const err = h('div', { class: 'form-error', role: 'alert' });
    const hints = h('div', { class: 'overlap-hints', 'aria-live': 'polite' });

    const bind = (key, el) => { el.addEventListener('input', () => { f[key] = el.type === 'checkbox' ? el.checked : el.value; }); return el; };
    const text = (key, attrs) => bind(key, h('input', Object.assign({ type: 'text', value: f[key] }, attrs)));
    const date = (key, attrs) => bind(key, h('input', Object.assign({ type: 'date', value: f[key] }, attrs)));
    const time = (key) => bind(key, h('input', { type: 'time', value: f[key], step: 60 }));
    const num = (key, attrs) => bind(key, h('input', Object.assign({ type: 'number', min: 0, value: f[key] }, attrs)));
    const check = (key, label, hint) => {
      const c = bind(key, h('input', { type: 'checkbox', checked: f[key], id: U.uid('c') }));
      return h('div', { class: 'check' }, c, h('label', { for: c.id }, label, hint ? h('span', { class: 'hint', text: hint }) : null));
    };
    const anchorOf = (key) => () => { const d = U.fromInputDate(f[key]); return Number.isNaN(d) ? today : d; };

    /* ----- anchored ----- */
    function anchoredSection() {
      const assignments = S().state.tasks.filter((t) => t.status === 'active' && t.type === 'assignment');
      const evType = h('select', { id: 'at-evtype', onchange: (e) => { f.evType = e.target.value; draw(); } },
        h('option', { value: 'event', text: 'Event' }), h('option', { value: 'class', text: 'Class (lecture, lab, section)' }));
      evType.value = f.evType;
      const link = h('select', {}, h('option', { value: '', text: 'None' }), assignments.map((t) => h('option', { value: t.id, text: t.title })));
      link.value = f.link;
      link.addEventListener('change', () => { f.link = link.value; });
      const upd = () => setTimeout(updateHints, 0);
      const d = date('fDate'); const a = time('fStart'); const b = time('fEnd');
      [d, a, b].forEach((x) => x.addEventListener('input', upd));
      updateHints();
      return h('div', { class: 'stack' },
        h('div', { class: 'grid-2' }, field('Type', evType, f.evType === 'class' ? 'Classes stay put, never ask for feedback, and can be overlapped.' : null),
          f.evType === 'class' ? field('Course', text('course', { list: 'course-list', placeholder: 'e.g. CS 220' })) : h('div')),
        h('div', { class: 'grid-3' }, field('Date', d), field('Starts', a), field('Ends', b)),
        hints,
        PF.ui.repeatEditor('anchored', f.rule, anchorOf('fDate'), draw),
        f.evType === 'event' ? field('Counts toward an assignment', link, 'Time you set aside by hand for an assignment counts as work on it, so Inflow schedules less.') : null);
    }
    function updateHints() {
      const day = U.fromInputDate(f.fDate);
      if (Number.isNaN(day) || !f.fStart || !f.fEnd) { hints.replaceChildren(); return; }
      const st = U.atClock(day, f.fStart); const en = U.atClock(day, f.fEnd);
      const over = S().state.blocks.filter((b) => b.state === 'planned' && b.start < en && b.end > st);
      const classes = over.filter((b) => b.eventType === 'class');
      const others = f.evType === 'class' ? [] : over.filter((b) => b.eventType !== 'class');
      const lines = [];
      if (classes.length || (f.evType === 'class' && over.length)) lines.push(h('div', { class: 'hint-line' }, icon('calendar', 14), ' Overlaps ' + (f.evType === 'class' ? over : classes).map((b) => b.title).join(', ') + '. That is allowed.'));
      if (others.length) lines.push(h('div', { class: 'hint-line is-warn' }, icon('repeat', 14), ' Overlaps ' + [...new Set(others.map((b) => b.title))].join(', ') + '. You will be asked whether to move it or keep both.'));
      hints.replaceChildren(...lines);
    }

    /* ----- floating ----- */
    function typeCards() {
      const card = (key, title, sub) => h('button', { type: 'button', class: 'choice' + (f.type === key ? ' is-on' : ''), 'aria-pressed': String(f.type === key), onclick: () => { f.type = key; draw(); } },
        h('strong', { text: title }), h('span', { class: 'muted', text: sub }));
      return h('div', { class: 'choices' }, card('assignment', 'Class assignment', 'Instructions, milestones, and an estimate'), card('other', 'Not an assignment', 'Errands, chores, meals, social events, anything else'));
    }

    function instructions() {
      const kinds = [['text', 'Paste text'], ['image', 'Image'], ['pdf', 'PDF'], ['link', 'Link']];
      const tabs = h('div', { class: 'tabs', role: 'tablist' }, kinds.map(([k, l]) => h('button', { type: 'button', role: 'tab', class: 'tab' + (f.instrKind === k ? ' is-on' : ''), 'aria-selected': String(f.instrKind === k), text: l, onclick: () => { f.instrKind = k; draw(); } })));
      let input;
      if (f.instrKind === 'text') input = h('textarea', { rows: 4, placeholder: 'Paste the assignment instructions…', 'aria-label': 'Assignment instructions', value: f.instrText, oninput: (e) => { f.instrText = e.target.value; gate(); } });
      else if (f.instrKind === 'link') input = h('input', { type: 'url', placeholder: 'https://…', 'aria-label': 'Assignment link', value: f.instrLink, oninput: (e) => { f.instrLink = e.target.value; gate(); } });
      else input = h('div', { class: 'drop' }, icon('upload', 18), h('input', { type: 'file', accept: f.instrKind === 'pdf' ? '.pdf,application/pdf' : 'image/*', 'aria-label': 'Upload ' + f.instrKind, onchange: (e) => { f.instrFile = e.target.files[0] ? e.target.files[0].name : ''; draw(); } }), f.instrFile ? h('span', { class: 'ok-text', text: f.instrFile + ' attached' }) : h('span', { class: 'muted', text: 'Choose a file' }));
      const has = () => !!((f.instrKind === 'text' && f.instrText.trim()) || (f.instrKind === 'link' && f.instrLink.trim()) || ((f.instrKind === 'image' || f.instrKind === 'pdf') && f.instrFile));
      const gen = btn(editorOrigin === 'generated' ? 'Regenerate milestones' : 'Generate milestones', { kind: 'primary', small: true, icon: 'sparkle', disabled: !has(), onclick: () => {
        const list = PF.assistant.generate({ title: f.title, text: f.instrKind === 'text' ? f.instrText : '' });
        editorOrigin = 'generated';
        editor = PF.ui.milestoneEditor({ list, showDone: true, chatOpen: true, onChange: refreshEstimate });
        draw();
      } });
      function gate() { gen.disabled = !has(); refreshEstimate(); }
      return h('div', { class: 'stack-sm' },
        h('div', { class: 'label', text: 'Assignment instructions (optional)' }), tabs, input,
        f.instrKind !== 'text' ? h('p', { class: 'hint', text: 'Prototype note: files and links are not read. Milestones come from the title and any pasted text.' }) : null,
        h('div', { class: 'row' }, gen, !editor ? btn('Add milestones myself', { small: true, onclick: () => { editorOrigin = 'manual'; editor = PF.ui.milestoneEditor({ list: [], showDone: true, chatOpen: false, onChange: refreshEstimate }); draw(); } }) : null));
    }

    const estimateBox = h('div', { class: 'stack-sm' });
    const hasInstructions = () => !!((f.instrKind === 'text' && f.instrText.trim()) || (f.instrKind === 'link' && f.instrLink.trim()) || ((f.instrKind === 'image' || f.instrKind === 'pdf') && f.instrFile));
    // PLACEHOLDER: with instructions but no milestones, the "LLM" estimates a total.
    const llmEstimate = () => E.round5(PF.assistant.estimate({ title: f.title, text: f.instrKind === 'text' ? f.instrText : '' }));
    function remainingFromEditor() { return editor ? editor.get().filter((m) => !m.done).reduce((n, m) => n + m.estMin, 0) : 0; }
    function refreshEstimate() {
      const open = remainingFromEditor();
      const hasMs = editor && editor.get().length > 0;
      const nodes = [];
      if (hasMs || hasInstructions()) {
        const fromMs = hasMs;
        nodes.push(h('div', { class: 'prediction' }, h('div', { class: 'eyebrow', text: 'Inflow prediction' }), h('div', { class: 'big', text: U.fmtDur(fromMs ? open : llmEstimate()) }),
          h('div', { class: 'muted', text: fromMs ? 'Remaining, from your milestones. Placeholder: there is no trained model yet.' : 'From your instructions, without milestones. Placeholder: no real LLM reads them yet.' })));
        const ov = h('input', { type: 'number', min: 5, step: 5, placeholder: 'Same as prediction', value: f.override, id: 'ov-min', oninput: (e) => { f.override = e.target.value; } });
        nodes.push(field('Override the estimate (minutes, optional)', ov));
        if (!fromMs) nodes.push(h('p', { class: 'hint', text: 'Milestones are optional. Generate them to report progress step by step; skip them to report progress with a slider.' }));
      } else {
        nodes.push(h('div', { class: 'grid-2' }, field('Hours', num('durH', { max: 99 })), field('Minutes', num('durM', { max: 59, step: 5 }))));
        nodes.push(h('p', { class: 'hint', text: 'Without instructions or milestones, enter how long you expect this to take.' }));
      }
      estimateBox.replaceChildren(...nodes);
    }

    function floatingSection() {
      const out = [typeCards()];
      if (f.type === 'assignment') {
        out.push(
          field('Course', text('course', { list: 'course-list', placeholder: 'e.g. CS 220' })),
          h('div', { class: 'grid-2' }, field('Start after', date('startAfter'), 'Defaults to today.'), field('Time (optional)', time('startTime'), 'Empty: from the start of the day.')),
          h('div', { class: 'grid-2' }, field('Complete by', date('due'), 'Empty: anytime.'), field('Time (optional)', time('dueTime'), 'Empty: by the end of the day.')),
          PF.ui.repeatEditor('assignment', f.rule, anchorOf('startAfter'), draw),
          check('canSplit', 'Can be split into sessions', 'Turn off for work best done in one go, like a lab experiment.'),
          instructions());
        if (editor) {
          out.push(h('div', { class: 'stack-sm' }, h('div', { class: 'label', text: 'Milestones' }),
            editor.el, h('p', { class: 'hint', text: 'Check off milestones you have already finished. Each one is a progress step you can update later.' })));
        }
        refreshEstimate();
        out.push(estimateBox);
      } else {
        const repeating = f.rule.freq !== 'none';
        out.push(repeating
          ? h('div', { class: 'grid-3' }, field('Starting', date('winStart')), field('Between (optional)', time('winStartTime'), 'Time of day.'), field('And', time('winEndTime'), 'Empty: any time.'))
          : h('div', { class: 'stack-sm' },
            h('div', { class: 'grid-2' }, field('Earliest', date('winStart')), field('Time (optional)', time('winStartTime'), 'Empty: from the start of the day.')),
            h('div', { class: 'grid-2' }, field('Latest', date('winEnd')), field('Time (optional)', time('winEndTime'), 'Empty: by the end of the day.'))),
        field('How long (minutes)', num('otherMin', { min: 5, step: 5, placeholder: 'e.g. 60' })),
        PF.ui.repeatEditor('other', f.rule, anchorOf('winStart'), draw),
        check('otherSplit', 'Can be split into sessions', 'Off by default: most things that are not assignments happen in one block.'));
      }
      return h('div', { class: 'stack' }, out);
    }

    function draw() {
      const courses = [...new Set(S().state.tasks.map((t) => t.course).concat(S().state.blocks.map((b) => b.course)).filter(Boolean))];
      const seg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'When' },
        h('button', { type: 'button', class: f.when === 'anchored' ? 'is-on' : '', 'aria-pressed': String(f.when === 'anchored'), onclick: () => { f.when = 'anchored'; draw(); } }, icon('anchor', 15), ' Anchor it: pick a time'),
        h('button', { type: 'button', class: f.when === 'floating' ? 'is-on' : '', 'aria-pressed': String(f.when === 'floating'), onclick: () => { f.when = 'floating'; draw(); } }, icon('waves', 15), ' Let it float: Inflow finds a time'));
      body.replaceChildren(
        field('Task name', text('title', { placeholder: f.when === 'anchored' ? 'e.g. Study group' : 'e.g. Graph Algorithms Problem Set', id: 'at-title' })),
        seg,
        h('p', { class: 'hint', text: f.when === 'anchored' ? 'Anchored tasks stay at the time you choose. Inflow plans around them.' : 'Floating tasks are placed in your free time before the deadline.' }),
        f.when === 'anchored' ? anchoredSection() : floatingSection(),
        h('datalist', { id: 'course-list' }, courses.map((c) => h('option', { value: c }))),
        err);
      err.textContent = '';
    }

    /* ----- validate and submit ----- */
    function collect() {
      const title = f.title.trim();
      if (!title) return { error: 'Give the task a name.' };
      const kind = f.when === 'anchored' ? 'anchored' : f.type;
      const r = PF.ui.ruleForEngine(f.rule, kind);
      if (r.error) return r;
      if (f.when === 'anchored') {
        const day = U.fromInputDate(f.fDate);
        if (Number.isNaN(day)) return { error: 'Choose a date.' };
        if (!f.fStart || !f.fEnd || U.atClock(day, f.fEnd) <= U.atClock(day, f.fStart)) return { error: 'The end time must be after the start time.' };
        if (f.evType === 'class' && !f.course.trim()) return { error: 'Enter the course for this class.' };
        return { kind: 'anchored', title, day, rule: r.rule };
      }
      if (f.type === 'assignment') {
        if (!f.course.trim()) return { error: 'Enter the course.' };
        const saDay = U.fromInputDate(f.startAfter);
        if (Number.isNaN(saDay)) return { error: 'Choose when you can start.' };
        const sa = f.startTime ? U.atClock(saDay, f.startTime) : saDay;
        let cb = null; // empty "Complete by" means anytime
        if (f.due) {
          const d = U.fromInputDate(f.due);
          cb = f.dueTime ? U.atClock(d, f.dueTime) : U.endOfDay(d);
          if (cb <= sa) return { error: 'The deadline is before the start.' };
        }
        const msList = editor ? editor.get() : [];
        if (msList.some((m) => !m.title.trim())) return { error: 'Every milestone needs a name.' };
        const open = msList.filter((m) => !m.done).reduce((n, m) => n + m.estMin, 0);
        const all = msList.reduce((n, m) => n + m.estMin, 0);
        const manual = (Number(f.durH) || 0) * 60 + (Number(f.durM) || 0);
        const override = Number(f.override) || 0;
        // Milestones are optional: milestone sum, else the placeholder LLM estimate from the
        // instructions, else the student's own duration. An override beats all of them.
        let need = msList.length ? (override > 0 ? override : open) : hasInstructions() ? (override > 0 ? override : llmEstimate()) : manual;
        if (msList.length && open === 0 && !override) return { error: 'Every milestone is marked done. Unmark one, or add the work that is left.' };
        if (need <= 0) return { error: msList.length ? 'Enter an estimate.' : 'Enter how long it will take, or add instructions to get milestones.' };
        need = E.round5(need);
        return { kind: 'assignment', title, sa, cb, msList, need, total: msList.length ? (override > 0 ? override + (all - open) : all) : need, rule: r.rule, source: msList.length ? 'milestones' : hasInstructions() ? 'llm-placeholder' : 'student' };
      }
      const min = Number(f.otherMin) || 0;
      if (min <= 0) return { error: 'Enter how long it takes, in minutes.' };
      const startDay = U.fromInputDate(f.winStart);
      if (Number.isNaN(startDay)) return { error: f.rule.freq === 'none' ? 'Choose the earliest day.' : 'Choose the day it starts.' };
      if (r.rule.freq !== 'none') {
        if (f.winStartTime && f.winEndTime && f.winEndTime <= f.winStartTime) return { error: 'The time of day ends before it starts.' };
        if (f.winStartTime && f.winEndTime && (U.atClock(0, f.winEndTime) - U.atClock(0, f.winStartTime)) / U.MIN < min && f.otherSplit === false) return { error: 'The time of day is shorter than the task.' };
        return { kind: 'other', title, startDay, need: min, rule: r.rule };
      }
      if (!f.winEnd) return { error: 'Choose the latest day.' };
      const sa = f.winStartTime ? U.atClock(startDay, f.winStartTime) : startDay;
      const endDay = U.fromInputDate(f.winEnd);
      const cb = f.winEndTime ? U.atClock(endDay, f.winEndTime) : U.endOfDay(endDay);
      if (cb <= sa) return { error: 'The latest time is before the earliest.' };
      return { kind: 'other', title, sa, cb, need: min, rule: r.rule };
    }

    const baseTask = (s, c, extra) => Object.assign({
      id: U.uid('t'), type: c.kind, title: c.title, course: c.kind === 'assignment' ? f.course.trim() : '',
      canSplit: c.kind === 'assignment' ? f.canSplit : f.otherSplit, rule: c.rule.freq === 'none' ? null : c.rule,
      needMin: c.need, totalMin: c.total || c.need, predictedMin: c.need, loggedMin: 0, pace: 1,
      milestones: [], status: 'active', sched: 'none', shortfallMin: 0, createdAt: s.now,
      prediction: { model: 'placeholder-v0', source: c.source || 'student', minutes: c.need, features: { type: c.kind, course: f.course.trim(), milestones: c.msList ? c.msList.length : 0, instructions: f.instrKind } },
    }, extra);

    async function submit() {
      const c = collect();
      if (c.error) { err.textContent = c.error; return; }
      m.close();
      if (c.kind === 'anchored') {
        const info = S().commit((s) => {
          const link = f.evType === 'event' && f.link ? E.task(s, f.link) : null;
          const occ = E.expandRepeat(c.rule, c.day);
          const seriesId = occ.length > 1 ? U.uid('ser') : undefined;
          const ids = occ.map((o) => {
            const b = {
              id: U.uid('b'), kind: link ? 'session' : 'anchored', taskId: link ? link.id : undefined, title: c.title,
              start: U.atClock(o.day, f.fStart), end: U.atClock(o.day, f.fEnd), state: 'planned', anchored: true, seriesId,
              eventType: link ? undefined : f.evType, course: f.evType === 'class' ? f.course.trim() : undefined, rule: c.rule.freq === 'none' ? undefined : c.rule,
            };
            s.blocks.push(b);
            return b.id;
          });
          return { ids, link: link ? link.id : null };
        });
        toast('Added “' + c.title + '”' + (info.ids.length > 1 ? ' (' + info.ids.length + ' times)' : '') + (f.evType === 'class' ? ' as a class.' : ' as an anchored task.'), { tone: 'ok' });
        if (info.link) PF.flow.report(await PF.flow.settle([info.link]));
        await PF.flow.resolveOverlaps(info.ids);
        return;
      }
      const ids = S().commit((s) => {
        const seriesId = c.rule.freq !== 'none' ? U.uid('ser') : undefined;
        const out = [];
        if (c.kind === 'assignment') {
          E.repeatShifts(c.rule, c.sa).forEach((shift, k) => {
            const t = baseTask(s, c, {
              startAfter: c.sa + shift, completeBy: c.cb ? c.cb + shift : null, seriesId,
              needMin: k === 0 ? c.need : c.total, predictedMin: k === 0 ? c.need : c.total,
              milestones: c.msList.map((x) => ({ id: U.uid('m'), title: x.title.trim(), estMin: x.estMin, done: k === 0 ? x.done : false })),
              instructions: { kind: f.instrKind, text: f.instrKind === 'text' ? f.instrText : '', file: f.instrFile, link: f.instrLink },
            });
            s.tasks.push(t); out.push(t.id);
          });
        } else if (c.rule.freq === 'none') {
          const t = baseTask(s, c, { startAfter: c.sa, completeBy: c.cb });
          s.tasks.push(t); out.push(t.id);
        } else {
          // One task per occurrence: a single day ("all") or a span of allowed days ("any").
          const dayWindow = f.winStartTime || f.winEndTime ? { from: f.winStartTime || '00:00', to: f.winEndTime || '24:00' } : null;
          for (const o of E.expandRepeat(c.rule, c.startDay)) {
            const from = o.day != null ? o.day : o.from;
            const to = o.day != null ? o.day : o.to;
            const t = baseTask(s, c, { startAfter: from, completeBy: U.endOfDay(to), seriesId, dayWindow, allowedDays: o.days || null });
            s.tasks.push(t); out.push(t.id);
          }
        }
        return out;
      });
      PF.flow.report(await PF.flow.settle(ids));
    }

    const m = modal({
      title: 'Add a task', subtitle: 'Pick a time yourself, or let Inflow find one.', size: 'lg', body,
      actions: [btn('Cancel', { onclick: () => m.close() }), btn('Add task', { kind: 'primary', id: 'at-submit', onclick: submit })],
    });
    draw();
    return m;
  };
})();
