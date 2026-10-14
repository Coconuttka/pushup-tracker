import Dexie, { type EntityTable } from 'dexie'
import { createSession, historicalTimestamp, sameSession, validateReps } from '../domain/session'
import type { Session } from '../domain/session'
import { parseBackup, serializeBackup } from '../domain/backup'
import type { SessionRepository } from './repository'

export class PushupDatabase extends Dexie {
  sessions!: EntityTable<Session, 'id'>

  constructor(name = 'pushup-tracker') {
    super(name)
    this.version(1).stores({ sessions: 'id, createdAt' })
  }
}

export class SessionStore implements SessionRepository {
  constructor(readonly database: PushupDatabase) {}

  list(): Promise<Session[]> {
    return this.database.sessions.orderBy('createdAt').reverse().toArray()
  }

  async create(reps: number, createdAt = Date.now()): Promise<Session> {
    const session = createSession(reps, createdAt)
    await this.database.sessions.add(session)
    return session
  }

  async createHistorical(reps: number, date: string, time: string): Promise<Session> {
    return this.create(reps, historicalTimestamp(date, time))
  }

  async edit(id: string, reps: number): Promise<void> {
    validateReps(reps)
    await this.database.transaction('rw', this.database.sessions, async () => {
      const count = await this.database.sessions.update(id, { reps })
      if (!count)
        throw new Error('This session no longer exists. Refresh your history and try again.')
    })
  }

  async remove(id: string): Promise<void> {
    await this.database.sessions.delete(id)
  }

  async export(): Promise<string> {
    return serializeBackup(await this.database.sessions.orderBy('createdAt').toArray())
  }

  async import(text: string): Promise<{ imported: number; skipped: number }> {
    const backup = parseBackup(text)
    const unique = [...new Map(backup.sessions.map((session) => [session.id, session])).values()]
    return this.database.transaction('rw', this.database.sessions, async () => {
      const existing = await this.database.sessions.bulkGet(unique.map((session) => session.id))
      const additions: Session[] = []
      unique.forEach((session, index) => {
        const previous = existing[index]
        if (previous && !sameSession(previous, session))
          throw new Error(
            'A session in this backup was edited after the backup was created. Conflicting IDs cannot be merged. No data was imported.',
          )
        if (!previous) additions.push(session)
      })
      await this.database.sessions.bulkAdd(additions)
      return { imported: additions.length, skipped: backup.sessions.length - additions.length }
    })
  }
}

export const sessionStore = new SessionStore(new PushupDatabase())
