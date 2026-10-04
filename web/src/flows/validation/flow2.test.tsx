/* Validation of Flow 2 ("after a session") in plan/uiux/user-flows.md, driven through the UI.
   Each test names the master-chart nodes it walks, in [brackets]; the node-by-node table is
   plan/uiux/flow-validation.md. Sessions end by moving the demo clock ("End next session"). */
import { describe, expect, test } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import * as U from '../../domain/util';
import * as E from '../../domain/engine';
import type { State } from '../../domain/types';
import { store } from '../../state/store';
import { at, emptyState, end, flush, inDialog, mkBlock, mkTask, renderApp, sessionsOf, toastText } from '../../test/helpers';

type User = ReturnType<typeof renderApp>['user'];
const S = () => store.state;
const setValue = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

function withMilestones(s: State, title: string, over: Parameters<typeof mkTask>[1] = {}) {
  const ms = [60, 60, 60].map((m, i) => ({ id: title + '-m' + i, title: 'Part ' + (i + 1), estMin: m, done: false }));
  const t = mkTask(s, { title, needMin: 180, milestones: ms, ...over });
  E.reconcile(s, t);
  return t;
}
function errand(s: State, title: string, over: Parameters<typeof mkTask>[1] = {}) {
  const t = mkTask(s, { title, type: 'other', course: '', needMin: 60, canSplit: false, completeBy: end(5), ...over });
  E.reconcile(s, t);
  return t;
}
async function endNextSession(user: User) {
  await user.click(screen.getByRole('button', { name: 'End next session' }));
}
const submit = async (user: User, d: ReturnType<typeof within>) => { await user.click(d.getByRole('button', { name: 'Submit feedback' })); await flush(); };

describe('Flow 2: who is asked [ended → asks]', () => {
  test('[asks: No → quiet] anchored events, classes, and earlier sessions of a task that is not an assignment never prompt', async () => {
    const s = emptyState();
    mkBlock(s, { title: 'Dentist', start: at(0, '09:00'), end: at(0, '10:00') });
    mkBlock(s, { title: 'Lecture', eventType: 'class', seriesId: 'c', start: at(0, '10:00'), end: at(0, '11:00') });
    const t = errand(s, 'Clean garage', { needMin: 100, canSplit: true });
    const [first, second] = sessionsOf(s, t.id);
    renderApp(s);
    const added = store.advance(second.start);
    expect(added).toEqual([]); // nothing asked; the earlier session is assumed done
    expect(S().pending).toEqual([]);
    expect(store.advance(second.end)).toEqual([second.id]); // only the last one asks
    expect(first.state).toBe('planned');
  });

  test('[asks: Yes → ask] an assignment session asks; unanswered requests wait and add up; until answered the session is assumed done', async () => {
    const s = emptyState();
    const t = withMilestones(s, 'Problem set');
    const ss = sessionsOf(s, t.id);
    const { user } = renderApp(s);
    act(() => { store.advance(ss[1].end + U.MIN); }); // two sessions end while the student is away
    expect(S().pending.length).toBe(2);
    expect(screen.getByLabelText('waiting for feedback').textContent).toBe('2');
    expect(E.coverage(S(), E.task(S(), t.id)!)).toBe(180); // assumed done: nothing re-planned
    await user.click(screen.getByRole('button', { name: /Session feedback/ }));
    const d = await inDialog('Problem set');
    expect(d.getByText('Focus block complete · 1 of 2')).toBeTruthy();
    await user.click(d.getByRole('button', { name: 'Skip for now' })); // still waiting, next one shown
    expect((await inDialog('Problem set')).getByText('Focus block complete · 2 of 2')).toBeTruthy();
    await user.keyboard('{Escape}');
    await flush();
    expect(S().pending.length).toBe(2);
  });
});

describe('Flow 2, a task that is not an assignment: [which: No → d1]', () => {
  test('[d1: Yes → marked] Done? Yes marks the task done; its time is not a training example', async () => {
    const s = emptyState();
    const t = errand(s, 'Pick up package');
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Pick up package');
    expect(d.getByText('Done?')).toBeTruthy();
    await user.click(d.getByRole('button', { name: 'Yes' }));
    await flush();
    expect(E.task(S(), t.id)!.status).toBe('complete');
    expect(S().completed).toEqual([]);
  });

  test('[d1: Not yet → d2 → d3: Extend → d4 → d6] the session runs longer, gets the overlap check, and asks Done? again when it ends', async () => {
    const s = emptyState();
    const t = errand(s, 'Laundry');
    const b = sessionsOf(s, t.id)[0];
    const end0 = b.end; // (b is the live block: the app changes it in place)
    mkBlock(s, { title: 'Call', start: b.end + 10 * U.MIN, end: b.end + 40 * U.MIN });
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Laundry');
    await user.click(d.getByRole('button', { name: 'Not yet' }));
    expect(d.getByText('How much more time does it need?')).toBeTruthy();
    setValue(d.getByLabelText('Minutes still needed'), '20');
    await user.click(d.getByRole('button', { name: 'Extend timeslot' }));
    await user.click((await inDialog('“Laundry” overlaps “Call”')).getByRole('button', { name: 'Keep the overlap' }));
    await flush();
    const x = E.block(S(), b.id)!;
    expect([x.end, x.anchored, x.state]).toEqual([end0 + 20 * U.MIN, true, 'planned']);
    expect(store.advance(x.end + U.MIN)).toEqual([b.id]); // asks Done? again
  });

  test('[d3: Continue now → d5 → d6] a new anchored block starts now, with the overlap check', async () => {
    const s = emptyState();
    const t = errand(s, 'Groceries');
    const b = sessionsOf(s, t.id)[0];
    mkBlock(s, { title: 'Run', start: U.roundUp(b.end + U.MIN, 5), end: U.roundUp(b.end + U.MIN, 5) + 30 * U.MIN });
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Groceries');
    await user.click(d.getByRole('button', { name: 'Not yet' }));
    setValue(d.getByLabelText('Minutes still needed'), '30');
    await user.click(d.getByRole('button', { name: 'Continue now' }));
    await user.click((await inDialog('“Groceries” overlaps “Run”')).getByRole('button', { name: 'Keep the overlap' }));
    await flush();
    const nb = S().blocks.find((x) => x.taskId === t.id && x.id !== b.id)!;
    expect([nb.start, E.len(nb), nb.anchored]).toEqual([U.roundUp(S().now, 5), 30, true]);
    expect(E.block(S(), b.id)!.state).toBe('done'); // never marked missed
  });

  test('[d3: Finish later → refit1] the rest goes to the fit check', async () => {
    const s = emptyState();
    const t = errand(s, 'Clean bathroom');
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Clean bathroom');
    await user.click(d.getByRole('button', { name: 'Not yet' }));
    setValue(d.getByLabelText('Minutes still needed'), '30');
    await user.click(d.getByRole('button', { name: 'Finish later' }));
    await flush();
    const later = sessionsOf(S(), t.id).filter((x) => x.start >= S().now);
    expect(later.map(E.len)).toEqual([30]);
    expect(later[0].anchored).toBe(false);
    expect(toastText()).toContain('The rest of “Clean bathroom” (30m) is scheduled for');
  });
});

describe('Flow 2, a class assignment: [which: Yes → s2]', () => {
  test('[s2 → zero: Yes → skip → refit2] 0 minutes marks the session missed, kept as a record, and the work goes to the fit check', async () => {
    const s = emptyState();
    const t = withMilestones(s, 'Lab report');
    const first = sessionsOf(s, t.id)[0];
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Lab report');
    setValue(d.getByLabelText('Minutes spent'), '0');
    await submit(user, d);
    const x = E.block(S(), first.id)!;
    expect([x.state, x.start]).toEqual(['skipped', first.start]); // still in the calendar history
    expect(E.coverage(S(), E.task(S(), t.id)!)).toBe(180); // made up by the fit check
    expect(sessionsOf(S(), t.id).every((b) => b.start > S().now)).toBe(true);
    expect(toastText()).toContain('Session greyed out. Rescheduled to');
  });

  test('[skip] an anchored block that was missed stays where it was; the work it needed is planned as floating time', async () => {
    const s = emptyState();
    const t = mkTask(s, { title: 'Reading', needMin: 60, completeBy: end(5) });
    const set = mkBlock(s, { title: 'Reading', kind: 'session', taskId: t.id, eventType: undefined, start: at(0, '13:00'), end: at(0, '14:00') });
    E.reconcile(s, t);
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Reading');
    setValue(d.getByLabelText('Minutes spent'), '0');
    await submit(user, d);
    expect([E.block(S(), set.id)!.state, E.block(S(), set.id)!.start]).toEqual(['skipped', at(0, '13:00')]);
    const re = sessionsOf(S(), t.id);
    expect([re.length, re[0].anchored, E.coverage(S(), E.task(S(), t.id)!)]).toEqual([1, false, 60]);
  });

  test('[log → s2] progress made outside a planned session is logged from the to-do list with the same questions', async () => {
    const s = emptyState();
    const t = withMilestones(s, 'Problem set');
    const { user } = renderApp(s, 'tasks');
    await user.click(screen.getByRole('button', { name: 'Log progress' }));
    const d = await inDialog('Problem set');
    expect(d.getByText('Log progress')).toBeTruthy();
    expect(d.getByText('How long did it take?')).toBeTruthy();
    expect(d.getByText('Which milestones did you finish?')).toBeTruthy();
    setValue(d.getByLabelText('Minutes spent'), '60');
    await user.click(d.getByLabelText(/Part 1/));
    await submit(user, d);
    expect(E.task(S(), t.id)!.loggedMin).toBe(60);
    expect(E.task(S(), t.id)!.milestones[0].done).toBe(true);
  });

  test('[hasms: No → sl → full: Yes → complete1] 100% done completes the assignment, removes later sessions, and keeps a training example', async () => {
    const s = emptyState();
    const t = mkTask(s, { title: 'Midterm review', needMin: 240, completeBy: end(6) });
    E.reconcile(s, t);
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Midterm review');
    expect(d.getByText('How much of the assignment is done?')).toBeTruthy();
    setValue(d.getByLabelText('Minutes spent'), '45');
    setValue(d.getByLabelText('How much of the assignment is done'), '100');
    await submit(user, d);
    expect(E.task(S(), t.id)!.status).toBe('complete');
    expect(sessionsOf(S(), t.id).filter((b) => b.start > S().now)).toEqual([]);
    expect(S().completed.map((c) => [c.title, c.predictedMin, c.actualMin])).toEqual([['Midterm review', 240, 45]]);
  });

  test('[full: No → reest → pace: Behind → refit3] less done than planned: the extra time goes to the fit check', async () => {
    const s = emptyState();
    const t = mkTask(s, { title: 'Essay', needMin: 120, completeBy: end(5) });
    E.reconcile(s, t);
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Essay');
    setValue(d.getByLabelText('Minutes spent'), '50');
    setValue(d.getByLabelText('How much of the assignment is done'), '30');
    await submit(user, d);
    const tk = E.task(S(), t.id)!;
    expect(tk.needMin).toBe(85); // 70% of 120, rounded to 5
    expect(E.coverage(S(), tk)).toBe(85);
    expect(toastText()).toMatch(/Behind plan by about/);
  });

  test('[hasms: Yes → s3 → prog: No → small → reest → pace: Behind → refit3] no milestone finished: no progress, smaller milestones offered, the session is made up', async () => {
    const s = emptyState();
    const t = withMilestones(s, 'Lab report');
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Lab report');
    setValue(d.getByLabelText('Minutes spent'), '50');
    await submit(user, d);
    const p = await inDialog('Break it into smaller milestones?');
    expect(p.getByRole('button', { name: 'Type them in' })).toBeTruthy();
    expect(p.getByRole('button', { name: 'Chat with the assistant' })).toBeTruthy();
    await user.click(p.getByRole('button', { name: 'Type them in' }));
    const ed = await inDialog('Break it into smaller milestones');
    await user.click(ed.getByRole('button', { name: 'Remove milestone 3' }));
    await user.type(ed.getByLabelText('New milestone title'), 'Part 3a{Enter}');
    await user.click(ed.getByRole('button', { name: 'Save milestones' }));
    await flush();
    const tk = E.task(S(), t.id)!;
    expect(tk.milestones.map((m) => m.title)).toEqual(['Part 1', 'Part 2', 'Part 3a']);
    expect(tk.milestones.every((m) => !m.done)).toBe(true);
    expect(E.coverage(S(), tk)).toBe(tk.needMin);
  });

  test('[small] "Not now" keeps the milestones and still makes up the session', async () => {
    const s = emptyState();
    const t = withMilestones(s, 'Lab report');
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Lab report');
    await submit(user, d);
    await user.click((await inDialog('Break it into smaller milestones?')).getByRole('button', { name: 'Not now' }));
    await flush();
    const tk = E.task(S(), t.id)!;
    expect(tk.needMin).toBe(180);
    expect(E.coverage(S(), tk)).toBe(180);
  });

  test('[prog: Yes → last: No → reest → pace: Ahead → trim] finishing early shortens later sessions; the freed time is not given to other tasks', async () => {
    const s = emptyState();
    const t = withMilestones(s, 'Problem set');
    const other = withMilestones(s, 'Other work', { completeBy: end(6) });
    const otherBefore = sessionsOf(s, other.id).map((b) => [b.start, b.end]);
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Problem set');
    setValue(d.getByLabelText('Minutes spent'), '30');
    await user.click(d.getByLabelText(/Part 1/));
    await submit(user, d);
    const tk = E.task(S(), t.id)!;
    expect(tk.needMin).toBe(90); // pace 0.75 on 120 minutes left
    expect(E.coverage(S(), tk)).toBe(90);
    expect(sessionsOf(S(), other.id).map((b) => [b.start, b.end])).toEqual(otherBefore);
    expect(toastText()).toMatch(/Ahead of plan\. Shortened later sessions by .*The freed time stays free\./);
  });

  test('[pace: On track → updated] progress in line with the plan changes nothing', async () => {
    const s = emptyState();
    const t = withMilestones(s, 'Problem set');
    const { user } = renderApp(s);
    const before = () => sessionsOf(S(), t.id).filter((b) => b.start > S().now).map((b) => [b.start, b.end]);
    await endNextSession(user);
    const planned = before();
    const d = await inDialog('Problem set');
    setValue(d.getByLabelText('Minutes spent'), '60');
    await user.click(d.getByLabelText(/Part 1/));
    await submit(user, d);
    expect(before()).toEqual(planned);
    expect(toastText()).toContain('On track. Your schedule for “Problem set” stays the same.');
  });

  test('[last: Yes → confirm: Yes → complete2] every milestone finished, the student confirms, and the assignment is complete', async () => {
    const s = emptyState();
    const t = withMilestones(s, 'Problem set');
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Problem set');
    setValue(d.getByLabelText('Minutes spent'), '50');
    for (const c of d.getAllByRole('checkbox')) await user.click(c);
    await submit(user, d);
    const c = await inDialog('Is the whole assignment finished?');
    expect(c.queryByRole('button', { name: 'Close' })).toBeNull(); // must be answered
    await user.click(c.getByRole('button', { name: 'Yes, it’s finished' }));
    await flush();
    expect(E.task(S(), t.id)!.status).toBe('complete');
    expect(S().completed.map((x) => [x.predictedMin, x.actualMin])).toEqual([[180, 50]]);
  });

  test('[confirm: No → addms → reest → pace] not finished: the student adds milestones and the plan is re-estimated from them', async () => {
    const s = emptyState();
    const t = withMilestones(s, 'Problem set');
    const { user } = renderApp(s);
    await endNextSession(user);
    const d = await inDialog('Problem set');
    setValue(d.getByLabelText('Minutes spent'), '50');
    for (const c of d.getAllByRole('checkbox')) await user.click(c);
    await submit(user, d);
    await user.click((await inDialog('Is the whole assignment finished?')).getByRole('button', { name: 'Not yet. Add milestones' }));
    const ed = await inDialog('Add milestones for what’s left');
    await user.type(ed.getByLabelText('New milestone title'), 'Write-up{Enter}');
    await user.click(ed.getByRole('button', { name: 'Add milestones' }));
    await flush();
    const tk = E.task(S(), t.id)!;
    expect(tk.status).toBe('active');
    expect(tk.milestones.map((m) => [m.title, m.done])).toEqual([['Part 1', true], ['Part 2', true], ['Part 3', true], ['Write-up', false]]);
    // Re-estimated from pace: all 180 planned minutes were done in 50, so the new 30-minute
    // milestone needs 30 × 0.75 ≈ 25 minutes, less than is still planned: ahead, so trimmed.
    expect(tk.needMin).toBe(25);
    expect(E.coverage(S(), tk)).toBe(25);
    expect(toastText()).toContain('Ahead of plan.');
  });
});

describe('Flow 2 rules around the chart', () => {
  test('a task that is not an assignment can be marked done from the to-do list at any time', async () => {
    const s = emptyState();
    const t = errand(s, 'Return books');
    const { user } = renderApp(s, 'tasks');
    await user.click(screen.getByRole('button', { name: 'Mark done' }));
    await flush();
    expect(E.task(S(), t.id)!.status).toBe('complete');
    expect(sessionsOf(S(), t.id).filter((b) => b.start > S().now)).toEqual([]);
  });

  test('time set aside by hand for an assignment asks for feedback like a floating session', async () => {
    const s = emptyState();
    const t = mkTask(s, { title: 'Reading', needMin: 60, completeBy: end(5) });
    mkBlock(s, { title: 'Reading', kind: 'session', taskId: t.id, eventType: undefined, start: at(1, '13:00'), end: at(1, '14:00') });
    const { user } = renderApp(s);
    await endNextSession(user);
    expect((await inDialog('Reading')).getByText('How long did it take?')).toBeTruthy();
    expect(S().now).toBe(at(1, '14:01'));
  });
});
