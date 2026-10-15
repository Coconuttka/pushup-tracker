import { afterEach, describe, expect, it } from 'vitest'
import { CloudDatabase } from './cloudStore'
import { FriendsStore } from './friendsStore'
import { FRIEND_DIRECTORY_REALM } from '../domain/sharing'

let database: CloudDatabase | undefined
afterEach(async () => {
  if (database) await database.delete()
})

describe('Friends sync transaction', () => {
  it('does not send a membership deletion for a newly created realm', async () => {
    const userId = 'first@example.com'
    const recipient = 'second@example.com'
    database = new CloudDatabase('', `friends-sync-${crypto.randomUUID()}`)
    await database.open()
    await database.friendDirectory.bulkAdd([
      { id: userId, name: 'First', realmId: FRIEND_DIRECTORY_REALM, owner: null },
      { id: recipient, name: 'Second', realmId: FRIEND_DIRECTORY_REALM, owner: null },
    ])
    database.cloud.currentUser.next({
      ...database.cloud.currentUser.value,
      userId,
      email: userId,
      isLoggedIn: true,
    })
    const store = new FriendsStore(database, userId)
    await store.share('First', [recipient])
    const mutations = await database.table('$members_mutations').toArray()
    expect(mutations).toHaveLength(1)
    expect(mutations[0].type).toBe('insert')
    expect(mutations[0].values).toEqual([
      expect.objectContaining({ email: recipient, invite: true, permissions: {} }),
    ])
    expect(mutations.some((mutation) => mutation.type === 'delete')).toBe(false)
  })
})
