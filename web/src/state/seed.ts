/* Sample data for the prototype. Everything seeded here is flagged `sample: true` so it
   can never be mistaken for a real student record (see AGENTS.md on synthetic data). */
import * as U from '../domain/util';
import * as E from '../domain/engine';
import type { Milestone, RepeatRule, State, Task } from '../domain/types';

export const VERSION = 5;

function task(over: Partial<Task> & { needMin: number }): Task {
  const need = over.needMin;
  return Object.assign({
    id: U.uid('t'), type: 'assignment', title: '', course: '', startAfter: null, completeBy: null,
    canSplit: true, rule: null, needMin: need, totalMin: need, predictedMin: need, loggedMin: 0, pace: 1,
    milestones: [], status: 'active', sched: 'none', shortfallMin: 0, sample: true,
    prediction: { model: 'placeholder-v0', minutes: need, features: { type: over.type || 'assignment', course: over.course } },
  } satisfies Task, over);
}
const ms = (list: [string, number][]): Milestone[] => list.map(([title, estMin]) => ({ id: U.uid('m'), title, estMin, done: false }));

export function seed(): State {
  // The demo clock starts at 8 AM on the next weekday (today, if it is one), so the week looks typical.
  let start = U.startOfDay(Date.now());
  while ([0, 6].includes(new Date(start).getDay())) start = U.addDays(start, 1);
  const now = U.atClock(start, '08:00');
  const today = U.startOfDay(now);
  const monday = U.startOfWeek(now);
  const state: State = {
    v: VERSION, now, onboarded: false, user: { name: 'Maya Chen', email: 'maya.chen@upenn.edu' },
    prefs: Object.assign({}, E.DEFAULT_PREFS), overrides: [],
    notifications: { upcoming: true, deadlines: true, changes: true, weekly: false, feedback: true },
    tasks: [], blocks: [], pending: [], completed: [],
  };

  // Class schedule for five weeks: Class events (anchored, never prompt, overlap silently).
  // A course's lecture and lab are separate series.
  const classes = [
    { id: 'cs220', title: 'CS 220 Lecture', days: [0, 2, 4], from: '09:00', to: '10:15', course: 'CS 220' },
    { id: 'math241', title: 'MATH 241 Lecture', days: [1, 3], from: '10:30', to: '11:45', course: 'MATH 241' },
    { id: 'bio201', title: 'BIO 201 Lab', days: [2], from: '13:00', to: '15:00', course: 'BIO 201' },
  ];
  for (let w = 0; w < 5; w++) {
    for (const c of classes) {
      for (const d of c.days) {
        const day = U.addDays(monday, w * 7 + d);
        state.blocks.push({ id: U.uid('b'), kind: 'anchored', title: c.title, course: c.course, start: U.atClock(day, c.from), end: U.atClock(day, c.to), state: 'planned', anchored: true, eventType: 'class', seriesId: 'class-' + c.id, sample: true });
      }
    }
  }
  // A repeating anchored event and a one-off. Anchored events never prompt.
  for (let w = 0; w < 5; w++) {
    for (const d of [0, 2, 4]) {
      const day = U.addDays(monday, w * 7 + d);
      const start = U.atClock(day, '17:30');
      if (start < now) continue;
      state.blocks.push({ id: U.uid('b'), kind: 'anchored', title: 'Gym', start, end: U.atClock(day, '18:30'), state: 'planned', anchored: true, eventType: 'event', seriesId: 'gym', sample: true });
    }
  }
  state.blocks.push({ id: U.uid('b'), kind: 'anchored', title: 'Dentist appointment', start: U.atClock(U.addDays(today, 3), '16:00'), end: U.atClock(U.addDays(today, 3), '17:00'), state: 'planned', anchored: true, eventType: 'event', sample: true });

  // Floating work.
  state.tasks.push(
    task({ title: 'Graph Algorithms Problem Set', course: 'CS 220', startAfter: today, completeBy: U.endOfDay(U.addDays(today, 3)), needMin: 210,
      milestones: ms([['Read the problems and plan', 30], ['Problems 1–2', 60], ['Problems 3–4', 60], ['Check answers and write up', 60]]) }),
    task({ title: 'Cell Respiration Lab Report', course: 'BIO 201', startAfter: today, completeBy: U.endOfDay(U.addDays(today, 5)), needMin: 210,
      milestones: ms([['Analyze the data', 60], ['Make figures and tables', 50], ['Write results and discussion', 60], ['Citations and proofread', 40]]) }),
    task({ title: 'Titration Lab Experiment', course: 'BIO 201', startAfter: today, completeBy: U.endOfDay(U.addDays(today, 4)), needMin: 120, canSplit: false,
      milestones: ms([['Prep and read protocol', 30], ['Run the experiment', 90]]) }),
    task({ title: 'Midterm Review', course: 'MATH 241', startAfter: today, completeBy: U.endOfDay(U.addDays(today, 6)), needMin: 240 }),
    task({ type: 'other', title: 'Pick up package', course: '', startAfter: today, completeBy: U.endOfDay(U.addDays(today, 2)), canSplit: false, needMin: 30 }),
  );
  // Laundry: weekly, on Saturday OR Sunday, between 10 AM and 8 PM, one hour, four weeks.
  const laundryRule: RepeatRule = { freq: 'weekly', every: 1, days: [6, 0], mode: 'any', nth: 1, ends: { type: 'after', count: 4, date: null } };
  for (const o of E.expandRepeat(laundryRule, today)) {
    if (o.from == null) continue;
    state.tasks.push(task({ type: 'other', title: 'Laundry', course: '', startAfter: o.from, completeBy: U.endOfDay(o.to), canSplit: false, needMin: 60,
      seriesId: 'ser-laundry', rule: laundryRule, allowedDays: o.days, dayWindow: { from: '10:00', to: '20:00' } }));
  }

  for (const id of E.byUrgency(state, state.tasks.map((t) => t.id))) E.reconcile(state, E.task(state, id)!, { allowPartial: true });
  return state;
}
