import { afterEach, describe, expect, it, vi } from 'vitest'
import { BehaviorSubject } from 'rxjs'
import type { CloudDatabase } from './cloudStore'
import { watchSyncRecovery } from './syncRecovery'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('recovery after an offline reload', () => {
  function fixture() {
    const sync = vi.fn().mockResolvedValue(undefined)
    const currentUser = new BehaviorSubject({ isLoggedIn: true })
    const syncState = new BehaviorSubject({ status: 'error', phase: 'in-sync' })
    const database = { cloud: { currentUser, syncState, sync } } as unknown as CloudDatabase
    return { database, sync, currentUser, syncState }
  }
  it('pulls on reconnect and retries a broken live connection, without polling a healthy connection', async () => {
    vi.useFakeTimers()
    const { database, sync, syncState } = fixture()
    const stop = watchSyncRecovery(database)
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(sync).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(sync).toHaveBeenCalledTimes(2)
    syncState.next({ status: 'connected', phase: 'in-sync' })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sync).toHaveBeenCalledTimes(2)
    stop()
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(sync).toHaveBeenCalledTimes(2)
  })
  it('does not overlap syncs, sync offline, or sync a signed-out account', async () => {
    vi.useFakeTimers()
    const { database, sync, currentUser } = fixture()
    let finish!: () => void
    sync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const stop = watchSyncRecovery(database)
    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(sync).toHaveBeenCalledOnce()
    finish()
    await vi.advanceTimersByTimeAsync(0)
    currentUser.next({ isLoggedIn: false })
    window.dispatchEvent(new Event('online'))
    expect(sync).toHaveBeenCalledOnce()
    currentUser.next({ isLoggedIn: true })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(sync).toHaveBeenCalledOnce()
    stop()
  })
})
