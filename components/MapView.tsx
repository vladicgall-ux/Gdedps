'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Crosshair, Siren, LogIn, ShieldCheck, Plus, Minus, X, Check } from 'lucide-react'
import type { DpsMarker } from '@/lib/types'
import { createDpsIcon, createUserDotIcon } from './dpsIcon'
import { MarkerModal } from './MarkerModal'
import { useAuth } from './AuthProvider'
import Link from 'next/link'

const DEFAULT_CENTER: [number, number] = [55.751244, 37.618423] // Moscow, fallback

export default function MapView() {
  const { user } = useAuth()
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const markerLayerRef = useRef<Map<string, L.Marker>>(new Map())
  const markersDataRef = useRef<Map<string, DpsMarker>>(new Map())

  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [selected, setSelected] = useState<DpsMarker | null>(null)
  const [adding, setAdding] = useState(false)
  const [picking, setPicking] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const openMarker = useCallback((id: string) => {
    const m = markersDataRef.current.get(id)
    if (m) setSelected(m)
  }, [])

  const renderMarkers = useCallback(
    (markers: DpsMarker[]) => {
      const map = mapRef.current
      if (!map) return
      const seen = new Set<string>()

      for (const m of markers) {
        markersDataRef.current.set(m.id, m)
        seen.add(m.id)
        const existing = markerLayerRef.current.get(m.id)
        if (existing) {
          existing.setLatLng([m.lat, m.lng])
        } else {
          const marker = L.marker([m.lat, m.lng], { icon: createDpsIcon() })
            .addTo(map)
            .on('click', () => openMarker(m.id))
          markerLayerRef.current.set(m.id, marker)
        }
      }

      for (const [id, marker] of markerLayerRef.current) {
        if (!seen.has(id)) {
          marker.remove()
          markerLayerRef.current.delete(id)
          markersDataRef.current.delete(id)
        }
      }
    },
    [openMarker]
  )

  const fetchMarkers = useCallback(async () => {
    try {
      const res = await fetch('/api/markers', { cache: 'no-store' })
      const json = await res.json()
      renderMarkers(json.markers ?? [])
    } catch {
      // network hiccup -- next poll will retry
    }
  }, [renderMarkers])

  // Init map once
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return

    const map = L.map(mapElRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      zoomControl: false,
      // Managed manually below so it doesn't share the bottom-right corner
      // with our own controls.
      attributionControl: false
    })

    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map)

    mapRef.current = map
    fetchMarkers()
    const poll = setInterval(fetchMarkers, 20000)

    return () => {
      clearInterval(poll)
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setUserPos(coords)
        const map = mapRef.current
        if (!map) return
        if (!userMarkerRef.current) {
          map.setView(coords, 15)
          userMarkerRef.current = L.marker(coords, { icon: createUserDotIcon(), zIndexOffset: 1000 }).addTo(map)
        } else {
          userMarkerRef.current.setLatLng(coords)
        }
      },
      () => showToast('Не удалось получить геолокацию'),
      { enableHighAccuracy: true, maximumAge: 10000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  function centerOnUser() {
    if (userPos && mapRef.current) {
      mapRef.current.setView(userPos, 16)
    } else {
      showToast('Определяем ваше местоположение...')
    }
  }

  function startPicking() {
    if (!user) {
      showToast('Войдите, чтобы добавить метку')
      return
    }
    if (userPos && mapRef.current) {
      mapRef.current.setView(userPos, 17)
    }
    setNoteInput('')
    setPicking(true)
  }

  async function confirmPickedLocation() {
    const map = mapRef.current
    if (!map) return
    const center = map.getCenter()
    const note = noteInput.trim()
    setAdding(true)
    try {
      const res = await fetch('/api/markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: center.lat, lng: center.lng, note: note || undefined })
      })
      if (!res.ok) throw new Error()
      showToast('Метка добавлена')
      setPicking(false)
      setNoteInput('')
      fetchMarkers()
    } catch {
      showToast('Не удалось добавить метку')
    } finally {
      setAdding(false)
    }
  }

  function handleModalChange(updated: DpsMarker | null) {
    if (!updated) {
      if (selected) {
        markerLayerRef.current.get(selected.id)?.remove()
        markerLayerRef.current.delete(selected.id)
        markersDataRef.current.delete(selected.id)
      }
      setSelected(null)
      return
    }
    markersDataRef.current.set(updated.id, updated)
    setSelected(updated)
  }

  return (
    <div className="relative h-[100dvh] w-full">
      <div id="map-root" ref={mapElRef} className="h-full w-full" />

      {picking && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
          <div className="-translate-y-1/2 flex flex-col items-center">
            <img src="/dps-marker.png" alt="" className="w-11 h-11 drop-shadow-lg" />
            <div className="w-1.5 h-1.5 rounded-full bg-black/40 -mt-1" />
          </div>
        </div>
      )}

      <header className="absolute top-0 inset-x-0 z-[500] flex items-center justify-between px-4 pt-safe-top pt-3 pb-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1.5 shadow">
          <Siren size={18} className="text-brand-600" />
          <span className="font-semibold text-sm">Где ДПС?</span>
        </div>
        {!picking && (
          <div className="pointer-events-auto flex items-center gap-2">
            {user?.role === 'admin' && (
              <Link
                href="/admin"
                className="flex items-center gap-1 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1.5 shadow text-xs font-medium"
              >
                <ShieldCheck size={16} /> Админ
              </Link>
            )}
            {!user && (
              <Link
                href="/login"
                className="flex items-center gap-1 rounded-full bg-brand-600 text-white px-3 py-1.5 shadow text-xs font-medium"
              >
                <LogIn size={16} /> Войти
              </Link>
            )}
          </div>
        )}
      </header>

      <div className="absolute right-3 z-[500] flex flex-col items-center gap-3 bottom-[calc(var(--app-safe-bottom)+104px)]">
        <div className="flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="w-12 h-12 flex items-center justify-center active:bg-slate-100 dark:active:bg-slate-800"
            aria-label="Приблизить"
          >
            <Plus size={22} />
          </button>
          <div className="h-px bg-slate-200 dark:bg-slate-700" />
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="w-12 h-12 flex items-center justify-center active:bg-slate-100 dark:active:bg-slate-800"
            aria-label="Отдалить"
          >
            <Minus size={22} />
          </button>
        </div>
        <button
          onClick={centerOnUser}
          className="w-12 h-12 rounded-full bg-white dark:bg-slate-900 shadow-lg flex items-center justify-center"
          aria-label="Моё местоположение"
        >
          <Crosshair size={22} />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[500] px-4 pb-[calc(var(--app-safe-bottom)+16px)] pt-6 pointer-events-none bg-gradient-to-t from-white/90 dark:from-slate-950/90 to-transparent">
        {picking ? (
          <div className="pointer-events-auto space-y-2">
            <input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Комментарий (необязательно): пост слева, у поворота..."
              maxLength={500}
              className="w-full rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm shadow focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPicking(false)}
                disabled={adding}
                className="flex items-center justify-center gap-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold py-3.5 px-5 shadow-lg active:scale-[0.98] transition disabled:opacity-60"
              >
                <X size={20} /> Отмена
              </button>
              <button
                onClick={confirmPickedLocation}
                disabled={adding}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-red-600 text-white font-semibold py-3.5 shadow-lg active:scale-[0.98] transition disabled:opacity-60"
              >
                <Check size={20} />
                {adding ? 'Добавляем...' : 'Поставить метку здесь'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={startPicking}
            className="pointer-events-auto w-full flex items-center justify-center gap-2 rounded-full bg-red-600 text-white font-semibold py-3.5 shadow-lg active:scale-[0.98] transition"
          >
            <Siren size={20} />
            Добавить метку ДПС
          </button>
        )}
      </div>

      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-16 z-[600] rounded-full bg-slate-900 text-white text-xs px-4 py-2 shadow">
          {toast}
        </div>
      )}

      {selected && <MarkerModal marker={selected} onClose={() => setSelected(null)} onChanged={handleModalChange} />}
    </div>
  )
}
