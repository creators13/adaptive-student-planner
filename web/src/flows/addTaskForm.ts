/* The Add task form's data, its checks, and what it turns into. Kept apart from the dialog
   so the checks can be tested without a browser. Times are to the minute; a date alone
   means the whole day (the start of it for "earliest", the end of it for a deadline). */
import * as U from '../domain/util';
import * as E from '../domain/engine';
import * as A from '../domain/assistant';
import type { Milestone, RepeatRule } from '../domain/types';
import { newRule, ruleForEngine, type RuleDraft } from '../domain/repeat';

export type InstrKind = 'text' | 'image' | 'pdf' | 'link';

export interface TaskForm {
  when: 'anchored' | 'floating';
  type: 'assignment' | 'other';
  title: string;
  rule: RuleDraft;
  // anchored
  evType: 'event' | 'class';
  fDate: string;
  fStart: string;
  fEnd: string;
  link: string; // id of the assignment this time counts toward
  // assignment (empty times mean the whole day)
  course: string;
  startAfter: string;
  startTime: string;
  due: string;
  dueTime: string;
  canSplit: boolean;
  instrKind: InstrKind;
  instrText: string;
  instrFile: string;
  instrLink: string;
  durH: string;
  durM: string;
  override: string;
  // milestones: null until the student generates them or adds their own
  milestones: Milestone[] | null;
  msOrigin: '' | 'generated' | 'manual';
  // not an assignment
  winStart: string;
  winStartTime: string;
  winEnd: string;
  winEndTime: string;
  otherMin: string;
  otherSplit: boolean;
}

// opts.start: a time picked on the calendar.
export function newTaskForm(now: number, opts: { when?: 'anchored' | 'floating'; start?: number } = {}): TaskForm {
  const today = U.startOfDay(now);
  const seedStart = opts.start || U.roundUp(now + 60 * U.MIN, 30);
  return {
    when: opts.when || 'floating', type: 'assignment', title: '', rule: newRule(),
    evType: 'event', fDate: U.toInputDate(seedStart), fStart: U.clockOf(seedStart), fEnd: U.clockOf(seedStart + 60 * U.MIN), link: '',
    course: '', startAfter: U.toInputDate(today), startTime: '', due: '', dueTime: '', canSplit: true,
    instrKind: 'text', instrText: '', instrFile: '', instrLink: '', durH: '', durM: '', override: '',
    milestones: null, msOrigin: '',
    winStart: U.toInputDate(today), winStartTime: '', winEnd: '', winEndTime: '', otherMin: '', otherSplit: false,
  };
}

export const hasInstructions = (f: TaskForm) =>
  !!((f.instrKind === 'text' && f.instrText.trim()) || (f.instrKind === 'link' && f.instrLink.trim()) || ((f.instrKind === 'image' || f.instrKind === 'pdf') && f.instrFile));

// PLACEHOLDER: with instructions but no milestones, the "LLM" estimates a total.
export const llmEstimate = (f: TaskForm) => E.round5(A.estimate({ title: f.title, text: f.instrKind === 'text' ? f.instrText : '' }));

export type Collected =
  | { kind: 'anchored'; title: string; day: number; rule: RepeatRule }
  | { kind: 'assignment'; title: string; sa: number; cb: number | null; msList: Milestone[]; need: number; total: number; rule: RepeatRule; source: 'milestones' | 'llm-placeholder' | 'student' }
  | { kind: 'other'; title: string; sa?: number; cb?: number; startDay?: number; need: number; rule: RepeatRule };

// The task the form describes, or the first failing check as one message.
export function collect(f: TaskForm, msList: Milestone[]): Collected | { error: string } {
  const title = f.title.trim();
  if (!title) return { error: 'Give the task a name.' };
  const kind = f.when === 'anchored' ? 'anchored' : f.type;
  const r = ruleForEngine(f.rule, kind);
  if (r.error != null) return { error: r.error };
  const rule = r.rule;
  if (f.when === 'anchored') {
    const day = U.fromInputDate(f.fDate);
    if (Number.isNaN(day)) return { error: 'Choose a date.' };
    if (!f.fStart || !f.fEnd || U.atClock(day, f.fEnd) <= U.atClock(day, f.fStart)) return { error: 'The end time must be after the start time.' };
    if (f.evType === 'class' && !f.course.trim()) return { error: 'Enter the course for this class.' };
    return { kind: 'anchored', title, day, rule };
  }
  if (f.type === 'assignment') {
    if (!f.course.trim()) return { error: 'Enter the course.' };
    const saDay = U.fromInputDate(f.startAfter);
    if (Number.isNaN(saDay)) return { error: 'Choose when you can start.' };
    const sa = f.startTime ? U.atClock(saDay, f.startTime) : saDay;
    let cb: number | null = null; // empty "Complete by" means anytime
    if (f.due) {
      const d = U.fromInputDate(f.due);
      cb = f.dueTime ? U.atClock(d, f.dueTime) : U.endOfDay(d);
      if (cb <= sa) return { error: 'The deadline is before the start.' };
    }
    if (msList.some((m) => !m.title.trim())) return { error: 'Every milestone needs a name.' };
    const open = msList.filter((m) => !m.done).reduce((n, m) => n + m.estMin, 0);
    const all = msList.reduce((n, m) => n + m.estMin, 0);
    const manual = (Number(f.durH) || 0) * 60 + (Number(f.durM) || 0);
    const override = Number(f.override) || 0;
    // Milestones are optional: milestone sum, else the placeholder LLM estimate from the
    // instructions, else the student's own duration. An override beats all of them.
    let need = msList.length ? (override > 0 ? override : open) : hasInstructions(f) ? (override > 0 ? override : llmEstimate(f)) : manual;
    if (msList.length && open === 0 && !override) return { error: 'Every milestone is marked done. Unmark one, or add the work that is left.' };
    if (need <= 0) return { error: msList.length ? 'Enter an estimate.' : 'Enter how long it will take, or add instructions to get milestones.' };
    need = E.round5(need);
    return {
      kind: 'assignment', title, sa, cb, msList, need, rule,
      total: msList.length ? (override > 0 ? override + (all - open) : all) : need,
      source: msList.length ? 'milestones' : hasInstructions(f) ? 'llm-placeholder' : 'student',
    };
  }
  const min = Number(f.otherMin) || 0;
  if (min <= 0) return { error: 'Enter how long it takes, in minutes.' };
  const startDay = U.fromInputDate(f.winStart);
  if (Number.isNaN(startDay)) return { error: f.rule.freq === 'none' ? 'Choose the earliest day.' : 'Choose the day it starts.' };
  if (rule.freq !== 'none') {
    if (f.winStartTime && f.winEndTime && f.winEndTime <= f.winStartTime) return { error: 'The time of day ends before it starts.' };
    if (f.winStartTime && f.winEndTime && (U.atClock(0, f.winEndTime) - U.atClock(0, f.winStartTime)) / U.MIN < min && f.otherSplit === false) return { error: 'The time of day is shorter than the task.' };
    return { kind: 'other', title, startDay, need: min, rule };
  }
  if (!f.winEnd) return { error: 'Choose the latest day.' };
  const sa = f.winStartTime ? U.atClock(startDay, f.winStartTime) : startDay;
  const endDay = U.fromInputDate(f.winEnd);
  const cb = f.winEndTime ? U.atClock(endDay, f.winEndTime) : U.endOfDay(endDay);
  if (cb <= sa) return { error: 'The latest time is before the earliest.' };
  return { kind: 'other', title, sa, cb, need: min, rule };
}
