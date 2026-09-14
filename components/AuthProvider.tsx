'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Role, Platform } from '@/lib/types'
import { detectPlatform } from '@/lib/platform'

interface CurrentUser {
  id: string
  platform: Platform
  role: Role
  name: string | null
}

interface AuthContextValue {
  user: CurrentUser | null
  loading: boolean
  refresh: () => Promise<CurrentUser | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => null,
  logout: async () => {}
})

async function tryAutoLogin(): Promise<Platform | null> {
  const platform = detectPlatform()

  if (platform === 'telegram') {
    const initData = window.Telegram?.WebApp?.initData
    if (!initData) return null
    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
      })
      return res.ok ? 'telegram' : null
    } catch {
      return null
    }
  }

  if (platform === 'vk' && window.location.search.includes('vk_user_id')) {
    try {
      const res = await fetch('/api/auth/vk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchParams: window.location.search })
      })
      return res.ok ? 'vk' : null
    } catch {
      return null
    }
  }

  return null
}

const PHONE_REQUEST_FLAG = 'gdedps_phone_requested'

// Asks Telegram's native "share phone number" popup once per device. The
// number itself never reaches this browser -- Telegram delivers it to the
// bot as a regular contact message, which app/api/telegram/webhook handles.
function requestTelegramPhoneOnce() {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(PHONE_REQUEST_FLAG)) return
  const webApp = window.Telegram?.WebApp
  if (!webApp?.requestContact) return

  localStorage.setItem(PHONE_REQUEST_FLAG, '1')
  webApp.requestContact(() => {
    // Nothing to do here either way -- the webhook updates the profile
    // once Telegram delivers the contact message, if the user accepted.
  })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const autoLoginAttempted = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      const json = await res.json()
      setUser(json.user)
      return json.user as CurrentUser | null
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    webApp?.ready?.()
    // Mini Apps open "half-screen" (compact) by default -- expand to full
    // height, and use the newer edge-to-edge fullscreen API where the
    // client supports it (Bot API 8.0+, silently ignored otherwise).
    webApp?.expand?.()
    webApp?.disableVerticalSwipes?.()
    try {
      webApp?.requestFullscreen?.()
    } catch {
      // older clients without this method -- expand() above already covers them
    }

    async function init() {
      const existing = await refresh()
      if (existing) {
        if (existing.platform === 'telegram') requestTelegramPhoneOnce()
        return
      }
      if (autoLoginAttempted.current) return
      autoLoginAttempted.current = true

      const loggedInAs = await tryAutoLogin()
      if (loggedInAs) {
        await refresh()
        if (loggedInAs === 'telegram') requestTelegramPhoneOnce()
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
