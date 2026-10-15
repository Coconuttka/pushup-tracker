import Dexie, { type EntityTable } from 'dexie'
import { BehaviorSubject } from 'rxjs'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Invite } from 'dexie-cloud-addon'
import { Friends } from './Friends'
import { FriendsStore } from '../data/friendsStore'
import type { CloudDatabase, CloudSession } from '../data/cloudStore'
import {
  FRIEND_DIRECTORY_REALM,
  PROGRESS_REALM_KIND,
  progressRealmId,
  type FriendDirectoryEntry,
  type SharingPreference,
} from '../domain/sharing'
import { createSession } from '../domain/session'

vi.mock('./ActivityChart', () => ({ default: () => <div>Activity chart</div> }))

class TestDatabase extends Dexie {
  workouts!: EntityTable<CloudSession, 'key'>
  friendDirectory!: EntityTable<FriendDirectoryEntry, 'id'>
  sharingPreferences!: EntityTable<SharingPreference, 'id'>
  constructor() {
    super(`friends-ui-${crypto.randomUUID()}`)
    this.version(1).stores({
      workouts: 'key, owner, createdAt',
      friendDirectory: 'id',
      sharingPreferences: 'id',
      realms: 'realmId',
      members: 'id, realmId',
    })
    this.members.hook('creating', (key) => key || `mmb-${crypto.randomUUID()}`)
  }
}

const first = 'first@example.com'
const second = 'second@example.com'
const now = new Date(2026, 9, 15, 12)
let db: TestDatabase
let store: FriendsStore
let sync: ReturnType<typeof vi.fn>
beforeEach(async () => {
  db = new TestDatabase()
  sync = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(db, 'cloud', {
    value: { sync, currentUser: new BehaviorSubject({ userId: first, isLoggedIn: true }) },
  })
  store = new FriendsStore(db as unknown as CloudDatabase, first)
  await db.friendDirectory.bulkAdd([
    { id: first, name: 'First', owner: null, realmId: FRIEND_DIRECTORY_REALM },
    { id: second, name: 'Second', owner: null, realmId: FRIEND_DIRECTORY_REALM },
  ])
})
afterEach(async () => {
  await db.delete()
})

describe('Friends sharing workflow', () => {
  it('requires acceptance before showing progress and never shares the recipient’s own sessions automatically', async () => {
    const realmId = progressRealmId(second)
    const session = createSession(35, now.getTime())
    await db.realms.add({ realmId, owner: second, name: 'Second', represents: PROGRESS_REALM_KIND })
    const invite = {
      id: 'invitation',
      owner: second,
      realmId,
      email: first,
      realm: { realmId, owner: second, name: 'Second', represents: PROGRESS_REALM_KIND },
      accept: vi.fn(async () => {
        await db.members.put({
          id: 'invitation',
          realmId,
          userId: first,
          owner: second,
          accepted: new Date(),
          permissions: {},
        })
        await db.workouts.put({
          ...session,
          key: `${second}:${session.id}`,
          owner: second,
          realmId,
          deleted: false,
        })
      }),
      reject: vi.fn(),
    } as unknown as Invite
    render(
      <Friends
        store={store}
        invites={[invite]}
        now={now}
        ownSessions={[]}
        online
        onSignIn={vi.fn()}
        notify={vi.fn()}
      />,
    )
    const invitation = await screen.findByRole('region', { name: 'Friend invitation' })
    expect(screen.queryByRole('region', { name: 'Second’s progress' })).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(within(invitation).getByRole('button', { name: 'Accept invitation' }))
    expect(await screen.findByRole('region', { name: 'Second’s progress' })).toBeVisible()
    const history = screen.getByRole('region', { name: 'Second’s session history' })
    expect(within(history).getByText('35')).toBeVisible()
    expect(within(history).queryByRole('button', { name: /Edit|Delete/ })).not.toBeInTheDocument()
    expect(screen.getByText('Your workouts are private. Share when you’re ready.')).toBeVisible()
    expect(await db.sharingPreferences.get(first)).toBeUndefined()
    expect(invite.accept).toHaveBeenCalledOnce()
    expect(invite.reject).not.toHaveBeenCalled()
  })
  it('requires an explicit review, saves one invitation on a double tap, and confirms stopping sharing', async () => {
    render(
      <Friends
        store={store}
        now={now}
        ownSessions={[]}
        online
        onSignIn={vi.fn()}
        notify={vi.fn()}
      />,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Share my progress' }))
    const review = screen.getByRole('dialog', { name: 'A little motivation, shared.' })
    expect(within(review).getByRole('checkbox', { name: /Second/ })).toBeChecked()
    expect(await db.members.count()).toBe(0)
    await user.dblClick(within(review).getByRole('button', { name: 'Share and invite' }))
    const stop = await screen.findByRole('button', { name: 'Stop sharing my workouts' })
    expect(await db.members.count()).toBe(1)
    await user.click(stop)
    expect((await db.sharingPreferences.get(first))?.enabled).toBe(true)
    const confirmation = screen.getByRole('dialog', { name: 'Stop sharing your progress?' })
    await user.click(within(confirmation).getByRole('button', { name: 'Stop sharing' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Share my progress' })).toBeVisible(),
    )
    expect(await db.members.count()).toBe(0)
    expect((await db.sharingPreferences.get(first))?.enabled).toBe(false)
  })
  it('shows sync failures inside the review and does not create invitations before the initial sync succeeds', async () => {
    sync.mockRejectedValue(new Error('Could not connect to sync.'))
    render(
      <Friends
        store={store}
        now={now}
        ownSessions={[]}
        online
        onSignIn={vi.fn()}
        notify={vi.fn()}
      />,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Share my progress' }))
    const review = screen.getByRole('dialog', { name: 'A little motivation, shared.' })
    await user.click(within(review).getByRole('button', { name: 'Share and invite' }))
    expect(await within(review).findByRole('alert')).toHaveTextContent('Could not connect to sync.')
    expect(await db.members.count()).toBe(0)
    expect(await db.sharingPreferences.get(first)).toBeUndefined()
  })
  it('reports a server rollback instead of showing a successful share', async () => {
    sync.mockImplementation(async ({ purpose }: { purpose: string }) => {
      if (purpose === 'push') {
        await db.members.clear()
        await db.realms.clear()
        await db.sharingPreferences.clear()
      }
    })
    const notify = vi.fn()
    render(
      <Friends
        store={store}
        now={now}
        ownSessions={[]}
        online
        onSignIn={vi.fn()}
        notify={notify}
      />,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Share my progress' }))
    const review = screen.getByRole('dialog', { name: 'A little motivation, shared.' })
    await user.click(within(review).getByRole('button', { name: 'Share and invite' }))
    expect(await within(review).findByRole('alert')).toHaveTextContent(
      'The server did not accept this sharing change. Please try again.',
    )
    expect(notify).not.toHaveBeenCalled()
    expect(within(review).getByRole('button', { name: 'Share and invite' })).toBeEnabled()
  })
})
