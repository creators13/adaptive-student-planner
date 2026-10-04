/* Flow 2: feedback after a session ends, and progress logged from the to-do list.
   Collects what really happened (for personal duration estimates) and adjusts the
   schedule: missed work is greyed out and rescheduled, milestone progress re-estimates
   the rest, and anything that no longer fits goes back through flow 1's fit check. */
(function () {
  'use strict';
  const PF = (window.PF = window.PF || {});
  const { h, btn, modal, toast, icon } = PF.ui;
  const U = PF.util;
  const E = PF.engine;
  const S = () => PF.store;
  const taskOf = (id) => E.task(S().state, id);

  /* ---------- small shared dialogs ---------- */

  // Resolves with the chosen value, or null if dismissed.
  function choicePopup(o) {
    return new Promise((resolve) => {
      const m = modal({
        eyebrow: o.eyebrow, title: o.title, subtitle: o.message, size: 'sm', dismissible: o.dismissible !== false,
        actions: o.choices.map((c) => btn(c.label, { kind: c.kind || 'secondary', onclick: () => { resolve(c.value); m.close(); } })),
      });
      m.promise.then(() => resolve(null));
    });
  }

  // Edit a milestone list (type, or chat with the assistant). Resolves the list, or null if cancelled.
  function milestoneModal(o) {
    return new Promise((resolve) => {
      const ed = PF.ui.milestoneEditor({ list: o.list || [], chatOpen: o.chatOpen, hint: o.hint, onChange: () => { warn.textContent = ''; } });
      const warn = h('div', { class: 'form-error', role: 'alert' });
      const m = modal({
        title: o.title, subtitle: o.subtitle, size: 'lg', body: h('div', { class: 'stack' }, ed.el, warn),
        actions: [
          btn('Cancel', { onclick: () => { resolve(null); m.close(); } }),
          btn(o.saveLabel || 'Save milestones', { kind: 'primary', onclick: () => {
            const list = ed.get();
            if (!list.length) { warn.textContent = 'Add at least one milestone.'; return; }
            if (list.some((x) => !x.title.trim())) { warn.textContent = 'Every milestone needs a name.'; return; }
            resolve(list); m.close();
          } }),
        ],
      });
      m.promise.then(() => resolve(null));
    });
  }

  const plannedIds = (taskId) => new Set(S().state.blocks.filter((x) => x.taskId === taskId && x.kind === 'session' && x.state === 'planned').map((x) => x.id));
  // "Tue, Oct 6 12:45–1:45 PM" for each session placed since `beforeIds` was captured.
  const newSessionsText = (taskId, beforeIds) =>
    S().state.blocks
      .filter((x) => x.taskId === taskId && x.kind === 'session' && x.state === 'planned' && !beforeIds.has(x.id))
      .sort((a, c) => a.start - c.start)
      .map((x) => U.fmtDay(x.start) + ' ' + U.fmtRange(x.start, x.end))
      .join(' and ');

  /* ---------- wizard steps (rendered into one modal) ---------- */

  function choiceStep(m, o) {
    return new Promise((resolve) => {
      const card = (value, ic, label, sub) => h('button', { type: 'button', class: 'choice choice-big', onclick: () => resolve(value) }, icon(ic, 22), h('strong', { text: label }), sub ? h('span', { class: 'muted', text: sub }) : null);
      m.setBody(h('div', { class: 'stack' },
        h('h3', { class: 'q', text: o.question }),
        h('div', { class: 'choices' }, card('yes', 'check', o.yes), card('no', 'x', o.no)),
        h('div', { class: 'note' }, icon('sparkle', 16), h('span', { text: 'No pressure. Unfinished work is rescheduled automatically, and your answers help Inflow improve future estimates.' }))));
      m.setActions([btn('Skip for now', { onclick: () => resolve('skip') })]);
      m.promise.then((r) => resolve(r === 'dismissed' ? 'dismiss' : 'skip'));
    });
  }

  // Time spent plus progress: the milestone checklist, or (without milestones) a slider.
  function progressStep(m, task, block) {
    return new Promise((resolve) => {
      const hadMs = task.milestones.length > 0;
      const open = task.milestones.filter((x) => !x.done);
      // 0 minutes means no work got done: the session is greyed out and the work rescheduled.
      const minutes = h('input', { type: 'number', min: block ? 0 : 1, step: 5, value: block ? E.len(block) : 30, id: 'fb-min', 'aria-label': 'Minutes spent' });
      const picked = new Set();
      const err = h('div', { class: 'form-error', role: 'alert' });
      const parts = [
        h('h3', { class: 'q', text: 'How long did it take?' }),
        h('div', { class: 'inline' }, minutes, h('span', { class: 'muted', text: 'minutes' + (block ? ' (planned: ' + U.fmtDur(E.len(block)) + ')' : '') })),
        block ? h('p', { class: 'hint', text: 'Enter 0 if you did not get to it. The session is kept as a skipped record and the work is rescheduled.' }) : null,
      ];
      let slider = null;
      if (hadMs) {
        parts.push(h('h3', { class: 'q', text: 'Which milestones did you finish?' }));
        parts.push(h('div', { class: 'checks' }, open.map((ms) => {
          const c = h('input', { type: 'checkbox', id: U.uid('ms'), onchange: (e) => { if (e.target.checked) picked.add(ms.id); else picked.delete(ms.id); } });
          return h('div', { class: 'check' }, c, h('label', { for: c.id }, ms.title, h('span', { class: 'hint', text: U.fmtDur(ms.estMin) })));
        })));
        parts.push(h('p', { class: 'hint', text: 'If none are finished, we will assume no progress and plan the time again.' }));
      }
      if (!hadMs) {
        // Without milestones, progress comes from a slider. 100% means finished.
        const out = h('output', { text: (task.progressPct || 0) + '%' });
        slider = h('input', { type: 'range', min: 0, max: 100, step: 5, value: task.progressPct || 0, 'aria-label': 'How much of the assignment is done', oninput: (e) => { out.textContent = e.target.value + '%'; } });
        parts.push(h('h3', { class: 'q', text: 'How much of the assignment is done?' }), h('div', { class: 'inline' }, slider, out),
          h('p', { class: 'hint', text: '100% marks it finished.' + (task.canSplit === false ? ' This task is done in one go, so whatever is left is rescheduled as one block.' : '') }));
      }
      parts.push(err);
      if (block) parts.push(h('div', { class: 'note' }, icon('sparkle', 16), h('span', { text: 'No pressure. Unfinished work is rescheduled automatically, and your answers help Inflow improve future estimates.' })));
      m.setBody(h('div', { class: 'stack' }, parts));
      m.setActions([
        btn(block ? 'Skip for now' : 'Cancel', { onclick: () => resolve({ skip: true }) }),
        btn('Submit feedback', { kind: 'primary', onclick: () => {
          const v = Math.round(Number(minutes.value));
          if (block && v === 0) { resolve({ none: true }); return; }
          if (!(v > 0)) { err.textContent = block ? 'Enter the minutes you spent, or 0.' : 'Enter the minutes you spent.'; return; }
          resolve({ minutes: v, doneIds: [...picked], pct: slider ? Number(slider.value) : null });
        } }),
      ]);
      m.promise.then((r) => resolve(r === 'dismissed' ? { dismiss: true } : { skip: true }));
    });
  }

  /* ---------- outcomes ---------- */

  async function skipAndReschedule(block, task) {
    S().commit((s) => E.skipBlock(s, block.id));
    const before = plannedIds(task.id);
    const results = await PF.flow.settle([task.id]);
    const r = results[0];
    if (r && r.res.status === 'scheduled') {
      toast('Session greyed out. Rescheduled to ' + (newSessionsText(task.id, before) || 'a later time') + '.', { tone: 'ok', ms: 9000 });
    } else if (results.length) {
      PF.flow.report(results, { prefix: 'Session greyed out.' });
    }
  }

  async function processProgress(task, block, data) {
    const t = taskOf(task.id);
    const hadMs = t.milestones.length > 0;
    const open = t.milestones.filter((x) => !x.done);
    const picked = data.doneIds.length;
    const sliderDone = !hadMs && data.pct != null && data.pct >= 100;
    const noMsProgress = hadMs && picked === 0; // flow 2 rule 4: no milestone checked, no progress
    const allDone = hadMs && open.length > 0 && picked === open.length;
    let finished = false;
    let replaceUndone = null;
    let addMilestones = null;

    if (sliderDone) finished = true;
    else if (hadMs && allDone) {
      // The last milestone was checked: confirm, and if there is more, add milestones.
      for (;;) {
        const ans = await choicePopup({
          eyebrow: 'Last milestone', title: 'Is the whole assignment finished?',
          message: 'You checked off every milestone for “' + t.title + '”.', dismissible: false,
          choices: [{ label: 'Not yet. Add milestones', value: 'no' }, { label: 'Yes, it’s finished', value: 'yes', kind: 'primary' }],
        });
        if (ans === 'yes') { finished = true; break; }
        const list = await milestoneModal({
          title: 'Add milestones for what’s left', subtitle: 'Type them in, or work them out with the assistant.',
          list: [], chatOpen: false, saveLabel: 'Add milestones',
        });
        if (list) { addMilestones = list.map((x) => Object.assign({}, x, { id: U.uid('m'), done: false })); break; }
      }
    } else if (noMsProgress) {
      const ans = await choicePopup({
        eyebrow: 'No milestone finished', title: 'Break it into smaller milestones?',
        message: 'We will assume no progress this session, and the time is planned again. Smaller milestones make progress easier to report next time.',
        choices: [{ label: 'Not now', value: 'no' }, { label: 'Type them in', value: 'type' }, { label: 'Chat with the assistant', value: 'chat', kind: 'primary' }],
      });
      if (ans === 'type' || ans === 'chat') {
        const list = await milestoneModal({
          title: 'Break it into smaller milestones', subtitle: 'Edit the open milestones below, or ask the assistant to split them.',
          list: open.map((x) => Object.assign({}, x)), chatOpen: ans === 'chat',
        });
        if (list) replaceUndone = list;
      }
    }

    const out = S().commit((s) => {
      const tk = E.task(s, task.id);
      if (block) E.markDone(s, block.id, data.minutes);
      if (finished) {
        tk.loggedMin += data.minutes;
        const removed = E.completeTask(s, tk);
        return { complete: true, removed, predicted: tk.predictedMin, actual: tk.loggedMin };
      }
      const r = E.applyProgress(s, tk, { minutes: data.minutes, newlyDone: data.doneIds, pct: data.pct, credit: block ? E.len(block) : null, addMilestones, replaceUndone });
      return Object.assign({ complete: false }, r);
    });

    if (out.complete) {
      toast('“' + t.title + '” is complete. Predicted ' + U.fmtDur(out.predicted) + ', actual ' + U.fmtDur(out.actual) + '.' + (out.removed ? ' ' + U.plural(out.removed, 'later session') + ' removed.' : ''), { tone: 'ok', ms: 9000 });
      return;
    }
    const before = plannedIds(task.id);
    const results = await PF.flow.settle([task.id]);
    const res = results[0] && results[0].res;
    if (out.kind === 'ahead') {
      toast('Ahead of plan. ' + (res && res.trimmedMin ? 'Shortened later sessions by ' + U.fmtDur(res.trimmedMin) + '. ' : '') + 'The freed time stays free.', { tone: 'ok', ms: 9000 });
    } else if (out.kind === 'on-track') {
      toast('On track. Your schedule for “' + t.title + '” stays the same.', { tone: 'ok' });
    } else {
      // More work than is scheduled: either the student ran slower than estimated, or added milestones.
      const lead = addMilestones ? 'The new milestones need about ' + U.fmtDur(out.remainingMin) + '.' : 'Behind plan by about ' + U.fmtDur(Math.abs(out.diffMin)) + '.';
      if (res && res.status === 'scheduled') toast(lead + ' Added ' + (newSessionsText(task.id, before) || 'time') + '.', { tone: 'ok', ms: 9000 });
      else PF.flow.report(results, { prefix: lead });
    }
  }

  /* ---------- entry points ---------- */

  async function assignmentFeedback(task, block, pos) {
    const m = modal({
      eyebrow: block ? 'Focus block complete' + (pos ? ' · ' + pos.i + ' of ' + pos.n : '') : 'Log progress',
      title: task.title,
      subtitle: block ? U.fmtDay(block.start) + ' · ' + U.fmtRange(block.start, block.end) : 'Progress you made outside a planned session',
      size: 'md', body: h('div'),
    });
    // One step: minutes spent (0 means none), then milestones or the slider.
    const d = await progressStep(m, taskOf(task.id), block);
    m.close();
    if (d.dismiss) return 'dismiss';
    if (d.skip) return;
    if (d.none) { await skipAndReschedule(block, task); return; }
    await processProgress(task, block, d);
  }

  // Tasks that are not assignments: "Done?" after their last session. If not yet, the
  // student says how much more time it needs and picks Extend timeslot, Continue now, or
  // Finish later. The session is never greyed out: for these tasks the system does not
  // care whether the time was productive.
  function notYetStep(m, block) {
    return new Promise((resolve) => {
      const minutes = h('input', { type: 'number', min: 5, step: 5, value: 30, id: 'fb-more', 'aria-label': 'Minutes still needed' });
      const err = h('div', { class: 'form-error', role: 'alert' });
      const pick = (how) => () => {
        const v = Math.round(Number(minutes.value));
        if (!(v > 0)) { err.textContent = 'Enter how many more minutes it needs.'; return; }
        resolve({ how, minutes: v });
      };
      m.setBody(h('div', { class: 'stack' },
        h('h3', { class: 'q', text: 'How much more time does it need?' }),
        h('div', { class: 'inline' }, minutes, h('span', { class: 'muted', text: 'minutes' })),
        h('ul', { class: 'plain hint' },
          h('li', { text: 'Extend timeslot: this session runs longer, ending ' + U.fmtTime(block.end) + ' plus the extra time.' }),
          h('li', { text: 'Continue now: a new block starts right away.' }),
          h('li', { text: 'Finish later: Inflow finds time for the rest.' })),
        err));
      m.setActions([
        btn('Back', { onclick: () => resolve({ back: true }) }),
        btn('Finish later', { id: 'fb-later', onclick: pick('later') }),
        btn('Continue now', { id: 'fb-continue', onclick: pick('continue') }),
        btn('Extend timeslot', { kind: 'primary', id: 'fb-extend', onclick: pick('extend') }),
      ]);
      m.promise.then((r) => resolve(r === 'dismissed' ? { dismiss: true } : { skip: true }));
    });
  }

  async function doneFeedback(task, block, pos) {
    const m = modal({
      eyebrow: 'Session complete' + (pos ? ' · ' + pos.i + ' of ' + pos.n : ''),
      title: task.title,
      subtitle: U.fmtDay(block.start) + ' · ' + U.fmtRange(block.start, block.end), size: 'md', body: h('div'),
    });
    for (;;) {
      const a = await choiceStep(m, { question: 'Done?', yes: 'Yes', no: 'Not yet' });
      if (a === 'dismiss') { m.close(); return 'dismiss'; }
      if (a === 'skip') { m.close(); return; }
      if (a === 'yes') {
        m.close();
        S().commit((s) => {
          E.markDone(s, block.id, E.len(block));
          const tk = E.task(s, task.id);
          tk.loggedMin = E.len(block); // not measured; only assignments become training examples
          E.completeTask(s, tk);
        });
        toast('“' + task.title + '” marked done.', { tone: 'ok' });
        return;
      }
      const d = await notYetStep(m, block);
      if (d.back) continue;
      m.close();
      if (d.dismiss) return 'dismiss';
      if (d.skip) return;
      const before = plannedIds(task.id);
      const id = S().commit((s) => E.notDoneYet(s, block.id, d.minutes, d.how));
      if (id) await PF.flow.resolveOverlaps([id]); // extending or continuing can overlap other events
      const results = await PF.flow.settle([task.id]);
      const res = results[0] && results[0].res;
      const b = id ? E.block(S().state, id) : null;
      if (d.how === 'extend') toast('Extended “' + task.title + '” to ' + U.fmtTime(b.end) + '.', { tone: 'ok' });
      else if (d.how === 'continue') toast('“' + task.title + '” continues now, ' + U.fmtRange(b.start, b.end) + '.', { tone: 'ok' });
      else if (res && res.status === 'scheduled') toast('The rest of “' + task.title + '” (' + U.fmtDur(d.minutes) + ') is scheduled for ' + (newSessionsText(task.id, before) || 'later') + '.', { tone: 'ok', ms: 9000 });
      else PF.flow.report(results);
      return;
    }
  }

  PF.flow.feedbackFor = async function (blockId, pos) {
    const s = S().state;
    const block = E.block(s, blockId);
    const gone = () => S().commit((st) => { st.pending = st.pending.filter((p) => p.blockId !== blockId); });
    if (!block) { gone(); return; }
    const kind = E.promptKind(s, block);
    const task = block.taskId ? E.task(s, block.taskId) : null;
    if (kind === 'none' || (block.taskId && (!task || task.status !== 'active'))) { gone(); return; }
    return kind === 'assignment' ? assignmentFeedback(task, block, pos) : doneFeedback(task, block, pos);
  };

  // Walk through every waiting prompt, oldest first.
  PF.flow.openPending = async function () {
    const ids = S().state.pending.slice().sort((a, b) => a.endedAt - b.endedAt).map((p) => p.blockId);
    if (!ids.length) { toast('No sessions are waiting for feedback.'); return; }
    let i = 0;
    for (const id of ids) {
      if (!S().state.pending.some((p) => p.blockId === id)) continue;
      i++;
      // Closing a dialog with X or Esc leaves the whole stack; "Skip for now" only skips that one.
      if ((await PF.flow.feedbackFor(id, { i, n: ids.length })) === 'dismiss') break;
    }
  };

  // Progress made outside a planned session, from the to-do list.
  PF.flow.logProgress = async function (taskId) {
    const task = taskOf(taskId);
    if (task && task.status === 'active') await assignmentFeedback(task, null);
  };

  // "Mark done" for tasks that are not assignments, in the to-do list.
  PF.flow.markOtherDone = async function (taskId) {
    const task = taskOf(taskId);
    if (!task || task.status !== 'active') return;
    S().commit((s) => {
      const tk = E.task(s, taskId);
      tk.loggedMin = tk.totalMin;
      E.completeTask(s, tk);
    });
    toast('“' + task.title + '” marked done.', { tone: 'ok' });
  };
})();
