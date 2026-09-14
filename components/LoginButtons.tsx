'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Send, Phone } from 'lucide-react'
import { useAuth } from './AuthProvider'

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, string | number>) => void
  }
}

function randomString(len: number) {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Base64Url(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function LoginButtons() {
  const { refresh } = useAuth()
  const router = useRouter()
  const telegramContainer = useRef<HTMLDivElement | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Telegram Login Widget
  useEffect(() => {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    if (!botUsername || !telegramContainer.current) return

    window.onTelegramAuth = async (user) => {
      setBusy('telegram')
      setError(null)
      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user)
        })
        if (!res.ok) throw new Error()
        await refresh()
        router.push('/')
      } catch {
        setError('Не удалось войти через Telegram')
      } finally {
        setBusy(null)
      }
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '999')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    telegramContainer.current.innerHTML = ''
    telegramContainer.current.appendChild(script)
  }, [refresh, router])

  async function loginWithVk() {
    const appId = process.env.NEXT_PUBLIC_VK_APP_ID
    if (!appId) {
      setError('VK не настроен')
      return
    }
    const codeVerifier = randomString(32)
    const state = randomString(16)
    const deviceId = randomString(16)
    sessionStorage.setItem('vk_code_verifier', codeVerifier)
    sessionStorage.setItem('vk_device_id', deviceId)
    sessionStorage.setItem('vk_state', state)

    const codeChallenge = await sha256Base64Url(codeVerifier)
    const redirectUri = `${window.location.origin}/login/vk-callback`

    const url = new URL('https://id.vk.com/authorize')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', appId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('code_challenge', codeChallenge)
    url.searchParams.set('code_challenge_method', 's256')
    url.searchParams.set('state', state)
    url.searchParams.set('scope', 'phone')

    window.location.href = url.toString()
  }

  function loginWithMax() {
    setError('Вход через MAX доступен внутри приложения MAX. Откройте бота «Где ДПС?» в MAX.')
  }

  return (
    <div className="space-y-3">
      <div ref={telegramContainer} className="flex justify-center min-h-[40px]" />

      <button
        onClick={loginWithVk}
        disabled={busy === 'vk'}
        className="w-full flex items-center justify-center gap-2 rounded-full bg-[#0077FF] text-white font-medium py-3 disabled:opacity-60"
      >
        <MessageCircle size={18} /> Войти через VK
      </button>

      <button
        onClick={loginWithMax}
        disabled={busy === 'max'}
        className="w-full flex items-center justify-center gap-2 rounded-full bg-slate-800 text-white font-medium py-3 disabled:opacity-60"
      >
        <Phone size={18} /> Войти через MAX
      </button>

      {!process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME && (
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 rounded-full bg-[#26A5E4] text-white font-medium py-3 opacity-50"
        >
          <Send size={18} /> Telegram (настройте бота)
        </button>
      )}

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  )
}
