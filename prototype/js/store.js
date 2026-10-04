/* App state: one plain-JSON object persisted to localStorage, plus a subscribe/commit
   pattern. Views re-render on every commit. The demo clock lives in state.now. */
(function () {
  'use strict';
  const PF = (window.PF = window.PF || {});
  const E = PF.engine;
  const KEY = 'planflow-prototype';
  let state = null;
  const subs = [];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); if (s && s.v === PF.data.VERSION) return s; }
    } catch (e) { /* storage unavailable: fall back to fresh sample data */ }
    return null;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  function emit() { subs.forEach((f) => f(state)); }

  PF.store = {
    init() { state = load() || PF.data.seed(); save(); return state; },
    get state() { return state; },
    // Run a mutation, persist, re-render. Returns whatever the mutation returns.
    commit(fn) { const r = fn(state); save(); emit(); return r; },
    // Run something against a throwaway copy.
    preview(fn) { return fn(structuredClone(state)); },
    subscribe(fn) { subs.push(fn); },
    reset() { state = PF.data.seed(); save(); emit(); },
    // Move the demo clock. Sessions that end in between queue a feedback prompt.
    advance(to) {
      return PF.store.commit((s) => {
        const old = s.now;
        s.now = Math.max(to, old);
        return E.queuePrompts(s, old, s.now);
      });
    },
  };
})();
