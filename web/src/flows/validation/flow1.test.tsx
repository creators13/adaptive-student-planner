/* Validation of Flow 1 ("adding a task") in plan/uiux/user-flows.md, driven through the UI.
   Each test names the master-chart nodes it walks, in [brackets]; the node-by-node table is
   plan/uiux/flow-validation.md. */
import { describe, expect, test } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import * as U from '../../domain/util';
import * as E from '../../domain/engine';
import { store } from '../../state/store';
import { at, day, dialog, emptyState, end, flush, inDialog, mkBlock, mkTask, noDialog, renderApp, sessionsOf, toastText } from '../../test/helpers';

type User = ReturnType<typeof renderApp>['user'];
const S = () => store.state;
const overlap = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;
const setValue = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

async function openAddTask(user: User) {
  await user.click(screen.getByRole('button', { name: 'Add task' }));
  return inDialog('Add a task');
}

async function addAnchored(user: User, o: { title: string; day: number; from: string; to: string; cls?: string }) {
  const d = await openAddTask(user);
  await user.type(d.getByLabelText('Task name'), o.title);
  await user.click(d.getByRole('button', { name: /Anchor it/ }));
  if (o.cls) {
    await user.selectOptions(d.getByLabelText('Type'), 'class');
    await user.type(d.getByLabelText('Course'), o.cls);
  }
  setValue(d.getByLabelText('Date'), U.toInputDate(day(o.day)));
  setValue(d.getByLabelText('Starts'), o.from);
  setValue(d.getByLabelText('Ends'), o.to);
  await user.click(d.getByRole('button', { name: 'Add task' }));
  await flush();
}

describe('Flow 1, anchored task: [start → pick: Yes → f1 → f2]', () => {
  test('[f2: No → done] an anchored task that overlaps nothing is scheduled at the time given, to the minute', async () => {
    const { user } = renderApp(emptyState());
    await addAnchored(user, { title: 'Study group', day: 1, from: '14:05', to: '15:20' });
    noDialog();
    const b = S().blocks.find((x) => x.title === 'Study group')!;
    expect([b.start, b.end, b.kind, b.anchored]).toEqual([at(1, '14:05'), at(1, '15:20'), 'anchored', true]);
  });

  test('[f2: Yes → f3: Keep overlap → done] the student keeps the overlap and nothing moves', async () => {
    const s = emptyState();
    mkBlock(s, { title: 'Dinner', start: at(1, '14:00'), end: at(1, '15:00') });
    const { user } = renderApp(s);
    await addAnchored(user, { title: 'Call', day: 1, from: '14:30', to: '15:30' });
    const d = await inDialog('“Call” overlaps “Dinner”');
    await user.click(d.getByRole('button', { name: 'Keep the overlap' }));
    await flush();
    noDialog();
    expect(S().blocks.find((x) => x.title === 'Dinner')!.start).toBe(at(1, '14:00'));
    expect(S().blocks.find((x) => x.title === 'Call')!.start).toBe(at(1, '14:30'));
  });

  test('[f3: Keep] closing the overlap question without choosing also keeps the overlap', async () => {
    const s = emptyState();
    mkBlock(s, { title: 'Dinner', start: at(1, '14:00'), end: at(1, '15:00') });
    const { user } = renderApp(s);
    await addAnchored(user, { title: 'Call', day: 1, from: '14:30', to: '15:30' });
    await dialog('“Call” overlaps “Dinner”');
    await user.keyboard('{Escape}');
    await flush();
    noDialog();
    expect(S().blocks.find((x) => x.title === 'Dinner')!.start).toBe(at(1, '14:00'));
  });

  test('[f3: Move → f4: Yes → f5 → done] an anchored event is given a new time for all its repeats, and the edited event gets the same overlap check', async () => {
    const s = emptyState();
    mkBlock(s, { title: 'Gym', seriesId: 'gym', start: at(1, '17:00'), end: at(1, '18:00') });
    mkBlock(s, { title: 'Gym', seriesId: 'gym', start: at(8, '17:00'), end: at(8, '18:00') });
    mkBlock(s, { title: 'Dinner', start: at(1, '19:00'), end: at(1, '20:00') });
    const { user } = renderApp(s);
    await addAnchored(user, { title: 'Club', day: 1, from: '17:00', to: '18:00' });
    await user.click((await inDialog('“Club” overlaps “Gym”')).getByRole('button', { name: 'Move “Gym”' }));
    const edit = await inDialog('Gym');
    expect(edit.getByText('Move the existing event')).toBeTruthy();
    setValue(edit.getByLabelText('Starts'), '19:00');
    setValue(edit.getByLabelText('Ends'), '20:00');
    await user.selectOptions(edit.getByLabelText('Apply to'), 'all');
    await user.click(edit.getByRole('button', { name: 'Save' }));
    // f5: the edited Gym now overlaps Dinner, so the student is asked again.
    await user.click((await inDialog('“Gym” overlaps “Dinner”')).getByRole('button', { name: 'Keep the overlap' }));
    await flush();
    noDialog();
    const gyms = S().blocks.filter((x) => x.title === 'Gym').map((x) => U.clockOf(x.start));
    expect(gyms).toEqual(['19:00', '19:00']);
  });

  test('[f5] "this event" changes only the one occurrence', async () => {
    const s = emptyState();
    mkBlock(s, { title: 'Gym', seriesId: 'gym', start: at(1, '17:00'), end: at(1, '18:00') });
    mkBlock(s, { title: 'Gym', seriesId: 'gym', start: at(8, '17:00'), end: at(8, '18:00') });
    const { user } = renderApp(s);
    await addAnchored(user, { title: 'Club', day: 1, from: '17:00', to: '18:00' });
    await user.click((await inDialog('“Club” overlaps “Gym”')).getByRole('button', { name: 'Move “Gym”' }));
    const edit = await inDialog('Gym');
    setValue(edit.getByLabelText('Starts'), '06:00');
    setValue(edit.getByLabelText('Ends'), '07:00');
    await user.click(edit.getByRole('button', { name: 'Save' }));
    await flush();
    expect(S().blocks.filter((x) => x.title === 'Gym').map((x) => U.clockOf(x.start))).toEqual(['06:00', '17:00']);
  });

  test('[f3: Move → f4: No → f6 → done] a floating session is taken off and the fit check re-places it', async () => {
    const s = emptyState();
    const t = mkTask(s, { title: 'Essay', needMin: 100, completeBy: end(4) });
    E.reconcile(s, t);
    const first = sessionsOf(s, t.id)[0];
    const { user } = renderApp(s);
    await addAnchored(user, { title: 'Meeting', day: Math.round((U.startOfDay(first.start) - day(0)) / U.DAY), from: U.clockOf(first.start), to: U.clockOf(first.end) });
    await user.click((await inDialog('“Meeting” overlaps “Essay”')).getByRole('button', { name: 'Move “Essay”' }));
    await flush();
    noDialog();
    const meeting = S().blocks.find((x) => x.title === 'Meeting')!;
    expect(S().blocks.some((x) => x.id === first.id)).toBe(false);
    expect(E.coverage(S(), E.task(S(), t.id)!)).toBe(100);
    expect(sessionsOf(S(), t.id).some((x) => overlap(x, meeting))).toBe(false);
    expect(toastText()).toContain('Moved “Essay”.');
  });

  test('[f2: "not a class"] classes are overlapped silently, in either direction', async () => {
    const s = emptyState();
    mkBlock(s, { title: 'Lecture', eventType: 'class', course: 'CS 220', start: at(1, '10:00'), end: at(1, '11:00') });
    mkBlock(s, { title: 'Office hours', start: at(2, '10:00'), end: at(2, '11:00') });
    const { user } = renderApp(s);
    await addAnchored(user, { title: 'Coffee', day: 1, from: '10:30', to: '11:30' });
    noDialog();
    await addAnchored(user, { title: 'Lab section', day: 2, from: '10:30', to: '11:30', cls: 'CS 220' });
    noDialog();
    expect(S().blocks.map((x) => x.title)).toEqual(expect.arrayContaining(['Coffee', 'Lab section']));
  });

  test('[f2] the overlap check also runs when the student moves something onto another event', async () => {
    const s = emptyState();
    const t = mkTask(s, { title: 'Essay', needMin: 50, completeBy: end(4) });
    E.reconcile(s, t);
    mkBlock(s, { title: 'Dinner', start: at(3, '18:00'), end: at(3, '19:00') });
    const { user } = renderApp(s);
    const session = sessionsOf(s, t.id)[0];
    const { details } = await import('../../views/PlanView');
    details(session.id);
    const d = await inDialog('Essay');
    setValue(d.getByLabelText('Move to date'), U.toInputDate(day(3)));
    setValue(d.getByLabelText('Start time'), '18:00');
    await user.click(d.getByRole('button', { name: 'Move' }));
    expect(await dialog('“Essay” overlaps “Dinner”')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Keep the overlap' }));
    await flush();
    expect(E.block(S(), session.id)!.anchored).toBe(true); // moving a floating task anchors it
  });
});

describe('Flow 1, floating task: [start → pick: No → todo → type]', () => {
  test('[a1] a class assignment starts with: start after today, complete by anytime, can split', async () => {
    const { user } = renderApp(emptyState());
    const d = await openAddTask(user);
    expect(d.getByRole('button', { name: /Let it float/ }).getAttribute('aria-pressed')).toBe('true');
    expect(d.getByRole('button', { name: /Class assignment/ }).getAttribute('aria-pressed')).toBe('true');
    expect((d.getByLabelText('Start after') as HTMLInputElement).value).toBe(U.toInputDate(day(0)));
    expect((d.getByLabelText('Complete by') as HTMLInputElement).value).toBe('');
    expect((d.getByLabelText(/Can be split into sessions/) as HTMLInputElement).checked).toBe(true);
  });

  test('[a1 → a2: Yes → a3 → a4 → a5 → fit] instructions give an estimate; milestones are optional, refined with the assistant, marked done, and the estimate can be overridden', async () => {
    const { user } = renderApp(emptyState());
    const d = await openAddTask(user);
    await user.type(d.getByLabelText('Task name'), 'Memory essay');
    await user.type(d.getByLabelText('Course'), 'PSYC 001');
    setValue(d.getByLabelText('Complete by'), U.toInputDate(day(5)));
    await user.type(d.getByLabelText('Assignment instructions'), 'Write an essay about memory.');
    // a3: the (placeholder) LLM estimates the time without milestones.
    expect(d.getByText('Inflow prediction')).toBeTruthy();
    expect(d.getByText('From your instructions, without milestones. Placeholder: no real LLM reads them yet.')).toBeTruthy();
    // a3: milestones proposed, then refined in the chat.
    await user.click(d.getByRole('button', { name: 'Generate milestones' }));
    expect(d.getAllByLabelText(/^Milestone \d+ title$/).length).toBe(4);
    await user.click(d.getByRole('button', { name: 'Break it into smaller steps' }));
    expect(d.getAllByLabelText(/^Milestone \d+ title$/).length).toBe(8);
    // a4: the student marks a milestone as already done; a5: the remaining time follows.
    await user.click(d.getAllByLabelText(/^Already done:/)[0]);
    expect(d.getByText(/7 open milestones/)).toBeTruthy();
    await user.type(d.getByLabelText('Override the estimate (minutes, optional)'), '200');
    await user.click(d.getByRole('button', { name: 'Add task' }));
    await flush();
    const t = S().tasks.find((x) => x.title === 'Memory essay')!;
    expect(t.needMin).toBe(200);
    expect(t.milestones.filter((m) => m.done).length).toBe(1);
    expect(t.prediction!.source).toBe('milestones');
    expect(E.coverage(S(), t)).toBe(200); // went through the fit check
  });

  test('[a2: Yes → a3 → a5] without milestones, the instructions estimate is used and can be overridden', async () => {
    const { user } = renderApp(emptyState());
    const d = await openAddTask(user);
    await user.type(d.getByLabelText('Task name'), 'Lab report');
    await user.type(d.getByLabelText('Course'), 'BIO 201');
    await user.type(d.getByLabelText('Assignment instructions'), 'Lab report on enzymes.');
    await user.click(d.getByRole('button', { name: 'Add task' }));
    await flush();
    const t = S().tasks.find((x) => x.title === 'Lab report')!;
    expect(t.prediction!.source).toBe('llm-placeholder');
    expect(t.needMin).toBe(200); // the placeholder's lab-report template
    expect(t.milestones).toEqual([]);
  });

  test('[a2: No → a6 → fit] without instructions the student gives the duration; milestones are optional', async () => {
    const { user } = renderApp(emptyState());
    const d = await openAddTask(user);
    await user.type(d.getByLabelText('Task name'), 'Reading');
    await user.type(d.getByLabelText('Course'), 'ENGL 100');
    expect(d.getByText('Without instructions or milestones, enter how long you expect this to take.')).toBeTruthy();
    await user.type(d.getByLabelText('Hours'), '1');
    await user.type(d.getByLabelText('Minutes'), '30');
    await user.click(d.getByRole('button', { name: 'Add task' }));
    await flush();
    const t = S().tasks.find((x) => x.title === 'Reading')!;
    expect([t.needMin, t.prediction!.source, t.sched]).toEqual([90, 'student', 'scheduled']);
  });

  test('[a6] milestones written by hand replace the duration', async () => {
    const { user } = renderApp(emptyState());
    const d = await openAddTask(user);
    await user.type(d.getByLabelText('Task name'), 'Problem set');
    await user.type(d.getByLabelText('Course'), 'MATH 241');
    await user.click(d.getByRole('button', { name: 'Add milestones myself' }));
    await user.type(d.getByLabelText('New milestone title'), 'Problems 1-3{Enter}');
    await user.type(d.getByLabelText('New milestone title'), 'Problems 4-6{Enter}');
    await user.click(d.getByRole('button', { name: 'Add task' }));
    await flush();
    const t = S().tasks.find((x) => x.title === 'Problem set')!;
    expect([t.needMin, t.milestones.length]).toEqual([60, 2]);
  });

  test('[type: No → o1 → fit] a task that is not an assignment: earliest and latest time to the minute, duration, cannot split by default', async () => {
    const { user } = renderApp(emptyState());
    const d = await openAddTask(user);
    await user.type(d.getByLabelText('Task name'), 'Pick up package');
    await user.click(d.getByRole('button', { name: /Not an assignment/ }));
    expect((d.getByLabelText(/Can be split into sessions/) as HTMLInputElement).checked).toBe(false);
    setValue(d.getByLabelText('Earliest'), U.toInputDate(day(1)));
    setValue(d.getAllByLabelText('Time (optional)')[0], '13:07');
    setValue(d.getByLabelText('Latest'), U.toInputDate(day(1)));
    setValue(d.getAllByLabelText('Time (optional)')[1], '16:00');
    await user.type(d.getByLabelText('How long (minutes)'), '45');
    await user.click(d.getByRole('button', { name: 'Add task' }));
    await flush();
    const t = S().tasks.find((x) => x.title === 'Pick up package')!;
    expect([t.type, t.canSplit, t.startAfter, t.completeBy]).toEqual(['other', false, at(1, '13:07'), at(1, '16:00')]);
    const ss = sessionsOf(S(), t.id);
    expect(ss.length).toBe(1);
    expect(ss[0].start >= at(1, '13:07') && ss[0].end <= at(1, '16:00')).toBe(true);
  });
});

describe('Flow 1, the fit check: [fit] and what happens when it fails', () => {
  test('[fit: Yes → done] work is split into sessions in free time, within preferences, without moving anything already placed', async () => {
    const s = emptyState();
    const other = mkTask(s, { title: 'Placed first', needMin: 100, completeBy: end(6) });
    E.reconcile(s, other);
    const before = sessionsOf(s, other.id).map((b) => b.start);
    mkBlock(s, { title: 'Lecture', eventType: 'class', start: at(0, '09:00'), end: at(0, '10:15') });
    const { user } = renderApp(s);
    const d = await openAddTask(user);
    await user.type(d.getByLabelText('Task name'), 'Long essay');
    await user.type(d.getByLabelText('Course'), 'HIST 1');
    setValue(d.getByLabelText('Complete by'), U.toInputDate(day(3)));
    await user.type(d.getByLabelText('Hours'), '4');
    await user.click(d.getByRole('button', { name: 'Add task' }));
    await flush();
    const t = S().tasks.find((x) => x.title === 'Long essay')!;
    const ss = sessionsOf(S(), t.id);
    expect(t.sched).toBe('scheduled');
    expect(ss.length).toBeGreaterThan(1); // split into sessions
    for (const b of ss) {
      expect(b.start).toBeGreaterThanOrEqual(U.atClock(U.startOfDay(b.start), '09:00'));
      expect(b.end).toBeLessThanOrEqual(U.atClock(U.startOfDay(b.start), '20:00'));
      expect(b.end).toBeLessThanOrEqual(E.deadlineFor(S(), t)); // the deadline buffer
      for (const x of S().blocks) if (x !== b && x.state === 'planned') expect(overlap(b, x)).toBe(false);
    }
    expect(sessionsOf(S(), other.id).map((b) => b.start)).toEqual(before);
  });

  test('[prefs → fit] the preferences decide where work can go (work hours past midnight)', async () => {
    const s = emptyState();
    s.prefs.workStart = '22:00';
    s.prefs.workEnd = '03:00';
    const { user } = renderApp(s);
    const d = await openAddTask(user);
    await user.type(d.getByLabelText('Task name'), 'Night shift');
    await user.click(d.getByRole('button', { name: /Not an assignment/ }));
    setValue(d.getByLabelText('Earliest'), U.toInputDate(day(1)));
    setValue(d.getByLabelText('Latest'), U.toInputDate(day(2)));
    await user.type(d.getByLabelText('How long (minutes)'), '120');
    await user.click(d.getByRole('button', { name: 'Add task' }));
    await flush();
    const b = sessionsOf(S(), S().tasks[0].id)[0];
    const h = new Date(b.start).getHours();
    expect(h >= 22 || h < 3).toBe(true);
  });

  test('[fit: No → bump: Yes → move → done] less urgent floating work moves later to make room, and the move is reported', async () => {
    const s = emptyState();
    const low = mkTask(s, { title: 'Low urgency', needMin: 600, completeBy: end(8) });
    E.reconcile(s, low);
    const { user } = renderApp(s);
    const d = await openAddTask(user);
    await user.type(d.getByLabelText('Task name'), 'Urgent errand');
    await user.click(d.getByRole('button', { name: /Not an assignment/ }));
    setValue(d.getByLabelText('Latest'), U.toInputDate(day(1)));
    await user.type(d.getByLabelText('How long (minutes)'), '1100');
    await user.click(d.getByLabelText(/Can be split into sessions/));
    await user.click(d.getByRole('button', { name: 'Add task' }));
    await flush();
    noDialog();
    const urgent = S().tasks.find((x) => x.title === 'Urgent errand')!;
    expect(urgent.sched).toBe('scheduled');
    expect(E.coverage(S(), E.task(S(), low.id)!)).toBe(600); // the moved task is re-placed by the same fit check
    expect(toastText()).toContain('Moved later to make room: Low urgency.');
  });

  async function addBigAssignment(user: User, title: string, hours: string, canSplit = true) {
    const d = await openAddTask(user);
    await user.type(d.getByLabelText('Task name'), title);
    await user.type(d.getByLabelText('Course'), 'CS 220');
    setValue(d.getByLabelText('Complete by'), U.toInputDate(day(0)));
    await user.type(d.getByLabelText('Hours'), hours);
    if (!canSplit) await user.click(d.getByLabelText(/Can be split into sessions/));
    await user.click(d.getByRole('button', { name: 'Add task' }));
  }

  test('[bump: No → warn → relax: Yes → fit: Yes → done] the student is offered later work hours or a smaller buffer, for a chosen time, and it then fits', async () => {
    const { user } = renderApp(emptyState());
    await addBigAssignment(user, 'Due today', '10');
    const d = await inDialog('This doesn’t fit your preferences');
    expect(d.getByText(/None of it fits/)).toBeTruthy();
    expect(within(d.getByLabelText('Apply this change for')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Just for this task', 'This week', 'The next two weeks', 'Until I change it in Settings']);
    await user.selectOptions(d.getByLabelText('Work until'), '00:00');
    await user.selectOptions(d.getByLabelText('Finish before the deadline by'), '0');
    expect(d.getByText('With these settings it fits.')).toBeTruthy();
    await user.click(d.getByRole('button', { name: 'Apply and schedule' }));
    await flush();
    noDialog();
    const t = S().tasks[0];
    expect([t.sched, E.coverage(S(), t)]).toEqual(['scheduled', 600]);
    expect(S().overrides.map((o) => [o.scope, o.taskId, o.workEnd, o.bufferDays])).toEqual([['task', t.id, '00:00', 0]]);
  });

  test('[relax: Yes → fit: No → warn again → relax: No → part: Yes → partial] relaxing too little asks again; keeping preferences schedules what fits and reports the shortfall', async () => {
    const { user } = renderApp(emptyState());
    await addBigAssignment(user, 'Huge', '20');
    let d = await inDialog('This doesn’t fit your preferences');
    await user.selectOptions(d.getByLabelText('Work until'), '00:00');
    await user.selectOptions(d.getByLabelText('Finish before the deadline by'), '0');
    expect(d.getByText(/Still .* short with these settings/)).toBeTruthy();
    await user.click(d.getByRole('button', { name: 'Apply and schedule' }));
    d = await inDialog('This doesn’t fit your preferences'); // checked again, still does not fit
    await user.click(d.getByRole('button', { name: /Schedule what fits/ }));
    await flush();
    const t = S().tasks[0];
    expect(t.sched).toBe('partial');
    expect(t.shortfallMin).toBeGreaterThan(0);
    expect(E.coverage(S(), t) + t.shortfallMin).toBe(1200);
    expect(toastText()).toMatch(/“Huge” is partly scheduled\. .* still needs a slot\./);
    expect(screen.getByText(/1 task not fully scheduled/)).toBeTruthy();
  });

  test('[relax: No → part: No → none] a task that cannot be split and does not fit stays on the to-do list, unscheduled and flagged', async () => {
    const s = emptyState();
    for (let i = 0; i <= 6; i++) mkBlock(s, { title: 'Busy', start: at(i, '10:00'), end: at(i, '18:00') });
    const { user } = renderApp(s);
    const d0 = await openAddTask(user);
    await user.type(d0.getByLabelText('Task name'), 'Experiment');
    await user.type(d0.getByLabelText('Course'), 'BIO 201');
    setValue(d0.getByLabelText('Complete by'), U.toInputDate(day(6)));
    await user.type(d0.getByLabelText('Hours'), '3');
    await user.click(d0.getByLabelText(/Can be split into sessions/));
    await user.click(d0.getByRole('button', { name: 'Add task' }));
    const d = await inDialog('This doesn’t fit your preferences');
    await user.click(d.getByRole('button', { name: 'Leave unscheduled' }));
    await flush();
    const t = S().tasks[0];
    expect([t.sched, t.status, sessionsOf(S(), t.id).length]).toEqual(['unscheduled', 'active', 0]);
    expect(screen.getByText(/“Experiment” \(unscheduled\)/)).toBeTruthy(); // flagged on Weekly Plan
    await user.click(screen.getByRole('link', { name: 'Tasks' }));
    await flush();
    expect(await screen.findByText('Unscheduled')).toBeTruthy(); // still on the to-do list
  });

  test('[relax: No] closing the does-not-fit pop-up keeps the preferences', async () => {
    const { user } = renderApp(emptyState());
    await addBigAssignment(user, 'Due today', '10');
    await dialog('This doesn’t fit your preferences');
    await user.keyboard('{Escape}');
    await flush();
    expect(S().overrides).toEqual([]);
    expect(S().tasks[0].sched).toBe('unscheduled');
  });
});
