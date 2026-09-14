'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Crosshair, Siren, LogIn, ShieldCheck } from 'lucide-react'
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
      attributionControl: true
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

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

  async function addDpsMarker() {
    if (!user) {
      showToast('Войдите, чтобы добавить метку')
      return
    }
    if (!userPos) {
      showToast('Нет данных о вашем местоположении')
      return
    }
    setAdding(true)
    try {
      const res = await fetch('/api/markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: userPos[0], lng: userPos[1] })
      })
      if (!res.ok) throw new Error()
      showToast('Метка добавлена')
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

      <header className="absolute top-0 inset-x-0 z-[500] flex items-center justify-between px-4 pt-safe-top pt-3 pb-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1.5 shadow">
          <Siren size={18} className="text-brand-600" />
          <span className="font-semibold text-sm">Где ДПС?</span>
        </div>
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
      </header>

      <button
        onClick={centerOnUser}
        className="absolute right-3 z-[500] bottom-[calc(env(safe-area-inset-bottom)+92px)] rounded-full bg-white dark:bg-slate-900 shadow p-3"
        aria-label="Моё местоположение"
      >
        <Crosshair size={20} />
      </button>

      <div className="absolute inset-x-0 bottom-0 z-[500] px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-6 pointer-events-none bg-gradient-to-t from-white/90 dark:from-slate-950/90 to-transparent">
        <button
          onClick={addDpsMarker}
          disabled={adding}
          className="pointer-events-auto w-full flex items-center justify-center gap-2 rounded-full bg-red-600 text-white font-semibold py-3.5 shadow-lg active:scale-[0.98] transition disabled:opacity-60"
        >
          <Siren size={20} />
          {adding ? 'Добавляем...' : 'Добавить метку ДПС'}
        </button>
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
