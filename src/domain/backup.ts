import { MAX_BACKUP_BYTES, MAX_IMPORT_SESSIONS, sameSession, validateSession } from './session'
import type { Session } from './session'

export interface Backup {
  app: 'pushup-tracker'
  version: 1
  exportedAt: string
  sessions: Session[]
}

export function serializeBackup(sessions: readonly Session[], now = new Date()): string {
  return JSON.stringify(
    { app: 'pushup-tracker', version: 1, exportedAt: now.toISOString(), sessions },
    null,
    2,
  )
}

export function parseBackup(text: string): Backup {
  if (new Blob([text]).size > MAX_BACKUP_BYTES)
    throw new Error('This file is too large. Choose a JSON backup smaller than 10 MB.')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON. Choose a Pushup backup file.')
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('This is not a Pushup backup.')
  const data = parsed as Record<string, unknown>
  if (data.app !== 'pushup-tracker' || data.version !== 1)
    throw new Error('Unsupported backup. Use a Pushup version 1 backup.')
  if (typeof data.exportedAt !== 'string' || !Number.isFinite(Date.parse(data.exportedAt)))
    throw new Error('The backup export date is invalid.')
  if (!Array.isArray(data.sessions) || data.sessions.length > MAX_IMPORT_SESSIONS)
    throw new Error('A backup must contain an array of up to 100,000 sessions.')
  const unique = new Map<string, Session>()
  const sessions = data.sessions.map((value, index) => {
    let session: Session
    try {
      session = validateSession(value)
    } catch (error) {
      throw new Error(
        `Session ${index + 1}: ${error instanceof Error ? error.message : 'Invalid session.'}`,
        { cause: error },
      )
    }
    const previous = unique.get(session.id)
    if (previous && !sameSession(previous, session))
      throw new Error(`Conflicting records share session ID ${session.id}. No data was imported.`)
    unique.set(session.id, session)
    return session
  })
  return { app: 'pushup-tracker', version: 1, exportedAt: data.exportedAt, sessions }
}
