import { useEffect, useState } from 'react'

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function useInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt>()
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches,
  )
  useEffect(() => {
    const available = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPrompt)
    }
    const complete = () => {
      setInstalled(true)
      setPrompt(undefined)
    }
    window.addEventListener('beforeinstallprompt', available)
    window.addEventListener('appinstalled', complete)
    return () => {
      window.removeEventListener('beforeinstallprompt', available)
      window.removeEventListener('appinstalled', complete)
    }
  }, [])
  async function install() {
    if (!prompt) return
    await prompt.prompt()
    await prompt.userChoice
    setPrompt(undefined)
  }
  return { canInstall: Boolean(prompt), installed, install }
}
