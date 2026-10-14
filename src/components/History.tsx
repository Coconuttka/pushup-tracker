import { useMemo, useRef, useState } from 'react'
import { ArrowDown, Check, Clock3, Pencil, Trash2 } from 'lucide-react'
import { groupByDay } from '../domain/statistics'
import { relativeDay } from '../domain/dates'
import type { Session } from '../domain/session'
import { MAX_REPS } from '../domain/session'
import type { SessionStore } from '../data/store'
import { Modal } from './Modal'

interface Props {
  sessions: Session[]
  now: Date
  store: SessionStore
  notify: (message: string) => void
  onTrack: () => void
}

export function History({ sessions, now, store, notify, onTrack }: Props) {
  const [limit, setLimit] = useState(50)
  const [editing, setEditing] = useState<Session>()
  const [deleting, setDeleting] = useState<Session>()
  const [reps, setReps] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const groups = useMemo(() => groupByDay(sessions.slice(0, limit)), [sessions, limit])
  async function mutate(action: () => Promise<void>, message: string) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await action()
      setEditing(undefined)
      setDeleting(undefined)
      notify(message)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The change could not be saved. Please try again.',
      )
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  return (
    <section aria-label="Session history">
      <div className="section-heading view-heading">
        <div>
          <h2>Your effort, recorded.</h2>
          <p className="muted">
            {sessions.length.toLocaleString()} saved session{sessions.length === 1 ? '' : 's'}.
            Every one matters.
          </p>
        </div>
        <Clock3 className="accent" size={26} aria-hidden="true" />
      </div>
      {sessions.length === 0 ? (
        <div className="panel empty-state">
          <span className="empty-icon">
            <Clock3 size={30} />
          </span>
          <h3>Your story starts with one session.</h3>
          <p className="muted">Save your first push-ups and they’ll appear here.</p>
          <button className="button primary" onClick={onTrack}>
            Log your first session{' '}
            <ArrowDown size={17} className="rotate-arrow" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="history-groups">
          {[...groups].map(([key, group]) => (
            <section key={key} aria-label={relativeDay(key, now)}>
              <div className="history-date">
                <h3>{relativeDay(key, now)}</h3>
                <span>
                  {group.reduce((sum, session) => sum + session.reps, 0).toLocaleString()} reps
                </span>
              </div>
              <div className="panel history-list">
                {group.map((session, index) => (
                  <div className="history-row" key={session.id}>
                    <span className="session-number" aria-hidden="true">
                      {String(group.length - index).padStart(2, '0')}
                    </span>
                    <div className="session-info">
                      <strong>
                        {session.reps.toLocaleString()} <span>push-ups</span>
                      </strong>
                      <time dateTime={new Date(session.createdAt).toISOString()}>
                        {new Date(session.createdAt).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    <div className="session-actions">
                      <button
                        className="icon-button"
                        aria-label={`Edit ${session.reps} push-up session at ${new Date(session.createdAt).toLocaleTimeString()}`}
                        onClick={() => {
                          setEditing(session)
                          setReps(String(session.reps))
                          setError('')
                        }}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        className="icon-button delete-button"
                        aria-label={`Delete ${session.reps} push-up session at ${new Date(session.createdAt).toLocaleTimeString()}`}
                        onClick={() => {
                          setDeleting(session)
                          setError('')
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {sessions.length > limit && (
        <button
          className="button secondary load-more"
          onClick={() => setLimit((value) => value + 50)}
        >
          Show more sessions <ArrowDown size={16} />
        </button>
      )}
      {editing && (
        <Modal title="Edit session" busy={busy} onClose={() => setEditing(undefined)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void mutate(() => store.edit(editing.id, Number(reps)), 'Session updated.')
            }}
          >
            <p className="muted modal-description">
              Adjust the rep count. The original date and time will stay the same.
            </p>
            <label className="field-label" htmlFor="edit-reps">
              Push-ups
            </label>
            <input
              id="edit-reps"
              type="number"
              inputMode="numeric"
              min="1"
              max={MAX_REPS}
              step="1"
              required
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              disabled={busy}
              autoFocus
            />
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setEditing(undefined)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                <Check size={17} />
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete this session?" busy={busy} onClose={() => setDeleting(undefined)}>
          <p className="muted modal-description">
            This removes the{' '}
            <strong className="text-bright">{deleting.reps.toLocaleString()} push-up</strong>{' '}
            session and updates your statistics. This can’t be undone.
          </p>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDeleting(undefined)}
            >
              Keep session
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => void mutate(() => store.remove(deleting.id), 'Session deleted.')}
            >
              <Trash2 size={17} />
              {busy ? 'Deleting…' : 'Delete session'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
