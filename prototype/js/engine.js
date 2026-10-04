/* Scheduling engine: the fit check, placement, displacement, and progress
   re-estimation behind both flows in plan/uiux/user-flows.md.

   Pure functions over a plain-JSON `state` object, so they run in the browser and
   under Node (see ../test). Nothing here touches the DOM or storage.

   state = { now, prefs, overrides[], tasks[], blocks[], pending[], completed[] }
   task  = floating work (assignment or other); block = anything on the calendar.
   A "session" block belongs to a task; a "anchored" block is a plain calendar event.
   Sessions the student anchored count as anchored blocks: the planner never moves them. */
(function (root) {
  'use strict';
  const PF = (root.PF = root.PF || {});
  const U = PF.util;
  const E = (PF.engine = {});

  // PROTOTYPE LIMIT, TO REMOVE: work with no deadline is only placed up to 28 days ahead.
  // In the product, "anytime" should really mean anytime.
  const HORIZON_DAYS = 28;
  const ENERGY = { morning: [9, 12], afternoon: [12, 17], evening: [17, 21] };

  // PLACEHOLDER: which preferences to collect and their defaults are for the team to refine
  // (open question 8 in plan/questions.md).
  E.DEFAULT_PREFS = {
    workStart: '09:00',
    workEnd: '20:00', // "no work after" cut-off; at or before workStart means the next day
    sessionMin: 50, // preferred session length
    minSession: 30,
    maxSession: 120,
    breakMin: 10, // gap kept after each session
    energy: 'morning',
    bufferDays: 1, // finish assignments this many days before the deadline
  };

  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };
  const pad2 = (n) => String(n).padStart(2, '0');
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const round5 = (m) => Math.max(5, Math.round(m / 5) * 5);
  const len = (b) => Math.round((b.end - b.start) / U.MIN);

  E.len = len;
  E.round5 = round5;

  // Minutes in a daily window. An end at or before the start is on the next day
  // ("10:00" to "03:00" is 17 hours); the same time means a full 24 hours.
  E.spanMin = (from, to) => { const d = (toMin(to) - toMin(from) + 1440) % 1440; return d === 0 ? 1440 : d; };
  // [start, end) of the daily window that begins on `day`.
  E.windowOn = (day, from, to) => { const s = U.atClock(day, from); return [s, s + E.spanMin(from, to) * U.MIN]; };
  const later = (start, a, b) => E.spanMin(start, a) > E.spanMin(start, b); // is cut-off a later than b?

  // A student's own estimate replaces the planner's. With milestones, the override is
  // kept by rescaling pace, so later progress updates start from it.
  E.overrideEstimate = (state, task, minutes) => {
    const open = sum(task.milestones.filter((m) => !m.done), (m) => m.estMin);
    if (open > 0) task.pace = Math.round((minutes / open) * 100) / 100;
    task.needMin = round5(minutes);
    E.logPrediction(state, task, task.needMin, { reason: 'student-override' });
  };
  E.task = (state, id) => state.tasks.find((t) => t.id === id);
  E.block = (state, id) => state.blocks.find((b) => b.id === id);

  /* ---------- preferences ---------- */

  // Base preferences plus any temporary "relax" overrides active on `day`.
  E.prefsFor = (state, task, day) => {
    const p = Object.assign({}, state.prefs);
    for (const o of state.overrides) {
      if (o.until != null && day > o.until) continue;
      if (o.taskId && (!task || o.taskId !== task.id)) continue;
      if (o.workEnd && later(p.workStart, o.workEnd, p.workEnd)) p.workEnd = o.workEnd;
      if (o.bufferDays != null && o.bufferDays < p.bufferDays) p.bufferDays = o.bufferDays;
    }
    return p;
  };

  // scope: 'task' | 'week' | 'fortnight' | 'always'
  E.addOverride = (state, o) => {
    if (o.scope === 'always') {
      if (o.workEnd && later(state.prefs.workStart, o.workEnd, state.prefs.workEnd)) state.prefs.workEnd = o.workEnd;
      if (o.bufferDays != null) state.prefs.bufferDays = Math.min(state.prefs.bufferDays, o.bufferDays);
      return;
    }
    let until = null;
    if (o.scope === 'week') until = U.endOfDay(U.addDays(U.startOfWeek(state.now), 6));
    if (o.scope === 'fortnight') until = U.endOfDay(U.addDays(state.now, 14));
    state.overrides.push({
      id: U.uid('o'),
      scope: o.scope,
      workEnd: o.workEnd || null,
      bufferDays: o.bufferDays == null ? null : o.bufferDays,
      taskId: o.scope === 'task' ? o.taskId : null,
      until,
    });
  };

  /* ---------- deadlines ---------- */

  // How far ahead "anytime" work may be placed: 28 days past now, or past the task's own
  // start if that is later (so a repeat that starts in six weeks still has room).
  E.horizonEnd = (state, task) => U.endOfDay(U.addDays(Math.max(state.now, (task && task.startAfter) || 0), HORIZON_DAYS));

  // Latest moment work may end: the due date minus the buffer (assignments only), or the
  // horizon for work with no deadline.
  E.deadlineFor = (state, task) => {
    if (!task.completeBy) return E.horizonEnd(state, task);
    let d = task.completeBy;
    if (task.type === 'assignment') d = U.addDays(d, -E.prefsFor(state, task, state.now).bufferDays);
    return d;
  };

  E.byUrgency = (state, taskIds) =>
    taskIds
      .map((id) => E.task(state, id))
      .filter(Boolean)
      .sort((a, b) => E.deadlineFor(state, a) - E.deadlineFor(state, b))
      .map((t) => t.id);

  /* ---------- free time ---------- */

  // Intervals that cannot be used. Sessions keep a break after them.
  function busyList(state, excluded) {
    const pad = state.prefs.breakMin * U.MIN;
    const out = [];
    for (const b of state.blocks) {
      if (b.state === 'skipped' || (excluded && excluded.has(b.id))) continue;
      out.push([b.start, b.end + (b.kind === 'session' ? pad : 0)]);
    }
    return out;
  }

  // Free slots on one day, best first (inside the student's peak-energy window).
  function slotsFor(state, task, day, busy, minLen, deadline) {
    const p = E.prefsFor(state, task, day);
    // Work hours that begin on `day`; they may run past midnight (10 AM to 3 AM).
    let [lo, hi] = E.windowOn(day, p.workStart, p.workEnd);
    // A task with its own time-of-day window (gym between 5 and 9 PM) uses it instead of
    // work hours: the student was explicit about when it can happen.
    if (task.dayWindow) [lo, hi] = E.windowOn(day, task.dayWindow.from, task.dayWindow.to);
    hi = Math.min(hi, deadline);
    if (task.startAfter) lo = Math.max(lo, task.startAfter); // earliest time, to the minute
    lo = Math.max(lo, U.roundUp(state.now, 15)); // never in the past
    if (hi - lo < minLen * U.MIN) return [];
    let slots = [[lo, hi]];
    for (const [bs, be] of busy) {
      if (be <= lo || bs >= hi) continue;
      const next = [];
      for (const [s, e] of slots) {
        if (be <= s || bs >= e) next.push([s, e]);
        else {
          if (bs > s) next.push([s, bs]);
          if (be < e) next.push([be, e]);
        }
      }
      slots = next;
    }
    const [w0, w1] = ENERGY[p.energy] || ENERGY.morning;
    const hour = (ts) => { const d = new Date(ts); return d.getHours() + d.getMinutes() / 60; };
    const score = (s) => { const h = hour(s); return h >= w0 && h < w1 ? 0 : Math.min(Math.abs(h - w0), Math.abs(h - w1)); };
    const pref = U.atClock(day, pad2(w0) + ':00');
    return slots
      .filter(([s, e]) => e - s >= minLen * U.MIN)
      .sort((a, b) => score(a[0]) - score(b[0]) || a[0] - b[0])
      .map(([s, e]) => ({ s, e, pref }));
  }

  // Next session length: the preferred length, without leaving a sliver behind.
  function nextLen(remaining, p) {
    if (remaining <= p.maxSession) return remaining - p.sessionMin >= p.minSession ? p.sessionMin : remaining;
    return p.sessionMin;
  }

  /* ---------- the fit check ----------
     Splits the work into sessions according to preferences *while* testing whether it
     fits, so a pass means the sessions already exist. Tasks that cannot be split need
     one free block as long as the whole task. Returns sessions without touching state. */
  function placeChunks(state, task, need, busy) {
    const startDay = Math.max(U.startOfDay(task.startAfter || state.now), U.startOfDay(state.now));
    const deadline = E.deadlineFor(state, task);
    const days = [];
    // Start a day early: yesterday's work hours may run past midnight into today.
    for (let d = U.addDays(startDay, -1); d <= deadline; d = U.addDays(d, 1)) {
      // "Any one of" repeats (laundry on Sat or Sun) may only use the selected weekdays.
      if (!task.allowedDays || task.allowedDays.includes(new Date(d).getDay())) days.push(d);
    }
    const pad = state.prefs.breakMin * U.MIN;
    const local = busy.slice();
    const perDay = new Map();
    const sessions = [];
    let remaining = need;
    const passes = task.canSplit ? 3 : 1;
    // Spread work: one session per day first, then two, then as many as fit.
    for (let pass = 1; pass <= passes && remaining > 0; pass++) {
      const cap = pass === 1 ? 1 : pass === 2 ? 2 : Infinity;
      for (const day of days) {
        let n = perDay.get(day) || 0;
        while (remaining > 0 && n < cap) {
          const p = E.prefsFor(state, task, day);
          const want = task.canSplit ? nextLen(remaining, p) : remaining;
          const minLen = task.canSplit ? Math.min(p.minSession, remaining) : remaining;
          const slot = slotsFor(state, task, day, local, minLen, deadline)[0];
          if (!slot) break;
          const length = Math.min(want, Math.floor((slot.e - slot.s) / U.MIN));
          let start = slot.s;
          if (start < slot.pref && slot.e - slot.pref >= length * U.MIN) start = slot.pref;
          const end = start + length * U.MIN;
          sessions.push({ id: U.uid('s'), kind: 'session', taskId: task.id, title: task.title, start, end, state: 'planned', anchored: false });
          local.push([start, end + pad]);
          remaining -= length;
          n++;
          perDay.set(day, n);
        }
      }
    }
    return { sessions, unplaced: remaining };
  }

  // Try making room by moving *less urgent* floating work later. Moves as little as it
  // can: the least urgent task first, adding more tasks only while the new one still
  // does not fit. All or nothing, and a task that lands back where it was is not "moved".
  function tryBump(state, task, need) {
    const myDeadline = E.deadlineFor(state, task);
    const sessionsIn = (t) => state.blocks.filter((b) => b.taskId === t.id && b.kind === 'session' && b.state === 'planned' && !b.anchored && b.start >= state.now && b.start < myDeadline);
    const cands = state.tasks
      .filter((t) => t.id !== task.id && t.status === 'active' && E.deadlineFor(state, t) > myDeadline && sessionsIn(t).length)
      .sort((a, b) => E.deadlineFor(state, b) - E.deadlineFor(state, a)); // least urgent first
    const pad = state.prefs.breakMin * U.MIN;
    for (let k = 1; k <= cands.length; k++) {
      const group = cands.slice(0, k);
      const originals = new Map(group.map((t) => [t.id, sessionsIn(t)]));
      const excluded = new Set([].concat(...[...originals.values()]).map((b) => b.id));
      const busy = busyList(state, excluded);
      const mine = placeChunks(state, task, need, busy);
      if (mine.unplaced > 0) continue;
      const busy2 = busy.concat(mine.sessions.map((s) => [s.start, s.end + pad]));
      let ok = true;
      const sessions = mine.sessions.slice();
      const removed = [];
      const moved = [];
      for (const t of group.slice().sort((a, b) => E.deadlineFor(state, a) - E.deadlineFor(state, b))) {
        const old = originals.get(t.id);
        const minutes = sum(old, len);
        const rr = placeChunks(state, t, minutes, busy2);
        if (rr.unplaced > 0) { ok = false; break; }
        const sig = (list) => list.map((b) => b.start + '-' + b.end).sort().join();
        if (sig(old) === sig(rr.sessions)) {
          old.forEach((b) => busy2.push([b.start, b.end + pad])); // landed back in place: leave it alone
        } else {
          rr.sessions.forEach((s) => busy2.push([s.start, s.end + pad]));
          sessions.push(...rr.sessions);
          removed.push(...old.map((b) => b.id));
          moved.push({ taskId: t.id, title: t.title, minutes });
        }
      }
      if (ok) return { ok: true, sessions, removed, moved, unplaced: 0 };
    }
    return null;
  }

  // Plan `need` minutes for a task without changing state.
  E.plan = (state, task, need, opts) => {
    opts = opts || {};
    const first = placeChunks(state, task, need, busyList(state, null));
    if (first.unplaced === 0) return { ok: true, sessions: first.sessions, removed: [], moved: [], unplaced: 0 };
    if (opts.bump !== false) {
      const bumped = tryBump(state, task, need);
      if (bumped) return bumped;
    }
    return { ok: false, sessions: first.sessions, removed: [], moved: [], unplaced: first.unplaced };
  };

  // Plan and commit. Without allowPartial a failed fit changes nothing ("nofit").
  E.apply = (state, task, need, opts) => {
    opts = opts || {};
    const r = E.plan(state, task, need, opts);
    const commit = (sessions, removed) => {
      const gone = new Set(removed);
      state.blocks = state.blocks.filter((b) => !gone.has(b.id)).concat(sessions);
    };
    if (r.ok) {
      commit(r.sessions, r.removed);
      task.sched = 'scheduled';
      task.shortfallMin = 0;
      return { status: 'scheduled', placedMin: need, shortfallMin: 0, moved: r.moved, needMin: need };
    }
    const placed = task.canSplit ? need - r.unplaced : 0;
    if (opts.allowPartial) {
      if (placed > 0) {
        commit(r.sessions, []);
        task.sched = 'partial';
        task.shortfallMin = r.unplaced;
      } else {
        task.sched = 'unscheduled';
        task.shortfallMin = need;
      }
      return { status: task.sched, placedMin: placed, shortfallMin: task.shortfallMin, moved: [], needMin: need };
    }
    return { status: 'nofit', placedMin: placed, shortfallMin: task.canSplit ? r.unplaced : need, moved: [], needMin: need };
  };

  /* ---------- keeping a task's sessions in line with what it still needs ---------- */

  // Minutes already covered by sessions assumed to happen (planned, including ones
  // that ended and still await feedback). Time after the due date cannot help meet it,
  // so a repeating anchored block that runs past the deadline does not count there.
  E.coverage = (state, task) =>
    sum(state.blocks.filter((b) => b.taskId === task.id && b.kind === 'session' && b.state === 'planned' && (!task.completeBy || b.start < task.completeBy)), len);

  // Shorten or remove the latest floating future sessions.
  function trim(state, task, excess) {
    const mine = state.blocks
      .filter((b) => b.taskId === task.id && b.kind === 'session' && b.state === 'planned' && !b.anchored && b.start > state.now)
      .sort((a, b) => b.start - a.start);
    let left = excess;
    let trimmed = 0;
    for (const b of mine) {
      if (left <= 0) break;
      const l = len(b);
      if (l <= left + 14) {
        state.blocks = state.blocks.filter((x) => x.id !== b.id);
        left -= l;
        trimmed += l;
      } else {
        b.end = b.start + (l - left) * U.MIN;
        trimmed += left;
        left = 0;
      }
    }
    return trimmed;
  }

  // Place what is missing (the fit check) or trim what is surplus.
  E.reconcile = (state, task, opts) => {
    if (task.status !== 'active') return { status: 'none', shortfallMin: 0 };
    const need = task.needMin - E.coverage(state, task);
    if (need > 0) return E.apply(state, task, need, opts);
    const trimmed = need < 0 ? trim(state, task, -need) : 0;
    task.sched = 'scheduled';
    task.shortfallMin = 0;
    return { status: 'scheduled', trimmedMin: trimmed, shortfallMin: 0, moved: [] };
  };

  // Blocks that a block overlaps, for the "move it or keep the overlap?" prompt. Classes
  // are overlapped silently (in either direction); finished or skipped blocks don't count.
  E.overlapsOf = (state, blockId) => {
    const b = E.block(state, blockId);
    if (!b || b.state !== 'planned' || b.eventType === 'class') return [];
    return state.blocks.filter((o) => o.id !== b.id && o.state === 'planned' && o.eventType !== 'class' && o.start < b.end && o.end > b.start);
  };

  E.isFloating = (b) => b.kind === 'session' && !b.anchored;

  // The student chose to move a floating session out of the way: take it off the
  // calendar. Returns its task id; the caller reconciles the task to re-place the work.
  E.unplaceSession = (state, blockId) => {
    const b = E.block(state, blockId);
    if (!b || !E.isFloating(b)) return null;
    state.blocks = state.blocks.filter((x) => x.id !== blockId);
    return b.taskId;
  };

  // Edit an anchored block's time, for this occurrence or every one of its repeats that has
  // not happened yet (the same shift and new length for each).
  E.editBlockTime = (state, blockId, start, end, scope) => {
    const b = E.block(state, blockId);
    const delta = start - b.start;
    const length = end - start;
    const targets = scope === 'all' && b.seriesId
      ? state.blocks.filter((x) => x.seriesId === b.seriesId && x.state === 'planned' && x.end > state.now)
      : [b];
    targets.forEach((x) => { x.start += delta; x.end = x.start + length; });
    return targets.map((x) => x.id);
  };

  // Preview the fit check under a draft relaxation, without changing state.
  E.previewFit = (state, taskId, override, need) => {
    const s = structuredClone(state);
    E.addOverride(s, override);
    const r = E.plan(s, E.task(s, taskId), need, {});
    return { fits: r.ok, shortfallMin: r.unplaced };
  };

  /* ---------- feedback after a session ---------- */

  // Who gets a prompt: 'assignment' | 'recurring' | 'errand' | 'none'.
  // Anchored events and classes never move, so their outcome changes nothing: no prompt.
  // Sessions (floating, or anchored time set aside for an assignment) do get one.
  // A task that is not an assignment asks "Done?" only after its last planned session;
  // earlier sessions are assumed done.
  E.promptKind = (state, b) => {
    if (b.state !== 'planned' || b.kind !== 'session') return 'none';
    const t = E.task(state, b.taskId);
    if (!t) return 'none';
    if (t.type === 'assignment') return 'assignment';
    const later = state.blocks.some((x) => x !== b && x.taskId === t.id && x.kind === 'session' && x.state === 'planned' && x.start >= b.end);
    return later ? 'none' : 'done';
  };

  // Queue a feedback prompt for each eligible block that ended in (oldNow, newNow].
  E.queuePrompts = (state, oldNow, newNow) => {
    const added = [];
    const due = state.blocks.filter((b) => b.end > oldNow && b.end <= newNow).sort((a, b) => a.end - b.end);
    for (const b of due) {
      if (E.promptKind(state, b) === 'none' || state.pending.some((p) => p.blockId === b.id)) continue;
      state.pending.push({ blockId: b.id, endedAt: b.end });
      added.push(b.id);
    }
    return added;
  };

  // Missed session: grey it out and keep it as a record. The caller reconciles the task.
  E.skipBlock = (state, blockId) => {
    const b = E.block(state, blockId);
    if (b) b.state = 'skipped';
    state.pending = state.pending.filter((p) => p.blockId !== blockId);
    return b;
  };

  /* Errands and chores that are not done yet. The student says how many more minutes the
     task needs and picks: 'extend' (this timeslot grows by that much), 'continue' (a new
     anchored block starting now), or 'later' (the fit check places it). The session is not
     greyed out: for these tasks it does not matter whether the time was productive.
     Returns the id of the extended or new block (null for 'later'); the caller runs the
     overlap check for it, then reconciles the task. */
  E.notDoneYet = (state, blockId, minutes, how) => {
    const b = E.block(state, blockId);
    const t = E.task(state, b.taskId);
    state.pending = state.pending.filter((p) => p.blockId !== blockId);
    if (how === 'extend') {
      b.end += minutes * U.MIN;
      b.anchored = true; // the student set this time
      t.needMin = len(b); // the original part is past; the extension covers what is left
      // If the extended time is already over, ask about it again right away.
      if (b.end <= state.now) state.pending.push({ blockId: b.id, endedAt: b.end });
      return b.id;
    }
    b.state = 'done';
    b.actualMin = len(b);
    t.needMin = minutes;
    if (how === 'continue') {
      const start = U.roundUp(state.now, 5);
      const nb = { id: U.uid('s'), kind: 'session', taskId: t.id, title: t.title, start, end: start + minutes * U.MIN, state: 'planned', anchored: true };
      state.blocks.push(nb);
      return nb.id;
    }
    return null;
  };

  E.markDone = (state, blockId, minutes) => {
    const b = E.block(state, blockId);
    if (b) { b.state = 'done'; b.actualMin = minutes; }
    state.pending = state.pending.filter((p) => p.blockId !== blockId);
    return b;
  };

  /* PLACEHOLDER MATH, FOR THE TEAM TO REFINE: the pace blend, the 0.5 to 2 clamp, and the
     10% / 10 minute tolerance below are first guesses, not validated choices.

     Re-estimate the remaining time from reported progress, then compare it with what
     is already planned. p = { minutes, newlyDone:[milestoneId], pct, credit,
     addMilestones:[], replaceUndone:[] }. Call after marking the session done.
     Returns { kind: 'ahead' | 'on-track' | 'behind', diffMin, remainingMin }. */
  E.applyProgress = (state, task, p) => {
    task.loggedMin = (task.loggedMin || 0) + (p.minutes || 0);
    if (p.replaceUndone) task.milestones = task.milestones.filter((m) => m.done).concat(p.replaceUndone);
    if (p.addMilestones) task.milestones = task.milestones.concat(p.addMilestones);
    const done = new Set(p.newlyDone || []);
    const newly = task.milestones.filter((m) => done.has(m.id));
    newly.forEach((m) => { m.done = true; });

    let est;
    if (!task.milestones.length && p.pct != null) {
      // Without milestones, progress comes from the slider.
      task.progressPct = p.pct;
      est = task.totalMin * (1 - p.pct / 100);
    } else if (task.milestones.length) {
      // With milestones, only checked milestones count: none checked means no progress.
      // Pace: how long this student really took versus the estimate for what they finished.
      const predicted = sum(newly, (m) => m.estMin);
      if (predicted > 0 && p.minutes > 0) {
        const ratio = U.clamp(p.minutes / predicted, 0.5, 2);
        task.pace = Math.round((0.5 * (task.pace || 1) + 0.5 * ratio) * 100) / 100;
      }
      est = sum(task.milestones.filter((m) => !m.done), (m) => m.estMin) * (task.pace || 1);
    } else {
      // No progress reported at all: nothing is assumed done, so the estimate stands.
      est = task.needMin;
    }
    est = est <= 0 ? 0 : round5(est);
    E.logPrediction(state, task, est, { reason: 'progress', loggedMin: task.loggedMin, pace: task.pace || 1, progressPct: task.progressPct || null, openMilestones: task.milestones.filter((m) => !m.done).length });

    const planned = E.coverage(state, task);
    const diff = est - planned;
    const tol = Math.max(10, 0.1 * planned);
    const kind = diff > tol ? 'behind' : diff < -tol ? 'ahead' : 'on-track';
    task.needMin = kind === 'on-track' ? planned : est; // within tolerance: leave the plan alone
    return { kind, diffMin: diff, remainingMin: est };
  };

  // Every new estimate is kept with the inputs it was based on, so predictions can be
  // compared with outcomes later.
  E.logPrediction = (state, task, minutes, inputs) => {
    task.predictionLog = (task.predictionLog || []).concat({ at: state.now, minutes, model: 'placeholder-v0', inputs });
  };

  // Finished: drop future sessions. A finished assignment's predicted-vs-actual total
  // becomes a training example; partial logs never do (they are lower bounds). Errands
  // and chores are not training examples: their time is never measured.
  E.completeTask = (state, task) => {
    const future = state.blocks.filter((b) => b.taskId === task.id && b.kind === 'session' && b.state === 'planned' && b.start > state.now);
    const goneIds = new Set(future.map((b) => b.id));
    state.blocks = state.blocks.filter((b) => !goneIds.has(b.id));
    state.blocks.filter((b) => b.taskId === task.id && b.state === 'planned').forEach((b) => { b.state = 'done'; });
    state.pending = state.pending.filter((p) => { const b = E.block(state, p.blockId); return b && b.state === 'planned'; });
    task.status = 'complete';
    task.needMin = 0;
    task.sched = 'none';
    task.completedAt = state.now;
    task.milestones.forEach((m) => { m.done = true; });
    if (task.type === 'assignment') {
      state.completed.push({
        taskId: task.id, title: task.title, course: task.course, type: task.type,
        predictedMin: task.predictedMin, actualMin: task.loggedMin, at: state.now, sample: !!task.sample,
      });
    }
    return future.length;
  };

  /* ---------- recurrence ----------
     rule = { freq: 'none'|'daily'|'weekly'|'monthly', every: N, days: [weekday 0-6],
              mode: 'all'|'any', nth: 1-5 or -1 (last), ends: { type: 'never'|'on'|'after', date, count } }
     Monthly means the Nth occurrence of each selected weekday ("the 2nd Tuesday",
     "the last Friday").
     Returns occurrences from `anchor` (a day) onward:
       mode 'all' -> one per selected day:          { day }
       mode 'any' -> one per period (week/month):   { from, to, days } (first..last selected day)
     PROTOTYPE LIMIT, TO REMOVE: "never" stops at GEN_WEEKS so the prototype stays finite. */
  const GEN_WEEKS = 8;
  E.expandRepeat = (rule, anchor) => {
    anchor = U.startOfDay(anchor);
    if (!rule || rule.freq === 'none') return [{ day: anchor }];
    const every = Math.max(1, rule.every || 1);
    const ends = rule.ends || { type: 'never' };
    // Only "never" is capped (PROTOTYPE LIMIT); "after N times" may run past it.
    const last = ends.type === 'on' ? U.endOfDay(ends.date) : U.addDays(anchor, ends.type === 'after' ? 3650 : GEN_WEEKS * 7);
    const max = ends.type === 'after' ? Math.max(1, ends.count) : Infinity;
    const out = [];
    const push = (o) => { if (out.length < max) out.push(o); };
    const fromPeriod = (dates) => {
      dates = dates.filter((d) => d >= anchor && d <= last).sort((a, b) => a - b);
      if (!dates.length) return;
      if (rule.mode === 'any') push({ from: dates[0], to: dates[dates.length - 1], days: rule.days.slice() });
      else dates.forEach((d) => push({ day: d }));
    };
    if (rule.freq === 'daily') {
      for (let d = anchor; d <= last && out.length < max; d = U.addDays(d, every)) push({ day: d });
    } else if (rule.freq === 'weekly') {
      for (let w = U.startOfWeek(anchor); w <= last && out.length < max; w = U.addDays(w, 7 * every)) {
        fromPeriod(rule.days.map((wd) => U.addDays(w, (wd + 6) % 7)));
      }
    } else if (rule.freq === 'monthly') {
      for (let m = 0; out.length < max; m += every) {
        const first = new Date(anchor); first.setDate(1); first.setMonth(first.getMonth() + m);
        const monthStart = first.getTime();
        if (monthStart > last) break;
        // The Nth occurrence of each selected weekday in that month ("2nd Tuesday"), or the last.
        fromPeriod(rule.days.map((wd) => {
          if (rule.nth === -1) {
            const next = new Date(monthStart); next.setMonth(next.getMonth() + 1);
            const lastDay = U.addDays(next.getTime(), -1);
            return U.addDays(lastDay, -((new Date(lastDay).getDay() - wd + 7) % 7));
          }
          const offset = (wd - new Date(monthStart).getDay() + 7) % 7;
          const d = U.addDays(monthStart, offset + 7 * ((rule.nth || 1) - 1));
          return new Date(d).getMonth() === new Date(monthStart).getMonth() ? d : null;
        }).filter((d) => d != null));
      }
    }
    return out;
  };

  // Assignments repeat by shifting their whole window. Returns shifts in ms from the first.
  E.repeatShifts = (rule, anchor) => {
    if (!rule || rule.freq === 'none') return [0];
    const every = Math.max(1, rule.every || 1);
    const ends = rule.ends || { type: 'never' };
    // Only "never" is capped (PROTOTYPE LIMIT); "after N times" may run past it.
    const last = ends.type === 'on' ? U.endOfDay(ends.date) : U.addDays(anchor, ends.type === 'after' ? 3650 : GEN_WEEKS * 7);
    const max = ends.type === 'after' ? Math.max(1, ends.count) : Infinity;
    const out = [];
    for (let k = 0; out.length < max; k++) {
      const d = new Date(anchor);
      if (rule.freq === 'daily') d.setDate(d.getDate() + k * every);
      else if (rule.freq === 'weekly') d.setDate(d.getDate() + 7 * k * every);
      else d.setMonth(d.getMonth() + k * every);
      if (d.getTime() > last) break;
      out.push(d.getTime() - anchor);
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
