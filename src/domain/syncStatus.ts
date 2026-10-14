import type { SyncState } from 'dexie-cloud-addon'

export function syncMessage(state: SyncState, online: boolean): string {
  if (state.license === 'expired' || state.license === 'deactivated')
    return 'Sync access needs attention · saved on this device'
  if (!online || state.phase === 'offline') return 'Saved on this device · sync when online'
  if (state.phase === 'in-sync')
    return state.status === 'connected'
      ? 'All workouts synced'
      : 'Workouts synced · checking for updates'
  if (state.phase === 'error' || state.status === 'error')
    return 'Sync paused · saved on this device'
  if (state.phase === 'pushing' || state.phase === 'pulling') return 'Syncing your workouts…'
  return 'Saved on this device · waiting to sync'
}
