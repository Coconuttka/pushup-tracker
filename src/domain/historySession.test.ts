import { describe, expect, it } from 'vitest'
import { historicalTimestamp } from './session'
import { dayKey, timeKey } from './dates'

const now = new Date(2026, 9, 14, 16, 30).getTime()

describe('historical session dates', () => {
  it('preserves the selected local date and time instead of interpreting it as UTC', () => {
    const timestamp = historicalTimestamp('2026-10-13', '00:15', now)
    expect(timestamp).toBe(new Date(2026, 9, 13, 0, 15).getTime())
    expect(dayKey(timestamp)).toBe('2026-10-13')
    expect(timeKey(new Date(timestamp))).toBe('00:15')
    expect(new Date(timestamp).getUTCDate()).toBe(12)
  })

  it('accepts a leap day and the current local minute', () => {
    expect(historicalTimestamp('2024-02-29', '18:45', now)).toBe(
      new Date(2024, 1, 29, 18, 45).getTime(),
    )
    expect(historicalTimestamp('2026-10-14', '16:30', now)).toBe(now)
  })

  it.each([
    ['2026-10-15', '00:00'],
    ['2026-10-14', '16:31'],
  ])('rejects future sessions: %s %s', (date, time) => {
    expect(() => historicalTimestamp(date, time, now)).toThrow(/Future sessions/)
  })

  it.each([
    ['', '12:00'],
    ['2026-10-13', ''],
    ['2026-2-13', '12:00'],
    ['2026-02-30', '12:00'],
    ['2025-02-29', '12:00'],
    ['2026-13-01', '12:00'],
    ['2026-10-00', '12:00'],
    ['2026-10-13', '24:00'],
    ['2026-10-13', '12:60'],
    ['1969-12-31', '12:00'],
    ['2026-10-13', '12:30:45'],
  ])('rejects invalid calendar values: %s %s', (date, time) => {
    expect(() => historicalTimestamp(date, time, now)).toThrow(/valid date and time/)
  })

  it('rejects a time skipped by daylight saving instead of moving it to another hour', () => {
    expect(() => historicalTimestamp('2026-03-29', '03:30', now)).toThrow(/local timezone/)
  })
})
