// Run with: node --test prototype/test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/util.js');
require('../js/engine.js');
const { util: U, engine: E } = globalThis.PF;

// Wed Oct 21 2026, 08:00 local.
const NOW = new Date(2026, 9, 21, 8, 0).getTime();
const day = (n) => U.addDays(U.startOfDay(NOW), n);
const end = (n) => U.endOfDay(day(n));

function mkState() {
  return { v: 1, now: NOW, prefs: Object.assign({}, E.DEFAULT_PREFS), overrides: [], tasks: [], blocks: [], pending: [], completed: [] };
}
let n = 0;
function mkTask(s, over) {
  const need = over.needMin || 120;
  const t = Object.assign({
    id: 't' + ++n, type: 'assignment', title: 'Task ' + n, course: 'CS 220', startAfter: NOW, completeBy: end(5),
    canSplit: true, recur: null, needMin: need, totalMin: need, predictedMin: need, loggedMin: 0, pace: 1,
    milestones: [], status: 'active', sched: 'none', shortfallMin: 0,
  }, over);
  s.tasks.push(t);
  return t;
}
const sessionsOf = (s, t) => s.blocks.filter((b) => b.taskId === t.id && b.kind === 'session' && b.state === 'planned').sort((a, b) => a.start - b.start);
const overlap = (a, b) => a.start < b.end && b.start < a.end;

test('fit check splits work into sessions inside work hours, the buffer, and with breaks', () => {
  const s = mkState();
  const t = mkTask(s, { needMin: 210, completeBy: end(2) }); // due Fri 23:59, buffer 1 day -> Thu 23:59
  const r = E.reconcile(s, t);
  assert.equal(r.status, 'scheduled');
  const ss = sessionsOf(s, t);
  assert.equal(E.coverage(s, t), 210);
  assert.ok(ss.length >= 3, 'split into several sessions');
  assert.ok(new Set(ss.map((b) => U.startOfDay(b.start))).size >= 2, 'spread over days');
  for (const b of ss) {
    assert.ok(b.start >= U.atClock(U.startOfDay(b.start), '09:00'), 'after work start');
    assert.ok(b.end <= U.atClock(U.startOfDay(b.start), '20:00'), 'before cut-off');
    assert.ok(b.end <= E.deadlineFor(s, t), 'before the buffered deadline');
    assert.ok(E.len(b) >= 30, 'no tiny sessions');
  }
  for (let i = 1; i < ss.length; i++) {
    if (U.sameDay(ss[i - 1].start, ss[i].start)) assert.ok(ss[i].start - ss[i - 1].end >= 10 * U.MIN, 'break between sessions');
  }
});

test('a task that cannot be split needs one block as long as the whole task', () => {
  const s = mkState();
  const t = mkTask(s, { needMin: 180, canSplit: false, completeBy: end(3) });
  assert.equal(E.reconcile(s, t).status, 'scheduled');
  const ss = sessionsOf(s, t);
  assert.equal(ss.length, 1);
  assert.equal(E.len(ss[0]), 180);

  // Make every day too short for 3 hours and it must not fit, not even partially.
  const s2 = mkState();
  for (let d = 0; d <= 6; d++) s2.blocks.push({ id: 'f' + d, kind: 'anchored', title: 'Busy', start: U.atClock(day(d), '10:00'), end: U.atClock(day(d), '18:00'), state: 'planned' });
  const t2 = mkTask(s2, { needMin: 180, canSplit: false, completeBy: end(6) });
  const r = E.reconcile(s2, t2);
  assert.equal(r.status, 'nofit');
  assert.equal(r.placedMin, 0);
  assert.equal(E.reconcile(s2, t2, { allowPartial: true }).status, 'unscheduled');
});

test('an overlap is reported, and a floating session the student moves is re-placed elsewhere', () => {
  const s = mkState();
  const t = mkTask(s, { needMin: 100, completeBy: end(4) });
  E.reconcile(s, t);
  const first = sessionsOf(s, t)[0];
  s.blocks.push({ id: 'fx', kind: 'anchored', title: 'Meeting', start: first.start - 10 * U.MIN, end: first.end + 10 * U.MIN, state: 'planned', anchored: true });
  assert.deepEqual(E.overlapsOf(s, 'fx').map((b) => b.id), [first.id], 'nothing moves on its own');
  assert.equal(E.unplaceSession(s, first.id), t.id);
  assert.equal(E.reconcile(s, t).status, 'scheduled');
  assert.equal(E.coverage(s, t), 100);
  assert.ok(!sessionsOf(s, t).some((b) => overlap(b, s.blocks.find((x) => x.id === 'fx'))));
});

test('classes are overlapped silently, and anchored blocks are never unplaced', () => {
  const s = mkState();
  s.blocks.push({ id: 'lec', kind: 'anchored', eventType: 'class', title: 'Lecture', start: U.atClock(day(1), '10:00'), end: U.atClock(day(1), '11:00'), state: 'planned', anchored: true });
  s.blocks.push({ id: 'ev', kind: 'anchored', title: 'Club', start: U.atClock(day(1), '10:30'), end: U.atClock(day(1), '11:30'), state: 'planned', anchored: true });
  s.blocks.push({ id: 'ev2', kind: 'anchored', title: 'Call', start: U.atClock(day(1), '11:00'), end: U.atClock(day(1), '12:00'), state: 'planned', anchored: true });
  assert.deepEqual(E.overlapsOf(s, 'ev').map((b) => b.id), ['ev2'], 'the class is ignored');
  assert.deepEqual(E.overlapsOf(s, 'lec'), []);
  assert.equal(E.unplaceSession(s, 'ev2'), null);
});

test('editing a repeating anchored event: this one, or all that have not happened yet', () => {
  const s = mkState();
  for (let w = -1; w < 3; w++) s.blocks.push({ id: 'g' + w, kind: 'anchored', title: 'Gym', seriesId: 'gym', start: U.atClock(day(7 * w + 1), '17:00'), end: U.atClock(day(7 * w + 1), '18:00'), state: 'planned', anchored: true });
  E.editBlockTime(s, 'g0', U.atClock(day(1), '18:00'), U.atClock(day(1), '19:30'), 'this');
  assert.equal(U.clockOf(E.block(s, 'g0').start), '18:00');
  assert.equal(U.clockOf(E.block(s, 'g1').start), '17:00', 'others untouched');
  E.editBlockTime(s, 'g1', U.atClock(day(8), '16:00'), U.atClock(day(8), '17:00'), 'all');
  assert.equal(U.clockOf(E.block(s, 'g2').start), '16:00');
  assert.equal(U.clockOf(E.block(s, 'g-1').start), '17:00', 'past occurrences stay as they were');
});

test('anchored sessions behave like anchored blocks and are never moved', () => {
  const s = mkState();
  const a = mkTask(s, { needMin: 50, completeBy: end(4) });
  E.reconcile(s, a);
  const moved = sessionsOf(s, a)[0];
  moved.anchored = true;
  const b = mkTask(s, { needMin: 50, completeBy: end(0), type: 'other' });
  E.reconcile(s, b);
  for (const x of sessionsOf(s, b)) assert.ok(!overlap(x, moved));
});

test('time set aside by hand counts toward a task, but not after its due date', () => {
  const s = mkState();
  const t = mkTask(s, { needMin: 300, completeBy: end(3) });
  const anchor = (d) => s.blocks.push({ id: 'l' + d, kind: 'session', taskId: t.id, title: t.title, start: U.atClock(day(d), '14:00'), end: U.atClock(day(d), '16:00'), state: 'planned', anchored: true });
  anchor(1);
  anchor(10); // a repeat that falls after the deadline
  assert.equal(E.coverage(s, t), 120, 'only the occurrence before the due date counts');
  assert.equal(E.reconcile(s, t).status, 'scheduled');
  assert.equal(E.coverage(s, t), 300, 'the planner adds just the 180 minutes still missing');
  assert.ok(s.blocks.some((b) => b.id === 'l1' && b.anchored), 'the anchored block is untouched');
});

test('does not fit, then fits after relaxing preferences', () => {
  const s = mkState();
  const t = mkTask(s, { needMin: 600, completeBy: end(0) }); // 10h due today, buffer pushes the deadline into the past
  const r = E.reconcile(s, t);
  assert.equal(r.status, 'nofit');
  assert.equal(s.blocks.length, 0, 'a failed fit changes nothing');
  const relax = { scope: 'task', taskId: t.id, workEnd: '24:00', bufferDays: 0 };
  assert.equal(E.previewFit(s, t.id, relax, r.needMin).fits, true);
  assert.equal(s.overrides.length, 0, 'preview does not change state');
  E.addOverride(s, relax);
  assert.equal(E.reconcile(s, t).status, 'scheduled');
  assert.equal(E.coverage(s, t), 600);
});

test('relaxations expire: "this week" stops applying after Sunday', () => {
  const s = mkState();
  E.addOverride(s, { scope: 'week', workEnd: '23:00' });
  const t = mkTask(s, {});
  assert.equal(E.prefsFor(s, t, day(1)).workEnd, '23:00');
  assert.equal(E.prefsFor(s, t, day(10)).workEnd, '20:00');
  E.addOverride(s, { scope: 'always', workEnd: '22:00' });
  assert.equal(s.prefs.workEnd, '22:00');
});

test('partial scheduling keeps what fits and reports the shortfall', () => {
  const s = mkState();
  for (let d = 0; d <= 4; d++) s.blocks.push({ id: 'f' + d, kind: 'anchored', title: 'Busy', start: U.atClock(day(d), '09:00'), end: U.atClock(day(d), '20:00'), state: 'planned' });
  s.blocks = s.blocks.filter((b) => b.id !== 'f1'); // leave one free day
  const t = mkTask(s, { needMin: 900, completeBy: end(4) });
  assert.equal(E.reconcile(s, t).status, 'nofit');
  const r = E.reconcile(s, t, { allowPartial: true });
  assert.equal(r.status, 'partial');
  assert.ok(r.shortfallMin > 0 && r.shortfallMin < 900);
  assert.equal(E.coverage(s, t) + r.shortfallMin, 900);
});

test('a more urgent task moves less urgent floating work later', () => {
  const s = mkState();
  const a = mkTask(s, { needMin: 600, completeBy: end(8), title: 'Low urgency' });
  E.reconcile(s, a);
  const b = mkTask(s, { needMin: 1100, completeBy: end(1), title: 'Urgent', type: 'other' });
  const r = E.reconcile(s, b);
  assert.equal(r.status, 'scheduled');
  assert.deepEqual(r.moved.map((m) => m.taskId), [a.id]);
  assert.equal(E.coverage(s, a), 600, 'moved work is still fully scheduled');
  assert.equal(E.coverage(s, b), 1100);
  const all = s.blocks.filter((x) => x.kind === 'session').sort((x, y) => x.start - y.start);
  for (let i = 1; i < all.length; i++) assert.ok(!overlap(all[i - 1], all[i]), 'no overlapping sessions');
});

test('making room moves as little as possible: only the least urgent task moves', () => {
  const s = mkState();
  s.prefs.breakMin = 0; // keeps the capacity arithmetic simple
  const y = mkTask(s, { needMin: 60, completeBy: end(8), title: 'Medium urgency' });
  E.reconcile(s, y);
  const x = mkTask(s, { needMin: 600, completeBy: end(20), title: 'Least urgent' });
  E.reconcile(s, x);
  const yBefore = sessionsOf(s, y).map((b) => b.id + b.start);
  const z = mkTask(s, { needMin: 1200, completeBy: end(1), type: 'other', title: 'Urgent' });
  const r = E.reconcile(s, z);
  assert.equal(r.status, 'scheduled');
  assert.deepEqual(r.moved.map((m) => m.taskId), [x.id], 'only the least urgent task was moved');
  assert.deepEqual(sessionsOf(s, y).map((b) => b.id + b.start), yBefore, 'the other task was left where it was');
  assert.equal(E.coverage(s, x), 600);
});

test('a skipped session is greyed out and its work is rescheduled later', () => {
  const s = mkState();
  const t = mkTask(s, { needMin: 150 });
  E.reconcile(s, t);
  const first = sessionsOf(s, t)[0];
  E.skipBlock(s, first.id);
  assert.equal(E.block(s, first.id).state, 'skipped', 'kept as a record');
  assert.equal(E.reconcile(s, t).status, 'scheduled');
  assert.equal(E.coverage(s, t), 150);
});

function withMilestones(s, over) {
  const ms = [60, 60, 60].map((m, i) => ({ id: 'm' + i + n, title: 'Part ' + (i + 1), estMin: m, done: false }));
  const t = mkTask(s, Object.assign({ needMin: 180, milestones: ms }, over));
  E.reconcile(s, t);
  return t;
}

test('finishing early shortens later sessions (ahead of schedule)', () => {
  const s = mkState();
  const t = withMilestones(s, {});
  const first = sessionsOf(s, t)[0];
  E.markDone(s, first.id, 30);
  const r = E.applyProgress(s, t, { minutes: 30, newlyDone: [t.milestones[0].id], credit: E.len(first) });
  assert.equal(r.kind, 'ahead');
  assert.ok(t.pace < 1);
  E.reconcile(s, t);
  assert.equal(E.coverage(s, t), t.needMin);
  assert.ok(t.needMin < 130);
});

test('running long adds time through the fit check (behind schedule)', () => {
  const s = mkState();
  const t = withMilestones(s, {});
  const first = sessionsOf(s, t)[0];
  E.markDone(s, first.id, 120);
  const r = E.applyProgress(s, t, { minutes: 120, newlyDone: [t.milestones[0].id], credit: E.len(first) });
  assert.equal(r.kind, 'behind');
  assert.equal(E.reconcile(s, t).status, 'scheduled');
  assert.equal(E.coverage(s, t), t.needMin);
  assert.ok(t.needMin > 130);
});

test('no milestone finished means no progress, so the session is made up', () => {
  const s = mkState();
  const t = withMilestones(s, {});
  const first = sessionsOf(s, t)[0];
  const before = E.coverage(s, t);
  E.markDone(s, first.id, 50);
  const r = E.applyProgress(s, t, { minutes: 50, newlyDone: [], credit: E.len(first) });
  assert.equal(r.kind, 'behind');
  E.reconcile(s, t);
  assert.equal(E.coverage(s, t), before, 'the session worth of work is planned again');
});

test('without milestones, the slider sets what remains; a non-splittable rest is one block', () => {
  const s = mkState();
  const t = mkTask(s, { needMin: 120, canSplit: false, completeBy: end(5) });
  E.reconcile(s, t);
  const only = sessionsOf(s, t)[0];
  E.markDone(s, only.id, 70);
  const r = E.applyProgress(s, t, { minutes: 70, newlyDone: [], pct: 50, credit: 120 });
  assert.equal(r.kind, 'behind');
  assert.equal(t.needMin, 60);
  assert.equal(E.reconcile(s, t).status, 'scheduled');
  const rest = sessionsOf(s, t);
  assert.equal(rest.length, 1);
  assert.equal(E.len(rest[0]), 60);
});

test('completing an assignment removes future sessions and logs a training example', () => {
  const s = mkState();
  const t = withMilestones(s, {});
  const first = sessionsOf(s, t)[0];
  E.markDone(s, first.id, 90);
  t.loggedMin = 90;
  const removed = E.completeTask(s, t);
  assert.ok(removed >= 1);
  assert.equal(sessionsOf(s, t).length, 0);
  assert.equal(t.status, 'complete');
  assert.deepEqual(s.completed.map((c) => [c.predictedMin, c.actualMin]), [[180, 90]]);
});

test('only finished assignments become training examples', () => {
  const s = mkState();
  const errand = mkTask(s, { type: 'other', needMin: 30 });
  E.completeTask(s, errand);
  assert.equal(s.completed.length, 0, 'errand time is not measured, so it is not a label');
  const asg = mkTask(s, { needMin: 60 });
  asg.loggedMin = 75;
  E.completeTask(s, asg);
  assert.deepEqual(s.completed.map((c) => [c.predictedMin, c.actualMin]), [[60, 75]]);
});

test('re-estimates are logged with their inputs, and a student override sticks', () => {
  const s = mkState();
  const t = withMilestones(s, {});
  const first = sessionsOf(s, t)[0];
  E.markDone(s, first.id, 60);
  E.applyProgress(s, t, { minutes: 60, newlyDone: [t.milestones[0].id], credit: E.len(first) });
  const last = t.predictionLog[t.predictionLog.length - 1];
  assert.equal(last.inputs.reason, 'progress');
  assert.equal(last.inputs.loggedMin, 60);
  E.overrideEstimate(s, t, 200);
  assert.equal(t.needMin, 200);
  assert.equal(t.pace, 1.67, 'pace rescaled so the open milestones add up to the override');
  assert.equal(E.reconcile(s, t).status, 'scheduled');
  assert.equal(E.coverage(s, t), 200);
});

test('errand or chore not done yet: extend the timeslot, continue now, or finish later', () => {
  const setup = () => {
    const s = mkState();
    const t = mkTask(s, { type: 'other', needMin: 60, canSplit: false, completeBy: end(5) });
    E.reconcile(s, t);
    const b = sessionsOf(s, t)[0];
    s.now = b.end; // the session just ended
    E.queuePrompts(s, b.start, b.end);
    return { s, t, b };
  };
  // Extend: the same block grows by 20 minutes, is anchored, and will ask "Done?" again.
  let { s, t, b } = setup();
  assert.equal(E.notDoneYet(s, b.id, 20, 'extend'), b.id);
  assert.equal(E.len(E.block(s, b.id)), 80);
  assert.equal(E.block(s, b.id).anchored, true);
  assert.equal(E.block(s, b.id).state, 'planned', 'not greyed out');
  assert.equal(E.reconcile(s, t).status, 'scheduled');
  assert.equal(sessionsOf(s, t).length, 1, 'nothing else added');
  assert.deepEqual(E.queuePrompts(s, s.now, b.end + 20 * U.MIN), [b.id], 'asked again when the extension ends');
  // Continue now: the session counts as done, and a new anchored block starts now.
  ({ s, t, b } = setup());
  const nb = E.notDoneYet(s, b.id, 30, 'continue');
  assert.equal(E.block(s, b.id).state, 'done');
  assert.equal(E.block(s, nb).start, U.roundUp(s.now, 5));
  assert.equal(E.len(E.block(s, nb)), 30);
  E.reconcile(s, t);
  assert.equal(E.coverage(s, t), 30);
  // Finish later: the remaining 30 minutes go through the fit check.
  ({ s, t, b } = setup());
  assert.equal(E.notDoneYet(s, b.id, 30, 'later'), null);
  assert.equal(E.block(s, b.id).state, 'done', 'not greyed out');
  assert.equal(E.reconcile(s, t).status, 'scheduled');
  assert.equal(E.coverage(s, t), 30);
  assert.ok(sessionsOf(s, t).every((x) => x.start >= s.now));
});

test('who gets a feedback prompt', () => {
  const s = mkState();
  const asg = mkTask(s, {});
  const errand = mkTask(s, { type: 'other' });
  const chore = mkTask(s, { type: 'other', seriesId: 'ser1' });
  const mk = (over) => Object.assign({ id: U.uid('b'), kind: 'session', start: NOW, end: NOW + 3600000, state: 'planned' }, over);
  assert.equal(E.promptKind(s, mk({ taskId: asg.id })), 'assignment');
  assert.equal(E.promptKind(s, mk({ taskId: errand.id })), 'done');
  assert.equal(E.promptKind(s, mk({ taskId: chore.id })), 'done');
  // A task that is not an assignment, split over two sessions: only the last one asks.
  const first = mk({ taskId: errand.id });
  const second = mk({ taskId: errand.id, start: NOW + 7200000, end: NOW + 10800000 });
  s.blocks.push(first, second);
  assert.equal(E.promptKind(s, first), 'none', 'an earlier session is assumed done');
  assert.equal(E.promptKind(s, second), 'done', 'the last session asks Done?');
  assert.equal(E.promptKind(s, mk({ taskId: asg.id, anchored: true })), 'assignment', 'anchored time set aside for an assignment');
  assert.equal(E.promptKind(s, mk({ kind: 'anchored' })), 'none', 'one-time anchored event');
  assert.equal(E.promptKind(s, mk({ kind: 'anchored', seriesId: 'g' })), 'none', 'repeating anchored event (gym)');
  assert.equal(E.promptKind(s, mk({ kind: 'anchored', seriesId: 'c', eventType: 'class' })), 'none', 'class');
  assert.equal(E.promptKind(s, mk({ taskId: asg.id, state: 'skipped' })), 'none');
});

test('prompts are queued once, when a session ends', () => {
  const s = mkState();
  const t = mkTask(s, { needMin: 50 });
  E.reconcile(s, t);
  const b = sessionsOf(s, t)[0];
  assert.deepEqual(E.queuePrompts(s, NOW, b.start), [], 'not yet ended');
  assert.deepEqual(E.queuePrompts(s, b.start, b.end + 1), [b.id]);
  assert.deepEqual(E.queuePrompts(s, b.start, b.end + 60000), [], 'never queued twice');
  assert.equal(s.pending.length, 1);
});

const dow = (ts) => new Date(ts).getDay();

test('repeats: weekly on all selected days, every N weeks, ending after N times', () => {
  // NOW is a Wednesday. Mon/Wed/Fri: this week starts at Wednesday (Monday is past).
  const gym = E.expandRepeat({ freq: 'weekly', every: 1, days: [1, 3, 5], mode: 'all', ends: { type: 'after', count: 5 } }, NOW);
  assert.deepEqual(gym.map((o) => dow(o.day)), [3, 5, 1, 3, 5]);
  assert.equal(gym[0].day, day(0));
  const fortnightly = E.expandRepeat({ freq: 'weekly', every: 2, days: [3], mode: 'all', ends: { type: 'after', count: 3 } }, NOW);
  assert.deepEqual(fortnightly.map((o) => (o.day - day(0)) / U.DAY).map(Math.round), [0, 14, 28]);
});

test('repeats: "any one of" gives one window per period over the selected days', () => {
  const laundry = E.expandRepeat({ freq: 'weekly', every: 1, days: [6, 0], mode: 'any', ends: { type: 'after', count: 2 } }, NOW);
  assert.equal(laundry.length, 2);
  assert.equal(dow(laundry[0].from), 6, 'from Saturday');
  assert.equal(dow(laundry[0].to), 0, 'to Sunday');
  assert.deepEqual(laundry[0].days, [6, 0]);
});

test('repeats: monthly on the Nth week, daily every N days, ending on a date', () => {
  const second = E.expandRepeat({ freq: 'monthly', every: 1, days: [2], mode: 'all', nth: 2, ends: { type: 'after', count: 2 } }, NOW);
  second.forEach((o) => { assert.equal(dow(o.day), 2); const d = new Date(o.day).getDate(); assert.ok(d >= 8 && d <= 14, 'the 2nd Tuesday'); });
  const daily = E.expandRepeat({ freq: 'daily', every: 2, ends: { type: 'on', date: day(6) } }, NOW);
  assert.deepEqual(daily.map((o) => Math.round((o.day - day(0)) / U.DAY)), [0, 2, 4, 6]);
  assert.deepEqual(E.expandRepeat({ freq: 'none' }, NOW), [{ day: day(0) }]);
  assert.equal(E.repeatShifts({ freq: 'weekly', every: 1, ends: { type: 'after', count: 3 } }, NOW).length, 3);
});

test('work hours can cross midnight, or cover all 24 hours', () => {
  assert.equal(E.spanMin('10:00', '03:00'), 17 * 60);
  assert.equal(E.spanMin('09:00', '09:00'), 1440);
  assert.equal(E.spanMin('17:00', '24:00'), 7 * 60);
  const s = mkState();
  s.prefs.workStart = '22:00'; s.prefs.workEnd = '04:00'; // a night owl
  const t = mkTask(s, { type: 'other', needMin: 120, canSplit: false, startAfter: day(1), completeBy: end(1) });
  E.reconcile(s, t);
  const b = sessionsOf(s, t)[0];
  assert.ok(b, 'placed');
  const h0 = new Date(b.start).getHours();
  assert.ok(h0 >= 22 || h0 < 4, 'inside 10 PM to 4 AM');
  // Relaxing to a later cut-off past midnight counts as later.
  const s2 = mkState();
  E.addOverride(s2, { scope: 'always', workEnd: '02:00' });
  assert.equal(s2.prefs.workEnd, '02:00', '2 AM the next day is later than 8 PM');
  E.addOverride(s2, { scope: 'always', workEnd: '23:00' });
  assert.equal(s2.prefs.workEnd, '02:00', 'an earlier cut-off does not replace a later one');
});

test('"after N times" is not cut short by the prototype\'s 8-week limit for "never"', () => {
  assert.equal(E.expandRepeat({ freq: 'monthly', every: 1, days: [5], mode: 'all', nth: -1, ends: { type: 'after', count: 6 } }, NOW).length, 6);
  assert.equal(E.repeatShifts({ freq: 'monthly', every: 1, ends: { type: 'after', count: 6 } }, NOW).length, 6);
  assert.ok(E.expandRepeat({ freq: 'weekly', every: 1, days: [3], mode: 'all', ends: { type: 'never' } }, NOW).length <= 9);
});

test('monthly: the last occurrence of a weekday', () => {
  const lastFri = E.expandRepeat({ freq: 'monthly', every: 1, days: [5], mode: 'all', nth: -1, ends: { type: 'after', count: 3 } }, NOW);
  lastFri.forEach((o) => {
    assert.equal(dow(o.day), 5);
    assert.ok(new Date(U.addDays(o.day, 7)).getMonth() !== new Date(o.day).getMonth(), 'no Friday after it in that month');
  });
});

test('work far in the future (a later repeat) is placed, not reported as not fitting', () => {
  const s = mkState();
  const t = mkTask(s, { type: 'other', needMin: 45, startAfter: day(40), completeBy: end(41) });
  assert.equal(E.reconcile(s, t).status, 'scheduled');
  const anytime = mkTask(s, { needMin: 45, startAfter: day(50), completeBy: null });
  assert.equal(E.reconcile(s, anytime).status, 'scheduled');
});

test('a time-of-day window and allowed days constrain placement; earliest time is to the minute', () => {
  const s = mkState();
  const gym = mkTask(s, { type: 'other', needMin: 60, canSplit: false, startAfter: day(0), completeBy: end(0), dayWindow: { from: '17:00', to: '21:00' } });
  E.reconcile(s, gym);
  const g = sessionsOf(s, gym)[0];
  assert.ok(g.start >= U.atClock(day(0), '17:00') && g.end <= U.atClock(day(0), '21:00'), 'inside 5-9 PM, even past the 8 PM work cut-off');
  const laundry = mkTask(s, { type: 'other', needMin: 60, canSplit: false, startAfter: day(0), completeBy: end(6), allowedDays: [6, 0] });
  E.reconcile(s, laundry);
  assert.ok([6, 0].includes(dow(sessionsOf(s, laundry)[0].start)), 'only on Saturday or Sunday');
  const late = mkTask(s, { type: 'other', needMin: 30, startAfter: U.atClock(day(1), '15:37'), completeBy: end(1) });
  E.reconcile(s, late);
  assert.ok(sessionsOf(s, late)[0].start >= U.atClock(day(1), '15:37'));
});
