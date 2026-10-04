/* Dialogs as promises. openDialog() pushes a dialog onto one stack and resolves with the
   value the dialog chooses, or DISMISSED when the student closes it with X or Esc. Flows
   are async functions that await one dialog after another, so each reads top to bottom
   like its flowchart. Only the top dialog reacts to Esc and Tab. */
import { createContext, useContext, useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Button } from './controls';

export const DISMISSED = 'dismissed' as const;
export type Dismissed = typeof DISMISSED;

interface Entry {
  id: number;
  render: () => ReactNode;
  dismissible: boolean;
  dismiss: () => void;
}

let stack: Entry[] = [];
let nextId = 1;
const subs = new Set<() => void>();
const emit = () => { stack = stack.slice(); subs.forEach((f) => f()); };

/* render(done) returns the dialog's content (a <Modal>). Calling done(value) closes it and
   resolves the promise with that value. */
export function openDialog<T>(render: (done: (value: T) => void) => ReactNode, opts: { dismissible?: boolean } = {}): Promise<T | Dismissed> {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const id = nextId++;
    let settled = false;
    const close = (value: T | Dismissed) => {
      if (settled) return;
      settled = true;
      stack = stack.filter((e) => e.id !== id);
      emit();
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
      resolve(value);
    };
    const dismissible = opts.dismissible !== false;
    stack.push({ id, render: () => render((v) => close(v)), dismissible, dismiss: () => { if (dismissible) close(DISMISSED); } });
    emit();
  });
}

export const anyDialogOpen = () => stack.length > 0;

// Close every dialog without answering it (tests start from a clean screen).
export function closeAllDialogs() { stack = []; emit(); }

const DialogContext = createContext<{ dismiss: () => void; dismissible: boolean }>({ dismiss: () => {}, dismissible: false });

export function DialogHost() {
  const entries = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => stack);
  useEffect(() => { document.body.classList.toggle('modal-open', entries.length > 0); }, [entries]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const top = stack[stack.length - 1];
      if (!top) return;
      if (e.key === 'Escape' && top.dismissible) { e.stopPropagation(); top.dismiss(); }
      if (e.key === 'Tab') {
        const overlays = document.querySelectorAll<HTMLElement>('.overlay');
        const el = overlays[overlays.length - 1]?.querySelector<HTMLElement>('.modal');
        if (!el) return;
        const f = [...el.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      {entries.map((e) => (
        <DialogContext.Provider key={e.id} value={{ dismiss: e.dismiss, dismissible: e.dismissible }}>
          {e.render()}
        </DialogContext.Provider>
      ))}
    </>
  );
}

interface ModalProps {
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  size?: 'sm' | 'md' | 'lg';
  actions?: ReactNode[];
  children?: ReactNode;
}

// The frame every dialog uses: overlay, title, body, and a row of actions.
export function Modal({ eyebrow, title, subtitle, size, actions = [], children }: ModalProps) {
  const { dismiss, dismissible } = useContext(DialogContext);
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Focus the first field when the dialog opens.
    const dlg = ref.current;
    if (!dlg) return;
    const first = dlg.querySelector<HTMLElement>('[autofocus]') || dlg.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea');
    (first || dlg).focus();
  }, []);
  const shown = actions.filter(Boolean);
  return (
    <div className="overlay">
      <div ref={ref} className={'modal ' + (size || '')} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal-head">
          <div>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          {dismissible ? <button type="button" className="icon-btn" aria-label="Close" onClick={dismiss}><Icon name="x" /></button> : null}
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-foot" hidden={!shown.length}>{shown}</div>
      </div>
    </div>
  );
}

// Promise<boolean>: true only when the student confirms.
export async function confirmDialog(o: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }) {
  const r = await openDialog<boolean>((done) => (
    <Modal title={o.title} subtitle={o.message} size="sm" actions={[
      <Button key="c" onClick={() => done(false)}>{o.cancelLabel || 'Cancel'}</Button>,
      <Button key="ok" kind={o.danger ? 'danger' : 'primary'} onClick={() => done(true)}>{o.confirmLabel || 'Confirm'}</Button>,
    ]} />
  ));
  return r === true;
}
