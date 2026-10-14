import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import type { FriendsStore } from '../data/friendsStore'

export type FriendsSnapshot = Awaited<ReturnType<FriendsStore['snapshot']>>

export function useFriends(store?: FriendsStore) {
  const [data, setData] = useState<FriendsSnapshot>()
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!store) return
    const subscription = liveQuery(() => store.snapshot()).subscribe({
      next: (snapshot) => {
        setData(snapshot)
        setError('')
      },
      error: () => setError('Friends could not be loaded. Sync your account and try again.'),
    })
    return () => subscription.unsubscribe()
  }, [store, revision])
  return {
    data,
    error,
    retry: () => {
      setError('')
      setRevision((value) => value + 1)
    },
  }
}
