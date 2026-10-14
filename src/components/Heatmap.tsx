import { useEffect, useMemo, useRef } from 'react'
import { heatmapData } from '../domain/statistics'
import type { Session } from '../domain/session'
import { displayDate } from '../domain/dates'

function level(total: number, maximum: number) {
  if (!total) return 0
  return Math.max(1, Math.ceil((total / maximum) * 4))
}

export function Heatmap({ sessions, now }: { sessions: Session[]; now: Date }) {
  const cells = useMemo(() => heatmapData(sessions, now), [sessions, now])
  const maximum = Math.max(1, ...cells.map((cell) => cell.total))
  const active = cells.filter((cell) => cell.total > 0)
  const scroll = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroll.current?.scrollTo({ left: scroll.current.scrollWidth })
  }, [])
  return (
    <section className="panel heatmap-panel" aria-labelledby="consistency-title">
      <div className="section-heading">
        <div>
          <h2 id="consistency-title">Small efforts. Lasting change.</h2>
          <p className="muted small">
            {active.length} active day{active.length === 1 ? '' : 's'} in the last year
          </p>
        </div>
        <span className="pill">Consistency</span>
      </div>
      <div
        className="heatmap-scroll"
        ref={scroll}
        tabIndex={0}
        role="region"
        aria-label="Daily activity calendar. Scroll horizontally to see earlier months."
      >
        <div className="heatmap-inner">
          <div className="heatmap-months">
            {cells
              .filter((_, i) => i % 7 === 0)
              .map((cell, i, weeks) => (
                <span key={cell.key}>
                  {i === 0 || cell.month !== weeks[i - 1].month ? cell.month : ''}
                </span>
              ))}
          </div>
          <div className="heatmap-body">
            <div className="heatmap-weekdays" aria-hidden="true">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div
              className="heatmap-grid"
              role="img"
              aria-label={`Activity over the last year. ${active.length} active days. Exact totals are in the daily totals table below.`}
            >
              {cells.map((cell) => (
                <span
                  className={`heat-cell level-${level(cell.total, maximum)}`}
                  key={cell.key}
                  title={`${displayDate(cell.key, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}: ${cell.total.toLocaleString()} push-ups`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="heatmap-footer">
        <details className="data-details">
          <summary>View daily totals</summary>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Active day totals over the last year</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Push-ups</th>
                </tr>
              </thead>
              <tbody>
                {active.length ? (
                  [...active].reverse().map((cell) => (
                    <tr key={cell.key}>
                      <th scope="row">
                        {displayDate(cell.key, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </th>
                      <td>{cell.total.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2}>No saved sessions yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
        <div className="heatmap-legend" aria-label="Color intensity increases with more push-ups">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((value) => (
            <span key={value} className={`heat-cell level-${value}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  )
}
