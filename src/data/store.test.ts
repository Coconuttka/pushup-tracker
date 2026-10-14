import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PushupDatabase, SessionStore } from './store'
import { createSession } from '../domain/session'
import { serializeBackup } from '../domain/backup'
import { calculateStatistics } from '../domain/statistics'

let database: PushupDatabase
let store: SessionStore
beforeEach(() => {
  database = new PushupDatabase(`test-${crypto.randomUUID()}`)
  store = new SessionStore(database)
})
afterEach(async () => {
  await database.delete()
})

describe('durable session operations', () => {
  it('creates exactly one record with a UUID, timestamp and reps', async () => {
    const before = Date.now()
    const session = await store.create(25)
    expect(session.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(session.createdAt).toBeGreaterThanOrEqual(before)
    expect(session.createdAt).toBeLessThanOrEqual(Date.now())
    expect(await database.sessions.toArray()).toEqual([session])
  })

  it('rejects zero, fractional and invalid counts without writing', async () => {
    for (const value of [0, -1, 2.5, NaN, Infinity, 1_000_001])
      await expect(store.create(value)).rejects.toThrow()
    expect(await database.sessions.count()).toBe(0)
  })

  it('assigns different IDs to sessions made in the same millisecond', async () => {
    const results = await Promise.all([store.create(10), store.create(10)])
    expect(results[0].id).not.toBe(results[1].id)
    expect(await database.sessions.count()).toBe(2)
  })

  it('survives closing and reopening the database', async () => {
    const saved = await store.create(30)
    const name = database.name
    database.close()
    database = new PushupDatabase(name)
    expect(await database.sessions.get(saved.id)).toEqual(saved)
  })

  it('edits counts while preserving identity and date, updating derived stats', async () => {
    const saved = await store.create(20)
    await store.edit(saved.id, 35)
    const sessions = await database.sessions.toArray()
    expect(sessions).toEqual([{ ...saved, reps: 35 }])
    expect(calculateStatistics(sessions).today).toEqual({ total: 35, count: 1 })
  })

  it('rejects invalid edits and missing records', async () => {
    const saved = await store.create(20)
    await expect(store.edit(saved.id, 0)).rejects.toThrow()
    await expect(store.edit(crypto.randomUUID(), 15)).rejects.toThrow(/no longer exists/)
    expect(await database.sessions.get(saved.id)).toEqual(saved)
  })

  it('deletes only the selected session and updates statistics', async () => {
    const first = await store.create(20)
    const second = await store.create(30)
    await store.remove(first.id)
    const sessions = await database.sessions.toArray()
    expect(sessions).toEqual([second])
    expect(calculateStatistics(sessions).allTime).toEqual({ total: 30, count: 1 })
  })
})

describe('atomic backup import and export', () => {
  it('imports sessions and skips all identical duplicate IDs', async () => {
    const a = createSession(20)
    const b = createSession(30)
    await database.sessions.add(a)
    expect(await store.import(serializeBackup([a, b, b]))).toEqual({ imported: 1, skipped: 2 })
    expect(await database.sessions.count()).toBe(2)
    expect(await store.import(serializeBackup([a, b]))).toEqual({ imported: 0, skipped: 2 })
  })

  it('rejects conflicting edits atomically, including earlier new records', async () => {
    const saved = await store.create(20)
    await expect(
      store.import(serializeBackup([createSession(50), { ...saved, reps: 30 }])),
    ).rejects.toThrow(/Conflicting/)
    expect(await database.sessions.toArray()).toEqual([saved])
  })

  it('validates the entire backup before writing anything', async () => {
    const original = await store.create(10)
    const invalid = JSON.parse(serializeBackup([createSession(30), createSession(40)]))
    invalid.sessions[1].reps = 0
    await expect(store.import(JSON.stringify(invalid))).rejects.toThrow()
    expect(await database.sessions.toArray()).toEqual([original])
  })

  it('exports all durable records and restores them losslessly', async () => {
    const sessions = await Promise.all([store.create(20), store.create(30)])
    const backup = await store.export()
    await database.sessions.clear()
    await store.import(backup)
    expect((await database.sessions.toArray()).sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      sessions.sort((a, b) => a.id.localeCompare(b.id)),
    )
  })

  it('handles two concurrent imports without duplicate records', async () => {
    const backup = serializeBackup([createSession(30)])
    const results = await Promise.all([store.import(backup), store.import(backup)])
    expect(await database.sessions.count()).toBe(1)
    expect(results.map((result) => result.imported).sort()).toEqual([0, 1])
  })
})
