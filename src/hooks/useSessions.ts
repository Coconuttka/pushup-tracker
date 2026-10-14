import { useCallback, useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import type { SessionRepository } from '../data/repository'
import type { Session } from '../domain/session'

export function useSessions(store: SessionRepository) {
  const [state, setState] = useState<{ sessions: Session[]; loading: boolean; error: string }>({
    sessions: [],
    loading: true,
    error: '',
  })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const subscription = liveQuery(() => store.list()).subscribe({
      next: (sessions) => setState({ sessions, loading: false, error: '' }),
      error: () =>
        setState((previous) => ({
          ...previous,
          loading: false,
          error:
            'Your saved sessions could not be opened. Allow browser storage, close other Pushup tabs, and try again.',
        })),
    })
    return () => subscription.unsubscribe()
  }, [store, revision])
  const retry = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true, error: '' }))
    setRevision((previous) => previous + 1)
  }, [])
  return { ...state, retry }
}
