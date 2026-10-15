import { useMemo, useRef, useState } from 'react'
import { Eye, Flame, HeartHandshake, LockKeyhole, Users } from 'lucide-react'
import type { Invite } from 'dexie-cloud-addon'
import type { FriendsStore } from '../data/friendsStore'
import type { Session } from '../domain/session'
import { PROGRESS_REALM_KIND, progressRealmId } from '../domain/sharing'
import { calculateStatistics } from '../domain/statistics'
import { useFriends } from '../hooks/useFriends'
import { FriendProgress } from './FriendProgress'
import { ShareProgress } from './ShareProgress'
import { Modal } from './Modal'

export function Friends({
  store,
  invites = [],
  now,
  ownSessions,
  onSignIn,
  notify,
  online,
}: {
  store?: FriendsStore
  invites?: Invite[]
  now: Date
  ownSessions: Session[]
  onSignIn: () => void
  notify: (message: string) => void
  online: boolean
}) {
  const { data, error: loadError, retry } = useFriends(store)
  const [selectedId, setSelectedId] = useState('')
  const [sharing, setSharing] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const own = useMemo(() => calculateStatistics(ownSessions, now), [ownSessions, now])
  const incoming = invites.filter(
    (invite) =>
      invite.realm?.represents === PROGRESS_REALM_KIND &&
      invite.realm.realmId === progressRealmId(invite.realm.owner) &&
      data?.directory.some((entry) => entry.id === invite.realm?.owner),
  )
  const peers = data?.peers || []
  const selected = peers.find((peer) => peer.id === selectedId) || peers[0]
  async function run(
    action: () => Promise<void>,
    message: string,
    confirm?: () => Promise<boolean>,
  ) {
    if (lock.current || !store) return
    lock.current = true
    setBusy(true)
    setError('')
    let saved = false
    try {
      if (!navigator.onLine)
        throw new Error('Connect to the internet to change sharing or accept invitations.')
      await store.database.cloud.sync({ purpose: 'pull', wait: true })
      await action()
      saved = true
      await store.database.cloud.sync({ purpose: 'push', wait: true })
      if (confirm && !(await confirm())) {
        saved = false
        throw new Error('The server did not accept this sharing change. Please try again.')
      }
      setSharing(false)
      setStopping(false)
      notify(message)
    } catch (cause) {
      setError(
        saved
          ? 'Your sharing choice is saved on this device, but has not finished syncing. Stay online and use Sync now in Settings.'
          : cause instanceof Error
            ? cause.message
            : 'Sharing could not be changed. Please try again.',
      )
      if (saved) {
        setSharing(false)
        setStopping(false)
      }
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (!store)
    return (
      <section className="panel empty-state">
        <span className="empty-icon">
          <Users size={30} />
        </span>
        <h2>Stronger together.</h2>
        <p className="muted">
          Sign in to share your progress with approved friends and see the work they’re putting in.
        </p>
        <button className="button primary" onClick={onSignIn}>
          Sign in to connect
        </button>
        <p className="small muted">Included in the free plan. Sharing is your choice.</p>
      </section>
    )
  return (
    <div className="friends-content">
      <section className="panel sharing-panel" aria-labelledby="share-title">
        <div className="heading-with-icon">
          <HeartHandshake className="accent" size={22} />
          <h2 id="share-title">A little friendly momentum.</h2>
        </div>
        <p className="muted">Show up for yourself. Cheer each other on.</p>
        {!data && !loadError && (
          <p className="muted" role="status">
            Loading your friends…
          </p>
        )}
        {data && (
          <>
            <p className="small sharing-summary">
              {data.preference?.enabled ? (
                <>
                  <Eye size={16} /> Your history and future sessions are shared with{' '}
                  {data.memberships
                    .map(
                      (member) =>
                        data.directory.find((entry) => entry.id === member.email)?.name ||
                        member.email,
                    )
                    .join(', ') || 'your invited friends'}
                  .
                </>
              ) : (
                <>
                  <LockKeyhole size={16} /> Your workouts are private. Share when you’re ready.
                </>
              )}
            </p>
            {data.preference?.enabled ? (
              <>
                <div className="friend-invite-status">
                  {data.memberships.map((member) => (
                    <p className="small muted" key={member.id}>
                      {data.directory.find((entry) => entry.id === member.email)?.name ||
                        member.email}
                      :{' '}
                      {member.accepted
                        ? 'connected'
                        : member.rejected
                          ? 'invitation declined'
                          : 'invitation pending'}
                    </p>
                  ))}
                </div>
                <button
                  className="button secondary"
                  disabled={busy || !online}
                  onClick={() => setStopping(true)}
                >
                  Stop sharing my workouts
                </button>
              </>
            ) : (
              <button
                className="button primary"
                disabled={
                  busy ||
                  !online ||
                  data.directory.filter((entry) => entry.id !== store.userId).length === 0
                }
                onClick={() => setSharing(true)}
              >
                Share my progress
              </button>
            )}
            {data.directory.length === 0 && (
              <p className="muted small">
                Your approved friends list is not available yet. Sync your account in Settings and
                try again.
              </p>
            )}
          </>
        )}
        {!online && (
          <p className="muted small">
            You’re viewing the last synced progress. Connect to receive updates or change sharing.
          </p>
        )}
        {loadError && (
          <>
            <p role="alert" className="error-text">
              {loadError}
            </p>
            <button className="button secondary" onClick={retry}>
              Try again
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </section>
      {incoming.map((invite) => (
        <section className="panel friend-invitation" key={invite.id} aria-label="Friend invitation">
          <div>
            <span className="eyebrow accent">YOU’RE INVITED</span>
            <h3>{invite.realm?.name} shared their progress</h3>
            <p className="muted small">
              Accept to view their history and charts. Your own workouts stay private until you
              choose to share them.
            </p>
          </div>
          <div className="settings-buttons">
            <button
              className="button primary"
              disabled={busy || !online}
              onClick={() =>
                void run(
                  () => invite.accept(),
                  'Friend connected. Their progress will appear after syncing.',
                  async () => Boolean((await store.database.members.get(invite.id))?.accepted),
                )
              }
            >
              Accept invitation
            </button>
            <button
              className="button secondary"
              disabled={busy || !online}
              onClick={() =>
                void run(
                  () => invite.reject(),
                  'Invitation declined.',
                  async () => Boolean((await store.database.members.get(invite.id))?.rejected),
                )
              }
            >
              Decline
            </button>
          </div>
        </section>
      ))}
      {data && !peers.length && !incoming.length && (
        <section className="panel empty-state">
          <span className="empty-icon">
            <Users size={30} />
          </span>
          <h3>Every rep is better with company.</h3>
          <p className="muted">
            When a friend shares their progress, their invitation appears here. Each person decides
            when to share.
          </p>
        </section>
      )}
      {peers.length > 0 && (
        <>
          <section aria-label="This week together" className="panel friend-comparison">
            <div className="section-heading">
              <h2>This week together</h2>
              <span className="muted small">Monday–Sunday</span>
            </div>
            <p className="muted small">A little encouragement, one rep at a time.</p>
            {[
              { id: store.userId, name: 'You', total: own.week.total },
              ...peers.map((peer) => ({
                id: peer.id,
                name: peer.name,
                total: calculateStatistics(peer.sessions, now).week.total,
              })),
            ].map((person, _, people) => (
              <div className="comparison-row" key={person.id}>
                <span>{person.name}</span>
                <strong>
                  {person.total.toLocaleString()} <span className="muted small">reps</span>
                </strong>
                <meter
                  min={0}
                  max={Math.max(1, ...people.map((item) => item.total))}
                  value={person.total}
                  aria-label={`${person.name}: ${person.total} reps this week`}
                />
              </div>
            ))}
          </section>
          <div className="friend-cards" aria-label="Choose a friend">
            {peers.map((peer) => {
              const stats = calculateStatistics(peer.sessions, now)
              return (
                <button
                  className={`panel friend-card ${selected?.id === peer.id ? 'selected' : ''}`}
                  key={peer.id}
                  aria-pressed={selected?.id === peer.id}
                  onClick={() => setSelectedId(peer.id)}
                >
                  <span className="friend-avatar" aria-hidden="true">
                    {peer.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="friend-card-name">
                    <strong>{peer.name}</strong>
                    <span className="muted small">
                      {stats.today.total.toLocaleString()} reps today ·{' '}
                      {stats.allTime.total.toLocaleString()} all time
                    </span>
                  </span>
                  <span className="friend-streak">
                    <Flame size={16} />
                    {stats.currentStreak}
                    <span className="sr-only"> day streak</span>
                  </span>
                </button>
              )
            })}
          </div>
          {selected && <FriendProgress friend={selected} now={now} key={selected.id} />}
        </>
      )}
      {sharing && data && (
        <ShareProgress
          directory={data.directory}
          userId={store.userId}
          busy={busy}
          error={error}
          onClose={() => setSharing(false)}
          onShare={(name, recipients) =>
            void run(
              () => store.share(name, recipients),
              'Progress shared. Your friends can accept their invitations in Friends.',
              async () => (await store.snapshot()).preference?.enabled === true,
            )
          }
        />
      )}
      {stopping && (
        <Modal title="Stop sharing your progress?" onClose={() => setStopping(false)} busy={busy}>
          <p className="muted modal-description">
            Your workouts stay in your account. Your friends will lose access after the change
            syncs. Copies they already viewed or saved cannot be recalled. To share again, you’ll
            send a new invitation.
          </p>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="button secondary" disabled={busy} onClick={() => setStopping(false)}>
              Keep sharing
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                void run(
                  () => store.stopSharing(),
                  'Sharing stopped. Your workouts remain in your account.',
                  async () => (await store.snapshot()).preference?.enabled === false,
                )
              }
            >
              {busy ? 'Stopping…' : 'Stop sharing'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
