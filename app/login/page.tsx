'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoginButtons } from '@/components/LoginButtons'
import { useAuth } from '@/components/AuthProvider'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (user) router.replace('/')
  }, [user, router])

  if (loading || user) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-slate-400">Проверяем платформу...</div>
    )
  }

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center px-6 pb-safe-bottom">
      <div className="mb-8 flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dps-marker.png" alt="Где ДПС?" className="w-20 h-20 drop-shadow-lg" />
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
