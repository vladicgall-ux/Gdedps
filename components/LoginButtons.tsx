'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCw, Copy, Check } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { TelegramIcon } from './icons/BrandIcons'

export function LoginButtons() {
  const { refresh } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [tgCode, setTgCode] = useState<string | null>(null)
  const [tgBotUsername, setTgBotUsername] = useState<string | null>(null)
  const [tgStatus, setTgStatus] = useState<'idle' | 'waiting' | 'expired'>('idle')
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function copyCode() {
    if (!tgCode) return
    try {
      await navigator.clipboard.writeText(tgCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable -- the code is already shown on screen
    }
  }

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
          <div className="flex items-center justify-center gap-2">
            <p className="text-3xl font-bold tracking-[0.2em]">{tgCode}</p>
            <button
              onClick={copyCode}
              aria-label="Скопировать код"
              className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {copied ? <Check size={20} className="text-emerald-600" /> : <Copy size={20} />}
            </button>
          </div>
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
        onClick={loginWithMax}
        disabled={busy === 'max'}
        className="w-full flex items-center justify-center gap-2 rounded-full bg-slate-800 text-white font-medium py-3 disabled:opacity-60"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/max-logo.png" alt="" className="w-[18px] h-[18px] rounded-[5px]" /> Войти через MAX
      </button>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  )
}
