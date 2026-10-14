import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  BarChart3,
  Check,
  CirclePlus,
  Download,
  History as HistoryIcon,
  Leaf,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react'
import { sessionStore } from './data/store'
import type { SessionStore } from './data/store'
import { useSessions } from './hooks/useSessions'
import { useLocalClock } from './hooks/useLocalClock'
import { useInstall } from './hooks/useInstall'
import { calculateStatistics } from './domain/statistics'
import { Brand } from './components/Brand'
import { Recorder } from './components/Recorder'
import { DetailedStats, SummaryCards } from './components/StatCards'
import { Heatmap } from './components/Heatmap'
import { History } from './components/History'
import { DataTools } from './components/DataTools'
import { PwaStatus } from './components/PwaStatus'

const ActivityChart = lazy(() => import('./components/ActivityChart'))
type View = 'track' | 'progress' | 'history'
const views = [
  { id: 'track', label: 'Track', icon: CirclePlus },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'history', label: 'History', icon: HistoryIcon },
] as const

export default function App({ store = sessionStore }: { store?: SessionStore }) {
  const [view, setView] = useState<View>('track')
  const [count, setCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  const [settings, setSettings] = useState(false)
  const [toast, setToast] = useState('')
  const [saveError, setSaveError] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const now = useLocalClock()
  const installation = useInstall()
  const { sessions, loading, error, retry } = useSessions(store)
  const stats = useMemo(() => calculateStatistics(sessions, now), [sessions, now])
  useEffect(() => {
    const connected = () => setOnline(true)
    const disconnected = () => setOnline(false)
    window.addEventListener('online', connected)
    window.addEventListener('offline', disconnected)
    return () => {
      window.removeEventListener('online', connected)
      window.removeEventListener('offline', disconnected)
    }
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])
  async function save() {
    if (saveLock.current || count === 0 || loading || error) return
    saveLock.current = true
    setSaving(true)
    setSaveError('')
    try {
      await store.create(count)
      setCount(0)
      setToast(`${count.toLocaleString()} push-ups saved. Nice work.`)
    } catch {
      setSaveError(
        'Your session couldn’t be saved. Your count is still here. Check that browser storage is allowed and try again.',
      )
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <a
            href="#"
            className="brand-link"
            aria-label="Pushup home"
            onClick={(event) => {
              event.preventDefault()
              setView('track')
            }}
          >
            <Brand />
          </a>
          <div className="header-divider" />
          <span className="header-tagline">EVERY REP COUNTS.</span>
          <nav className="navigation" aria-label="Main navigation">
            {views.map((item) => (
              <button
                key={item.id}
                aria-current={view === item.id ? 'page' : undefined}
                className={view === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setView(item.id)}
              >
                <item.icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            {installation.canInstall && (
              <button
                className="install-button"
                onClick={() =>
                  void installation
                    .install()
                    .catch(() => setToast('Open the Chrome menu and choose Install app.'))
                }
              >
                <Download size={16} />
                <span>Install app</span>
              </button>
            )}
            <button
              className="icon-button settings-button"
              aria-label="Settings and backups"
              onClick={() => setSettings(true)}
            >
              <Settings2 size={20} />
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="main-content">
        <div className="page-intro">
          <div>
            <div className="intro-date">
              <span className="accent short-line" />
              {now.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </div>
            <h1>
              {view === 'track' ? (
                <>
                  A little stronger.
                  <br />
                  <span className="muted-heading">Every single day.</span>
                </>
              ) : view === 'progress' ? (
                <>
                  Look how far
                  <br />
                  <span className="muted-heading">you’ve come.</span>
                </>
              ) : (
                <>
                  Every session.
                  <br />
                  <span className="muted-heading">Part of your story.</span>
                </>
              )}
            </h1>
            <p className="intro-description">
              {view === 'track'
                ? 'Show up. Put in the reps. Build your momentum.'
                : view === 'progress'
                  ? 'Small steps make a difference. Here’s the proof.'
                  : 'A record of the work you’ve put in.'}
            </p>
          </div>
          <div className="today-summary" aria-label="Today’s summary" aria-busy={loading}>
            <span className="eyebrow muted">TODAY SO FAR</span>
            <div>
              <strong>{loading ? '—' : stats.today.total.toLocaleString()}</strong>
              <span>push-ups</span>
            </div>
            <span className="today-sessions">
              <span className="live-dot" />
              {loading
                ? 'Loading your sessions…'
                : `${stats.today.count.toLocaleString()} session${stats.today.count === 1 ? '' : 's'} logged`}
            </span>
          </div>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            <p>{error}</p>
            <button className="button secondary" onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {saveError && (
          <div className="error-banner" role="alert">
            <p>{saveError}</p>
            <button
              className="icon-button"
              aria-label="Dismiss save error"
              onClick={() => setSaveError('')}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {loading && (
          <p className="loading-line" role="status">
            <span className="spinner" /> Opening your workout journal…
          </p>
        )}
        {view === 'track' && (
          <>
            <div className="tracker-grid">
              <Recorder
                count={count}
                onChange={setCount}
                onSave={() => void save()}
                saving={saving}
                unavailable={loading || Boolean(error)}
              />
              <SummaryCards stats={stats} />
            </div>
            <Suspense
              fallback={
                <div className="panel chart-loading" role="status">
                  Loading your activity chart…
                </div>
              }
            >
              <ActivityChart sessions={sessions} now={now} compact />
            </Suspense>
            <div className="practice-note">
              <span className="practice-icon">
                <Leaf size={21} aria-hidden="true" />
              </span>
              <p>
                Progress is a practice.
                <span>You don’t have to do it all. Just a little, every day.</span>
              </p>
              <ArrowUpRight size={23} aria-hidden="true" />
            </div>
          </>
        )}
        {view === 'progress' && (
          <div className="progress-content">
            <div className="section-heading">
              <h2>The bigger picture</h2>
              <span className="eyebrow muted">YOUR EFFORT ADDS UP</span>
            </div>
            <div className="period-grid">
              {[
                { label: 'Today', data: stats.today },
                { label: 'This week', data: stats.week },
                { label: 'This month', data: stats.month },
                { label: 'All time', data: stats.allTime },
              ].map((period) => (
                <div className="panel period-card" key={period.label}>
                  <span className="stat-label">{period.label}</span>
                  <strong>
                    {period.data.total.toLocaleString()}
                    <span>reps</span>
                  </strong>
                  <span className="muted small">{period.data.count.toLocaleString()} sessions</span>
                </div>
              ))}
            </div>
            <Suspense
              fallback={
                <div className="panel chart-loading" role="status">
                  Loading your activity chart…
                </div>
              }
            >
              <ActivityChart sessions={sessions} now={now} />
            </Suspense>
            <DetailedStats stats={stats} />
            <Heatmap sessions={sessions} now={now} />
            <div className="progress-streak">
              <span className="live-dot" />
              {stats.currentStreak} day current streak
              <span className="muted">
                {' '}
                · A streak stays active today if you trained yesterday.
              </span>
            </div>
          </div>
        )}
        {view === 'history' && (
          <History
            sessions={sessions}
            now={now}
            store={store}
            notify={setToast}
            onTrack={() => setView('track')}
          />
        )}
        <footer className="app-footer">
          <span>
            <ShieldCheck size={15} aria-hidden="true" />
            {online
              ? 'Private by design. Saved on this device.'
              : 'You’re offline. Keep going — your sessions save here.'}
          </span>
          <span className="footer-motto">YOU VS. YESTERDAY.</span>
        </footer>
      </main>
      <PwaStatus hasUnsaved={count > 0 || saving} />
      <div
        className={`toast ${toast ? 'visible' : ''}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast && (
          <>
            <span>
              <Check size={17} aria-hidden="true" />
            </span>
            {toast}
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setToast('')}
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>
      {settings && (
        <DataTools
          store={store}
          onClose={() => setSettings(false)}
          notify={setToast}
          installation={installation}
        />
      )}
    </div>
  )
}
