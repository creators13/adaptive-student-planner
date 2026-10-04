/* App state: one plain-JSON object persisted to localStorage, plus a subscribe/commit
   pattern. Mutations happen in place inside commit(); a version counter tells React
   to re-render. The demo clock lives in state.now. */
import { useSyncExternalStore } from 'react';
import * as E from '../domain/engine';
import type { State } from '../domain/types';
import { VERSION, seed } from './seed';

const KEY = 'inflow-web';
let state: State | null = null;
let version = 0;
const subs = new Set<() => void>();

function load(): State | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw) as State; if (s && s.v === VERSION) return s; }
  } catch { /* storage unavailable: fall back to fresh sample data */ }
  return null;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }
function emit() { version++; subs.forEach((f) => f()); }

export const store = {
  init(): State { state = load() || seed(); save(); return state; },
  get state(): State { return state || store.init(); },
  // Run a mutation, persist, re-render. Returns whatever the mutation returns.
  commit<T>(fn: (s: State) => T): T { const r = fn(store.state); save(); emit(); return r; },
  // Run something against a throwaway copy.
  preview<T>(fn: (s: State) => T): T { return fn(structuredClone(store.state)); },
  subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
  reset() { state = seed(); save(); emit(); },
  // Replace the whole state (tests, and loading saved data).
  replace(next: State) { state = next; save(); emit(); },
  // Move the demo clock. Sessions that end in between queue a feedback prompt.
  advance(to: number) {
    return store.commit((s) => {
      const old = s.now;
      s.now = Math.max(to, old);
      return E.queuePrompts(s, old, s.now);
    });
  },
};

// The current state; the calling component re-renders after every commit.
export function useAppState(): State {
  useSyncExternalStore(store.subscribe, () => version);
  return store.state;
}
