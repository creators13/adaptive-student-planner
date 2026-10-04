/* Settings: the scheduling preferences the planner needs (also asked at first run),
   temporary relaxations, and notification options. */
import { useState } from 'react';
import * as U from '../domain/util';
import type { Notifications, Prefs } from '../domain/types';
import { store, useAppState } from '../state/store';
import { Button } from '../ui/controls';
import { Modal, openDialog } from '../ui/dialog';
import { toast } from '../ui/toast';
import { PrefsForm, cleanPrefs } from '../components/PrefsForm';

function Onboarding({ done }: { done: (p: Prefs | null) => void }) {
  const [p, setP] = useState(store.state.prefs);
  return (
    <Modal eyebrow="Welcome to Inflow" title="When do you like to work?" size="md"
      subtitle="Inflow uses this to place floating work in your free time. You can change it anytime in Settings."
      actions={[
        <Button key="d" id="onb-defaults" onClick={() => done(null)}>Use defaults</Button>,
        <Button key="s" kind="primary" id="onb-save" onClick={() => done(cleanPrefs(p))}>Save and continue</Button>,
      ]}>
      <PrefsForm value={p} onChange={setP} />
    </Modal>
  );
}

// First run: ask for preferences (or accept defaults). It must be answered.
export async function onboarding() {
  const r = await openDialog<Prefs | null>((done) => <Onboarding done={done} />, { dismissible: false });
  store.commit((s) => { if (r && r !== 'dismissed') s.prefs = { ...s.prefs, ...r }; s.onboarded = true; });
}

function Toggle({ label, sub, k }: { label: string; sub: string; k: keyof Notifications }) {
  const s = useAppState();
  const id = 'n-' + k;
  return (
    <div className="toggle-row">
      <div><label htmlFor={id}>{label}</label><div className="muted small">{sub}</div></div>
      <input type="checkbox" role="switch" id={id} className="switch" checked={!!s.notifications?.[k]} onChange={(e) => store.commit((st) => { if (st.notifications) st.notifications[k] = e.target.checked; })} />
    </div>
  );
}

export function SettingsView() {
  const s = useAppState();
  const [draft, setDraft] = useState(s.prefs);
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const [, rerender] = useState(0);
  return (
    <>
      <div className="page-head">
        <div><h1>Settings</h1><p className="muted">Manage your planning preferences and notifications.</p></div>
        <div className="head-actions">
          <Button kind="primary" id="save-prefs" onClick={() => {
            store.commit((st) => { st.prefs = { ...st.prefs, ...cleanPrefs(draft) }; });
            toast('Saved. New preferences apply to work scheduled from now on.', { tone: 'ok' });
          }}>Save changes</Button>
        </div>
      </div>
      <section className="card">
        <div className="card-head"><h2>Work preferences</h2><span className="muted small">Used for adaptive scheduling</span></div>
        <PrefsForm value={draft} onChange={setDraft} />
        <p className="hint">Saving does not move work that is already scheduled.</p>
      </section>
      <section className="card">
        <div className="card-head"><h2>Temporary changes</h2></div>
        {s.overrides.length ? (
          <ul className="plain">
            {s.overrides.map((o) => (
              <li key={o.id} className="temp-row">
                <span>{[o.workEnd ? 'Work until ' + U.clockLabel(o.workEnd) : null, o.bufferDays != null ? (o.bufferDays ? U.plural(o.bufferDays, 'day') + ' buffer' : 'no buffer') : null].filter(Boolean).join(', ') + ' · ' +
                  (o.scope === 'task' ? 'one task' : o.until ? 'until ' + U.fmtDate(o.until) : 'until removed')}</span>
                <Button small onClick={() => store.commit((st) => { st.overrides = st.overrides.filter((x) => x.id !== o.id); })}>Remove</Button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">None. When work does not fit, you can relax a preference for a while. Those changes show up here.</p>}
      </section>
      <section className="card">
        <div className="card-head"><h2>Notifications</h2></div>
        <Toggle label="Session feedback" sub="Ask how a session went when it ends" k="feedback" />
        <div className="toggle-row">
          <div>
            <div className="label">Browser notifications</div>
            <div className="muted small">{perm === 'granted' ? 'On. You will be notified when a session ends.' : perm === 'denied' ? 'Blocked in your browser settings.' : perm === 'unsupported' ? 'Not supported in this browser.' : 'Off. Turn on to hear about finished sessions when this tab is in the background.'}</div>
          </div>
          {perm === 'default' ? <Button onClick={() => Notification.requestPermission().then(() => rerender((n) => n + 1))}>Enable</Button> : null}
        </div>
        <Toggle label="Upcoming focus blocks" sub="15 minutes before" k="upcoming" />
        <Toggle label="Deadline reminders" sub="24 hours before" k="deadlines" />
        <Toggle label="Schedule changes" sub="When Inflow reschedules" k="changes" />
        <Toggle label="Weekly summary" sub="Sunday evening" k="weekly" />
        <p className="hint">Prototype note: only session feedback sends a notification. The other switches are placeholders.</p>
      </section>
    </>
  );
}
