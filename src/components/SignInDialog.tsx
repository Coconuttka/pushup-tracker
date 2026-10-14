import { useRef, useState } from 'react'
import { resolveText, type DXCUserInteraction } from 'dexie-cloud-addon'
import { Modal } from './Modal'

export function SignInDialog({ interaction }: { interaction: DXCUserInteraction }) {
  const [submittedInteraction, setSubmittedInteraction] = useState<DXCUserInteraction>()
  const locked = useRef<DXCUserInteraction | undefined>(undefined)
  const submitted = submittedInteraction === interaction
  const isEmail = interaction.type === 'email'
  const isOtp = interaction.type === 'otp'
  const isLogout = interaction.type === 'logout-confirmation'
  const title = isEmail
    ? 'Sign in to Pushup'
    : isOtp
      ? 'Check your email'
      : isLogout
        ? 'Keep your unsynced workouts'
        : interaction.title
  return (
    <Modal title={title} onClose={interaction.onCancel}>
      {interaction.alerts.map((alert, index) => (
        <p
          key={index}
          className={alert.type === 'error' ? 'error-text' : 'muted small'}
          role={alert.type === 'error' ? 'alert' : 'status'}
        >
          {resolveText(alert)}
        </p>
      ))}
      {isLogout ? (
        <>
          <p className="muted">
            Some changes have not synced. Stay signed in, connect to the internet and try again. You
            can export a JSON backup in Settings.
          </p>
          <button className="button primary" onClick={interaction.onCancel}>
            Stay signed in
          </button>
        </>
      ) : (
        <form
          className="account-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (locked.current === interaction) return
            locked.current = interaction
            setSubmittedInteraction(interaction)
            const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<
              string,
              string
            >
            if (values.email) values.email = values.email.trim().toLowerCase()
            if (values.otp) values.otp = values.otp.trim()
            interaction.onSubmit(values)
          }}
        >
          {isEmail && (
            <p className="muted small">
              Use your approved email. We’ll send a one-time code. No password needed.
            </p>
          )}
          {Object.entries(interaction.fields).map(([name]) => (
            <label key={name} className="form-label">
              {name === 'email' ? 'Email address' : name === 'otp' ? 'One-time code' : name}
              <input
                className="form-input"
                name={name}
                type={name === 'email' ? 'email' : 'text'}
                autoComplete={name === 'email' ? 'email' : name === 'otp' ? 'one-time-code' : 'off'}
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={name === 'email' ? 254 : 100}
                disabled={submitted}
                autoFocus
              />
            </label>
          ))}
          <div className="modal-actions">
            <button className="button primary" type="submit" disabled={submitted}>
              {submitted
                ? 'Please wait…'
                : isEmail
                  ? 'Send sign-in code'
                  : isOtp
                    ? 'Verify and sign in'
                    : interaction.submitLabel}
            </button>
            {interaction.cancelLabel && (
              <button className="button secondary" type="button" onClick={interaction.onCancel}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  )
}
