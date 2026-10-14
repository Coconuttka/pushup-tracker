import { Cloud, LogIn, LogOut, RefreshCw } from 'lucide-react'

export interface AccountControls {
  email?: string
  status: string
  busy: boolean
  error: string
  notice: string
  online: boolean
  login(): void
  logout(): void
  sync(): void
  copyHistory(): void
}

export function AccountPanel({
  account,
  hasUnsaved,
}: {
  account: AccountControls
  hasUnsaved: boolean
}) {
  return (
    <section className="settings-section account-section" aria-labelledby="account-title">
      <div className="heading-with-icon">
        <Cloud size={20} className="accent" aria-hidden="true" />
        <h3 id="account-title">Your progress, everywhere</h3>
      </div>
      {account.email ? (
        <>
          <p className="account-email">{account.email}</p>
          <p className="small muted" role="status">
            {account.status}
          </p>
          <p className="small muted">
            Workouts belong to your account. Sign in with the same email on your phone and computer.
            Open Friends to choose whether to share progress.
          </p>
          <div className="settings-buttons">
            <button
              className="button secondary"
              disabled={account.busy || !account.online}
              onClick={account.sync}
            >
              <RefreshCw size={16} /> Sync now
            </button>
            <button
              className="button secondary"
              disabled={account.busy || hasUnsaved || !account.online}
              onClick={account.logout}
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
          <div className="device-history-note">
            <p className="small muted">
              Already tracked workouts before signing in? Copy this device’s history into{' '}
              {account.email}. Your device copy stays here. Existing or previously deleted account
              sessions are skipped.
            </p>
            <button
              className="button secondary"
              disabled={account.busy}
              onClick={account.copyHistory}
            >
              Copy device history to this account
            </button>
          </div>
          {!account.online && (
            <p className="small muted">
              Keep tracking offline. Open the app online to sync. Connect before signing out so no
              pending workouts are lost.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="small muted">
            Sign in using an email code to sync between devices. Only approved accounts can sign in.
            You can also keep tracking on this device without an account.
          </p>
          <button
            className="button primary"
            disabled={account.busy || hasUnsaved || !account.online}
            onClick={account.login}
          >
            <LogIn size={17} /> Sign in to sync
          </button>
          {!account.online && (
            <p className="small muted">Connect to the internet for your first sign-in.</p>
          )}
        </>
      )}
      {hasUnsaved && (
        <p className="small muted">Save your current counter before signing in or out.</p>
      )}
      {account.error && (
        <p className="error-text" role="alert">
          {account.error}
        </p>
      )}
      {account.notice && (
        <p className="settings-success" role="status">
          {account.notice}
        </p>
      )}
      <p className="small account-plan">Free plan · private accounts · registration closed</p>
    </section>
  )
}
