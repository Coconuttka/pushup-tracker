import Dexie, { type EntityTable } from 'dexie'
import { BehaviorSubject } from 'rxjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FriendsStore } from './friendsStore'
import { CloudSessionStore, type CloudDatabase, type CloudSession } from './cloudStore'
import {
  FRIEND_DIRECTORY_REALM,
  PROGRESS_REALM_KIND,
  progressRealmId,
  type FriendDirectoryEntry,
  type SharingPreference,
} from '../domain/sharing'
import { createSession } from '../domain/session'
import { parseBackup } from '../domain/backup'

class TestDatabase extends Dexie {
  workouts!: EntityTable<CloudSession, 'key'>
  friendDirectory!: EntityTable<FriendDirectoryEntry, 'id'>
  sharingPreferences!: EntityTable<SharingPreference, 'id'>
  constructor() {
    super(`friends-test-${crypto.randomUUID()}`)
    this.version(1).stores({
      workouts: 'key, owner, createdAt',
      friendDirectory: 'id',
      sharingPreferences: 'id',
      realms: 'realmId',
      members: 'id, realmId, [email+realmId]',
    })
    this.members.hook('creating', (key) => key || `mmb-${crypto.randomUUID()}`)
  }
}

const first = 'first@example.com'
const second = 'second@example.com'
let db: TestDatabase
let friends: FriendsStore
let sessions: CloudSessionStore
let currentUser: BehaviorSubject<{ userId: string; isLoggedIn: boolean }>
beforeEach(async () => {
  db = new TestDatabase()
  currentUser = new BehaviorSubject<{ userId: string; isLoggedIn: boolean }>({
    userId: first,
    isLoggedIn: true,
  })
  Object.defineProperty(db, 'cloud', { value: { currentUser } })
  friends = new FriendsStore(db as unknown as CloudDatabase, first)
  sessions = new CloudSessionStore(db as unknown as CloudDatabase, first)
  await db.friendDirectory.bulkAdd([
    { id: first, name: 'First', realmId: FRIEND_DIRECTORY_REALM, owner: null },
    { id: second, name: 'Second', realmId: FRIEND_DIRECTORY_REALM, owner: null },
  ])
})
afterEach(async () => {
  await db.delete()
})

describe('opt-in friend sharing', () => {
  it('keeps workouts private until sharing and moves existing history without duplicating sessions', async () => {
    const saved = await sessions.create(20)
    expect((await db.workouts.toArray())[0].realmId).toBe(first)
    expect((await friends.snapshot()).preference).toBeUndefined()
    await friends.share(' First person ', [second])
    expect(await sessions.list()).toEqual([saved])
    expect(await db.workouts.count()).toBe(1)
    expect((await db.workouts.toArray())[0].realmId).toBe(progressRealmId(first))
    expect((await db.sharingPreferences.get(first))?.enabled).toBe(true)
    const membership = (await db.members.toArray())[0]
    expect(membership.email).toBe(second)
    expect(membership.invite).toBe(true)
    expect(membership.permissions).toEqual({})
    expect(membership.accepted).toBeUndefined()
    expect(membership.userId).toBeUndefined()
  })
  it('puts future and imported sessions in the shared realm while retaining private ownership', async () => {
    await friends.share('First', [second])
    const saved = await sessions.create(10)
    const imported = createSession(30)
    await sessions.copyDeviceHistory([imported])
    expect(await db.workouts.count()).toBe(2)
    for (const row of await db.workouts.toArray()) {
      expect(row.owner).toBe(first)
      expect(row.realmId).toBe(progressRealmId(first))
    }
    expect(
      parseBackup(await sessions.export())
        .sessions.map((row) => row.id)
        .sort(),
    ).toEqual([saved.id, imported.id].sort())
  })
  it('revokes memberships, retains workouts and deletion markers, and makes future saves private', async () => {
    const saved = await sessions.create(20)
    const deleted = await sessions.create(10)
    await sessions.remove(deleted.id)
    await friends.share('First', [second])
    await friends.stopSharing()
    expect(await db.members.count()).toBe(0)
    expect((await db.sharingPreferences.get(first))?.enabled).toBe(false)
    expect(await sessions.list()).toEqual([saved])
    expect((await db.workouts.get(`${first}:${deleted.id}`))?.deleted).toBe(true)
    await sessions.create(40)
    expect((await db.workouts.toArray()).every((row) => row.realmId === first)).toBe(true)
    await friends.share('First again', [second])
    expect(await db.members.count()).toBe(1)
    expect((await db.members.toArray())[0].invite).toBe(true)
  })
  it('does not move or include anyone else’s private history when sharing', async () => {
    const own = await sessions.create(20)
    const other = createSession(75)
    await db.workouts.add({
      ...other,
      key: `${second}:${other.id}`,
      owner: second,
      realmId: second,
      deleted: false,
    })
    await friends.share('First', [second])
    expect((await db.workouts.get(`${second}:${other.id}`))?.realmId).toBe(second)
    expect(await sessions.list()).toEqual([own])
    expect(parseBackup(await sessions.export()).sessions).toEqual([own])
  })
  it('only displays approved owners in their matching shared realm, excluding deleted and private rows', async () => {
    await db.realms.put({
      realmId: progressRealmId(second),
      owner: second,
      name: 'Friend',
      represents: PROGRESS_REALM_KIND,
    })
    const shared = createSession(30)
    const privateRow = createSession(40)
    const deleted = createSession(50)
    await db.workouts.bulkAdd([
      {
        ...shared,
        key: `friend:${shared.id}`,
        owner: second,
        realmId: progressRealmId(second),
        deleted: false,
      },
      {
        ...privateRow,
        key: `private:${privateRow.id}`,
        owner: second,
        realmId: second,
        deleted: false,
      },
      {
        ...deleted,
        key: `deleted:${deleted.id}`,
        owner: second,
        realmId: progressRealmId(second),
        deleted: true,
      },
    ])
    expect((await friends.snapshot()).peers).toEqual([])
    const membershipId = await db.members.add({
      realmId: progressRealmId(second),
      userId: first,
      email: first,
      owner: second,
      accepted: new Date(),
      permissions: {},
    })
    expect((await friends.snapshot()).peers).toEqual([
      { id: second, realmId: progressRealmId(second), name: 'Friend', sessions: [shared] },
    ])
    await db.members.delete(membershipId)
    expect((await friends.snapshot()).peers).toEqual([])
    await db.members.add({
      realmId: progressRealmId(second),
      userId: first,
      email: first,
      owner: second,
      accepted: new Date(),
      permissions: {},
    })
    await db.friendDirectory.delete(second)
    expect((await friends.snapshot()).peers).toEqual([])
  })
  it('reconciles sessions from an older or offline device without reviving deleted sessions', async () => {
    await friends.share('First', [second])
    const saved = await sessions.create(20)
    await db.workouts.update(`${first}:${saved.id}`, { realmId: first })
    await friends.reconcile()
    expect((await db.workouts.get(`${first}:${saved.id}`))?.realmId).toBe(progressRealmId(first))
    await sessions.remove(saved.id)
    expect((await db.workouts.get(`${first}:${saved.id}`))?.realmId).toBe(first)
    expect(await sessions.list()).toEqual([])
    await friends.stopSharing()
    await db.workouts.update(`${first}:${saved.id}`, { realmId: progressRealmId(first) })
    await friends.reconcile()
    expect((await db.workouts.get(`${first}:${saved.id}`))?.realmId).toBe(first)
    expect(await db.members.count()).toBe(0)
  })
  it('never shares sessions deleted before opting in', async () => {
    const removed = await sessions.create(10)
    await sessions.remove(removed.id)
    await friends.share('First', [second])
    expect((await db.workouts.get(`${first}:${removed.id}`))?.realmId).toBe(first)
    await friends.reconcile()
    expect((await db.workouts.get(`${first}:${removed.id}`))?.realmId).toBe(first)
  })
  it('rejects unapproved recipients, self sharing, empty names and repeated sharing without writes', async () => {
    const saved = await sessions.create(10)
    for (const [name, recipients] of [
      ['First', ['outside@example.com']],
      ['First', [first]],
      ['', [second]],
      ['First', []],
    ] as const)
      await expect(friends.share(name, [...recipients])).rejects.toThrow()
    expect(await db.members.count()).toBe(0)
    expect(await db.realms.count()).toBe(0)
    expect(await sessions.list()).toEqual([saved])
    await friends.share('First', [second])
    await expect(friends.share('First', [second])).rejects.toThrow(/Stop the existing share/)
    expect(await db.members.count()).toBe(1)
  })
  it('rejects all sharing actions after the authenticated account changes', async () => {
    currentUser.next({ userId: second, isLoggedIn: true })
    await expect(friends.snapshot()).rejects.toThrow(/account changed/)
    await expect(friends.share('First', [second])).rejects.toThrow(/account changed/)
    await expect(friends.stopSharing()).rejects.toThrow(/account changed/)
    await expect(friends.reconcile()).rejects.toThrow(/account changed/)
    expect(await db.members.count()).toBe(0)
  })
})
