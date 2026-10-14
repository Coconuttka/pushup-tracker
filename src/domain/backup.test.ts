import { describe, expect, it } from 'vitest'
import { parseBackup, serializeBackup } from './backup'
import { createSession, MAX_REPS } from './session'

const session = createSession(25, 1_700_000_000_000)
const valid = {
  app: 'pushup-tracker',
  version: 1,
  exportedAt: '2026-10-14T12:00:00.000Z',
  sessions: [session],
}

describe('backup schema validation', () => {
  it('round trips all session data', () => {
    const text = serializeBackup([session], new Date(valid.exportedAt))
    expect(parseBackup(text)).toEqual(valid)
  })

  it('accepts an empty backup', () => {
    expect(parseBackup(serializeBackup([])).sessions).toEqual([])
  })

  it.each(['{', 'null', '[]', '42', '"text"'])(
    'rejects invalid JSON or backup roots: %s',
    (text) => {
      expect(() => parseBackup(text)).toThrow()
    },
  )

  it.each([
    { app: 'other' },
    { version: 2 },
    { exportedAt: 'yesterday' },
    { sessions: {} },
    { sessions: null },
  ])('rejects invalid backup metadata: %j', (patch) => {
    expect(() => parseBackup(JSON.stringify({ ...valid, ...patch }))).toThrow()
  })

  it.each([
    { reps: 0 },
    { reps: -1 },
    { reps: 1.5 },
    { reps: '25' },
    { reps: MAX_REPS + 1 },
    { reps: null },
    { id: 'not-a-uuid' },
    { createdAt: '2026-10-14' },
    { createdAt: -1 },
    { createdAt: 1.5 },
    { createdAt: 9e18 },
  ])('rejects invalid session fields: %j', (patch) => {
    expect(() =>
      parseBackup(JSON.stringify({ ...valid, sessions: [{ ...session, ...patch }] })),
    ).toThrow(/Session 1:/)
  })

  it('normalizes UUID case and strips unknown fields', () => {
    const backup = parseBackup(
      JSON.stringify({
        ...valid,
        sessions: [{ ...session, id: session.id.toUpperCase(), unexpected: 'ignored' }],
      }),
    )
    expect(backup.sessions).toEqual([session])
  })

  it('accepts identical duplicates for deterministic skipping', () => {
    expect(
      parseBackup(JSON.stringify({ ...valid, sessions: [session, session] })).sessions,
    ).toHaveLength(2)
  })

  it('rejects different records sharing one ID in a backup', () => {
    expect(() =>
      parseBackup(JSON.stringify({ ...valid, sessions: [session, { ...session, reps: 30 }] })),
    ).toThrow(/Conflicting/)
  })

  it('rejects oversized files and arrays', () => {
    expect(() => parseBackup(' '.repeat(10 * 1024 * 1024 + 1))).toThrow(/too large/)
    expect(() =>
      parseBackup(JSON.stringify({ ...valid, sessions: Array(100_001).fill(0) })),
    ).toThrow(/100,000/)
  })
})
