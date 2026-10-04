/* Scheduling engine: the fit check, placement, displacement, and progress
   re-estimation behind both flows in plan/uiux/user-flows.md.

   Pure functions over a plain-JSON `state` object, so they run in the browser and
   under the test runner. Nothing here touches the DOM, React, or storage.

   task  = floating work (assignment or other); block = anything on the calendar.
   A "session" block belongs to a task; an "anchored" block is a plain calendar event.
   Sessions the student anchored count as anchored blocks: the planner never moves them. */
import * as U from './util';
import type { Block, Milestone, OverrideDraft, Prefs, RepeatRule, State, Task } from './types';

// PROTOTYPE LIMIT, TO REMOVE: work with no deadline is only placed up to 28 days ahead.
// In the product, "anytime" should really mean anytime.
const HORIZON_DAYS = 28;
const ENERGY: Record<string, [number, number]> = { morning: [9, 12], afternoon: [12, 17], evening: [17, 21] };

// PLACEHOLDER: which preferences to collect and their defaults are for the team to refine
// (open question 8 in plan/questions.md).
export const DEFAULT_PREFS: Prefs = {
  workStart: '09:00',
  workEnd: '20:00', // "no work after" cut-off; at or before workStart means the next day
  sessionMin: 50, // preferred session length
  minSession: 30,
  maxSession: 120,
  breakMin: 10, // gap kept after each session
  energy: 'morning',
  bufferDays: 1, // finish assignments this many days before the deadline
};

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };
const pad2 = (n: number) => String(n).padStart(2, '0');
const sum = <T>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0);
export const round5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);
export const len = (b: Block) => Math.round((b.end - b.start) / U.MIN);

// Minutes in a daily window. An end at or before the start is on the next day
// ("10:00" to "03:00" is 17 hours); the same time means a full 24 hours.
export const spanMin = (from: string, to: string) => { const d = (toMin(to) - toMin(from) + 1440) % 1440; return d === 0 ? 1440 : d; };
// [start, end) of the daily window that begins on `day`.
export const windowOn = (day: number, from: string, to: string): [number, number] => { const s = U.atClock(day, from); return [s, s + spanMin(from, to) * U.MIN]; };
const later = (start: string, a: string, b: string) => spanMin(start, a) > spanMin(start, b); // is cut-off a later than b?

export const task = (state: State, id: string | null | undefined) => state.tasks.find((t) => t.id === id);
export const block = (state: State, id: string | null | undefined) => state.blocks.find((b) => b.id === id);

// Every new estimate is kept with the inputs it was based on, so predictions can be
// compared with outcomes later.
export const logPrediction = (state: State, t: Task, minutes: number, inputs: Record<string, unknown>) => {
  t.predictionLog = (t.predictionLog || []).concat({ at: state.now, minutes, model: 'placeholder-v0', inputs });
};

// A student's own estimate replaces the planner's. With milestones, the override is
// kept by rescaling pace, so later progress updates start from it.
export const overrideEstimate = (state: State, t: Task, minutes: number) => {
  const open = sum(t.milestones.filter((m) => !m.done), (m) => m.estMin);
  if (open > 0) t.pace = Math.round((minutes / open) * 100) / 100;
  t.needMin = round5(minutes);
  logPrediction(state, t, t.needMin, { reason: 'student-override' });
};

/* ---------- preferences ---------- */

// Base preferences plus any temporary "relax" overrides active on `day`.
export const prefsFor = (state: State, t: Task | null | undefined, day: number): Prefs => {
  const p = Object.assign({}, state.prefs);
  for (const o of state.overrides) {
    if (o.until != null && day > o.until) continue;
    if (o.taskId && (!t || o.taskId !== t.id)) continue;
    if (o.workEnd && later(p.workStart, o.workEnd, p.workEnd)) p.workEnd = o.workEnd;
    if (o.bufferDays != null && o.bufferDays < p.bufferDays) p.bufferDays = o.bufferDays;
  }
  return p;
};

export const addOverride = (state: State, o: OverrideDraft) => {
  if (o.scope === 'always') {
    if (o.workEnd && later(state.prefs.workStart, o.workEnd, state.prefs.workEnd)) state.prefs.workEnd = o.workEnd;
    if (o.bufferDays != null) state.prefs.bufferDays = Math.min(state.prefs.bufferDays, o.bufferDays);
    return;
  }
  let until: number | null = null;
  if (o.scope === 'week') until = U.endOfDay(U.addDays(U.startOfWeek(state.now), 6));
  if (o.scope === 'fortnight') until = U.endOfDay(U.addDays(state.now, 14));
  state.overrides.push({
    id: U.uid('o'),
    scope: o.scope,
    workEnd: o.workEnd || null,
    bufferDays: o.bufferDays == null ? null : o.bufferDays,
    taskId: o.scope === 'task' ? o.taskId || null : null,
    until,
  });
};

/* ---------- deadlines ---------- */

// How far ahead "anytime" work may be placed: 28 days past now, or past the task's own
// start if that is later (so a repeat that starts in six weeks still has room).
export const horizonEnd = (state: State, t: Task | null) => U.endOfDay(U.addDays(Math.max(state.now, (t && t.startAfter) || 0), HORIZON_DAYS));

// Latest moment work may end: the due date minus the buffer (assignments only), or the
// horizon for work with no deadline.
export const deadlineFor = (state: State, t: Task) => {
  if (!t.completeBy) return horizonEnd(state, t);
  let d = t.completeBy;
  if (t.type === 'assignment') d = U.addDays(d, -prefsFor(state, t, state.now).bufferDays);
  return d;
};

export const byUrgency = (state: State, taskIds: string[]) =>
  taskIds
    .map((id) => task(state, id))
    .filter((t): t is Task => !!t)
    .sort((a, b) => deadlineFor(state, a) - deadlineFor(state, b))
    .map((t) => t.id);

/* ---------- free time ---------- */

type Interval = [number, number];

// Intervals that cannot be used. Sessions keep a break after them.
function busyList(state: State, excluded: Set<string> | null): Interval[] {
  const pad = state.prefs.breakMin * U.MIN;
  const out: Interval[] = [];
  for (const b of state.blocks) {
    if (b.state === 'skipped' || (excluded && excluded.has(b.id))) continue;
    out.push([b.start, b.end + (b.kind === 'session' ? pad : 0)]);
  }
  return out;
}

interface Slot { s: number; e: number; pref: number }

// Free slots on one day, best first (inside the student's peak-energy window).
function slotsFor(state: State, t: Task, day: number, busy: Interval[], minLen: number, deadline: number): Slot[] {
  const p = prefsFor(state, t, day);
  // Work hours that begin on `day`; they may run past midnight (10 AM to 3 AM).
  let [lo, hi] = windowOn(day, p.workStart, p.workEnd);
  // A task with its own time-of-day window (gym between 5 and 9 PM) uses it instead of
  // work hours: the student was explicit about when it can happen.
  if (t.dayWindow) [lo, hi] = windowOn(day, t.dayWindow.from, t.dayWindow.to);
  hi = Math.min(hi, deadline);
  if (t.startAfter) lo = Math.max(lo, t.startAfter); // earliest time, to the minute
  lo = Math.max(lo, U.roundUp(state.now, 15)); // never in the past
  if (hi - lo < minLen * U.MIN) return [];
  let slots: Interval[] = [[lo, hi]];
  for (const [bs, be] of busy) {
    if (be <= lo || bs >= hi) continue;
    const next: Interval[] = [];
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
  const hour = (ts: number) => { const d = new Date(ts); return d.getHours() + d.getMinutes() / 60; };
  const score = (s: number) => { const h = hour(s); return h >= w0 && h < w1 ? 0 : Math.min(Math.abs(h - w0), Math.abs(h - w1)); };
  const pref = U.atClock(day, pad2(w0) + ':00');
  return slots
    .filter(([s, e]) => e - s >= minLen * U.MIN)
    .sort((a, b) => score(a[0]) - score(b[0]) || a[0] - b[0])
    .map(([s, e]) => ({ s, e, pref }));
}

// Next session length: the preferred length, without leaving a sliver behind.
function nextLen(remaining: number, p: Prefs) {
  if (remaining <= p.maxSession) return remaining - p.sessionMin >= p.minSession ? p.sessionMin : remaining;
  return p.sessionMin;
}

interface Placement { sessions: Block[]; unplaced: number }

/* ---------- the fit check ----------
   Splits the work into sessions according to preferences *while* testing whether it
   fits, so a pass means the sessions already exist. Tasks that cannot be split need
   one free block as long as the whole task. Returns sessions without touching state. */
function placeChunks(state: State, t: Task, need: number, busy: Interval[]): Placement {
  const startDay = Math.max(U.startOfDay(t.startAfter || state.now), U.startOfDay(state.now));
  const deadline = deadlineFor(state, t);
  const days: number[] = [];
  // Start a day early: yesterday's work hours may run past midnight into today.
  for (let d = U.addDays(startDay, -1); d <= deadline; d = U.addDays(d, 1)) {
    // "Any one of" repeats (laundry on Sat or Sun) may only use the selected weekdays.
    if (!t.allowedDays || t.allowedDays.includes(new Date(d).getDay())) days.push(d);
  }
  const pad = state.prefs.breakMin * U.MIN;
  const local = busy.slice();
  const perDay = new Map<number, number>();
  const sessions: Block[] = [];
  let remaining = need;
  const passes = t.canSplit ? 3 : 1;
  // Spread work: one session per day first, then two, then as many as fit.
  for (let pass = 1; pass <= passes && remaining > 0; pass++) {
    const cap = pass === 1 ? 1 : pass === 2 ? 2 : Infinity;
    for (const day of days) {
      let n = perDay.get(day) || 0;
      while (remaining > 0 && n < cap) {
        const p = prefsFor(state, t, day);
        const want = t.canSplit ? nextLen(remaining, p) : remaining;
        const minLen = t.canSplit ? Math.min(p.minSession, remaining) : remaining;
        const slot = slotsFor(state, t, day, local, minLen, deadline)[0];
        if (!slot) break;
        const length = Math.min(want, Math.floor((slot.e - slot.s) / U.MIN));
        let start = slot.s;
        if (start < slot.pref && slot.e - slot.pref >= length * U.MIN) start = slot.pref;
        const end = start + length * U.MIN;
        sessions.push({ id: U.uid('s'), kind: 'session', taskId: t.id, title: t.title, start, end, state: 'planned', anchored: false });
        local.push([start, end + pad]);
        remaining -= length;
        n++;
        perDay.set(day, n);
      }
    }
  }
  return { sessions, unplaced: remaining };
}

export interface Moved { taskId: string; title: string; minutes: number }
export interface Plan { ok: boolean; sessions: Block[]; removed: string[]; moved: Moved[]; unplaced: number }

// Try making room by moving *less urgent* floating work later. Moves as little as it
// can: the least urgent task first, adding more tasks only while the new one still
// does not fit. All or nothing, and a task that lands back where it was is not "moved".
function tryBump(state: State, t: Task, need: number): Plan | null {
  const myDeadline = deadlineFor(state, t);
  const sessionsIn = (x: Task) => state.blocks.filter((b) => b.taskId === x.id && b.kind === 'session' && b.state === 'planned' && !b.anchored && b.start >= state.now && b.start < myDeadline);
  const cands = state.tasks
    .filter((x) => x.id !== t.id && x.status === 'active' && deadlineFor(state, x) > myDeadline && sessionsIn(x).length)
    .sort((a, b) => deadlineFor(state, b) - deadlineFor(state, a)); // least urgent first
  const pad = state.prefs.breakMin * U.MIN;
  for (let k = 1; k <= cands.length; k++) {
    const group = cands.slice(0, k);
    const originals = new Map(group.map((x) => [x.id, sessionsIn(x)]));
    const excluded = new Set(([] as Block[]).concat(...originals.values()).map((b) => b.id));
    const busy = busyList(state, excluded);
    const mine = placeChunks(state, t, need, busy);
    if (mine.unplaced > 0) continue;
    const busy2: Interval[] = busy.concat(mine.sessions.map((s): Interval => [s.start, s.end + pad]));
    let ok = true;
    const sessions = mine.sessions.slice();
    const removed: string[] = [];
    const moved: Moved[] = [];
    for (const x of group.slice().sort((a, b) => deadlineFor(state, a) - deadlineFor(state, b))) {
      const old = originals.get(x.id) || [];
      const minutes = sum(old, len);
      const rr = placeChunks(state, x, minutes, busy2);
      if (rr.unplaced > 0) { ok = false; break; }
      const sig = (list: Block[]) => list.map((b) => b.start + '-' + b.end).sort().join();
      if (sig(old) === sig(rr.sessions)) {
        old.forEach((b) => busy2.push([b.start, b.end + pad])); // landed back in place: leave it alone
      } else {
        rr.sessions.forEach((s) => busy2.push([s.start, s.end + pad]));
        sessions.push(...rr.sessions);
        removed.push(...old.map((b) => b.id));
        moved.push({ taskId: x.id, title: x.title, minutes });
      }
    }
    if (ok) return { ok: true, sessions, removed, moved, unplaced: 0 };
  }
  return null;
}

// Plan `need` minutes for a task without changing state.
export const plan = (state: State, t: Task, need: number, opts: { bump?: boolean } = {}): Plan => {
  const first = placeChunks(state, t, need, busyList(state, null));
  if (first.unplaced === 0) return { ok: true, sessions: first.sessions, removed: [], moved: [], unplaced: 0 };
  if (opts.bump !== false) {
    const bumped = tryBump(state, t, need);
    if (bumped) return bumped;
  }
  return { ok: false, sessions: first.sessions, removed: [], moved: [], unplaced: first.unplaced };
};

export type FitStatus = 'scheduled' | 'partial' | 'unscheduled' | 'nofit' | 'none';
export interface FitResult {
  status: FitStatus;
  placedMin?: number;
  shortfallMin: number;
  moved: Moved[];
  needMin?: number;
  trimmedMin?: number;
}

// Plan and commit. Without allowPartial a failed fit changes nothing ("nofit").
export const apply = (state: State, t: Task, need: number, opts: { allowPartial?: boolean; bump?: boolean } = {}): FitResult => {
  const r = plan(state, t, need, opts);
  const commit = (sessions: Block[], removed: string[]) => {
    const gone = new Set(removed);
    state.blocks = state.blocks.filter((b) => !gone.has(b.id)).concat(sessions);
  };
  if (r.ok) {
    commit(r.sessions, r.removed);
    t.sched = 'scheduled';
    t.shortfallMin = 0;
    return { status: 'scheduled', placedMin: need, shortfallMin: 0, moved: r.moved, needMin: need };
  }
  const placed = t.canSplit ? need - r.unplaced : 0;
  if (opts.allowPartial) {
    if (placed > 0) {
      commit(r.sessions, []);
      t.sched = 'partial';
      t.shortfallMin = r.unplaced;
    } else {
      t.sched = 'unscheduled';
      t.shortfallMin = need;
    }
    return { status: t.sched, placedMin: placed, shortfallMin: t.shortfallMin, moved: [], needMin: need };
  }
  return { status: 'nofit', placedMin: placed, shortfallMin: t.canSplit ? r.unplaced : need, moved: [], needMin: need };
};

/* ---------- keeping a task's sessions in line with what it still needs ---------- */

// Minutes already covered by sessions assumed to happen (planned, including ones
// that ended and still await feedback). Time after the due date cannot help meet it,
// so a repeating anchored block that runs past the deadline does not count there.
export const coverage = (state: State, t: Task) =>
  sum(state.blocks.filter((b) => b.taskId === t.id && b.kind === 'session' && b.state === 'planned' && (!t.completeBy || b.start < t.completeBy)), len);

// Shorten or remove the latest floating future sessions.
function trim(state: State, t: Task, excess: number) {
  const mine = state.blocks
    .filter((b) => b.taskId === t.id && b.kind === 'session' && b.state === 'planned' && !b.anchored && b.start > state.now)
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
export const reconcile = (state: State, t: Task, opts: { allowPartial?: boolean } = {}): FitResult => {
  if (t.status !== 'active') return { status: 'none', shortfallMin: 0, moved: [] };
  const need = t.needMin - coverage(state, t);
  if (need > 0) return apply(state, t, need, opts);
  const trimmed = need < 0 ? trim(state, t, -need) : 0;
  t.sched = 'scheduled';
  t.shortfallMin = 0;
  return { status: 'scheduled', trimmedMin: trimmed, shortfallMin: 0, moved: [] };
};

// Blocks that a block overlaps, for the "move it or keep the overlap?" prompt. Classes
// are overlapped silently (in either direction); finished or skipped blocks don't count.
export const overlapsOf = (state: State, blockId: string) => {
  const b = block(state, blockId);
  if (!b || b.state !== 'planned' || b.eventType === 'class') return [];
  return state.blocks.filter((o) => o.id !== b.id && o.state === 'planned' && o.eventType !== 'class' && o.start < b.end && o.end > b.start);
};

export const isFloating = (b: Block) => b.kind === 'session' && !b.anchored;

// The student chose to move a floating session out of the way: take it off the
// calendar. Returns its task id; the caller reconciles the task to re-place the work.
export const unplaceSession = (state: State, blockId: string) => {
  const b = block(state, blockId);
  if (!b || !isFloating(b)) return null;
  state.blocks = state.blocks.filter((x) => x.id !== blockId);
  return b.taskId || null;
};

// Edit an anchored block's time, for this occurrence or every one of its repeats that has
// not happened yet (the same shift and new length for each).
export const editBlockTime = (state: State, blockId: string, start: number, end: number, scope: 'this' | 'all') => {
  const b = block(state, blockId);
  if (!b) return [];
  const delta = start - b.start;
  const length = end - start;
  const targets = scope === 'all' && b.seriesId
    ? state.blocks.filter((x) => x.seriesId === b.seriesId && x.state === 'planned' && x.end > state.now)
    : [b];
  targets.forEach((x) => { x.start += delta; x.end = x.start + length; });
  return targets.map((x) => x.id);
};

// Preview the fit check under a draft relaxation, without changing state.
export const previewFit = (state: State, taskId: string, override: OverrideDraft, need: number) => {
  const s = structuredClone(state);
  addOverride(s, override);
  const t = task(s, taskId);
  if (!t) return { fits: false, shortfallMin: need };
  const r = plan(s, t, need, {});
  return { fits: r.ok, shortfallMin: r.unplaced };
};

/* ---------- feedback after a session ---------- */

export type PromptKind = 'assignment' | 'done' | 'none';

// Who gets a prompt. Anchored events and classes never move, so their outcome changes
// nothing: no prompt. Sessions (floating, or anchored time set aside for an assignment)
// do get one. A task that is not an assignment asks "Done?" only after its last planned
// session; earlier sessions are assumed done.
export const promptKind = (state: State, b: Block): PromptKind => {
  if (b.state !== 'planned' || b.kind !== 'session') return 'none';
  const t = task(state, b.taskId);
  if (!t) return 'none';
  if (t.type === 'assignment') return 'assignment';
  const laterOne = state.blocks.some((x) => x !== b && x.taskId === t.id && x.kind === 'session' && x.state === 'planned' && x.start >= b.end);
  return laterOne ? 'none' : 'done';
};

// Queue a feedback prompt for each eligible block that ended in (oldNow, newNow].
export const queuePrompts = (state: State, oldNow: number, newNow: number) => {
  const added: string[] = [];
  const due = state.blocks.filter((b) => b.end > oldNow && b.end <= newNow).sort((a, b) => a.end - b.end);
  for (const b of due) {
    if (promptKind(state, b) === 'none' || state.pending.some((p) => p.blockId === b.id)) continue;
    state.pending.push({ blockId: b.id, endedAt: b.end });
    added.push(b.id);
  }
  return added;
};

// Missed session: grey it out and keep it as a record. The caller reconciles the task.
export const skipBlock = (state: State, blockId: string) => {
  const b = block(state, blockId);
  if (b) b.state = 'skipped';
  state.pending = state.pending.filter((p) => p.blockId !== blockId);
  return b;
};

export type NotDoneHow = 'extend' | 'continue' | 'later';

/* Errands and chores that are not done yet. The student says how many more minutes the
   task needs and picks: 'extend' (this timeslot grows by that much), 'continue' (a new
   anchored block starting now), or 'later' (the fit check places it). The session is not
   greyed out: for these tasks it does not matter whether the time was productive.
   Returns the id of the extended or new block (null for 'later'); the caller runs the
   overlap check for it, then reconciles the task. */
export const notDoneYet = (state: State, blockId: string, minutes: number, how: NotDoneHow) => {
  const b = block(state, blockId);
  const t = task(state, b && b.taskId);
  state.pending = state.pending.filter((p) => p.blockId !== blockId);
  if (!b || !t) return null;
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
    const nb: Block = { id: U.uid('s'), kind: 'session', taskId: t.id, title: t.title, start, end: start + minutes * U.MIN, state: 'planned', anchored: true };
    state.blocks.push(nb);
    return nb.id;
  }
  return null;
};

export const markDone = (state: State, blockId: string, minutes: number) => {
  const b = block(state, blockId);
  if (b) { b.state = 'done'; b.actualMin = minutes; }
  state.pending = state.pending.filter((p) => p.blockId !== blockId);
  return b;
};

export interface Progress {
  minutes?: number;
  newlyDone?: string[];
  pct?: number | null;
  credit?: number | null;
  addMilestones?: Milestone[] | null;
  replaceUndone?: Milestone[] | null;
}
export type Pace = 'ahead' | 'on-track' | 'behind';

/* PLACEHOLDER MATH, FOR THE TEAM TO REFINE: the pace blend, the 0.5 to 2 clamp, and the
   10% / 10 minute tolerance below are first guesses, not validated choices.

   Re-estimate the remaining time from reported progress, then compare it with what
   is already planned. Call after marking the session done. */
export const applyProgress = (state: State, t: Task, p: Progress): { kind: Pace; diffMin: number; remainingMin: number } => {
  t.loggedMin = (t.loggedMin || 0) + (p.minutes || 0);
  if (p.replaceUndone) t.milestones = t.milestones.filter((m) => m.done).concat(p.replaceUndone);
  if (p.addMilestones) t.milestones = t.milestones.concat(p.addMilestones);
  const done = new Set(p.newlyDone || []);
  const newly = t.milestones.filter((m) => done.has(m.id));
  newly.forEach((m) => { m.done = true; });

  let est: number;
  if (!t.milestones.length && p.pct != null) {
    // Without milestones, progress comes from the slider.
    t.progressPct = p.pct;
    est = t.totalMin * (1 - p.pct / 100);
  } else if (t.milestones.length) {
    // With milestones, only checked milestones count: none checked means no progress.
    // Pace: how long this student really took versus the estimate for what they finished.
    const predicted = sum(newly, (m) => m.estMin);
    if (predicted > 0 && p.minutes && p.minutes > 0) {
      const ratio = U.clamp(p.minutes / predicted, 0.5, 2);
      t.pace = Math.round((0.5 * (t.pace || 1) + 0.5 * ratio) * 100) / 100;
    }
    est = sum(t.milestones.filter((m) => !m.done), (m) => m.estMin) * (t.pace || 1);
  } else {
    // No progress reported at all: nothing is assumed done, so the estimate stands.
    est = t.needMin;
  }
  est = est <= 0 ? 0 : round5(est);
  logPrediction(state, t, est, { reason: 'progress', loggedMin: t.loggedMin, pace: t.pace || 1, progressPct: t.progressPct || null, openMilestones: t.milestones.filter((m) => !m.done).length });

  const planned = coverage(state, t);
  const diff = est - planned;
  const tol = Math.max(10, 0.1 * planned);
  const kind: Pace = diff > tol ? 'behind' : diff < -tol ? 'ahead' : 'on-track';
  t.needMin = kind === 'on-track' ? planned : est; // within tolerance: leave the plan alone
  return { kind, diffMin: diff, remainingMin: est };
};

// Finished: drop future sessions. A finished assignment's predicted-vs-actual total
// becomes a training example; partial logs never do (they are lower bounds). Errands
// and chores are not training examples: their time is never measured.
export const completeTask = (state: State, t: Task) => {
  const future = state.blocks.filter((b) => b.taskId === t.id && b.kind === 'session' && b.state === 'planned' && b.start > state.now);
  const goneIds = new Set(future.map((b) => b.id));
  state.blocks = state.blocks.filter((b) => !goneIds.has(b.id));
  state.blocks.filter((b) => b.taskId === t.id && b.state === 'planned').forEach((b) => { b.state = 'done'; });
  state.pending = state.pending.filter((p) => { const b = block(state, p.blockId); return b && b.state === 'planned'; });
  t.status = 'complete';
  t.needMin = 0;
  t.sched = 'none';
  t.completedAt = state.now;
  t.milestones.forEach((m) => { m.done = true; });
  if (t.type === 'assignment') {
    state.completed.push({
      taskId: t.id, title: t.title, course: t.course, type: t.type,
      predictedMin: t.predictedMin, actualMin: t.loggedMin, at: state.now, sample: !!t.sample,
    });
  }
  return future.length;
};

/* ---------- recurrence ----------
   Monthly means the Nth occurrence of each selected weekday ("the 2nd Tuesday",
   "the last Friday"). Returns occurrences from `anchor` (a day) onward:
     mode 'all' -> one per selected day:          { day }
     mode 'any' -> one per period (week/month):   { from, to, days } (first..last selected day)
   PROTOTYPE LIMIT, TO REMOVE: "never" stops at GEN_WEEKS so the prototype stays finite. */
const GEN_WEEKS = 8;
export type Occurrence = { day: number; from?: undefined; to?: undefined; days?: undefined } | { day?: undefined; from: number; to: number; days: number[] };

export const expandRepeat = (rule: RepeatRule | null | undefined, anchorTs: number): Occurrence[] => {
  const anchor = U.startOfDay(anchorTs);
  if (!rule || rule.freq === 'none') return [{ day: anchor }];
  const every = Math.max(1, rule.every || 1);
  const ends = rule.ends || { type: 'never' };
  const days = rule.days || [];
  // Only "never" is capped (PROTOTYPE LIMIT); "after N times" may run past it.
  const last = ends.type === 'on' ? U.endOfDay(ends.date ?? 0) : U.addDays(anchor, ends.type === 'after' ? 3650 : GEN_WEEKS * 7);
  const max = ends.type === 'after' ? Math.max(1, ends.count ?? 1) : Infinity;
  const out: Occurrence[] = [];
  const push = (o: Occurrence) => { if (out.length < max) out.push(o); };
  const fromPeriod = (list: number[]) => {
    const dates = list.filter((d) => d >= anchor && d <= last).sort((a, b) => a - b);
    if (!dates.length) return;
    if (rule.mode === 'any') push({ from: dates[0], to: dates[dates.length - 1], days: days.slice() });
    else dates.forEach((d) => push({ day: d }));
  };
  if (rule.freq === 'daily') {
    for (let d = anchor; d <= last && out.length < max; d = U.addDays(d, every)) push({ day: d });
  } else if (rule.freq === 'weekly') {
    for (let w = U.startOfWeek(anchor); w <= last && out.length < max; w = U.addDays(w, 7 * every)) {
      fromPeriod(days.map((wd) => U.addDays(w, (wd + 6) % 7)));
    }
  } else if (rule.freq === 'monthly') {
    for (let m = 0; out.length < max; m += every) {
      const first = new Date(anchor); first.setDate(1); first.setMonth(first.getMonth() + m);
      const monthStart = first.getTime();
      if (monthStart > last) break;
      // The Nth occurrence of each selected weekday in that month ("2nd Tuesday"), or the last.
      fromPeriod(days.map((wd) => {
        if (rule.nth === -1) {
          const next = new Date(monthStart); next.setMonth(next.getMonth() + 1);
          const lastDay = U.addDays(next.getTime(), -1);
          return U.addDays(lastDay, -((new Date(lastDay).getDay() - wd + 7) % 7));
        }
        const offset = (wd - new Date(monthStart).getDay() + 7) % 7;
        const d = U.addDays(monthStart, offset + 7 * ((rule.nth || 1) - 1));
        return new Date(d).getMonth() === new Date(monthStart).getMonth() ? d : null;
      }).filter((d): d is number => d != null));
    }
  }
  return out;
};

// Assignments repeat by shifting their whole window. Returns shifts in ms from the first.
export const repeatShifts = (rule: RepeatRule | null | undefined, anchor: number) => {
  if (!rule || rule.freq === 'none') return [0];
  const every = Math.max(1, rule.every || 1);
  const ends = rule.ends || { type: 'never' };
  // Only "never" is capped (PROTOTYPE LIMIT); "after N times" may run past it.
  const last = ends.type === 'on' ? U.endOfDay(ends.date ?? 0) : U.addDays(anchor, ends.type === 'after' ? 3650 : GEN_WEEKS * 7);
  const max = ends.type === 'after' ? Math.max(1, ends.count ?? 1) : Infinity;
  const out: number[] = [];
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
