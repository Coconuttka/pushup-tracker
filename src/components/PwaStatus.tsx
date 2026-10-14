import { useEffect, useState } from 'react'
import { Download, RefreshCw, WifiOff, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaStatus({ hasUnsaved }: { hasUnsaved: boolean }) {
  const [error, setError] = useState(false)
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () => setError(true),
  })
  useEffect(() => {
    if (!offlineReady) return
    const timer = window.setTimeout(() => setOfflineReady(false), 6500)
    return () => window.clearTimeout(timer)
  }, [offlineReady, setOfflineReady])
  if (!offlineReady && !needRefresh && !error) return null
  return (
    <aside className="pwa-notice" aria-label="App availability">
      <div>
        {error ? (
          <WifiOff size={18} />
        ) : needRefresh ? (
          <RefreshCw size={18} />
        ) : (
          <Download size={18} />
        )}
        <p>
          {error
            ? 'Offline setup could not finish. Reopen the app when connected to try again.'
            : needRefresh
              ? hasUnsaved
                ? 'An update is ready. Save your session before updating.'
                : 'A fresh version of Pushup is ready.'
              : 'Ready to go offline. Your next rep can happen anywhere.'}
        </p>
      </div>
      <div className="pwa-actions">
        {needRefresh && (
          <button
            className="text-button"
            disabled={hasUnsaved}
            onClick={() => void updateServiceWorker(true).catch(() => setError(true))}
          >
            Update
          </button>
        )}
        <button
          className="icon-button"
          aria-label="Dismiss app notice"
          onClick={() => {
            setOfflineReady(false)
            setNeedRefresh(false)
            setError(false)
          }}
        >
          <X size={17} />
        </button>
      </div>
    </aside>
  )
}
