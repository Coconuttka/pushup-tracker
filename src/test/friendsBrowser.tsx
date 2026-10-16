import Dexie from 'dexie'
import { createRoot } from 'react-dom/client'
import App from '../App'
import { CloudSessionStore, type CloudDatabase } from '../data/cloudStore'
import { FriendsStore } from '../data/friendsStore'
import { FRIEND_DIRECTORY_REALM, PROGRESS_REALM_KIND, progressRealmId } from '../domain/sharing'
import '../styles.css'

const userId = 'you@example.com'
const friendId = 'friend@example.com'
const name = new URLSearchParams(location.search).has('longName') ? 'Alex'.repeat(10) : 'Alex'
const realmId = progressRealmId(friendId)
const database = new Dexie('friends-browser-fixture')
database.version(1).stores({
  workouts: 'key, owner, createdAt',
  friendDirectory: 'id',
  sharingPreferences: 'id',
  realms: 'realmId',
  members: 'id, realmId',
})
Object.defineProperty(database, 'cloud', {
  value: { currentUser: { value: { userId, isLoggedIn: true } } },
})

await database.table('friendDirectory').bulkPut([
  { id: userId, name: 'You', realmId: FRIEND_DIRECTORY_REALM, owner: null },
  { id: friendId, name: 'Alex', realmId: FRIEND_DIRECTORY_REALM, owner: null },
])
await database.table('sharingPreferences').put({
  id: userId,
  enabled: true,
  name: 'You',
  owner: userId,
  realmId: userId,
})
await database
  .table('realms')
  .put({ realmId, owner: friendId, name, represents: PROGRESS_REALM_KIND })
await database.table('members').bulkPut([
  { id: 'incoming', realmId, userId, owner: friendId, accepted: new Date(), permissions: {} },
  {
    id: 'outgoing',
    realmId: progressRealmId(userId),
    userId: friendId,
    email: friendId,
    owner: userId,
    accepted: new Date(),
    permissions: {},
  },
])
await database.table('workouts').bulkPut(
  Array.from({ length: 13 }, (_, index) => {
    const date = new Date()
    date.setHours(8, 0, 0, 0)
    date.setDate(date.getDate() - index)
    const id = crypto.randomUUID()
    return {
      id,
      key: `${friendId}:${id}`,
      owner: friendId,
      realmId,
      deleted: false,
      createdAt: date.getTime(),
      reps: 20 + index,
    }
  }),
)

const cloudDatabase = database as CloudDatabase
createRoot(document.getElementById('root')!).render(
  <App
    store={new CloudSessionStore(cloudDatabase, userId)}
    friendsStore={new FriendsStore(cloudDatabase, userId)}
  />,
)
