import { lazy, Suspense, useMemo, useState } from 'react'
import { ArrowDown, Flame } from 'lucide-react'
import type { FriendProgress as Friend } from '../domain/sharing'
import { calculateStatistics, groupByDay } from '../domain/statistics'
import { relativeDay } from '../domain/dates'
import { DetailedStats } from './StatCards'
import { Heatmap } from './Heatmap'

const ActivityChart = lazy(() => import('./ActivityChart'))

export function FriendProgress({ friend, now }: { friend: Friend; now: Date }) {
  const stats = useMemo(() => calculateStatistics(friend.sessions, now), [friend.sessions, now])
  const [limit, setLimit] = useState(50)
  const groups = useMemo(
    () => groupByDay(friend.sessions.slice(0, limit)),
    [friend.sessions, limit],
  )
  return (
    <section className="friend-progress progress-content" aria-label={`${friend.name}’s progress`}>
      <div className="section-heading">
        <div>
          <span className="eyebrow accent">SHARED PROGRESS</span>
          <h2>{friend.name}’s journey</h2>
        </div>
        <span className="friend-streak">
          <Flame size={18} aria-hidden="true" />
          {stats.currentStreak} day streak
        </span>
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
          <p role="status" className="muted">
            Loading activity chart…
          </p>
        }
      >
        <ActivityChart sessions={friend.sessions} now={now} subject={friend.name} />
      </Suspense>
      <DetailedStats stats={stats} shared />
      <Heatmap sessions={friend.sessions} now={now} />
      <section aria-label={`${friend.name}’s session history`}>
        <div className="section-heading view-heading">
          <h2>Session history</h2>
          <span className="muted small">
            {friend.sessions.length.toLocaleString()} sessions · view only
          </span>
        </div>
        {!friend.sessions.length && (
          <div className="panel empty-state">
            <h3>The next rep is a fresh start.</h3>
            <p className="muted">No sessions shared yet. Check back after their next workout.</p>
          </div>
        )}
        <div className="history-groups">
          {[...groups].map(([key, sessions]) => (
            <section key={key} aria-label={relativeDay(key, now)}>
              <div className="history-date">
                <h3>{relativeDay(key, now)}</h3>
                <span>
                  {sessions.reduce((total, session) => total + session.reps, 0).toLocaleString()}{' '}
                  reps
                </span>
              </div>
              <div className="panel history-list">
                {sessions.map((session, index) => (
                  <div key={session.id} className="history-row">
                    <span className="session-number" aria-hidden="true">
                      {String(sessions.length - index).padStart(2, '0')}
                    </span>
                    <div className="session-info">
                      <strong>
                        {session.reps.toLocaleString()} <span>push-ups</span>
                      </strong>
                      <time dateTime={new Date(session.createdAt).toISOString()}>
                        {new Date(session.createdAt).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        {friend.sessions.length > limit && (
          <button
            className="button secondary load-more"
            onClick={() => setLimit((value) => value + 50)}
          >
            Show more sessions <ArrowDown size={16} />
          </button>
        )}
      </section>
      <p className="muted small">
        Dates and comparisons use your device’s local timezone. Changes appear after syncing.
      </p>
    </section>
  )
}
