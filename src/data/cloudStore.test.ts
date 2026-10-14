import Dexie, { type EntityTable } from 'dexie'
import { BehaviorSubject } from 'rxjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CloudSessionStore, type CloudDatabase, type CloudSession } from './cloudStore'
import { createSession } from '../domain/session'
import { parseBackup, serializeBackup } from '../domain/backup'
import { calculateStatistics } from '../domain/statistics'

class TestDatabase extends Dexie {
  workouts!: EntityTable<CloudSession, 'key'>
  constructor() {
    super(`cloud-test-${crypto.randomUUID()}`)
    this.version(1).stores({ workouts: 'key, owner, createdAt' })
  }
}

let db: TestDatabase
let store: CloudSessionStore
const account = 'first@example.com'
let currentUser: BehaviorSubject<{ userId: string; isLoggedIn: boolean }>
beforeEach(() => {
  db = new TestDatabase()
  currentUser = new BehaviorSubject<{ userId: string; isLoggedIn: boolean }>({
    userId: account,
    isLoggedIn: true,
  })
  Object.defineProperty(db, 'cloud', { value: { currentUser } })
  store = new CloudSessionStore(db as unknown as CloudDatabase, account)
})
afterEach(async () => {
  await db.delete()
})

describe('account storage', () => {
  it('saves sessions with private ownership and a stable account-scoped key', async () => {
    const saved = await store.create(25)
    const record = await db.workouts.get(`${account}:${saved.id}`)
    expect(record).toEqual({
      ...saved,
      key: `${account}:${saved.id}`,
      owner: account,
      realmId: account,
      deleted: false,
    })
    expect(await store.list()).toEqual([saved])
    expect(calculateStatistics(await store.list()).allTime.total).toBe(25)
  })
  it('never returns another account’s cached records or shared realms', async () => {
    const own = await store.create(10)
    const other = createSession(80)
    await db.workouts.add({
      ...other,
      key: `other:${other.id}`,
      owner: 'other',
      realmId: 'other',
      deleted: false,
    })
    const shared = createSession(90)
    await db.workouts.add({
      ...shared,
      key: `shared:${shared.id}`,
      owner: account,
      realmId: 'shared',
      deleted: false,
    })
    expect(await store.list()).toEqual([own])
  })
  it('keeps edits reactive and deletions durable against repeated imports and migration', async () => {
    const saved = await store.create(20)
    await store.edit(saved.id, 40)
    expect((await store.list())[0]).toEqual({ ...saved, reps: 40 })
    await store.remove(saved.id)
    await expect(store.edit(saved.id, 30)).rejects.toThrow(/no longer exists/)
    expect(await store.import(serializeBackup([saved]))).toEqual({ imported: 0, skipped: 1 })
    expect(await store.copyDeviceHistory([saved])).toEqual({ imported: 0, skipped: 1 })
    expect(await store.list()).toEqual([])
    expect((await db.workouts.get(`${account}:${saved.id}`))?.deleted).toBe(true)
  })
  it('rejects writes and reads after the authenticated account changes', async () => {
    const saved = await store.create(10)
    currentUser.next({ userId: 'other', isLoggedIn: true })
    await expect(store.create(20)).rejects.toThrow(/account changed/)
    await expect(store.edit(saved.id, 30)).rejects.toThrow(/account changed/)
    await expect(store.remove(saved.id)).rejects.toThrow(/account changed/)
    await expect(store.list()).rejects.toThrow(/account changed/)
    await expect(store.import(serializeBackup([createSession(40)]))).rejects.toThrow(
      /account changed/,
    )
    expect(await db.workouts.count()).toBe(1)
  })
  it('copies legacy sessions idempotently and preserves newer account edits', async () => {
    const old = createSession(20)
    const extra = createSession(15)
    await store.copyDeviceHistory([old])
    await store.edit(old.id, 50)
    expect(await store.copyDeviceHistory([old, extra])).toEqual({ imported: 1, skipped: 1 })
    expect((await store.list()).find((session) => session.id === old.id)?.reps).toBe(50)
    expect(await store.copyDeviceHistory([old, extra])).toEqual({ imported: 0, skipped: 2 })
  })
  it('does not leak ownership, credentials or deletion markers in backups', async () => {
    const saved = await store.create(20)
    const removed = await store.create(30)
    await store.remove(removed.id)
    const backup = parseBackup(await store.export())
    expect(backup.sessions).toEqual([saved])
    expect(await store.export()).not.toContain(account)
    expect(Object.keys(backup.sessions[0]).sort()).toEqual(['createdAt', 'id', 'reps'])
  })
  it('atomically rejects conflicting or invalid backups', async () => {
    const saved = await store.create(20)
    await expect(
      store.import(serializeBackup([createSession(30), { ...saved, reps: 40 }])),
    ).rejects.toThrow(/Conflicting/)
    await expect(store.import(serializeBackup([{ ...saved, reps: 0 }]))).rejects.toThrow()
    expect(await store.list()).toEqual([saved])
  })
  it('handles simultaneous copies without double-counting', async () => {
    const saved = createSession(30)
    const results = await Promise.all([
      store.copyDeviceHistory([saved]),
      store.copyDeviceHistory([saved]),
    ])
    expect(results.map((result) => result.imported).sort()).toEqual([0, 1])
    expect((await store.list()).length).toBe(1)
  })
  it('allows two accounts to import the same original UUID without an ownership collision', async () => {
    const saved = createSession(10)
    await store.copyDeviceHistory([saved])
    currentUser.next({ userId: 'second', isLoggedIn: true })
    const second = new CloudSessionStore(db as unknown as CloudDatabase, 'second')
    await second.copyDeviceHistory([saved])
    expect(await db.workouts.count()).toBe(2)
    expect(await second.list()).toEqual([saved])
  })
})
