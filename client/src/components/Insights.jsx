import { useEffect, useState } from 'react';
import { Fire, Target, CheckCircle, WarningCircle, NotePencil, ChartBar, Sparkle, CircleNotch, Timer } from '@phosphor-icons/react';
import { api } from '../api.js';
import { catOf } from '../utils/constants.js';
import { dayLabel } from '../utils/date.js';

const MOOD = { great: '🤩', good: '😊', okay: '🙂', ok: '🙂', tired: '😴', stressed: '😣', sad: '😔' };

export default function Insights({ stats, today, toast }) {
  const [reviews, setReviews] = useState([]);
  const [reports, setReports] = useState([]);
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.reviews().then(setReviews).catch(() => {});
    api.reports().then(setReports).catch(() => {});
    api.focus(today).then(setFocus).catch(() => {});
  }, [stats, today]);

  async function generate() {
    setBusy(true);
    try {
      const r = await api.weeklyReport(today);
      setReports((rs) => [r, ...rs.filter((x) => x.id !== r.id && x.weekEnding !== r.weekEnding)]);
    } catch (e) { toast?.(e.message, 'error'); }
    setBusy(false);
  }

  if (!stats) return <div className="empty">Loading…</div>;
  const max = Math.max(1, ...stats.week.map((d) => d.total));
  const rate = stats.weekTotal ? Math.round((stats.weekDone / stats.weekTotal) * 100) : 0;
  const cats = Object.entries(stats.categories).sort((a, b) => b[1].total - a[1].total);
  const latest = reports[0];

  return (
    <div className="insights">
      <div className="stat-grid">
        <Stat icon={<Fire weight="fill" />} label="Day streak" value={stats.streak} hint="din lagataar" tone="orange" />
        <Stat icon={<Target />} label="Weekly completion" value={`${rate}%`} hint={`${stats.weekDone}/${stats.weekTotal} tasks`} tone="violet" />
        <Stat icon={<Timer />} label="Focus this week" value={`${Math.round(((focus?.weekMinutes || 0) / 60) * 10) / 10}h`} hint={`${focus?.todayMinutes || 0} min aaj`} tone="green" />
        <Stat icon={<WarningCircle />} label="Overdue" value={stats.overdue} hint="pichle din ke pending" tone="red" />
      </div>

      <div className="card report-card">
        <div className="row-between">
          <h3><Sparkle size={18} weight="fill" /> Weekly report</h3>
          <button className="btn sm" onClick={generate} disabled={busy}>{busy ? <CircleNotch size={15} className="spin" /> : <ChartBar size={15} />} {latest ? 'Refresh' : 'Generate'}</button>
        </div>
        {latest ? (
          <>
            <div className="muted small">{latest.from} → {latest.weekEnding}</div>
            <div className="report-text">{latest.text}</div>
          </>
        ) : <p className="muted">Har Sunday raat ko report khud ban jati hai. Abhi dekhne ke liye "Generate" dabayein.</p>}
      </div>

      <div className="card">
        <h3><ChartBar size={18} /> Last 7 days</h3>
        <div className="bars">
          {stats.week.map((d) => (
            <div key={d.date} className={`bar-col ${d.date === today ? 'today' : ''}`}>
              <div className="bar-track">
                <div className="bar total" style={{ height: `${(d.total / max) * 100}%` }}>
                  <div className="bar done" style={{ height: d.total ? `${(d.done / d.total) * 100}%` : 0 }} />
                </div>
              </div>
              <div className="bar-num">{d.done}/{d.total}</div>
              <div className="bar-label">{dayLabel(d.date, today).replace('Yesterday', 'Yest.').split(',')[0]}</div>
            </div>
          ))}
        </div>
        <div className="legend"><span><i className="lg done" /> Done</span><span><i className="lg total" /> Planned</span></div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3><CheckCircle size={18} /> Categories (7 days)</h3>
          {cats.length === 0 && <p className="muted">Abhi koi data nahi.</p>}
          {cats.map(([id, v]) => {
            const c = catOf(id);
            return (
              <div key={id} className="cat-row">
                <span className="cat-name"><c.Icon size={15} color={c.color} /> {c.label}</span>
                <div className="cat-track"><div style={{ width: `${(v.done / v.total) * 100}%`, background: c.color }} /></div>
                <span className="muted mono">{v.done}/{v.total}</span>
              </div>
            );
          })}
        </div>
        <div className="card">
          <h3><NotePencil size={18} /> Daily reviews</h3>
          {reviews.length === 0 && <p className="muted">Agent se "Aaj ka review" karein — summary yahan save hogi.</p>}
          <div className="reviews">
            {reviews.map((r) => (
              <div key={r.id} className="review">
                <div className="review-head"><b>{dayLabel(r.date, today)}</b>{r.mood && <span>{MOOD[r.mood.toLowerCase()] || '📝'} {r.mood}</span>}</div>
                {r.accomplished.length > 0 && <div className="review-line">✓ {r.accomplished.join(', ')}</div>}
                {r.notDone.length > 0 && <div className="review-line muted">✕ {r.notDone.join(', ')}</div>}
                {r.tomorrowFocus && <div className="review-line">→ {r.tomorrowFocus}</div>}
                {r.notes && <div className="review-line muted">{r.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint, tone }) {
  return (
    <div className={`stat tone-${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  );
}
