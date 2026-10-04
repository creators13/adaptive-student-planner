/* Toasts: short status messages, bottom right, at most three at a time. */
import { useSyncExternalStore } from 'react';
import { Icon } from './Icon';

export type Tone = 'info' | 'ok' | 'warn';
interface ToastItem { id: number; message: string; tone: Tone; action?: { label: string; onClick: () => void } | null }

let items: ToastItem[] = [];
let nextId = 1;
const subs = new Set<() => void>();
const set = (next: ToastItem[]) => { items = next; subs.forEach((f) => f()); };
const remove = (id: number) => set(items.filter((t) => t.id !== id));

export function toast(message: string, o: { tone?: Tone; ms?: number; action?: ToastItem['action'] } = {}) {
  const id = nextId++;
  set(items.concat({ id, message, tone: o.tone || 'info', action: o.action }).slice(-3)); // keep the stack short
  setTimeout(() => remove(id), o.ms || 7000);
}

export const clearToasts = () => set([]);

export function Toasts() {
  const list = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => items);
  return (
    <div id="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={'toast toast-' + t.tone} role="status">
          <span>{t.message}</span>
          {t.action ? <button type="button" className="toast-action" onClick={() => { remove(t.id); t.action!.onClick(); }}>{t.action.label}</button> : null}
          <button type="button" className="icon-btn toast-x" aria-label="Dismiss" onClick={() => remove(t.id)}><Icon name="x" size={14} /></button>
        </div>
      ))}
    </div>
  );
}
