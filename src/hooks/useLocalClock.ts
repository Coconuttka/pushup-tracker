import { useEffect, useState } from 'react'

export function useLocalClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: number
    function schedule() {
      const current = new Date()
      const midnight = new Date(current)
      midnight.setHours(24, 0, 0, 0)
      timer = window.setTimeout(
        () => {
          setNow(new Date())
          schedule()
        },
        Math.max(1, Math.min(30_000, midnight.getTime() - current.getTime())),
      )
    }
    const refresh = () => {
      window.clearTimeout(timer)
      setNow(new Date())
      schedule()
    }
    schedule()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return now
}
