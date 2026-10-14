import { useEffect, useMemo, useRef, useState } from 'react'
import { useObservable } from 'dexie-react-hooks'
import App from './App'
import { CloudDatabase, CloudSessionStore } from './data/cloudStore'
import { sessionStore } from './data/store'
import { SignInDialog } from './components/SignInDialog'
import { syncMessage } from './domain/syncStatus'
import { watchSyncRecovery } from './data/syncRecovery'

const databaseUrl = import.meta.env.VITE_DEXIE_CLOUD_URL || 'https://ztlilst6w.dexie.cloud'
const database =
  import.meta.env.VITE_CLOUD_ENABLED === 'false' ? undefined : new CloudDatabase(databaseUrl)

export default function Workspace() {
  return database ? <ConnectedWorkspace database={database} /> : <App />
}

export function ConnectedWorkspace({ database }: { database: CloudDatabase }) {
  const user = useObservable(
    () => database.cloud.currentUser,
    [database],
    database.cloud.currentUser.value,
  )
  const syncState = useObservable(
    () => database.cloud.syncState,
    [database],
    database.cloud.syncState.value,
  )
  const interaction = useObservable(
    () => database.cloud.userInteraction,
    [database],
    database.cloud.userInteraction.value,
  )
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const lock = useRef(false)
  useEffect(() => {
    let active = true
    database
      .open()
      .then(() => {
        if (active) setReady(true)
      })
      .catch(() => {
        if (active)
          setError('Account storage could not open. Allow browser storage and reload the app.')
      })
    return () => {
      active = false
    }
  }, [database])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  const userId = user.isLoggedIn ? user.userId : undefined
  const cloudStore = useMemo(
    () => (userId ? new CloudSessionStore(database, userId) : undefined),
    [database, userId],
  )
  useEffect(() => watchSyncRecovery(database), [database, userId])
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
        cause instanceof Error
          ? cause.message
          : 'The account action could not finish. Please try again.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (!ready || user.isLoading)
    return (
      <main className="account-loading">
        <h1>Opening your journal…</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="button primary" onClick={() => window.location.reload()}>
              Reload Pushup
            </button>
          </>
        ) : (
          <p role="status">Your workouts are stored on this device.</p>
        )}
      </main>
    )
  return (
    <>
      <App
        key={userId || 'device'}
        store={cloudStore || sessionStore}
        account={{
          email: userId ? user.email || userId : undefined,
          status: syncMessage(syncState, online),
          busy,
          error:
            error || (syncState.error ? `Sync could not finish: ${syncState.error.message}` : ''),
          notice,
          online,
          login: () => void run(() => database.cloud.login({ intent: 'login' })),
          logout: () =>
            void run(async () => {
              if (!navigator.onLine)
                throw new Error('Connect to the internet and sync before signing out.')
              await database.cloud.sync({ purpose: 'push', wait: true })
              if (database.cloud.syncState.value.phase !== 'in-sync')
                throw new Error('Wait until all workouts have synced before signing out.')
              await database.cloud.logout()
            }),
          sync: () =>
            void run(async () => {
              await database.cloud.sync({ purpose: 'pull', wait: true })
            }),
          copyHistory: () =>
            void run(async () => {
              if (!cloudStore) throw new Error('Sign in before copying device history.')
              const result = await cloudStore.copyDeviceHistory(await sessionStore.list())
              setNotice(
                `${result.imported} device sessions copied. ${result.skipped} existing or deleted sessions skipped.`,
              )
            }),
        }}
      />
      {interaction && (
        <SignInDialog
          key={`${interaction.type}:${interaction.alerts.map((alert) => alert.messageCode).join(':')}`}
          interaction={interaction}
        />
      )}
    </>
  )
}
