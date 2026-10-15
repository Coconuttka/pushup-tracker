import type { CloudDatabase } from './cloudStore'
import {
  FRIEND_DIRECTORY_REALM,
  PROGRESS_REALM_KIND,
  progressRealmId,
  validateSharing,
} from '../domain/sharing'
import type { FriendProgress } from '../domain/sharing'
import { validateSession } from '../domain/session'

export class FriendsStore {
  constructor(
    readonly database: CloudDatabase,
    readonly userId: string,
  ) {}

  private assertAccount() {
    const user = this.database.cloud.currentUser.value
    if (!user.isLoggedIn || user.userId !== this.userId)
      throw new Error('Your account changed. Reopen Friends and try again.')
  }

  async snapshot() {
    this.assertAccount()
    const [directory, preference, realms, members] = await Promise.all([
      this.database.friendDirectory.toArray(),
      this.database.sharingPreferences.get(this.userId),
      this.database.realms.toArray(),
      this.database.members.toArray(),
    ])
    const approved = directory.filter((entry) => entry.realmId === FRIEND_DIRECTORY_REALM)
    const memberships = members.filter(
      (member) => member.realmId === progressRealmId(this.userId) && member.userId !== this.userId,
    )
    const peers: FriendProgress[] = []
    for (const realm of realms) {
      if (
        realm.represents !== PROGRESS_REALM_KIND ||
        realm.owner === this.userId ||
        realm.realmId !== progressRealmId(realm.owner) ||
        !approved.some((entry) => entry.id === realm.owner) ||
        !members.some(
          (member) =>
            member.realmId === realm.realmId &&
            member.userId === this.userId &&
            member.accepted &&
            !member.rejected,
        )
      )
        continue
      const rows = await this.database.workouts.where('owner').equals(realm.owner).toArray()
      peers.push({
        id: realm.owner,
        realmId: realm.realmId,
        name: realm.name,
        sessions: rows
          .filter((row) => row.realmId === realm.realmId && !row.deleted)
          .map(validateSession)
          .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)),
      })
    }
    peers.sort((a, b) => a.name.localeCompare(b.name))
    return { directory: approved, preference, peers, memberships }
  }

  async share(name: string, recipients: string[]) {
    this.assertAccount()
    const directory = await this.database.friendDirectory.toArray()
    const sharing = validateSharing(
      name,
      recipients,
      directory
        .filter((entry) => entry.realmId === FRIEND_DIRECTORY_REALM)
        .map((entry) => entry.id),
      this.userId,
    )
    const realmId = progressRealmId(this.userId)
    await this.database.transaction(
      'rw',
      [
        this.database.workouts,
        this.database.sharingPreferences,
        this.database.realms,
        this.database.members,
      ],
      async () => {
        const previous = await this.database.sharingPreferences.get(this.userId)
        if (previous?.enabled) throw new Error('Stop the existing share before starting a new one.')
        await this.database.realms.put({
          realmId,
          owner: this.userId,
          name: sharing.name,
          represents: PROGRESS_REALM_KIND,
        })
        const previousMembers = await this.database.members
          .where('realmId')
          .equals(realmId)
          .primaryKeys()
        if (previousMembers.length) await this.database.members.bulkDelete(previousMembers)
        await this.database.members.bulkAdd(
          sharing.recipients.map((email) => ({ realmId, email, invite: true, permissions: {} })),
        )
        await this.database.workouts
          .where('owner')
          .equals(this.userId)
          .filter((row) => !row.deleted)
          .modify({ realmId })
        await this.database.sharingPreferences.put({
          id: this.userId,
          enabled: true,
          name: sharing.name,
          owner: this.userId,
          realmId: this.userId,
        })
      },
    )
  }

  async stopSharing() {
    this.assertAccount()
    const realmId = progressRealmId(this.userId)
    await this.database.transaction(
      'rw',
      [this.database.workouts, this.database.sharingPreferences, this.database.members],
      async () => {
        await this.database.members.where('realmId').equals(realmId).delete()
        await this.database.workouts
          .where('owner')
          .equals(this.userId)
          .modify({ realmId: this.userId })
        const previous = await this.database.sharingPreferences.get(this.userId)
        await this.database.sharingPreferences.put({
          id: this.userId,
          enabled: false,
          name: previous?.name || '',
          owner: this.userId,
          realmId: this.userId,
        })
      },
    )
  }

  async reconcile() {
    this.assertAccount()
    await this.database.transaction(
      'rw',
      this.database.workouts,
      this.database.sharingPreferences,
      async () => {
        const preference = await this.database.sharingPreferences.get(this.userId)
        if (!preference) return
        const desired = preference.enabled ? progressRealmId(this.userId) : this.userId
        const source = preference.enabled ? this.userId : progressRealmId(this.userId)
        const deletedShared = this.database.workouts
          .where('owner')
          .equals(this.userId)
          .filter((row) => row.deleted && row.realmId === progressRealmId(this.userId))
        if (await deletedShared.count()) await deletedShared.modify({ realmId: this.userId })
        const rows = this.database.workouts
          .where('owner')
          .equals(this.userId)
          .filter((row) => !row.deleted && row.realmId === source)
        if (await rows.count()) await rows.modify({ realmId: desired })
      },
    )
  }
}
