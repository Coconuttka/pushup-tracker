import { describe, expect, it } from 'vitest'
import { syncMessage } from './syncStatus'

describe('honest sync status', () => {
  it('only says synced after the SDK confirms in-sync', () => {
    expect(syncMessage({ phase: 'in-sync', status: 'connected' }, true)).toBe('All workouts synced')
    expect(syncMessage({ phase: 'not-in-sync', status: 'connected' }, true)).toMatch(/waiting/)
    expect(syncMessage({ phase: 'pushing', status: 'connected' }, true)).toMatch(/Syncing/)
    expect(syncMessage({ phase: 'in-sync', status: 'error' }, true)).toBe(
      'Workouts synced · checking for updates',
    )
  })
  it('prioritizes offline and license failures over a previously synced state', () => {
    expect(syncMessage({ phase: 'in-sync', status: 'connected' }, false)).toMatch(/when online/)
    expect(syncMessage({ phase: 'offline', status: 'offline', license: 'expired' }, true)).toMatch(
      /attention/,
    )
    expect(syncMessage({ phase: 'error', status: 'error' }, true)).toMatch(/paused/)
  })
})
