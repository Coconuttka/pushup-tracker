import { useId, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronDown, TrendingUp } from 'lucide-react'
import { chartData } from '../domain/statistics'
import type { ChartPeriod } from '../domain/statistics'
import type { Session } from '../domain/session'

export default function ActivityChart({
  sessions,
  now,
  compact = false,
  subject,
}: {
  sessions: Session[]
  now: Date
  compact?: boolean
  subject?: string
}) {
  const [period, setPeriod] = useState<ChartPeriod>('daily')
  const titleId = useId()
  const data = useMemo(
    () => chartData(sessions, compact ? 'daily' : period, now),
    [sessions, period, now, compact],
  )
  const total = data.reduce((sum, point) => sum + point.total, 0)
  return (
    <section className="panel chart-panel" aria-labelledby={titleId}>
      <div className="section-heading chart-heading">
        <div>
          <div className="heading-with-icon">
            <TrendingUp size={19} className="accent" aria-hidden="true" />
            <h2 id={titleId}>
              {subject ? `${subject}’s activity` : compact ? 'The last 7 days' : 'Your activity'}
            </h2>
          </div>
          <p className="muted small">
            {total
              ? `${total.toLocaleString()} push-ups.${subject ? '' : ' All you.'}`
              : 'Every rep will find its place here.'}
          </p>
        </div>
        {compact ? (
          <span className="chart-unit">PUSH-UPS</span>
        ) : (
          <div className="segmented" aria-label="Chart period">
            {(
              [
                ['daily', 'Daily'],
                ['weekly', 'Weekly'],
                ['monthly', 'Monthly'],
              ] as const
            ).map(([value, label]) => (
              <button
                aria-pressed={period === value}
                className={period === value ? 'selected' : ''}
                onClick={() => setPeriod(value)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        className="chart"
        role="img"
        aria-label={`${compact ? 'Daily' : period} push-up totals: ${total.toLocaleString()} reps. Exact values are available in the data table below.`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            margin={{ top: 15, right: 0, bottom: 0, left: -24 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke="#2a3028" strokeDasharray="3 5" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9da696', fontSize: 12 }}
              dy={10}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9da696', fontSize: 11 }}
              domain={[0, (maximum: number) => Math.max(10, Math.ceil(maximum * 1.15))]}
            />
            <Tooltip
              cursor={{ fill: '#ffffff05' }}
              contentStyle={{
                background: '#242a20',
                border: '1px solid #414a38',
                borderRadius: 12,
                color: '#f1f4ee',
              }}
              labelFormatter={(_, payload) => payload[0]?.payload.detail ?? ''}
              formatter={(value) => [`${Number(value).toLocaleString()} reps`, 'Push-ups']}
            />
            <Bar
              dataKey="total"
              fill="#c5f277"
              radius={[5, 5, 0, 0]}
              maxBarSize={compact ? 40 : 46}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
        {total === 0 && <span className="empty-chart-label">A fresh start. A stronger you.</span>}
      </div>
      <div className="chart-footer">
        <span className="muted small">
          {compact || period === 'daily'
            ? 'Last 7 days'
            : period === 'weekly'
              ? 'Last 12 weeks · starts Monday'
              : 'Last 12 months'}{' '}
          · local time
        </span>
        <details className="data-details">
          <summary>
            View data <ChevronDown size={13} aria-hidden="true" />
          </summary>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Push-up chart data</caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Reps</th>
                  <th scope="col">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((point) => (
                  <tr key={point.key}>
                    <th scope="row">{point.detail}</th>
                    <td>{point.total.toLocaleString()}</td>
                    <td>{point.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  )
}
