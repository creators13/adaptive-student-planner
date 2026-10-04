/* Flow 2: feedback after a session ends, and progress logged from the to-do list.
   Collects what really happened (for personal duration estimates) and adjusts the
   schedule: missed work is greyed out and rescheduled, milestone progress re-estimates
   the rest, and anything that no longer fits goes back through flow 1's fit check. */
import { useState } from 'react';
import * as U from '../domain/util';
import * as E from '../domain/engine';
import type { Block, Milestone, Task } from '../domain/types';
import { store } from '../state/store';
import { Button } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { DISMISSED, Modal, openDialog } from '../ui/dialog';
import { toast } from '../ui/toast';
import { MilestoneEditor, normalizeMilestones } from '../components/MilestoneEditor';
import { report, resolveOverlaps, settle } from './schedule';

const S = () => store.state;
const taskOf = (id: string) => E.task(S(), id);
const NO_PRESSURE = 'No pressure. Unfinished work is rescheduled automatically, and your answers help Inflow improve future estimates.';

/* ---------- small shared dialogs ---------- */

interface Choice<T> { label: string; value: T; kind?: 'primary' | 'secondary' }

// Resolves with the chosen value, or null if dismissed.
async function choicePopup<T>(o: { eyebrow?: string; title: string; message: string; dismissible?: boolean; choices: Choice<T>[] }): Promise<T | null> {
  const r = await openDialog<T>((done) => (
    <Modal eyebrow={o.eyebrow} title={o.title} subtitle={o.message} size="sm"
      actions={o.choices.map((c) => <Button key={c.label} kind={c.kind || 'secondary'} onClick={() => done(c.value)}>{c.label}</Button>)} />
  ), { dismissible: o.dismissible !== false });
  return r === DISMISSED ? null : r;
}

function MilestoneDialog({ o, done }: { o: { title: string; subtitle: string; list: Milestone[]; chatOpen: boolean; saveLabel?: string }; done: (l: Milestone[] | null) => void }) {
  const [list, setList] = useState(o.list);
  const [warn, setWarn] = useState('');
  const save = () => {
    const l = normalizeMilestones(list);
    if (!l.length) { setWarn('Add at least one milestone.'); return; }
    if (l.some((x) => !x.title.trim())) { setWarn('Every milestone needs a name.'); return; }
    done(l);
  };
  return (
    <Modal title={o.title} subtitle={o.subtitle} size="lg" actions={[
      <Button key="cancel" onClick={() => done(null)}>Cancel</Button>,
      <Button key="save" kind="primary" onClick={save}>{o.saveLabel || 'Save milestones'}</Button>,
    ]}>
      <div className="stack">
        <MilestoneEditor list={list} onChange={(l) => { setList(l); setWarn(''); }} chatOpen={o.chatOpen} />
        <div className="form-error" role="alert">{warn}</div>
      </div>
    </Modal>
  );
}

// Edit a milestone list (type, or chat with the assistant). Resolves the list, or null if cancelled.
async function milestoneModal(o: { title: string; subtitle: string; list: Milestone[]; chatOpen: boolean; saveLabel?: string }) {
  const r = await openDialog<Milestone[] | null>((done) => <MilestoneDialog o={o} done={done} />);
  return r === DISMISSED ? null : r;
}

const plannedIds = (taskId: string) => new Set(S().blocks.filter((x) => x.taskId === taskId && x.kind === 'session' && x.state === 'planned').map((x) => x.id));
// "Tue, Oct 6 12:45–1:45 PM" for each session placed since `beforeIds` was captured.
const newSessionsText = (taskId: string, beforeIds: Set<string>) =>
  S().blocks
    .filter((x) => x.taskId === taskId && x.kind === 'session' && x.state === 'planned' && !beforeIds.has(x.id))
    .sort((a, c) => a.start - c.start)
    .map((x) => U.fmtDay(x.start) + ' ' + U.fmtRange(x.start, x.end))
    .join(' and ');

/* ---------- assignment feedback: minutes spent, then milestones or the slider ---------- */

type ProgressAnswer = { skip: true } | { dismiss: true } | { none: true } | { minutes: number; doneIds: string[]; pct: number | null };
const NOTE = <div className="note"><Icon name="sparkle" size={16} /><span>{NO_PRESSURE}</span></div>;

function ProgressStep({ task, block, pos, done }: { task: Task; block: Block | null; pos?: { i: number; n: number }; done: (a: ProgressAnswer) => void }) {
  const hadMs = task.milestones.length > 0;
  const open = task.milestones.filter((x) => !x.done);
  // 0 minutes means no work got done: the session is greyed out and the work rescheduled.
  const [minutes, setMinutes] = useState(String(block ? E.len(block) : 30));
  const [picked, setPicked] = useState<string[]>([]);
  const [pct, setPct] = useState(task.progressPct || 0);
  const [err, setErr] = useState('');
  const submit = () => {
    const v = Math.round(Number(minutes));
    if (block && v === 0) { done({ none: true }); return; }
    if (!(v > 0)) { setErr(block ? 'Enter the minutes you spent, or 0.' : 'Enter the minutes you spent.'); return; }
    done({ minutes: v, doneIds: picked, pct: hadMs ? null : pct });
  };
  return (
    <Modal
      eyebrow={block ? 'Focus block complete' + (pos ? ' · ' + pos.i + ' of ' + pos.n : '') : 'Log progress'}
      title={task.title}
      subtitle={block ? U.fmtDay(block.start) + ' · ' + U.fmtRange(block.start, block.end) : 'Progress you made outside a planned session'}
      size="md"
      actions={[
        <Button key="skip" onClick={() => done({ skip: true })}>{block ? 'Skip for now' : 'Cancel'}</Button>,
        <Button key="submit" kind="primary" onClick={submit}>Submit feedback</Button>,
      ]}
    >
      <div className="stack">
        <h3 className="q">How long did it take?</h3>
        <div className="inline">
          <input type="number" min={block ? 0 : 1} step={5} value={minutes} id="fb-min" aria-label="Minutes spent" onChange={(e) => setMinutes(e.target.value)} />
          <span className="muted">{'minutes' + (block ? ' (planned: ' + U.fmtDur(E.len(block)) + ')' : '')}</span>
        </div>
        {block ? <p className="hint">Enter 0 if you did not get to it. The session is kept as a skipped record and the work is rescheduled.</p> : null}
        {hadMs ? (
          <>
            <h3 className="q">Which milestones did you finish?</h3>
            <div className="checks">
              {open.map((ms) => (
                <div key={ms.id} className="check">
                  <input type="checkbox" id={'ms-' + ms.id} checked={picked.includes(ms.id)} onChange={(e) => setPicked(e.target.checked ? picked.concat(ms.id) : picked.filter((x) => x !== ms.id))} />
                  <label htmlFor={'ms-' + ms.id}>{ms.title}<span className="hint">{U.fmtDur(ms.estMin)}</span></label>
                </div>
              ))}
            </div>
            <p className="hint">If none are finished, we will assume no progress and plan the time again.</p>
          </>
        ) : (
          // Without milestones, progress comes from a slider. 100% means finished.
          <>
            <h3 className="q">How much of the assignment is done?</h3>
            <div className="inline">
              <input type="range" min={0} max={100} step={5} value={pct} aria-label="How much of the assignment is done" onChange={(e) => setPct(Number(e.target.value))} />
              <output>{pct + '%'}</output>
            </div>
            <p className="hint">{'100% marks it finished.' + (task.canSplit === false ? ' This task is done in one go, so whatever is left is rescheduled as one block.' : '')}</p>
          </>
        )}
        <div className="form-error" role="alert">{err}</div>
        {block ? NOTE : null}
      </div>
    </Modal>
  );
}

async function skipAndReschedule(block: Block, task: Task) {
  store.commit((s) => E.skipBlock(s, block.id));
  const before = plannedIds(task.id);
  const results = await settle([task.id]);
  const r = results[0];
  if (r && r.res.status === 'scheduled') {
    toast('Session greyed out. Rescheduled to ' + (newSessionsText(task.id, before) || 'a later time') + '.', { tone: 'ok', ms: 9000 });
  } else if (results.length) {
    report(results, { prefix: 'Session greyed out.' });
  }
}

async function processProgress(task: Task, block: Block | null, data: { minutes: number; doneIds: string[]; pct: number | null }) {
  const t = taskOf(task.id)!;
  const hadMs = t.milestones.length > 0;
  const open = t.milestones.filter((x) => !x.done);
  const picked = data.doneIds.length;
  const sliderDone = !hadMs && data.pct != null && data.pct >= 100;
  const noMsProgress = hadMs && picked === 0; // flow 2 rule 4: no milestone checked, no progress
  const allDone = hadMs && open.length > 0 && picked === open.length;
  let finished = false;
  let replaceUndone: Milestone[] | null = null;
  let addMilestones: Milestone[] | null = null;

  if (sliderDone) finished = true;
  else if (hadMs && allDone) {
    // The last milestone was checked: confirm, and if there is more, add milestones.
    for (;;) {
      const ans = await choicePopup({
        eyebrow: 'Last milestone', title: 'Is the whole assignment finished?',
        message: 'You checked off every milestone for “' + t.title + '”.', dismissible: false,
        choices: [{ label: 'Not yet. Add milestones', value: 'no' }, { label: 'Yes, it’s finished', value: 'yes', kind: 'primary' }],
      });
      if (ans === 'yes') { finished = true; break; }
      const list = await milestoneModal({
        title: 'Add milestones for what’s left', subtitle: 'Type them in, or work them out with the assistant.',
        list: [], chatOpen: false, saveLabel: 'Add milestones',
      });
      if (list) { addMilestones = list.map((x) => ({ ...x, id: U.uid('m'), done: false })); break; }
    }
  } else if (noMsProgress) {
    const ans = await choicePopup({
      eyebrow: 'No milestone finished', title: 'Break it into smaller milestones?',
      message: 'We will assume no progress this session, and the time is planned again. Smaller milestones make progress easier to report next time.',
      choices: [{ label: 'Not now', value: 'no' }, { label: 'Type them in', value: 'type' }, { label: 'Chat with the assistant', value: 'chat', kind: 'primary' }],
    });
    if (ans === 'type' || ans === 'chat') {
      const list = await milestoneModal({
        title: 'Break it into smaller milestones', subtitle: 'Edit the open milestones below, or ask the assistant to split them.',
        list: open.map((x) => ({ ...x })), chatOpen: ans === 'chat',
      });
      if (list) replaceUndone = list;
    }
  }

  const out = store.commit((s) => {
    const tk = E.task(s, task.id)!;
    if (block) E.markDone(s, block.id, data.minutes);
    if (finished) {
      tk.loggedMin += data.minutes;
      const removed = E.completeTask(s, tk);
      return { complete: true as const, removed, predicted: tk.predictedMin, actual: tk.loggedMin };
    }
    const r = E.applyProgress(s, tk, { minutes: data.minutes, newlyDone: data.doneIds, pct: data.pct, credit: block ? E.len(block) : null, addMilestones, replaceUndone });
    return { complete: false as const, ...r };
  });

  if (out.complete) {
    toast('“' + t.title + '” is complete. Predicted ' + U.fmtDur(out.predicted) + ', actual ' + U.fmtDur(out.actual) + '.' + (out.removed ? ' ' + U.plural(out.removed, 'later session') + ' removed.' : ''), { tone: 'ok', ms: 9000 });
    return;
  }
  const before = plannedIds(task.id);
  const results = await settle([task.id]);
  const res = results[0] && results[0].res;
  if (out.kind === 'ahead') {
    toast('Ahead of plan. ' + (res && res.trimmedMin ? 'Shortened later sessions by ' + U.fmtDur(res.trimmedMin) + '. ' : '') + 'The freed time stays free.', { tone: 'ok', ms: 9000 });
  } else if (out.kind === 'on-track') {
    toast('On track. Your schedule for “' + t.title + '” stays the same.', { tone: 'ok' });
  } else {
    // More work than is scheduled: either the student ran slower than estimated, or added milestones.
    const lead = addMilestones ? 'The new milestones need about ' + U.fmtDur(out.remainingMin) + '.' : 'Behind plan by about ' + U.fmtDur(Math.abs(out.diffMin)) + '.';
    if (res && res.status === 'scheduled') toast(lead + ' Added ' + (newSessionsText(task.id, before) || 'time') + '.', { tone: 'ok', ms: 9000 });
    else report(results, { prefix: lead });
  }
}

type Outcome = 'dismiss' | void;

async function assignmentFeedback(task: Task, block: Block | null, pos?: { i: number; n: number }): Promise<Outcome> {
  // One step: minutes spent (0 means none), then milestones or the slider.
  const r = await openDialog<ProgressAnswer>((done) => <ProgressStep task={taskOf(task.id)!} block={block} pos={pos} done={done} />);
  const d: ProgressAnswer = r === DISMISSED ? { dismiss: true } : r;
  if ('dismiss' in d) return 'dismiss';
  if ('skip' in d) return;
  if ('none' in d) { if (block) await skipAndReschedule(block, task); return; }
  await processProgress(task, block, d);
}

/* ---------- feedback for a task that is not an assignment ----------
   "Done?" after its last session. If not yet, the student says how much more time it
   needs and picks Extend timeslot, Continue now, or Finish later. The session is never
   greyed out: for these tasks the system does not care whether the time was productive. */

type DoneAnswer = 'yes' | 'skip' | { how: E.NotDoneHow; minutes: number };

function DoneStep({ task, block, pos, done }: { task: Task; block: Block; pos?: { i: number; n: number }; done: (a: DoneAnswer) => void }) {
  const [step, setStep] = useState<'ask' | 'more'>('ask');
  const [minutes, setMinutes] = useState('30');
  const [err, setErr] = useState('');
  const pick = (how: E.NotDoneHow) => () => {
    const v = Math.round(Number(minutes));
    if (!(v > 0)) { setErr('Enter how many more minutes it needs.'); return; }
    done({ how, minutes: v });
  };
  const card = (value: 'yes' | 'no', icon: 'check' | 'x', label: string) => (
    <button type="button" className="choice choice-big" onClick={() => (value === 'yes' ? done('yes') : setStep('more'))}>
      <Icon name={icon} size={22} /><strong>{label}</strong>
    </button>
  );
  return (
    <Modal eyebrow={'Session complete' + (pos ? ' · ' + pos.i + ' of ' + pos.n : '')} title={task.title}
      subtitle={U.fmtDay(block.start) + ' · ' + U.fmtRange(block.start, block.end)} size="md"
      actions={step === 'ask' ? [<Button key="skip" onClick={() => done('skip')}>Skip for now</Button>] : [
        <Button key="back" onClick={() => { setErr(''); setStep('ask'); }}>Back</Button>,
        <Button key="later" id="fb-later" onClick={pick('later')}>Finish later</Button>,
        <Button key="continue" id="fb-continue" onClick={pick('continue')}>Continue now</Button>,
        <Button key="extend" kind="primary" id="fb-extend" onClick={pick('extend')}>Extend timeslot</Button>,
      ]}
    >
      {step === 'ask' ? (
        <div className="stack">
          <h3 className="q">Done?</h3>
          <div className="choices">{card('yes', 'check', 'Yes')}{card('no', 'x', 'Not yet')}</div>
          {NOTE}
        </div>
      ) : (
        <div className="stack">
          <h3 className="q">How much more time does it need?</h3>
          <div className="inline">
            <input type="number" min={5} step={5} value={minutes} id="fb-more" aria-label="Minutes still needed" autoFocus onChange={(e) => setMinutes(e.target.value)} />
            <span className="muted">minutes</span>
          </div>
          <ul className="plain hint">
            <li>{'Extend timeslot: this session runs longer, ending ' + U.fmtTime(block.end) + ' plus the extra time.'}</li>
            <li>Continue now: a new block starts right away.</li>
            <li>Finish later: Inflow finds time for the rest.</li>
          </ul>
          <div className="form-error" role="alert">{err}</div>
        </div>
      )}
    </Modal>
  );
}

async function doneFeedback(task: Task, block: Block, pos?: { i: number; n: number }): Promise<Outcome> {
  const r = await openDialog<DoneAnswer>((done) => <DoneStep task={task} block={block} pos={pos} done={done} />);
  if (r === DISMISSED) return 'dismiss';
  if (r === 'skip') return;
  if (r === 'yes') {
    store.commit((s) => {
      E.markDone(s, block.id, E.len(block));
      const tk = E.task(s, task.id)!;
      tk.loggedMin = E.len(block); // not measured; only assignments become training examples
      E.completeTask(s, tk);
    });
    toast('“' + task.title + '” marked done.', { tone: 'ok' });
    return;
  }
  const before = plannedIds(task.id);
  const id = store.commit((s) => E.notDoneYet(s, block.id, r.minutes, r.how));
  if (id) await resolveOverlaps([id]); // extending or continuing can overlap other events
  const results = await settle([task.id]);
  const res = results[0] && results[0].res;
  const b = id ? E.block(S(), id) : null;
  if (r.how === 'extend' && b) toast('Extended “' + task.title + '” to ' + U.fmtTime(b.end) + '.', { tone: 'ok' });
  else if (r.how === 'continue' && b) toast('“' + task.title + '” continues now, ' + U.fmtRange(b.start, b.end) + '.', { tone: 'ok' });
  else if (res && res.status === 'scheduled') toast('The rest of “' + task.title + '” (' + U.fmtDur(r.minutes) + ') is scheduled for ' + (newSessionsText(task.id, before) || 'later') + '.', { tone: 'ok', ms: 9000 });
  else report(results);
}

/* ---------- entry points ---------- */

export async function feedbackFor(blockId: string, pos?: { i: number; n: number }): Promise<Outcome> {
  const s = S();
  const block = E.block(s, blockId);
  const gone = () => store.commit((st) => { st.pending = st.pending.filter((p) => p.blockId !== blockId); });
  if (!block) { gone(); return; }
  const kind = E.promptKind(s, block);
  const task = block.taskId ? E.task(s, block.taskId) : null;
  if (kind === 'none' || !task || task.status !== 'active') { gone(); return; }
  return kind === 'assignment' ? assignmentFeedback(task, block, pos) : doneFeedback(task, block, pos);
}

// Walk through every waiting prompt, oldest first.
export async function openPending() {
  const ids = S().pending.slice().sort((a, b) => a.endedAt - b.endedAt).map((p) => p.blockId);
  if (!ids.length) { toast('No sessions are waiting for feedback.'); return; }
  let i = 0;
  for (const id of ids) {
    if (!S().pending.some((p) => p.blockId === id)) continue;
    i++;
    // Closing a dialog with X or Esc leaves the whole stack; "Skip for now" only skips that one.
    if ((await feedbackFor(id, { i, n: ids.length })) === 'dismiss') break;
  }
}

// Progress made outside a planned session, from the to-do list.
export async function logProgress(taskId: string) {
  const task = taskOf(taskId);
  if (task && task.status === 'active') await assignmentFeedback(task, null);
}

// "Mark done" for tasks that are not assignments, in the to-do list.
export function markOtherDone(taskId: string) {
  const task = taskOf(taskId);
  if (!task || task.status !== 'active') return;
  store.commit((s) => {
    const tk = E.task(s, taskId)!;
    tk.loggedMin = tk.totalMin;
    E.completeTask(s, tk);
  });
  toast('“' + task.title + '” marked done.', { tone: 'ok' });
}
