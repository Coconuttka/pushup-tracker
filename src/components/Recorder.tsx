import { ArrowUpRight, Check, Minus, Plus } from 'lucide-react'
import { MAX_REPS } from '../domain/session'

interface Props {
  count: number
  onChange: (count: number) => void
  onSave: () => void
  saving: boolean
  unavailable: boolean
}

export function Recorder({ count, onChange, onSave, saving, unavailable }: Props) {
  const disabled = saving || unavailable
  return (
    <section className="panel recorder" aria-labelledby="session-title">
      <div className="recorder-heading">
        <span className="eyebrow" id="session-title">
          <span className="live-dot" /> NEW SESSION
        </span>
        <span className="muted small">
          One rep at a time <ArrowUpRight size={15} aria-hidden="true" />
        </span>
      </div>
      <div className="counter-row">
        <button
          className="counter-button minus"
          aria-label="Subtract 1 push-up"
          disabled={disabled || count === 0}
          onClick={() => onChange(Math.max(0, count - 1))}
        >
          <Minus size={26} />
        </button>
        <div className="counter-display">
          <output
            className={`counter-number ${count > 99999 ? 'counter-tiny' : count > 999 ? 'counter-small' : ''}`}
            aria-label="Current session reps"
            aria-live="polite"
          >
            {count}
          </output>
          <span className="counter-caption">PUSH-UPS</span>
        </div>
        <button
          className="counter-button plus"
          aria-label="Add 1 push-up"
          disabled={disabled || count >= MAX_REPS}
          onClick={() => onChange(Math.min(MAX_REPS, count + 1))}
        >
          <Plus size={28} />
        </button>
      </div>
      <div className="quick-add" aria-label="Quick add push-ups">
        {[5, 10, 20].map((amount) => (
          <button
            key={amount}
            disabled={disabled || count >= MAX_REPS}
            onClick={() => onChange(Math.min(MAX_REPS, count + amount))}
          >
            +{amount}
          </button>
        ))}
      </div>
      <button
        className="button primary save-button"
        disabled={disabled || count === 0}
        onClick={onSave}
      >
        {saving ? <span className="spinner" /> : <Check size={20} aria-hidden="true" />}{' '}
        {saving ? 'Saving your session…' : `Save ${count} push-ups`}
      </button>
      <p className="recorder-note">
        {count === 0
          ? 'Your next little victory starts here.'
          : 'Looking good. Save when you’re finished.'}
      </p>
    </section>
  )
}
