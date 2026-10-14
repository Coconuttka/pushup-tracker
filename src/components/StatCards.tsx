import { ArrowUpRight, Flame, Trophy } from 'lucide-react'
import type { calculateStatistics } from '../domain/statistics'
import { displayDate } from '../domain/dates'

export type Statistics = ReturnType<typeof calculateStatistics>
const format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 })

export function SummaryCards({ stats }: { stats: Statistics }) {
  return (
    <aside className="momentum" aria-labelledby="momentum-title">
      <div className="section-heading">
        <h2 id="momentum-title">Your momentum</h2>
        <span className="eyebrow muted">KEEP SHOWING UP</span>
      </div>
      <div className="panel streak-card">
        <span className="streak-icon">
          <Flame size={26} aria-hidden="true" />
        </span>
        <div>
          <div className="streak-value">
            {stats.currentStreak}
            <span> day{stats.currentStreak === 1 ? '' : 's'}</span>
          </div>
          <p>Current streak</p>
        </div>
        <span className="streak-caption">
          {stats.currentStreak ? 'Keep the fire going.' : 'Today is a good day to start.'}
        </span>
      </div>
      <div className="summary-grid">
        {[
          { title: 'This week', summary: stats.week },
          { title: 'This month', summary: stats.month },
          { title: 'All time', summary: stats.allTime },
        ].map(({ title, summary }) => (
          <div
            className={`panel stat-card ${title === 'All time' ? 'all-time-card' : ''}`}
            key={title}
          >
            <div className="stat-label">
              {title}
              <ArrowUpRight size={15} aria-hidden="true" />
            </div>
            <div className="stat-value">
              {format(summary.total)}
              <span>reps</span>
            </div>
            <span className="muted small">
              {summary.count.toLocaleString()} session{summary.count === 1 ? '' : 's'}
            </span>
          </div>
        ))}
      </div>
    </aside>
  )
}

export function DetailedStats({ stats }: { stats: Statistics }) {
  return (
    <section className="records-grid" aria-label="Personal records">
      {[
        {
          label: 'Average session',
          value: format(stats.average),
          suffix: 'reps',
          detail: 'Every session adds up',
        },
        {
          label: 'Best session',
          value: format(stats.bestSession),
          suffix: 'reps',
          detail: 'Your personal best',
        },
        {
          label: 'Best day',
          value: format(stats.bestDay.total),
          suffix: 'reps',
          detail: stats.bestDay.key
            ? displayDate(stats.bestDay.key, { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Your best is ahead of you',
        },
        {
          label: 'Longest streak',
          value: format(stats.longestStreak),
          suffix: 'days',
          detail: `${stats.activeDays.toLocaleString()} active days in total`,
        },
      ].map((record) => (
        <div className="panel record-card" key={record.label}>
          <span className="stat-label">
            {record.label}
            <Trophy size={16} aria-hidden="true" />
          </span>
          <div className="stat-value">
            {record.value}
            <span>{record.suffix}</span>
          </div>
          <p className="muted small">{record.detail}</p>
        </div>
      ))}
    </section>
  )
}
