import { useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { addDays, dayKey, timeKey } from '../domain/dates'
import { MAX_REPS } from '../domain/session'
import type { SessionStore } from '../data/store'
import { Modal } from './Modal'

interface Props {
  now: Date
  store: SessionStore
  onClose: () => void
  onSaved: () => void
}

export function AddHistorySession({ now, store, onClose, onSaved }: Props) {
  const [date, setDate] = useState(() => dayKey(addDays(now, -1)))
  const [time, setTime] = useState(() => timeKey(now))
  const [reps, setReps] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)

  async function save() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await store.createHistorical(Number(reps), date, time)
      onSaved()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Your session could not be saved. Try again.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <Modal title="Add a past session" busy={busy} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <p className="muted modal-description">
          Forgot to log a workout? Choose when you did it and add your reps.
        </p>
        <label className="field-label" htmlFor="history-reps">
          Push-ups
        </label>
        <input
          id="history-reps"
          type="number"
          inputMode="numeric"
          min="1"
          max={MAX_REPS}
          step="1"
          required
          autoFocus
          disabled={busy}
          value={reps}
          onChange={(event) => setReps(event.target.value)}
        />
        <div className="history-date-fields">
          <div>
            <label className="field-label" htmlFor="history-date">
              Date
            </label>
            <input
              id="history-date"
              type="date"
              min="1970-01-01"
              max={dayKey(now)}
              required
              disabled={busy}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="history-time">
              Time
            </label>
            <input
              id="history-time"
              type="time"
              max={date === dayKey(now) ? timeKey(now) : undefined}
              required
              disabled={busy}
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </div>
        </div>
        <p className="muted small history-time-note">
          Date and time use your device’s local timezone.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            <Check size={17} aria-hidden="true" />
            {busy ? 'Saving…' : 'Save session'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
