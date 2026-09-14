'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

function VkCallbackInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { refresh } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      const code = params.get('code')
      const state = params.get('state')
      const codeVerifier = sessionStorage.getItem('vk_code_verifier')
      const deviceId = sessionStorage.getItem('vk_device_id')
      const savedState = sessionStorage.getItem('vk_state')

      if (!code || !codeVerifier || !deviceId || state !== savedState) {
        setError('Некорректный ответ от VK')
        return
      }

      try {
        const res = await fetch('/api/auth/vk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            codeVerifier,
            deviceId,
            state,
            redirectUri: `${window.location.origin}/login/vk-callback`
          })
        })
        if (!res.ok) throw new Error()
        await refresh()
        router.replace('/')
      } catch {
        setError('Не удалось завершить вход через VK')
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="h-[100dvh] flex items-center justify-center px-4 text-center">
      {error ? (
        <div>
          <p className="text-red-500 mb-3">{error}</p>
          <a href="/login" className="text-brand-600 underline">
            Вернуться на страницу входа
          </a>
        </div>
      ) : (
        <p className="text-slate-400">Завершаем вход через VK...</p>
      )}
    </div>
  )
}

export default function VkCallbackPage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] flex items-center justify-center text-slate-400">Загрузка...</div>}>
      <VkCallbackInner />
    </Suspense>
  )
}
