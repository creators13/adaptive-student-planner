/* The data model. Timestamps are milliseconds since the epoch; day boundaries come from
   the local clock. Durations are integer minutes. See DESIGN.md section 6. */

export type Energy = 'morning' | 'afternoon' | 'evening';

export interface Prefs {
  workStart: string; // "HH:MM"
  workEnd: string; // "no work after"; at or before workStart means the next day
  sessionMin: number; // preferred session length
  minSession: number;
  maxSession: number;
  breakMin: number; // gap kept after each session
  energy: Energy;
  bufferDays: number; // finish assignments this many days before the deadline
}

export type OverrideScope = 'task' | 'week' | 'fortnight' | 'always';

// A temporary relaxation of the preferences. Scope "always" edits prefs directly.
export interface Override {
  id: string;
  scope: Exclude<OverrideScope, 'always'>;
  workEnd: string | null;
  bufferDays: number | null;
  taskId: string | null;
  until: number | null;
}

export interface OverrideDraft {
  scope: OverrideScope;
  taskId?: string;
  workEnd?: string;
  bufferDays?: number;
}

export type Freq = 'none' | 'daily' | 'weekly' | 'monthly';

export interface RepeatEnds {
  type: 'never' | 'on' | 'after';
  date?: number | null;
  count?: number;
}

/* freq: how often. days: weekdays 0-6 (Sunday is 0). mode "all" = once on each selected
   day; "any" = once per period on one of them. nth: monthly "the 2nd Tuesday" (1-5, or -1
   for the last one). */
export interface RepeatRule {
  freq: Freq;
  every?: number;
  days?: number[];
  mode?: 'all' | 'any';
  nth?: number;
  ends?: RepeatEnds;
}

export interface Milestone {
  id: string;
  title: string;
  estMin: number;
  done: boolean;
}

export interface PredictionEntry {
  at: number;
  minutes: number;
  model: string;
  inputs: Record<string, unknown>;
}

export type TaskType = 'assignment' | 'other';
export type SchedState = 'scheduled' | 'partial' | 'unscheduled' | 'none';

// Floating work: the to-do list. A repeating task is one task per occurrence sharing a seriesId.
export interface Task {
  id: string;
  type: TaskType;
  title: string;
  course: string;
  startAfter: number | null;
  completeBy: number | null;
  canSplit: boolean;
  rule: RepeatRule | null;
  seriesId?: string;
  dayWindow?: { from: string; to: string } | null;
  allowedDays?: number[] | null;
  needMin: number;
  totalMin: number;
  predictedMin: number;
  loggedMin: number;
  pace: number;
  progressPct?: number;
  milestones: Milestone[];
  status: 'active' | 'complete';
  sched: SchedState;
  shortfallMin: number;
  createdAt?: number;
  completedAt?: number;
  instructions?: { kind: string; text: string; file: string; link: string };
  prediction?: { model: string; source?: string; minutes: number; features: Record<string, unknown> };
  predictionLog?: PredictionEntry[];
  sample?: boolean;
}

export type BlockState = 'planned' | 'done' | 'skipped';

/* Anything on the calendar. A "session" belongs to a task; an "anchored" block is a plain
   calendar event (an event or a class). Sessions the student anchored count as anchored. */
export interface Block {
  id: string;
  kind: 'anchored' | 'session';
  title: string;
  start: number;
  end: number;
  state: BlockState;
  anchored: boolean;
  taskId?: string;
  eventType?: 'event' | 'class';
  course?: string;
  seriesId?: string;
  rule?: RepeatRule;
  actualMin?: number;
  sample?: boolean;
}

export interface Pending {
  blockId: string;
  endedAt: number;
}

// A finished assignment's predicted and actual time: a training example.
export interface CompletedRecord {
  taskId: string;
  title: string;
  course: string;
  type: TaskType;
  predictedMin: number;
  actualMin: number;
  at: number;
  sample: boolean;
}

export interface Notifications {
  upcoming: boolean;
  deadlines: boolean;
  changes: boolean;
  weekly: boolean;
  feedback: boolean;
}

export interface State {
  v: number;
  now: number; // the demo clock
  onboarded?: boolean;
  user?: { name: string; email: string };
  prefs: Prefs;
  overrides: Override[];
  notifications?: Notifications;
  tasks: Task[];
  blocks: Block[];
  pending: Pending[];
  completed: CompletedRecord[];
}
