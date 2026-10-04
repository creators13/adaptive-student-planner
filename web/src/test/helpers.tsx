/* Shared setup for the flow tests: a small, fixed state and the app rendered on top of it. */
import { expect } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as U from '../domain/util';
import * as E from '../domain/engine';
import type { Block, State, Task } from '../domain/types';
import { store } from '../state/store';
import { App } from '../App';

// Wed Oct 21 2026, 08:00 local.
export const NOW = new Date(2026, 9, 21, 8, 0).getTime();
export const day = (n: number) => U.addDays(U.startOfDay(NOW), n);
export const end = (n: number) => U.endOfDay(day(n));
export const at = (n: number, hhmm: string) => U.atClock(day(n), hhmm);

export function emptyState(): State {
  return {
    v: 5, now: NOW, onboarded: true, user: { name: 'Test', email: 'test@example.com' },
    prefs: { ...E.DEFAULT_PREFS }, overrides: [],
    notifications: { upcoming: false, deadlines: false, changes: false, weekly: false, feedback: true },
    tasks: [], blocks: [], pending: [], completed: [],
  };
}

let n = 0;
export function mkTask(s: State, over: Partial<Task>): Task {
  const need = over.needMin || 120;
  const t: Task = {
    id: 't' + ++n, type: 'assignment', title: 'Task ' + n, course: 'CS 220', startAfter: NOW, completeBy: end(5),
    canSplit: true, rule: null, needMin: need, totalMin: need, predictedMin: need, loggedMin: 0, pace: 1,
    milestones: [], status: 'active', sched: 'none', shortfallMin: 0, ...over,
  };
  s.tasks.push(t);
  return t;
}

export function mkBlock(s: State, over: Partial<Block> & { start: number; end: number }): Block {
  const b: Block = { id: 'b' + ++n, kind: 'anchored', title: 'Event ' + n, state: 'planned', anchored: true, eventType: 'event', ...over };
  s.blocks.push(b);
  return b;
}

export const sessionsOf = (s: State, taskId: string) =>
  s.blocks.filter((b) => b.taskId === taskId && b.kind === 'session' && b.state === 'planned').sort((a, b) => a.start - b.start);

// Render the whole app on top of `state`, opened on `route`.
export function renderApp(state: State, route = 'plan') {
  window.location.hash = '#/' + route;
  store.replace(state);
  const user = userEvent.setup();
  render(<App />);
  return { user };
}

export const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name });
export const inDialog = async (name: string | RegExp) => within(await dialog(name));
export const noDialog = () => expect(screen.queryByRole('dialog')).toBeNull();
export const toastText = () => screen.queryAllByRole('status').map((e) => e.textContent).join(' | ');
// Let pending promise chains (flows awaiting dialogs) settle.
export const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
