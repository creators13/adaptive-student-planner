/* Milestone editor: an editable list (title + minutes, optional "already done" checkbox)
   plus a chat with the placeholder assistant. Used when adding an assignment, when
   breaking a milestone into smaller ones, and when adding milestones to unfinished work. */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import * as U from '../domain/util';
import * as A from '../domain/assistant';
import type { Milestone } from '../domain/types';
import { Button } from '../ui/controls';
import { Icon } from '../ui/Icon';

// Minutes as the planner uses them: whole numbers, at least 5.
export const normalizeMilestones = (list: Milestone[]) => list.map((m) => ({ ...m, estMin: Math.max(5, Math.round(Number(m.estMin) || 0)) }));

interface Props {
  list: Milestone[];
  onChange: (list: Milestone[]) => void;
  showDone?: boolean;
  chatOpen?: boolean;
  hint?: string;
}

const GREETING = 'Hi, I help turn an assignment into milestones. I am a placeholder with no real model behind me, so I only understand a few requests: split into smaller steps, add or remove a milestone, make times shorter or longer.';
const CHIPS = ['Break it into smaller steps', 'Add a milestone for proofreading', 'These take too long'];

export function MilestoneEditor({ list, onChange, showDone, chatOpen, hint }: Props) {
  const [addTitle, setAddTitle] = useState('');
  const [addMin, setAddMin] = useState('30');
  const [log, setLog] = useState<{ who: 'me' | 'bot'; text: string }[]>([{ who: 'bot', text: GREETING }]);
  const [message, setMessage] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  const update = (i: number, patch: Partial<Milestone>) => onChange(list.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const add = () => {
    const t = addTitle.trim();
    if (!t) return;
    onChange(list.concat({ id: U.uid('m'), title: t, estMin: Number(addMin) || 30, done: false }));
    setAddTitle('');
  };
  const send = (text?: string) => {
    const said = (text || message).trim();
    if (!said) return;
    setMessage('');
    const r = A.reply(said, list);
    onChange(r.list);
    setLog((l) => l.concat({ who: 'me', text: said }, { who: 'bot', text: r.message }));
  };
  const onEnter = (f: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); f(); } };

  const open = list.filter((m) => !m.done);
  const minutes = open.reduce((s, m) => s + (Number(m.estMin) || 0), 0);
  const total = list.length
    ? U.plural(open.length, 'open milestone') + ' · ' + U.fmtDur(minutes) + ' remaining' + (list.length > open.length ? ' · ' + (list.length - open.length) + ' done' : '')
    : 'No milestones yet.';

  return (
    <div className="ms">
      {hint ? <p className="hint">{hint}</p> : null}
      <div className="ms-rows">
        {list.map((m, i) => (
          <div key={m.id} className={'ms-row' + (m.done ? ' is-done' : '')}>
            {showDone ? <input type="checkbox" checked={m.done} aria-label={'Already done: ' + m.title} onChange={(e) => update(i, { done: e.target.checked })} /> : null}
            <input type="text" className="ms-title" value={m.title} aria-label={'Milestone ' + (i + 1) + ' title'} onChange={(e) => update(i, { title: e.target.value })} />
            <input type="number" className="ms-min" min={5} step={5} value={m.estMin} aria-label={'Minutes for milestone ' + (i + 1)} onChange={(e) => update(i, { estMin: Number(e.target.value) })} />
            <span className="muted ms-unit">min</span>
            <button type="button" className="icon-btn" aria-label={'Remove milestone ' + (i + 1)} onClick={() => onChange(list.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
      <div className="ms-row ms-add">
        <input type="text" placeholder="Add a milestone…" aria-label="New milestone title" value={addTitle} onChange={(e) => setAddTitle(e.target.value)} onKeyDown={onEnter(add)} />
        <input type="number" min={5} step={5} className="ms-min" aria-label="Minutes for new milestone" value={addMin} onChange={(e) => setAddMin(e.target.value)} />
        <span className="muted ms-unit">min</span>
        <Button small onClick={add}>Add</Button>
      </div>
      <div className="ms-total muted">{total}</div>
      <details className="chat" open={chatOpen}>
        <summary><Icon name="sparkle" size={14} /> Work it out with the assistant <span className="tag">placeholder</span></summary>
        <div className="chat-log" aria-live="polite" ref={logRef}>
          {log.map((b, i) => <div key={i} className={'bubble bubble-' + b.who}>{b.text}</div>)}
        </div>
        <div className="chips">
          {CHIPS.map((c) => <button key={c} type="button" className="chip" onClick={() => send(c)}>{c}</button>)}
        </div>
        <div className="chat-input">
          <input type="text" placeholder="Ask for a change, e.g. “break it into smaller steps”" aria-label="Message to the assistant" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={onEnter(() => send())} />
          <Button icon="send" aria="Send" onClick={() => send()} />
        </div>
      </details>
    </div>
  );
}
