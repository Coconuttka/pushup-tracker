import type { Session } from './session'
import {
  addDays,
  dayKey,
  dayOrdinal,
  fromDayKey,
  isoWeekLabel,
  startOfDay,
  startOfWeek,
} from './dates'

export interface PeriodSummary {
  total: number
  count: number
}
export interface ChartPoint {
  key: string
  label: string
  detail: string
  total: number
  count: number
}
export type ChartPeriod = 'daily' | 'weekly' | 'monthly'

export function groupByDay(sessions: readonly Session[]): Map<string, Session[]> {
  const days = new Map<string, Session[]>()
  for (const session of [...sessions].sort(
    (a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id),
  )) {
    const key = dayKey(session.createdAt)
    const group = days.get(key) ?? []
    group.push(session)
    days.set(key, group)
  }
  return days
}

function summarize(sessions: readonly Session[], start = -Infinity, end = Infinity): PeriodSummary {
  return sessions.reduce(
    (result, session) => {
      if (session.createdAt >= start && session.createdAt < end) {
        result.total += session.reps
        result.count += 1
      }
      return result
    },
    { total: 0, count: 0 },
  )
}

export function calculateStatistics(sessions: readonly Session[], now = new Date()) {
  const today = startOfDay(now)
  const week = startOfWeek(now)
  const month = new Date(now.getFullYear(), now.getMonth(), 1)
  const allTime = summarize(sessions)
  const days = groupByDay(sessions)
  const activeDays = [...days.keys()].sort()
  let longestStreak = 0
  let run = 0
  let previous = -Infinity
  let bestDay = { key: '', total: 0 }
  for (const key of activeDays) {
    const ordinal = dayOrdinal(key)
    run = ordinal === previous + 1 ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    previous = ordinal
    const total = days.get(key)!.reduce((sum, session) => sum + session.reps, 0)
    if (total >= bestDay.total) bestDay = { key, total }
  }
  let currentStreak = 0
  let cursor = days.has(dayKey(today)) ? today : addDays(today, -1)
  while (days.has(dayKey(cursor))) {
    currentStreak += 1
    cursor = addDays(cursor, -1)
  }
  return {
    today: summarize(sessions, today.getTime(), addDays(today, 1).getTime()),
    week: summarize(sessions, week.getTime(), addDays(week, 7).getTime()),
    month: summarize(
      sessions,
      month.getTime(),
      new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(),
    ),
    allTime,
    average: allTime.count ? allTime.total / allTime.count : 0,
    bestSession: sessions.reduce((max, session) => Math.max(max, session.reps), 0),
    bestDay,
    activeDays: days.size,
    currentStreak,
    longestStreak,
  }
}

export function chartData(
  sessions: readonly Session[],
  period: ChartPeriod,
  now = new Date(),
  length = period === 'daily' ? 7 : 12,
): ChartPoint[] {
  const current = period === 'weekly' ? startOfWeek(now) : startOfDay(now)
  const points: ChartPoint[] = []
  for (let index = length - 1; index >= 0; index -= 1) {
    const start =
      period === 'monthly'
        ? new Date(now.getFullYear(), now.getMonth() - index, 1)
        : addDays(current, -index * (period === 'weekly' ? 7 : 1))
    const end =
      period === 'monthly'
        ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
        : addDays(start, period === 'weekly' ? 7 : 1)
    const label =
      period === 'monthly'
        ? start.toLocaleDateString(undefined, { month: 'short' })
        : period === 'weekly'
          ? start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : start.toLocaleDateString(undefined, { weekday: 'short' })
    const detail =
      period === 'weekly'
        ? isoWeekLabel(start)
        : start.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            ...(period === 'daily' ? { day: 'numeric' as const } : {}),
          })
    points.push({
      key: dayKey(start),
      label,
      detail,
      ...summarize(sessions, start.getTime(), end.getTime()),
    })
  }
  return points
}

export function heatmapData(sessions: readonly Session[], now = new Date()) {
  const end = startOfDay(now)
  const start = startOfWeek(addDays(end, -364))
  const days = groupByDay(sessions)
  const cells = []
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const key = dayKey(cursor)
    const total = days.get(key)?.reduce((sum, session) => sum + session.reps, 0) ?? 0
    cells.push({
      key,
      total,
      month: fromDayKey(key).toLocaleDateString(undefined, { month: 'short' }),
    })
  }
  return cells
}
