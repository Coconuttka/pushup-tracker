import { describe, expect, it } from 'vitest'
import { calculateStatistics, chartData, groupByDay, heatmapData } from './statistics'
import { addDays, dayKey, dayOrdinal, isoWeekLabel, startOfWeek } from './dates'
import { createSession } from './session'

const session = (reps: number, year: number, month: number, day: number, hour = 12) =>
  createSession(reps, new Date(year, month - 1, day, hour).getTime())

describe('statistics using local calendar periods', () => {
  it('has honest zero and empty states', () => {
    const stats = calculateStatistics([])
    expect(stats.today).toEqual({ total: 0, count: 0 })
    expect(stats.allTime).toEqual({ total: 0, count: 0 })
    expect(stats.average).toBe(0)
    expect(stats.bestSession).toBe(0)
    expect(stats.bestDay).toEqual({ key: '', total: 0 })
    expect(stats.currentStreak).toBe(0)
    expect(stats.longestStreak).toBe(0)
  })

  it('calculates period totals, counts, averages and records from sessions', () => {
    const stats = calculateStatistics(
      [
        session(20, 2026, 10, 14),
        session(15, 2026, 10, 14, 15),
        session(40, 2026, 10, 13),
        session(10, 2026, 10, 12),
        session(100, 2026, 10, 11),
        session(30, 2026, 9, 30),
      ],
      new Date(2026, 9, 14, 18),
    )
    expect(stats.today).toEqual({ total: 35, count: 2 })
    expect(stats.week).toEqual({ total: 85, count: 4 })
    expect(stats.month).toEqual({ total: 185, count: 5 })
    expect(stats.allTime).toEqual({ total: 215, count: 6 })
    expect(stats.average).toBeCloseTo(215 / 6)
    expect(stats.bestSession).toBe(100)
    expect(stats.bestDay).toEqual({ key: '2026-10-11', total: 100 })
    expect(stats.currentStreak).toBe(4)
    expect(stats.longestStreak).toBe(4)
    expect(stats.activeDays).toBe(5)
  })

  it('uses local midnight rather than UTC and excludes the next day', () => {
    const midnight = new Date(2026, 9, 14, 0)
    expect(midnight.getTimezoneOffset()).toBe(-180)
    const stats = calculateStatistics(
      [
        createSession(10, midnight.getTime() - 1),
        createSession(20, midnight.getTime()),
        createSession(30, new Date(2026, 9, 15).getTime() - 1),
        createSession(40, new Date(2026, 9, 15).getTime()),
      ],
      new Date(2026, 9, 14, 12),
    )
    expect(stats.today).toEqual({ total: 50, count: 2 })
  })

  it('starts weeks on Monday across year boundaries', () => {
    const now = new Date(2027, 0, 1)
    const sessions = [
      session(5, 2026, 12, 27),
      session(10, 2026, 12, 28),
      session(20, 2027, 1, 1),
      session(30, 2027, 1, 4),
    ]
    expect(dayKey(startOfWeek(now))).toBe('2026-12-28')
    expect(calculateStatistics(sessions, now).week).toEqual({ total: 30, count: 2 })
    expect(calculateStatistics(sessions, now).month).toEqual({ total: 50, count: 2 })
    expect(isoWeekLabel(now)).toBe('2026 · W53')
    expect(isoWeekLabel(new Date(2027, 0, 4))).toBe('2027 · W01')
  })

  it('handles a leap day and month-end transitions', () => {
    const sessions = [session(10, 2024, 2, 28), session(20, 2024, 2, 29), session(30, 2024, 3, 1)]
    expect(calculateStatistics(sessions, new Date(2024, 1, 29)).month.total).toBe(30)
    const stats = calculateStatistics(sessions, new Date(2024, 2, 1))
    expect(stats.month.total).toBe(30)
    expect(stats.currentStreak).toBe(3)
    expect(stats.longestStreak).toBe(3)
  })

  it.each([
    [2026, 3, 27, 30],
    [2026, 10, 23, 26],
  ])('counts calendar days across DST: %i/%i', (year, month, first, last) => {
    const sessions = Array.from({ length: last - first + 1 }, (_, index) =>
      session(10, year, month, first + index),
    )
    const stats = calculateStatistics(sessions, new Date(year, month - 1, last))
    expect(stats.currentStreak).toBe(4)
    expect(stats.longestStreak).toBe(4)
    expect(
      dayOrdinal(dayKey(new Date(year, month - 1, last))) -
        dayOrdinal(dayKey(new Date(year, month - 1, first))),
    ).toBe(3)
  })

  it('keeps yesterday’s streak active and breaks after a missed full day', () => {
    const sessions = [
      session(10, 2026, 10, 11),
      session(20, 2026, 10, 12),
      session(30, 2026, 10, 13),
    ]
    expect(calculateStatistics(sessions, new Date(2026, 9, 14)).currentStreak).toBe(3)
    expect(calculateStatistics(sessions, new Date(2026, 9, 15)).currentStreak).toBe(0)
    expect(calculateStatistics(sessions, new Date(2026, 9, 15)).longestStreak).toBe(3)
  })

  it('counts multiple sessions on the same day as one streak day', () => {
    const sessions = [session(10, 2026, 10, 14), session(20, 2026, 10, 14)]
    const stats = calculateStatistics(sessions, new Date(2026, 9, 14))
    expect(stats.currentStreak).toBe(1)
    expect(stats.bestDay.total).toBe(30)
  })

  it('groups newest days and sessions first without mutating the source', () => {
    const sessions = [
      session(10, 2026, 10, 13),
      session(20, 2026, 10, 14),
      session(30, 2026, 10, 14, 15),
    ]
    const groups = groupByDay(sessions)
    expect([...groups.keys()]).toEqual(['2026-10-14', '2026-10-13'])
    expect(groups.get('2026-10-14')!.map((item) => item.reps)).toEqual([30, 20])
    expect(sessions[0].reps).toBe(10)
  })
})

describe('chart and calendar aggregation', () => {
  it('fills seven local days, including zero days, with exact totals', () => {
    const now = new Date(2026, 9, 14)
    const data = chartData(
      [session(15, 2026, 10, 14), session(5, 2026, 10, 14), session(70, 2026, 10, 7)],
      'daily',
      now,
    )
    expect(data).toHaveLength(7)
    expect(data[0].key).toBe('2026-10-08')
    expect(data[6]).toMatchObject({ key: '2026-10-14', total: 20, count: 2 })
    expect(data.slice(0, 6).every((point) => point.total === 0)).toBe(true)
  })

  it('buckets weekly and monthly totals across December and January', () => {
    const now = new Date(2027, 0, 4)
    const sessions = [session(10, 2026, 12, 31), session(20, 2027, 1, 1), session(30, 2027, 1, 4)]
    const weekly = chartData(sessions, 'weekly', now)
    expect(weekly.at(-2)).toMatchObject({ total: 30, count: 2, detail: '2026 · W53' })
    expect(weekly.at(-1)).toMatchObject({ total: 30, count: 1, detail: '2027 · W01' })
    const monthly = chartData(sessions, 'monthly', now)
    expect(monthly.at(-2)).toMatchObject({ total: 10, key: '2026-12-01' })
    expect(monthly.at(-1)).toMatchObject({ total: 50, key: '2027-01-01' })
    expect(monthly).toHaveLength(12)
  })

  it('covers the last year in the heatmap and ends at today', () => {
    const now = new Date(2026, 9, 14)
    const cells = heatmapData([session(15, 2026, 10, 14)], now)
    expect(cells.length).toBeGreaterThanOrEqual(365)
    expect(new Date(`${cells[0].key}T12:00:00`).getDay()).toBe(1)
    expect(cells.at(-1)).toMatchObject({ key: '2026-10-14', total: 15 })
    expect(new Set(cells.map((cell) => cell.key)).size).toBe(cells.length)
    expect(dayKey(addDays(now, 1))).toBe('2026-10-15')
  })
})
