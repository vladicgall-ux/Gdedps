'use client'

import { useState } from 'react'
import { X, Send, ShieldAlert, RefreshCcw, Clock } from 'lucide-react'
import type { DpsMarker } from '@/lib/types'
import { useAuth } from './AuthProvider'

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.max(0, Math.round(diffMs / 60000))
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  return `${hours} ч ${mins % 60} мин назад`
}

function timeLeft(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now()
  if (diffMs <= 0) return 'скоро исчезнет'
  const mins = Math.round(diffMs / 60000)
  const hours = Math.floor(mins / 60)
  return `исчезнет через ${hours} ч ${mins % 60} мин`
}

export function MarkerModal({
  marker,
  onClose,
  onChanged
}: {
  marker: DpsMarker
  onClose: () => void
  onChanged: (updated: DpsMarker | null) => void
}) {
  const { user } = useAuth()
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitComment() {
    if (!comment.trim()) return
    if (!user) {
      setError('Войдите, чтобы оставить комментарий')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/markers/${marker.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: comment.trim() })
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      onChanged({ ...marker, comments: [...(marker.comments ?? []), json.comment] })
      setComment('')
    } catch {
      setError('Не удалось отправить комментарий')
    } finally {
      setBusy(false)
    }
  }

  async function confirmStillHere() {
    if (!user) {
      setError('Войдите, чтобы подтвердить')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/markers/${marker.id}/confirm`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const json = await res.json()
      onChanged({ ...marker, expires_at: json.marker.expires_at, confirmations_count: json.marker.confirmations_count })
    } catch {
      setError('Не удалось подтвердить')
    } finally {
      setBusy(false)
    }
  }

  async function adminDelete() {
    if (!confirm('Удалить эту метку?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/markers/${marker.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onChanged(null)
      onClose()
    } catch {
      setError('Не удалось удалить метку')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-xl max-h-[85vh] flex flex-col pb-safe-bottom">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold">{marker.kind === 'gas' ? 'Заправка' : 'Пост ДПС'}</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2 border-b border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300">
          <p>
            Добавил: <span className="font-medium text-slate-900 dark:text-slate-100">{marker.author_name ?? 'Аноним'}</span>{' '}
            · {timeAgo(marker.created_at)}
          </p>
          {marker.note && <p className="text-slate-800 dark:text-slate-200">{marker.note}</p>}
          <p className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <Clock size={14} /> {timeLeft(marker.expires_at)}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {(marker.comments ?? []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">Пока нет комментариев</p>
          )}
          {(marker.comments ?? []).map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-medium">{c.author_name ?? 'Аноним'}</span>{' '}
              <span className="text-slate-400 text-xs">{timeAgo(c.created_at)}</span>
              <p className="text-slate-700 dark:text-slate-200">{c.body}</p>
            </div>
          ))}
        </div>

        {error && <p className="px-4 text-sm text-red-500">{error}</p>}

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Написать комментарий..."
              className="flex-1 rounded-full border border-slate-300 dark:border-slate-700 bg-transparent px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              maxLength={500}
              onKeyDown={(e) => e.key === 'Enter' && submitComment()}
            />
            <button
              disabled={busy}
              onClick={submitComment}
              className="rounded-full bg-brand-600 text-white p-2.5 disabled:opacity-50"
              aria-label="Отправить"
            >
              <Send size={18} />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={confirmStillHere}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 text-white text-sm font-medium py-2.5 disabled:opacity-50"
            >
              <RefreshCcw size={16} /> Всё ещё там
            </button>
            {user?.role === 'admin' && (
              <button
                disabled={busy}
                onClick={adminDelete}
                className="flex items-center justify-center gap-1.5 rounded-full bg-red-600 text-white text-sm font-medium px-4 py-2.5 disabled:opacity-50"
              >
                <ShieldAlert size={16} /> Удалить
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
