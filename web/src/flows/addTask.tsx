/* Flow 1, the front half: the Add Task dialog.
   "Anchor it: pick a time" makes an anchored task (an event or a class, like a Google
   Calendar event). "Let it float" makes floating work: a class assignment (instructions,
   milestones, estimate) or a task that is not an assignment (earliest and latest time,
   duration). Submitting an anchored task runs the overlap check; floating work runs the
   fit check (schedule.tsx). */
import { useState, type ChangeEvent } from 'react';
import * as U from '../domain/util';
import * as E from '../domain/engine';
import * as A from '../domain/assistant';
import type { Block, State, Task } from '../domain/types';
import { store, useAppState } from '../state/store';
import { Button, Field } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { DISMISSED, Modal, openDialog } from '../ui/dialog';
import { toast } from '../ui/toast';
import { RepeatEditor } from '../components/RepeatEditor';
import { MilestoneEditor, normalizeMilestones } from '../components/MilestoneEditor';
import { collect, hasInstructions, llmEstimate, newTaskForm, type Collected, type InstrKind, type TaskForm } from './addTaskForm';
import { report, resolveOverlaps, settle } from './schedule';

type Keys<V> = { [K in keyof TaskForm]: TaskForm[K] extends V ? K : never }[keyof TaskForm];

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  const id = 'c-' + label.replace(/\W+/g, '-').toLowerCase();
  return (
    <div className="check">
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}<span className="hint">{hint}</span></label>
    </div>
  );
}

// Live hints while the anchored task's times change: what it will overlap.
function OverlapHints({ s, f }: { s: State; f: TaskForm }) {
  const day = U.fromInputDate(f.fDate);
  if (Number.isNaN(day) || !f.fStart || !f.fEnd) return <div className="overlap-hints" aria-live="polite" />;
  const st = U.atClock(day, f.fStart);
  const en = U.atClock(day, f.fEnd);
  const over = s.blocks.filter((b) => b.state === 'planned' && b.start < en && b.end > st);
  const classes = over.filter((b) => b.eventType === 'class');
  const others = f.evType === 'class' ? [] : over.filter((b) => b.eventType !== 'class');
  return (
    <div className="overlap-hints" aria-live="polite">
      {classes.length || (f.evType === 'class' && over.length) ? (
        <div className="hint-line"><Icon name="calendar" size={14} />{' Overlaps ' + (f.evType === 'class' ? over : classes).map((b) => b.title).join(', ') + '. That is allowed.'}</div>
      ) : null}
      {others.length ? (
        <div className="hint-line is-warn"><Icon name="repeat" size={14} />{' Overlaps ' + [...new Set(others.map((b) => b.title))].join(', ') + '. You will be asked whether to move it or keep both.'}</div>
      ) : null}
    </div>
  );
}

function AddTask({ opts, done }: { opts: { when?: 'anchored' | 'floating'; start?: number }; done: (r: { c: Collected; f: TaskForm } | null) => void }) {
  const s = useAppState();
  const [f, setF] = useState<TaskForm>(() => newTaskForm(s.now, opts));
  const [err, setErr] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const set = (patch: Partial<TaskForm>) => { setF((x) => ({ ...x, ...patch })); setErr(''); };
  const bind = (key: Keys<string>) => ({ value: f[key], onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set({ [key]: e.target.value }) });
  const today = U.startOfDay(s.now);
  const anchorOf = (key: 'fDate' | 'startAfter' | 'winStart') => () => { const d = U.fromInputDate(f[key]); return Number.isNaN(d) ? today : d; };
  const repeat = (kind: 'anchored' | 'assignment' | 'other', key: 'fDate' | 'startAfter' | 'winStart') => (
    <RepeatEditor kind={kind} rule={f.rule} anchorDay={anchorOf(key)} onChange={(rule) => set({ rule })} />
  );
  const courses = [...new Set(s.tasks.map((t) => t.course).concat(s.blocks.map((b) => b.course || '')).filter(Boolean))];

  /* ----- anchored ----- */
  const anchoredSection = () => {
    const assignments = s.tasks.filter((t) => t.status === 'active' && t.type === 'assignment');
    return (
      <div className="stack">
        <div className="grid-2">
          <Field label="Type" hint={f.evType === 'class' ? 'Classes stay put, never ask for feedback, and can be overlapped.' : null}>
            <select id="at-evtype" value={f.evType} onChange={(e) => set({ evType: e.target.value as TaskForm['evType'] })}>
              <option value="event">Event</option>
              <option value="class">Class (lecture, lab, section)</option>
            </select>
          </Field>
          {f.evType === 'class' ? <Field label="Course"><input type="text" list="course-list" placeholder="e.g. CS 220" {...bind('course')} /></Field> : <div />}
        </div>
        <div className="grid-3">
          <Field label="Date"><input type="date" {...bind('fDate')} /></Field>
          <Field label="Starts"><input type="time" step={60} {...bind('fStart')} /></Field>
          <Field label="Ends"><input type="time" step={60} {...bind('fEnd')} /></Field>
        </div>
        <OverlapHints s={s} f={f} />
        {repeat('anchored', 'fDate')}
        {f.evType === 'event' ? (
          <Field label="Counts toward an assignment" hint="Time you set aside by hand for an assignment counts as work on it, so Inflow schedules less.">
            <select value={f.link} onChange={(e) => set({ link: e.target.value })}>
              <option value="">None</option>
              {assignments.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </Field>
        ) : null}
      </div>
    );
  };

  /* ----- floating ----- */
  const typeCard = (key: TaskForm['type'], title: string, sub: string) => (
    <button type="button" className={'choice' + (f.type === key ? ' is-on' : '')} aria-pressed={f.type === key} onClick={() => set({ type: key })}>
      <strong>{title}</strong><span className="muted">{sub}</span>
    </button>
  );

  const instructions = () => {
    const kinds: [InstrKind, string][] = [['text', 'Paste text'], ['image', 'Image'], ['pdf', 'PDF'], ['link', 'Link']];
    let input;
    if (f.instrKind === 'text') input = <textarea rows={4} placeholder="Paste the assignment instructions…" aria-label="Assignment instructions" {...bind('instrText')} />;
    else if (f.instrKind === 'link') input = <input type="url" placeholder="https://…" aria-label="Assignment link" {...bind('instrLink')} />;
    else {
      input = (
        <div className="drop">
          <Icon name="upload" size={18} />
          <input type="file" accept={f.instrKind === 'pdf' ? '.pdf,application/pdf' : 'image/*'} aria-label={'Upload ' + f.instrKind}
            onChange={(e) => set({ instrFile: e.target.files && e.target.files[0] ? e.target.files[0].name : '' })} />
          {f.instrFile ? <span className="ok-text">{f.instrFile + ' attached'}</span> : <span className="muted">Choose a file</span>}
        </div>
      );
    }
    return (
      <div className="stack-sm">
        <div className="label">Assignment instructions (optional)</div>
        <div className="tabs" role="tablist">
          {kinds.map(([k, l]) => <button key={k} type="button" role="tab" className={'tab' + (f.instrKind === k ? ' is-on' : '')} aria-selected={f.instrKind === k} onClick={() => set({ instrKind: k })}>{l}</button>)}
        </div>
        {input}
        {f.instrKind !== 'text' ? <p className="hint">Prototype note: files and links are not read. Milestones come from the title and any pasted text.</p> : null}
        <div className="row">
          <Button kind="primary" small icon="sparkle" disabled={!hasInstructions(f)} onClick={() => {
            set({ milestones: A.generate({ title: f.title, text: f.instrKind === 'text' ? f.instrText : '' }), msOrigin: 'generated' });
            setEditorKey((k) => k + 1);
          }}>{f.msOrigin === 'generated' ? 'Regenerate milestones' : 'Generate milestones'}</Button>
          {!f.milestones ? <Button small onClick={() => { set({ milestones: [], msOrigin: 'manual' }); setEditorKey((k) => k + 1); }}>Add milestones myself</Button> : null}
        </div>
      </div>
    );
  };

  const estimateBox = () => {
    const list = f.milestones || [];
    const hasMs = list.length > 0;
    if (hasMs || hasInstructions(f)) {
      const open = normalizeMilestones(list).filter((m) => !m.done).reduce((n, m) => n + m.estMin, 0);
      return (
        <div className="stack-sm">
          <div className="prediction">
            <div className="eyebrow">Inflow prediction</div>
            <div className="big">{U.fmtDur(hasMs ? open : llmEstimate(f))}</div>
            <div className="muted">{hasMs ? 'Remaining, from your milestones. Placeholder: there is no trained model yet.' : 'From your instructions, without milestones. Placeholder: no real LLM reads them yet.'}</div>
          </div>
          <Field label="Override the estimate (minutes, optional)"><input type="number" min={5} step={5} placeholder="Same as prediction" id="ov-min" {...bind('override')} /></Field>
          {!hasMs ? <p className="hint">Milestones are optional. Generate them to report progress step by step; skip them to report progress with a slider.</p> : null}
        </div>
      );
    }
    return (
      <div className="stack-sm">
        <div className="grid-2">
          <Field label="Hours"><input type="number" min={0} max={99} {...bind('durH')} /></Field>
          <Field label="Minutes"><input type="number" min={0} max={59} step={5} {...bind('durM')} /></Field>
        </div>
        <p className="hint">Without instructions or milestones, enter how long you expect this to take.</p>
      </div>
    );
  };

  const floatingSection = () => (
    <div className="stack">
      <div className="choices">
        {typeCard('assignment', 'Class assignment', 'Instructions, milestones, and an estimate')}
        {typeCard('other', 'Not an assignment', 'Errands, chores, meals, social events, anything else')}
      </div>
      {f.type === 'assignment' ? (
        <>
          <Field label="Course"><input type="text" list="course-list" placeholder="e.g. CS 220" {...bind('course')} /></Field>
          <div className="grid-2">
            <Field label="Start after" hint="Defaults to today."><input type="date" {...bind('startAfter')} /></Field>
            <Field label="Time (optional)" hint="Empty: from the start of the day."><input type="time" step={60} {...bind('startTime')} /></Field>
          </div>
          <div className="grid-2">
            <Field label="Complete by" hint="Empty: anytime."><input type="date" {...bind('due')} /></Field>
            <Field label="Time (optional)" hint="Empty: by the end of the day."><input type="time" step={60} {...bind('dueTime')} /></Field>
          </div>
          {repeat('assignment', 'startAfter')}
          <Check checked={f.canSplit} onChange={(v) => set({ canSplit: v })} label="Can be split into sessions" hint="Turn off for work best done in one go, like a lab experiment." />
          {instructions()}
          {f.milestones ? (
            <div className="stack-sm">
              <div className="label">Milestones</div>
              <MilestoneEditor key={editorKey} list={f.milestones} onChange={(l) => set({ milestones: l })} showDone chatOpen={f.msOrigin === 'generated'} />
              <p className="hint">Check off milestones you have already finished. Each one is a progress step you can update later.</p>
            </div>
          ) : null}
          {estimateBox()}
        </>
      ) : (
        <>
          {f.rule.freq !== 'none' ? (
            <div className="grid-3">
              <Field label="Starting"><input type="date" {...bind('winStart')} /></Field>
              <Field label="Between (optional)" hint="Time of day."><input type="time" step={60} {...bind('winStartTime')} /></Field>
              <Field label="And" hint="Empty: any time."><input type="time" step={60} {...bind('winEndTime')} /></Field>
            </div>
          ) : (
            <div className="stack-sm">
              <div className="grid-2">
                <Field label="Earliest"><input type="date" {...bind('winStart')} /></Field>
                <Field label="Time (optional)" hint="Empty: from the start of the day."><input type="time" step={60} {...bind('winStartTime')} /></Field>
              </div>
              <div className="grid-2">
                <Field label="Latest"><input type="date" {...bind('winEnd')} /></Field>
                <Field label="Time (optional)" hint="Empty: by the end of the day."><input type="time" step={60} {...bind('winEndTime')} /></Field>
              </div>
            </div>
          )}
          <Field label="How long (minutes)"><input type="number" min={5} step={5} placeholder="e.g. 60" {...bind('otherMin')} /></Field>
          {repeat('other', 'winStart')}
          <Check checked={f.otherSplit} onChange={(v) => set({ otherSplit: v })} label="Can be split into sessions" hint="Off by default: most things that are not assignments happen in one block." />
        </>
      )}
    </div>
  );

  const submit = () => {
    const c = collect(f, f.milestones ? normalizeMilestones(f.milestones) : []);
    if ('error' in c) { setErr(c.error); return; }
    done({ c, f });
  };

  return (
    <Modal title="Add a task" subtitle="Pick a time yourself, or let Inflow find one." size="lg" actions={[
      <Button key="cancel" onClick={() => done(null)}>Cancel</Button>,
      <Button key="add" kind="primary" id="at-submit" onClick={submit}>Add task</Button>,
    ]}>
      <div className="stack">
        <Field label="Task name"><input type="text" id="at-title" placeholder={f.when === 'anchored' ? 'e.g. Study group' : 'e.g. Graph Algorithms Problem Set'} {...bind('title')} /></Field>
        <div className="segmented" role="group" aria-label="When">
          <button type="button" className={f.when === 'anchored' ? 'is-on' : ''} aria-pressed={f.when === 'anchored'} onClick={() => set({ when: 'anchored' })}><Icon name="anchor" size={15} /> Anchor it: pick a time</button>
          <button type="button" className={f.when === 'floating' ? 'is-on' : ''} aria-pressed={f.when === 'floating'} onClick={() => set({ when: 'floating' })}><Icon name="waves" size={15} /> Let it float: Inflow finds a time</button>
        </div>
        <p className="hint">{f.when === 'anchored' ? 'Anchored tasks stay at the time you choose. Inflow plans around them.' : 'Floating tasks are placed in your free time before the deadline.'}</p>
        {f.when === 'anchored' ? anchoredSection() : floatingSection()}
        <datalist id="course-list">{courses.map((c) => <option key={c} value={c} />)}</datalist>
        <div className="form-error" role="alert">{err}</div>
      </div>
    </Modal>
  );
}

// opts: { when: 'anchored' | 'floating', start: ts }
export async function addTask(opts: { when?: 'anchored' | 'floating'; start?: number } = {}) {
  const r = await openDialog<{ c: Collected; f: TaskForm } | null>((done) => <AddTask opts={opts} done={done} />);
  if (r === DISMISSED || !r) return;
  const { c, f } = r;
  if (c.kind === 'anchored') {
    const info = store.commit((s) => {
      const link = f.evType === 'event' && f.link ? E.task(s, f.link) : null;
      const occ = E.expandRepeat(c.rule, c.day);
      const seriesId = occ.length > 1 ? U.uid('ser') : undefined;
      const ids = occ.map((o) => {
        const day = o.day ?? o.from;
        const b: Block = {
          id: U.uid('b'), kind: link ? 'session' : 'anchored', taskId: link ? link.id : undefined, title: c.title,
          start: U.atClock(day, f.fStart), end: U.atClock(day, f.fEnd), state: 'planned', anchored: true, seriesId,
          eventType: link ? undefined : f.evType, course: f.evType === 'class' ? f.course.trim() : undefined, rule: c.rule.freq === 'none' ? undefined : c.rule,
        };
        s.blocks.push(b);
        return b.id;
      });
      return { ids, link: link ? link.id : null };
    });
    toast('Added “' + c.title + '”' + (info.ids.length > 1 ? ' (' + info.ids.length + ' times)' : '') + (f.evType === 'class' ? ' as a class.' : ' as an anchored task.'), { tone: 'ok' });
    if (info.link) report(await settle([info.link]));
    await resolveOverlaps(info.ids);
    return;
  }
  const baseTask = (s: State, extra: Partial<Task>): Task => Object.assign({
    id: U.uid('t'), type: c.kind, title: c.title, course: c.kind === 'assignment' ? f.course.trim() : '',
    startAfter: null, completeBy: null,
    canSplit: c.kind === 'assignment' ? f.canSplit : f.otherSplit, rule: c.rule.freq === 'none' ? null : c.rule,
    needMin: c.need, totalMin: (c.kind === 'assignment' && c.total) || c.need, predictedMin: c.need, loggedMin: 0, pace: 1,
    milestones: [], status: 'active', sched: 'none', shortfallMin: 0, createdAt: s.now,
    prediction: { model: 'placeholder-v0', source: c.kind === 'assignment' ? c.source : 'student', minutes: c.need, features: { type: c.kind, course: f.course.trim(), milestones: c.kind === 'assignment' ? c.msList.length : 0, instructions: f.instrKind } },
  } satisfies Task, extra);
  const ids = store.commit((s) => {
    const seriesId = c.rule.freq !== 'none' ? U.uid('ser') : undefined;
    const out: string[] = [];
    if (c.kind === 'assignment') {
      E.repeatShifts(c.rule, c.sa).forEach((shift, k) => {
        const t = baseTask(s, {
          startAfter: c.sa + shift, completeBy: c.cb ? c.cb + shift : null, seriesId,
          needMin: k === 0 ? c.need : c.total, predictedMin: k === 0 ? c.need : c.total,
          milestones: c.msList.map((x) => ({ id: U.uid('m'), title: x.title.trim(), estMin: x.estMin, done: k === 0 ? x.done : false })),
          instructions: { kind: f.instrKind, text: f.instrKind === 'text' ? f.instrText : '', file: f.instrFile, link: f.instrLink },
        });
        s.tasks.push(t); out.push(t.id);
      });
    } else if (c.rule.freq === 'none') {
      const t = baseTask(s, { startAfter: c.sa ?? null, completeBy: c.cb ?? null });
      s.tasks.push(t); out.push(t.id);
    } else {
      // One task per occurrence: a single day ("all") or a span of allowed days ("any").
      const dayWindow = f.winStartTime || f.winEndTime ? { from: f.winStartTime || '00:00', to: f.winEndTime || '24:00' } : null;
      for (const o of E.expandRepeat(c.rule, c.startDay ?? s.now)) {
        const from = o.day != null ? o.day : o.from;
        const to = o.day != null ? o.day : o.to;
        const t = baseTask(s, { startAfter: from, completeBy: U.endOfDay(to), seriesId, dayWindow, allowedDays: o.days || null });
        s.tasks.push(t); out.push(t.id);
      }
    }
    return out;
  });
  report(await settle(ids));
}
