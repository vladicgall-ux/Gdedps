'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCw } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { TelegramIcon, VkIcon, MaxIcon } from './icons/BrandIcons'

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
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [tgCode, setTgCode] = useState<string | null>(null)
  const [tgBotUsername, setTgBotUsername] = useState<string | null>(null)
  const [tgStatus, setTgStatus] = useState<'idle' | 'waiting' | 'expired'>('idle')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => stopPolling(), [])

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  async function startTelegramCodeLogin() {
    setError(null)
    setBusy('telegram')
    stopPolling()
    try {
      const res = await fetch('/api/auth/telegram/code', { method: 'POST' })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setTgCode(json.code)
      setTgBotUsername(json.botUsername)
      setTgStatus('waiting')

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/auth/telegram/code/status?code=${json.code}`, { cache: 'no-store' })
          const statusJson = await statusRes.json()
          if (statusJson.status === 'ok') {
            stopPolling()
            await refresh()
            router.push('/')
          } else if (statusJson.status === 'expired') {
            stopPolling()
            setTgStatus('expired')
          }
        } catch {
          // transient network hiccup -- next poll will retry
        }
      }, 2000)
    } catch {
      setError('Не удалось создать код входа')
    } finally {
      setBusy(null)
    }
  }

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
      {tgStatus === 'idle' && (
        <button
          onClick={startTelegramCodeLogin}
          disabled={busy === 'telegram'}
          className="w-full flex items-center justify-center gap-2 rounded-full bg-[#26A5E4] text-white font-medium py-3 disabled:opacity-60"
        >
          <TelegramIcon size={18} /> Войти через Telegram
        </button>
      )}

      {tgStatus === 'waiting' && tgCode && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Отправьте этот код боту в Telegram</p>
          <p className="text-3xl font-bold tracking-[0.2em]">{tgCode}</p>
          <a
            href={`https://t.me/${tgBotUsername}?start=${tgCode}`}
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-full bg-[#26A5E4] text-white font-medium py-3"
          >
            Открыть бота и отправить код
          </a>
          <p className="text-xs text-slate-400">Код действует 5 минут. Страница обновится сама после подтверждения.</p>
        </div>
      )}

      {tgStatus === 'expired' && (
        <div className="rounded-2xl border border-red-200 dark:border-red-900 p-4 text-center space-y-2">
          <p className="text-sm text-red-500">Код истёк или уже использован</p>
          <button
            onClick={startTelegramCodeLogin}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600"
          >
            <RotateCw size={14} /> Получить новый код
          </button>
        </div>
      )}

      <button
        onClick={loginWithVk}
        disabled={busy === 'vk'}
        className="w-full flex items-center justify-center gap-2 rounded-full bg-[#0077FF] text-white font-medium py-3 disabled:opacity-60"
      >
        <VkIcon size={18} /> Войти через VK
      </button>

      <button
        onClick={loginWithMax}
        disabled={busy === 'max'}
        className="w-full flex items-center justify-center gap-2 rounded-full bg-slate-800 text-white font-medium py-3 disabled:opacity-60"
      >
        <MaxIcon size={18} /> Войти через MAX
      </button>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  )
}
