import { useRef, useState } from 'react'
import { Download, HardDrive, LockKeyhole, Smartphone, Upload } from 'lucide-react'
import type { SessionStore } from '../data/store'
import { parseBackup } from '../domain/backup'
import { dayKey } from '../domain/dates'
import { MAX_BACKUP_BYTES } from '../domain/session'
import { Modal } from './Modal'

interface Props {
  store: SessionStore
  onClose: () => void
  notify: (message: string) => void
  installation: { canInstall: boolean; installed: boolean; install: () => Promise<void> }
}

export function DataTools({ store, onClose, notify, installation }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<{ text: string; count: number; date: string }>()
  const [protectedStorage, setProtectedStorage] = useState(false)
  async function run(action: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'This action could not finish. Please try again.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  async function exportBackup() {
    const text = await store.export()
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pushup-backup-${dayKey(Date.now())}.json`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setNotice('Backup exported. Keep it somewhere safe.')
    notify('Backup exported. Keep it somewhere safe.')
  }
  async function inspect(file: File) {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a JSON backup smaller than 10 MB.')
    const text = await file.text()
    const backup = parseBackup(text)
    setPreview({
      text,
      count: backup.sessions.length,
      date: new Date(backup.exportedAt).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    })
  }
  return (
    <Modal title="Your app. Your data." onClose={onClose} busy={busy}>
      <div className="privacy-note">
        <LockKeyhole size={22} aria-hidden="true" />
        <p>
          Your workouts stay on this device. No account, no tracking, just you and your progress.
        </p>
      </div>
      <section className="settings-section" aria-labelledby="backup-title">
        <div className="heading-with-icon">
          <HardDrive size={18} className="accent" />
          <h3 id="backup-title">Keep your progress safe</h3>
        </div>
        <p className="muted small">
          Export a backup regularly and before changing devices or clearing browser data. Backups
          include all saved sessions.
        </p>
        <div className="settings-buttons">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void run(exportBackup)}
          >
            <Download size={17} />
            Export JSON
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setError('')
              fileInput.current!.click()
            }}
          >
            <Upload size={17} />
            Import JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            tabIndex={-1}
            accept=".json,application/json"
            aria-label="Choose backup file"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void run(() => inspect(file))
            }}
          />
        </div>
        {preview && (
          <div className="import-preview">
            <strong>
              Ready to merge {preview.count.toLocaleString()} session
              {preview.count === 1 ? '' : 's'}
            </strong>
            <p className="muted small">
              Backup from {preview.date}. Identical sessions are skipped. Conflicting session IDs
              stop the entire import; existing data stays intact.
            </p>
            <div className="settings-buttons">
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await store.import(preview.text)
                    setPreview(undefined)
                    const message = `${result.imported} sessions imported. ${result.skipped} duplicates skipped.`
                    setNotice(message)
                    notify(message)
                  })
                }
              >
                {busy ? 'Importing…' : 'Merge backup'}
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setPreview(undefined)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <button
          className="text-button protect-button"
          disabled={busy || protectedStorage}
          onClick={() =>
            void run(async () => {
              if (!navigator.storage?.persist)
                throw new Error(
                  'This browser does not offer storage protection. Keep a JSON backup of your sessions.',
                )
              const persisted = await navigator.storage.persist()
              setProtectedStorage(persisted)
              notify(
                persisted
                  ? 'Local storage protection is enabled. Keep making regular backups.'
                  : 'Your browser manages storage automatically. Keep a JSON backup to protect your progress.',
              )
            })
          }
        >
          {protectedStorage ? 'Storage protection enabled' : 'Request storage protection'}{' '}
          <LockKeyhole size={13} />
        </button>
      </section>
      <section className="settings-section install-section" aria-labelledby="install-title">
        <div className="heading-with-icon">
          <Smartphone size={19} className="accent" />
          <h3 id="install-title">Make room for a good habit</h3>
        </div>
        <p className="muted small">
          {installation.installed
            ? 'Pushup is installed and ready for your next session.'
            : 'On Android, open this page in Chrome. Tap the menu (⋮), then “Add to Home screen” → “Install”. Open it once online to make it available offline.'}
        </p>
        {installation.canInstall && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void run(installation.install)}
          >
            <Download size={17} />
            Install Pushup
          </button>
        )}
      </section>
      {busy && !preview && (
        <p className="muted small" role="status">
          Working on it…
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="settings-success" role="status">
          {notice}
        </p>
      )}
      <p className="settings-version">PUSHUP · VERSION 1.0.0 · BUILT FOR THE LONG RUN</p>
    </Modal>
  )
}
