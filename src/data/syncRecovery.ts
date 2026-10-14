import type { CloudDatabase } from './cloudStore'

export function watchSyncRecovery(database: Pick<CloudDatabase, 'cloud'>) {
  let running = false
  let stopped = false
  function recover(force = false) {
    const user = database.cloud.currentUser.value
    const state = database.cloud.syncState.value
    if (stopped || running || !navigator.onLine || !user.isLoggedIn) return
    if (user.license && user.license.status !== 'ok') return
    if (!force && (document.hidden || (state.status === 'connected' && state.phase === 'in-sync')))
      return
    running = true
    void database.cloud
      .sync({ purpose: 'pull', wait: true })
      .catch(() => undefined)
      .finally(() => {
        running = false
      })
  }
  const online = () => recover(true)
  const visible = () => {
    if (!document.hidden) recover(true)
  }
  window.addEventListener('online', online)
  window.addEventListener('focus', visible)
  document.addEventListener('visibilitychange', visible)
  const timer = window.setInterval(() => recover(), 30_000)
  return () => {
    stopped = true
    window.clearInterval(timer)
    window.removeEventListener('online', online)
    window.removeEventListener('focus', visible)
    document.removeEventListener('visibilitychange', visible)
  }
}
