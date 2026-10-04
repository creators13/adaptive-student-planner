/* Repeat settings as the forms hold them, their labels, and conversion to engine rules.
   "All of them" = one occurrence on each selected day (gym Mon, Wed, Fri).
   "Any one of them" = one occurrence per week or month on one of the selected days
   (laundry Sat or Sun); offered for floating tasks that are not assignments only.
   Assignments repeat by shifting their whole window, so they get no day picker. */
import * as U from './util';
import type { Freq, RepeatRule } from './types';

export type RepeatKind = 'anchored' | 'other' | 'assignment';

// The form's version of a rule: the end date is still the date input's text.
export interface RuleDraft {
  freq: Freq;
  every: number;
  days: number[];
  mode: 'all' | 'any';
  nth: number;
  ends: { type: 'never' | 'on' | 'after'; date: string; count: number };
}

export const DAYS: [string, number][] = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]];
const NAMES: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
export const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
const ordName = (n: number | undefined) => (n === -1 ? 'last' : ORD[(n || 1) - 1]);
export const UNIT: Record<Exclude<Freq, 'none'>, [string, string]> = { daily: ['day', 'days'], weekly: ['week', 'weeks'], monthly: ['month', 'months'] };

export const newRule = (): RuleDraft => ({ freq: 'none', every: 1, days: [], mode: 'all', nth: 1, ends: { type: 'never', date: '', count: 4 } });

// "Every 2 weeks on Sat or Sun", "Weekly on Mon, Wed, Fri", "Monthly on the 2nd Tue"
export const repeatLabel = (r: RepeatRule | RuleDraft | null | undefined) => {
  if (!r || r.freq === 'none') return '';
  const n = Math.max(1, r.every || 1);
  const many = UNIT[r.freq][1];
  let s = n === 1 ? { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[r.freq] : 'Every ' + n + ' ' + many;
  const days = r.days || [];
  if (r.freq !== 'daily' && days.length) {
    const order = DAYS.map((d) => d[1]).filter((d) => days.includes(d)).map((d) => NAMES[d]);
    const list = r.mode === 'any' ? order.join(' or ') : order.join(', ');
    s += r.freq === 'monthly' ? ' on the ' + ordName(r.nth) + ' ' + list : ' on ' + list; // "the 2nd Tue", "the last Fri"
  }
  return s;
};

// The rule in engine form (end date as a timestamp), or an error message.
export const ruleForEngine = (rule: RuleDraft, kind: RepeatKind): { rule: RepeatRule; error?: undefined } | { error: string; rule?: undefined } => {
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
