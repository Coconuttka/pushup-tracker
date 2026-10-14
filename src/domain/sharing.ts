import type { Session } from './session'

export const FRIEND_DIRECTORY_REALM = 'rlm-pushup-friend-directory'
export const PROGRESS_REALM_KIND = 'push-up progress'

export interface FriendDirectoryEntry {
  id: string
  name: string
  realmId: string
  owner: string | null
}

export interface SharingPreference {
  id: string
  enabled: boolean
  name: string
  owner: string
  realmId: string
}

export interface FriendProgress {
  id: string
  realmId: string
  name: string
  sessions: Session[]
}

export function progressRealmId(userId: string): string {
  return `rlm-pushup-progress-${userId}`
}

export function validateSharing(
  name: string,
  recipients: string[],
  allowed: string[],
  userId: string,
) {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 40) throw new Error('Enter a name between 1 and 40 characters.')
  const unique = [...new Set(recipients)]
  if (
    !unique.length ||
    unique.length > 2 ||
    unique.some((id) => id === userId || !allowed.includes(id))
  )
    throw new Error('Choose at least one other approved account to share with.')
  return { name: trimmed, recipients: unique }
}
