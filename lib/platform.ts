'use client'

export type RuntimePlatform = 'telegram' | 'max' | 'web'

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string
        ready?: () => void
        expand?: () => void
        isExpanded?: boolean
        requestFullscreen?: () => void
        disableVerticalSwipes?: () => void
        requestContact?: (callback: (shared: boolean) => void) => void
      }
    }
  }
}

// Best-effort detection of which shell the page is running inside, used to
// decide which auth button(s) to surface and whether to auto-login.
export function detectPlatform(): RuntimePlatform {
  if (typeof window === 'undefined') return 'web'

  if (window.Telegram?.WebApp?.initData) return 'telegram'

  const params = new URLSearchParams(window.location.search)
  if (params.has('max_user_id') || params.get('platform') === 'max') return 'max'

  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('maxmessenger') || ua.includes('max_app')) return 'max'

  return 'web'
}
