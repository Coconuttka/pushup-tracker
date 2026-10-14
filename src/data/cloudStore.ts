import Dexie, { type EntityTable } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'
import type { SessionRepository } from './repository'
import {
  createSession,
  historicalTimestamp,
  sameSession,
  validateReps,
  validateSession,
} from '../domain/session'
import type { Session } from '../domain/session'
import { parseBackup, serializeBackup } from '../domain/backup'
import {
  progressRealmId,
  type FriendDirectoryEntry,
  type SharingPreference,
} from '../domain/sharing'

export interface CloudSession extends Session {
  key: string
  owner: string
  realmId: string
  deleted: boolean
}

export class CloudDatabase extends Dexie {
  workouts!: EntityTable<CloudSession, 'key'>
  friendDirectory!: EntityTable<FriendDirectoryEntry, 'id'>
  sharingPreferences!: EntityTable<SharingPreference, 'id'>

  constructor(databaseUrl: string, name = 'pushup-accounts') {
    super(name, { addons: [dexieCloud] })
    this.version(1).stores({ workouts: 'key, owner, createdAt' })
    this.version(2).stores({
      friendDirectory: 'id',
      sharingPreferences: 'id',
      realms: '@realmId',
      members: '@id, realmId, [email+realmId]',
      roles: '[realmId+name]',
    })
    this.cloud.configure({
      databaseUrl,
      customLoginGui: true,
      requireAuth: false,
      socialAuth: false,
      tryUseServiceWorker: false,
    })
  }
}

export class CloudSessionStore implements SessionRepository {
  constructor(
    readonly database: CloudDatabase,
    readonly userId: string,
  ) {}

  private assertAccount() {
    const user = this.database.cloud.currentUser.value
    if (!user.isLoggedIn || user.userId !== this.userId)
      throw new Error('Your account changed. Reopen the app before saving.')
  }

  private key(id: string) {
    return `${this.userId}:${id}`
  }

  private record(session: Session, shared = false): CloudSession {
    return {
      ...validateSession(session),
      key: this.key(session.id),
      owner: this.userId,
      realmId: shared ? progressRealmId(this.userId) : this.userId,
      deleted: false,
    }
  }

  async list(): Promise<Session[]> {
    this.assertAccount()
    const records = await this.database.workouts.where('owner').equals(this.userId).toArray()
    return records
      .filter(
        (record) =>
          (record.realmId === this.userId || record.realmId === progressRealmId(this.userId)) &&
          !record.deleted,
      )
      .map(validateSession)
      .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
  }

  async create(reps: number, createdAt = Date.now()): Promise<Session> {
    this.assertAccount()
    const session = createSession(reps, createdAt)
    await this.database.transaction(
      'rw',
      this.database.workouts,
      this.database.sharingPreferences,
      async () => {
        const sharing = await this.database.sharingPreferences.get(this.userId)
        await this.database.workouts.add(this.record(session, sharing?.enabled))
      },
    )
    return session
  }

  async createHistorical(reps: number, date: string, time: string): Promise<Session> {
    return this.create(reps, historicalTimestamp(date, time))
  }

  async edit(id: string, reps: number): Promise<void> {
    this.assertAccount()
    validateReps(reps)
    await this.database.transaction('rw', this.database.workouts, async () => {
      const record = await this.database.workouts.get(this.key(id))
      if (!record || record.deleted)
        throw new Error('This session no longer exists. Refresh your history and try again.')
      await this.database.workouts.update(record.key, { reps })
    })
  }

  async remove(id: string): Promise<void> {
    this.assertAccount()
    await this.database.workouts.update(this.key(id), { deleted: true, realmId: this.userId })
  }

  async export(): Promise<string> {
    return serializeBackup(await this.list())
  }

  async import(text: string): Promise<{ imported: number; skipped: number }> {
    return this.merge(parseBackup(text).sessions, false)
  }

  async copyDeviceHistory(sessions: Session[]) {
    return this.merge(sessions.map(validateSession), true)
  }

  private async merge(sessions: Session[], keepAccountVersion: boolean) {
    this.assertAccount()
    const unique = [...new Map(sessions.map((session) => [session.id, session])).values()]
    return this.database.transaction(
      'rw',
      this.database.workouts,
      this.database.sharingPreferences,
      async () => {
        const sharing = await this.database.sharingPreferences.get(this.userId)
        const existing = await this.database.workouts.bulkGet(
          unique.map((session) => this.key(session.id)),
        )
        const additions: CloudSession[] = []
        unique.forEach((session, index) => {
          const previous = existing[index]
          if (
            previous &&
            !previous.deleted &&
            !keepAccountVersion &&
            !sameSession(previous, session)
          )
            throw new Error('Conflicting session IDs cannot be merged. No data was imported.')
          if (!previous) additions.push(this.record(session, sharing?.enabled))
        })
        await this.database.workouts.bulkAdd(additions)
        return { imported: additions.length, skipped: sessions.length - additions.length }
      },
    )
  }
}
