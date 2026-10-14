import { useState } from 'react'
import type { FriendDirectoryEntry } from '../domain/sharing'
import { Modal } from './Modal'

export function ShareProgress({
  directory,
  userId,
  onShare,
  onClose,
  busy,
  error,
}: {
  directory: FriendDirectoryEntry[]
  userId: string
  onShare: (name: string, recipients: string[]) => void
  onClose: () => void
  busy: boolean
  error: string
}) {
  const eligible = directory.filter((entry) => entry.id !== userId)
  const [name, setName] = useState(
    directory.find((entry) => entry.id === userId)?.name || userId.split('@')[0],
  )
  const [recipients, setRecipients] = useState(eligible.map((entry) => entry.id))
  return (
    <Modal title="A little motivation, shared." onClose={onClose} busy={busy}>
      <form
        className="account-form"
        onSubmit={(event) => {
          event.preventDefault()
          onShare(name, recipients)
        }}
      >
        <p className="muted small">
          Share your complete saved history and progress, including future sessions, edits, and
          deletions. Your friends can view your workouts. You keep control of your sessions.
        </p>
        <label className="form-label">
          Your display name
          <input
            className="form-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            required
            disabled={busy}
            autoComplete="nickname"
          />
        </label>
        <fieldset className="friend-recipients">
          <legend>Share with approved friends</legend>
          {eligible.map((entry) => (
            <label className="friend-check" key={entry.id}>
              <input
                type="checkbox"
                checked={recipients.includes(entry.id)}
                disabled={busy}
                onChange={(event) =>
                  setRecipients(
                    event.target.checked
                      ? [...recipients, entry.id]
                      : recipients.filter((id) => id !== entry.id),
                  )
                }
              />
              <span>
                <strong>{entry.name}</strong>
                <span className="muted small">{entry.id}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="muted small">
          They’ll receive an invitation and can accept in Friends. You can stop sharing anytime.
          Someone who already viewed your workouts may retain a copy, including while offline.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button secondary" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || !recipients.length || !name.trim()}>
            {busy ? 'Sharing…' : 'Share and invite'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
