'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Siren } from 'lucide-react'
import { LoginButtons } from '@/components/LoginButtons'
import { useAuth } from '@/components/AuthProvider'
import { detectPlatform } from '@/lib/platform'

export default function LoginPage() {
  const router = useRouter()
  const { user, refresh } = useAuth()
  const [autoStatus, setAutoStatus] = useState<'checking' | 'manual' | 'failed'>('checking')

  useEffect(() => {
    if (user) {
      router.replace('/')
      return
    }

    const platform = detectPlatform()

    async function autoLoginTelegram() {
      const initData = window.Telegram?.WebApp?.initData
      if (!initData) return false
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
      })
      if (!res.ok) return false
      await refresh()
      router.replace('/')
      return true
    }

    async function autoLoginVk() {
      if (!window.location.search.includes('vk_user_id')) return false
      const res = await fetch('/api/auth/vk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchParams: window.location.search })
      })
      if (!res.ok) return false
      await refresh()
      router.replace('/')
      return true
    }

    async function run() {
      try {
        window.Telegram?.WebApp?.ready?.()
        if (platform === 'telegram' && (await autoLoginTelegram())) return
        if (platform === 'vk' && (await autoLoginVk())) return
      } catch {
        // fall through to manual login
      }
      setAutoStatus('manual')
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (autoStatus === 'checking') {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-slate-400">Проверяем платформу...</div>
    )
  }

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center px-6 pb-safe-bottom">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="rounded-full bg-brand-600 text-white p-4">
          <Siren size={32} />
        </div>
        <h1 className="text-2xl font-bold">Где ДПС?</h1>
        <p className="text-slate-500 text-center max-w-xs">
          Войдите, чтобы отмечать посты ДПС и видеть карту в реальном времени
        </p>
      </div>

      <div className="w-full max-w-sm">
        <LoginButtons />
      </div>

      <a href="/" className="mt-6 text-sm text-slate-400 underline">
        Смотреть карту без входа
      </a>
    </div>
  )
}
