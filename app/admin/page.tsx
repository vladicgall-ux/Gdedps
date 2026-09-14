'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Activity, MapPin, Fuel, Trash2, ShieldCheck, ShieldOff, ChevronDown } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import type { DpsMarker, AppUser } from '@/lib/types'

interface Stats {
  totalUsers: number
  activeUsers24h: number
  activeDpsMarkers: number
  activeGasMarkers: number
  byPlatform: Record<string, number>
}

const platformLabels: Record<string, string> = {
  telegram: 'Telegram',
  max: 'MAX',
  web: 'Веб'
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [dpsMarkers, setDpsMarkers] = useState<DpsMarker[]>([])
  const [gasMarkers, setGasMarkers] = useState<DpsMarker[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !user) return
    if (user.role !== 'admin') {
      setError('Доступ только для администраторов')
      return
    }
    async function load() {
      const [statsRes, dpsRes, gasRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/markers?kind=dps'),
        fetch('/api/markers?kind=gas'),
        fetch('/api/admin/users')
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (dpsRes.ok) setDpsMarkers((await dpsRes.json()).markers ?? [])
      if (gasRes.ok) setGasMarkers((await gasRes.json()).markers ?? [])
      if (usersRes.ok) setUsers((await usersRes.json()).users ?? [])
    }
    load()
  }, [loading, user])

  async function deleteMarker(id: string, kind: 'dps' | 'gas') {
    if (!confirm('Удалить метку?')) return
    const res = await fetch(`/api/markers/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    const setter = kind === 'dps' ? setDpsMarkers : setGasMarkers
    setter((prev) => prev.filter((m) => m.id !== id))
  }

  async function toggleRole(target: AppUser) {
    const nextRole = target.role === 'admin' ? 'user' : 'admin'
    if (target.role === 'admin' && target.id === user?.id) {
      alert('Нельзя снять права администратора с самого себя')
      return
    }
    if (
      !confirm(
        nextRole === 'admin'
          ? `Сделать «${target.display_name ?? 'без имени'}» админом?`
          : `Убрать права админа у «${target.display_name ?? 'без имени'}»?`
      )
    ) {
      return
    }
    setBusyUserId(target.id)
    try {
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole })
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setUsers((prev) => prev.map((u) => (u.id === target.id ? json.user : u)))
    } catch {
      alert('Не удалось изменить роль')
    } finally {
      setBusyUserId(null)
    }
  }

  if (loading) return <div className="p-6 text-slate-400">Загрузка...</div>
  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500 mb-3">{error}</p>
        <Link href="/" className="text-brand-600 underline">
          На карту
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] pb-safe-bottom pt-safe-top">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold">Админ-панель</h1>
      </header>

      <div className="p-4 space-y-6 max-w-3xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<Users size={18} />} label="Всего пользователей" value={stats?.totalUsers ?? '—'} />
          <StatCard icon={<Activity size={18} />} label="Активны за 24ч" value={stats?.activeUsers24h ?? '—'} />
          <StatCard icon={<MapPin size={18} />} label="Активных меток ДПС" value={stats?.activeDpsMarkers ?? '—'} />
          <StatCard icon={<Fuel size={18} />} label="Активных заправок" value={stats?.activeGasMarkers ?? '—'} />
        </div>

        {stats && (
          <div>
            <h2 className="font-semibold mb-2">По платформам</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(stats.byPlatform).map(([platform, count]) => (
                <div
                  key={platform}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-center"
                >
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-slate-500">{platformLabels[platform] ?? platform}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Collapsible title={`Пользователи (${users.length})`} defaultOpen>
          <div className="space-y-2">
            {users.length === 0 && <p className="text-sm text-slate-400">Пока никто не заходил</p>}
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">
                    {u.display_name ?? 'Без имени'}
                    {u.role === 'admin' && (
                      <span className="text-[10px] uppercase tracking-wide bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200 rounded-full px-1.5 py-0.5">
                        Админ
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {platformLabels[u.platform] ?? u.platform}
                    {u.phone ? ` · ${u.phone}` : ''} · был(а) {new Date(u.last_seen_at).toLocaleString('ru-RU')}
                  </p>
                </div>
                <button
                  onClick={() => toggleRole(u)}
                  disabled={busyUserId === u.id}
                  className={`shrink-0 flex items-center gap-1 rounded-full text-xs font-medium px-3 py-2 disabled:opacity-60 ${
                    u.role === 'admin'
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : 'bg-brand-600 text-white'
                  }`}
                >
                  {u.role === 'admin' ? (
                    <>
                      <ShieldOff size={14} /> Снять админа
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} /> Сделать админом
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </Collapsible>

        <Collapsible title={`Активные метки ДПС (${dpsMarkers.length})`} defaultOpen>
          <MarkerList markers={dpsMarkers} onDelete={(id) => deleteMarker(id, 'dps')} emptyText="Сейчас нет активных меток" />
        </Collapsible>

        <Collapsible title={`Активные заправки (${gasMarkers.length})`} defaultOpen>
          <MarkerList markers={gasMarkers} onDelete={(id) => deleteMarker(id, 'gas')} emptyText="Сейчас нет отмеченных заправок" />
        </Collapsible>
      </div>
    </div>
  )
}

function MarkerList({
  markers,
  onDelete,
  emptyText
}: {
  markers: DpsMarker[]
  onDelete: (id: string) => void
  emptyText: string
}) {
  return (
    <div className="space-y-2">
      {markers.length === 0 && <p className="text-sm text-slate-400">{emptyText}</p>}
      {markers.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{m.author_name ?? 'Аноним'}</p>
            <p className="text-xs text-slate-500">
              {m.lat.toFixed(4)}, {m.lng.toFixed(4)} · {new Date(m.created_at).toLocaleString('ru-RU')}
            </p>
          </div>
          <button
            onClick={() => onDelete(m.id)}
            className="shrink-0 flex items-center gap-1 rounded-full bg-red-600 text-white text-xs font-medium px-3 py-2"
          >
            <Trash2 size={14} /> Удалить
          </button>
        </div>
      ))}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center gap-2 text-brand-600 mb-1">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function Collapsible({
  title,
  defaultOpen = false,
  children
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 mb-2">
        <h2 className="font-semibold">{title}</h2>
        <ChevronDown size={18} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && children}
    </div>
  )
}
