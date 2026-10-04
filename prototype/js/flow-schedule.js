/* Flow 1, the back half: run the fit check for tasks, and when something does not fit,
   ask the student whether to relax a preference (and for how long) or accept a partial
   or unscheduled result. Every path ends with each task scheduled, partially scheduled,
   or unscheduled. */
(function () {
  'use strict';
  const PF = (window.PF = window.PF || {});
  const { h, btn, field, modal, toast } = PF.ui;
  const U = PF.util;
  const E = PF.engine;
  const S = () => PF.store;
  PF.flow = PF.flow || {};

  const pad2 = (n) => String(n).padStart(2, '0');
  const hourOf = (hhmm) => Number(hhmm.split(':')[0]);

  /* Resolves { action: 'relax', override } or { action: 'keep' }. */
  function doesntFitDialog(taskId, result) {
    const s = S().state;
    const task = E.task(s, taskId);
    const cur = E.prefsFor(s, task, s.now);
    const deadline = E.deadlineFor(s, task);
    const hasBuffer = task.type === 'assignment' && cur.bufferDays > 0;

    // Later cut-offs, an hour at a time, up to a full 24-hour day (it can cross midnight).
    const endSel = h('select', { id: 'rx-end', 'aria-label': 'Work until' });
    const startMin = hourOf(cur.workStart) * 60 + Number(cur.workStart.split(':')[1] || 0);
    const curSpan = E.spanMin(cur.workStart, cur.workEnd);
    endSel.append(h('option', { value: cur.workEnd, text: U.clockLabel(cur.workEnd) + (startMin + curSpan > 1440 ? ' (next day)' : '') + ' (current)' }));
    for (let span = (Math.floor(curSpan / 60) + 1) * 60; span <= 1440; span += 60) {
      const m = (startMin + span) % 1440;
      const v = pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
      endSel.append(h('option', { value: v, text: span === 1440 ? 'All 24 hours' : U.clockLabel(v) + (startMin + span >= 1440 ? ' (next day)' : '') }));
    }
    const bufSel = h('select', { id: 'rx-buf', 'aria-label': 'Deadline buffer' });
    for (let d = cur.bufferDays; d >= 0; d--) {
      bufSel.append(h('option', { value: String(d), text: (d === 0 ? 'No buffer' : U.plural(d, 'day') + ' before') + (d === cur.bufferDays ? ' (current)' : '') }));
    }
    const scopeSel = h('select', { id: 'rx-scope', 'aria-label': 'How long the change lasts' },
      h('option', { value: 'task', text: 'Just for this task' }),
      h('option', { value: 'week', text: 'This week' }),
      h('option', { value: 'fortnight', text: 'The next two weeks' }),
      h('option', { value: 'always', text: 'Until I change it in Settings' }));
    const preview = h('div', { class: 'preview', 'aria-live': 'polite' });

    const draft = () => {
      const o = { scope: scopeSel.value, taskId: task.id };
      if (endSel.value !== cur.workEnd) o.workEnd = endSel.value;
      if (hasBuffer && Number(bufSel.value) !== cur.bufferDays) o.bufferDays = Number(bufSel.value);
      return o;
    };
    const changed = () => { const o = draft(); return o.workEnd != null || o.bufferDays != null; };

    let applyBtn;
    const refresh = () => {
      if (!changed()) {
        preview.className = 'preview';
        preview.textContent = 'Change at least one setting to see whether it fits.';
        applyBtn.disabled = true;
        return;
      }
      const r = S().preview((st) => E.previewFit(st, taskId, draft(), result.needMin));
      preview.className = 'preview ' + (r.fits ? 'is-ok' : 'is-warn');
      preview.textContent = r.fits ? 'With these settings it fits.' : 'Still ' + U.fmtDur(r.shortfallMin) + ' short with these settings. You can apply them anyway and loosen more.';
      applyBtn.disabled = false;
    };
    [endSel, bufSel, scopeSel].forEach((el) => el.addEventListener('change', refresh));

    const partial = task.canSplit && result.placedMin > 0;
    return new Promise((resolve) => {
      applyBtn = btn('Apply and schedule', { kind: 'primary', onclick: () => { resolve({ action: 'relax', override: draft() }); m.close(); } });
      const keepBtn = btn(partial ? 'Schedule what fits (' + U.fmtDur(result.placedMin) + ')' : 'Leave unscheduled', { onclick: () => { resolve({ action: 'keep' }); m.close(); } });
      const m = modal({
        eyebrow: 'Does not fit',
        title: 'This doesn’t fit your preferences',
        subtitle: '“' + task.title + '” needs ' + U.fmtDur(result.needMin) + (task.completeBy ? ' before ' + U.fmtDay(deadline) : '') + '. ' +
          (result.placedMin > 0 ? U.fmtDur(result.placedMin) + ' fits' : 'None of it fits') + ' inside your work hours' + (task.canSplit ? '' : ' as one block') + ', breaks' + (hasBuffer ? ', and deadline buffer' : '') + '.',
        size: 'md',
        body: h('div', { class: 'stack' },
          h('p', { class: 'muted', text: 'Your anchored events and work that is already scheduled stay where they are. To make room, loosen a preference:' }),
          field('Work until', endSel),
          hasBuffer ? field('Finish before the deadline by', bufSel) : null,
          field('Apply this change for', scopeSel),
          preview),
        actions: [keepBtn, applyBtn],
      });
      m.promise.then(() => resolve({ action: 'keep' })); // Esc counts as keeping preferences
      refresh();
    });
  }

  // Fit check for one task. Loops through the dialog until it fits or the student keeps their preferences.
  PF.flow.ensureScheduled = async function (taskId, opts) {
    opts = opts || {};
    const run = (partial) => S().commit((s) => E.reconcile(s, E.task(s, taskId), { allowPartial: partial }));
    let res = run(!!opts.quiet);
    while (res.status === 'nofit') {
      const choice = await doesntFitDialog(taskId, res);
      if (choice.action === 'relax') {
        S().commit((s) => E.addOverride(s, choice.override));
        res = run(false);
      } else {
        res = run(true);
      }
    }
    return res;
  };

  // Fit check for several tasks, most urgent first.
  PF.flow.settle = async function (taskIds, opts) {
    const s = S().state;
    const ids = E.byUrgency(s, [...new Set(taskIds)]).filter((id) => E.task(s, id).status === 'active');
    const out = [];
    for (const id of ids) out.push({ task: E.task(S().state, id), res: await PF.flow.ensureScheduled(id, opts) });
    return out;
  };

  /* ---------- overlaps the student creates ----------
     Whenever the student's own action (adding, dragging, or moving an event) makes it
     overlap something, ask: move the existing event, or keep the overlap? An anchored event
     opens its edit pop-up (this event or all its repeats); a floating session is taken
     off and re-placed by the fit check. Classes are overlapped silently. */

  const when = (b) => U.fmtDay(b.start) + ', ' + U.fmtRange(b.start, b.end);

  function overlapPrompt(mine, other) {
    return new Promise((resolve) => {
      const m = modal({
        eyebrow: 'Overlap', title: '“' + mine.title + '” overlaps “' + other.title + '”', size: 'sm',
        subtitle: '“' + other.title + '” is ' + when(other) + (E.isFloating(other) ? '. Inflow can find it another time.' : '. You can pick it a new time.'),
        actions: [
          btn('Keep the overlap', { onclick: () => { resolve('keep'); m.close(); } }),
          btn('Move “' + other.title + '”', { kind: 'primary', onclick: () => { resolve('move'); m.close(); } }),
        ],
      });
      m.promise.then(() => resolve('keep'));
    });
  }

  // Edit pop-up for an anchored block. Resolves the ids of the blocks that changed, or null.
  PF.flow.editBlock = function (blockId, opts) {
    opts = opts || {};
    const b = E.block(S().state, blockId);
    const dateIn = h('input', { type: 'date', value: U.toInputDate(b.start), id: 'ed-date' });
    const startIn = h('input', { type: 'time', value: U.clockOf(b.start), step: 60, id: 'ed-start' });
    const endIn = h('input', { type: 'time', value: U.clockOf(b.end), step: 60, id: 'ed-end' });
    const scope = h('select', { id: 'ed-scope' }, h('option', { value: 'this', text: 'This event' }), h('option', { value: 'all', text: 'All events in the series' }));
    const err = h('div', { class: 'form-error', role: 'alert' });
    return new Promise((resolve) => {
      const m = modal({
        eyebrow: opts.eyebrow || 'Edit event', title: b.title, subtitle: 'Now ' + when(b), size: 'md',
        body: h('div', { class: 'stack' },
          h('div', { class: 'grid-3' }, field('Date', dateIn), field('Starts', startIn), field('Ends', endIn)),
          b.seriesId ? field('Apply to', scope, '“All events” changes every repeat that has not happened yet, by the same amount.') : null,
          err),
        actions: [
          btn('Cancel', { onclick: () => { resolve(null); m.close(); } }),
          btn('Save', { kind: 'primary', id: 'ed-save', onclick: () => {
            const day = U.fromInputDate(dateIn.value);
            if (Number.isNaN(day) || !startIn.value || !endIn.value) { err.textContent = 'Choose a date and times.'; return; }
            const start = U.atClock(day, startIn.value);
            const end = U.atClock(day, endIn.value);
            if (end <= start) { err.textContent = 'The end time must be after the start time.'; return; }
            const ids = S().commit((s) => E.editBlockTime(s, blockId, start, end, b.seriesId ? scope.value : 'this'));
            resolve(ids); m.close();
          } }),
        ],
      });
      m.promise.then(() => resolve(null));
    });
  };

  PF.flow.resolveOverlaps = async function (blockIds) {
    const asked = new Set();
    const queue = blockIds.slice();
    while (queue.length) {
      const id = queue.shift();
      for (const other of E.overlapsOf(S().state, id)) {
        const key = [id, other.id].sort().join('|');
        if (asked.has(key)) continue;
        asked.add(key);
        const mine = E.block(S().state, id);
        const live = E.block(S().state, other.id);
        if (!mine || !live || !(live.start < mine.end && live.end > mine.start)) continue; // already moved
        if ((await overlapPrompt(mine, live)) !== 'move') continue;
        if (E.isFloating(live)) {
          const taskId = S().commit((s) => E.unplaceSession(s, live.id));
          PF.flow.report(await PF.flow.settle([taskId]), { prefix: 'Moved “' + live.title + '”.' });
        } else {
          const changed = await PF.flow.editBlock(live.id, { eyebrow: 'Move the existing event' });
          if (changed) queue.push(...changed); // the edited event is checked for overlaps too
        }
      }
    }
  };

  // One toast summarising what happened. Repeats of the same series collapse into one line.
  PF.flow.report = function (results, opts) {
    opts = opts || {};
    if (!results.length) return;
    const groups = new Map();
    for (const r of results) {
      const k = r.task.seriesId || r.task.id;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const lines = [];
    let tone = 'ok';
    const movedNames = new Set();
    for (const list of groups.values()) {
      const t = list[0].task;
      const name = '“' + t.title + '”' + (list.length > 1 ? ' (' + list.length + ' times)' : '');
      const bad = list.filter((x) => x.res.status === 'unscheduled');
      const part = list.filter((x) => x.res.status === 'partial');
      list.forEach((x) => (x.res.moved || []).forEach((m) => movedNames.add(m.title)));
      if (bad.length) { tone = 'warn'; lines.push(name + ' could not be scheduled. It stays on your to-do list.'); }
      else if (part.length) { tone = 'warn'; lines.push(name + ' is partly scheduled. ' + U.fmtDur(part.reduce((n, x) => n + x.res.shortfallMin, 0)) + ' still needs a slot.'); }
      else lines.push(name + ' scheduled.');
    }
    if (movedNames.size) lines.push('Moved later to make room: ' + [...movedNames].join(', ') + '.');
    toast((opts.prefix ? opts.prefix.trim() + ' ' : '') + lines.join(' '), {
      tone, ms: 9000,
      action: location.hash.indexOf('plan') < 0 ? { label: 'View plan', onClick: () => { location.hash = '#/plan'; } } : null,
    });
  };
})();
