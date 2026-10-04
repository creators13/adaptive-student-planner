/* App shell: sidebar navigation, hash routing, the feedback badge, and the
   "Prototype controls" panel that fast-forwards the demo clock so you can see flow 2
   without waiting for a real session to end. */
import { useEffect, useState } from 'react';
import * as U from './domain/util';
import * as E from './domain/engine';
import { store, useAppState } from './state/store';
import { Button } from './ui/controls';
import { Icon, type IconName } from './ui/Icon';
import { DialogHost, anyDialogOpen, confirmDialog } from './ui/dialog';
import { Toasts, toast } from './ui/toast';
import { openPending } from './flows/feedback';
import { PlanView } from './views/PlanView';
import { TasksView } from './views/TasksView';
import { DashboardView } from './views/DashboardView';
import { SettingsView, onboarding } from './views/SettingsView';

const ROUTES: [string, string, IconName][] = [['dashboard', 'Dashboard', 'grid'], ['plan', 'Weekly Plan', 'calendar'], ['tasks', 'Tasks', 'tasks'], ['settings', 'Settings', 'settings']];
const current = () => { const k = (location.hash || '').replace(/^#\/?/, ''); return ROUTES.some((r) => r[0] === k) ? k : 'plan'; };

// Browser notification when a session ends (only if the student has allowed them).
function notify(title: string, body: string) {
  try {
    if (store.state.notifications?.feedback && 'Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
  } catch { /* notifications are best effort */ }
}

function afterAdvance(added: string[]) {
  if (!added.length) return;
  const first = E.block(store.state, added[0]);
  notify('Session ended', (first ? first.title : 'A session') + ': how did it go?' + (added.length > 1 ? ' (+' + (added.length - 1) + ' more)' : ''));
  // In real use the pop-up appears when the student next opens the app. The demo shows it right away.
  if (!anyDialogOpen()) setTimeout(() => openPending(), 300);
}
const advanceTo = (ts: number) => afterAdvance(store.advance(ts));

function endNext() {
  const s = store.state;
  const next = s.blocks.filter((b) => b.end > s.now && E.promptKind(s, b) !== 'none' && !s.pending.some((p) => p.blockId === b.id)).sort((a, b) => a.end - b.end)[0];
  if (!next) { toast('No more sessions with feedback prompts in the plan.'); return; }
  advanceTo(next.end + U.MIN);
}

async function reset() {
  if (!(await confirmDialog({ title: 'Reset sample data?', message: 'This clears everything you added and restarts the demo clock.', confirmLabel: 'Reset', danger: true }))) return;
  const was = store.state.onboarded;
  store.reset();
  store.commit((s) => { s.onboarded = was; });
  location.hash = '#/plan';
}

function DemoControls() {
  const s = useAppState();
  return (
    <aside className="demo" aria-label="Prototype controls">
      <details open={window.innerWidth > 900}>
        <summary>Prototype controls <span className="tag">sample data</span></summary>
        <div className="demo-clock" id="demo-clock" aria-live="polite">{'Demo time: ' + U.fmtDay(s.now) + ', ' + U.fmtTime(s.now)}</div>
        <div className="demo-btns">
          <Button kind="primary" small id="demo-end" onClick={endNext}>End next session</Button>
          <Button small id="demo-hour" onClick={() => advanceTo(store.state.now + U.HOUR)}>+1 hour</Button>
          <Button small id="demo-day" onClick={() => advanceTo(U.addDays(store.state.now, 1))}>+1 day</Button>
          <Button small id="demo-reset" onClick={reset}>Reset</Button>
        </div>
        <p className="hint">Real sessions end on their own. These buttons move a demo clock forward so you can try the after-session flow now.</p>
      </details>
    </aside>
  );
}

let booted = false;

export function App() {
  const s = useAppState();
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const onHash = () => setRoute(current());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (booted) return; // once per page load, even when React runs effects twice in development
    booted = true;
    if (!store.state.onboarded) onboarding();
    else if (store.state.pending.length) setTimeout(() => openPending(), 600); // "next visit" pop-up
  }, []);

  return (
    <>
      <div className="app">
        <nav className="sidebar" aria-label="Main">
          <div className="brand">
            <span className="brand-mark"><Icon name="inflow" size={20} /></span>
            <span className="brand-name"><span className="brand-in">in</span><span className="brand-flow">flow</span></span>
          </div>
          <div className="nav">
            {ROUTES.map(([k, label, ic]) => (
              <a key={k} href={'#/' + k} className={'nav-item' + (route === k ? ' is-on' : '')} data-route={k} aria-current={route === k ? 'page' : undefined}>
                <Icon name={ic} size={18} /><span>{label}</span>
              </a>
            ))}
            <button type="button" className="nav-item nav-btn" id="nav-feedback" onClick={() => openPending()}>
              <Icon name="bell" size={18} /><span>Session feedback</span>
              <span className="count" aria-label="waiting for feedback" hidden={s.pending.length === 0}>{String(s.pending.length)}</span>
            </button>
          </div>
          <DemoControls />
          <div className="user">
            <div className="avatar" aria-hidden="true">MC</div>
            <div><div className="task-title">Maya Chen</div><div className="muted small">Student plan</div></div>
          </div>
        </nav>
        <main id="view" className="main" tabIndex={-1}>
          {route === 'dashboard' ? <DashboardView /> : route === 'tasks' ? <TasksView /> : route === 'settings' ? <SettingsView key={JSON.stringify(s.prefs)} /> : <PlanView />}
        </main>
      </div>
      <DialogHost />
      <Toasts />
    </>
  );
}
