import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLocalClock } from './useLocalClock'
import { dayKey } from '../domain/dates'

afterEach(() => vi.useRealTimers())

it('refreshes at local midnight, including a year boundary', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59, 800))
  const { result } = renderHook(useLocalClock)
  expect(dayKey(result.current)).toBe('2026-12-31')
  act(() => vi.advanceTimersByTime(200))
  expect(dayKey(result.current)).toBe('2027-01-01')
})

it('refreshes when returning to the app after being asleep', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 14, 18))
  const { result } = renderHook(useLocalClock)
  vi.setSystemTime(new Date(2026, 9, 16, 9))
  act(() => window.dispatchEvent(new Event('focus')))
  expect(dayKey(result.current)).toBe('2026-10-16')
})
