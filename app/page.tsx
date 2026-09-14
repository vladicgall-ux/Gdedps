import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-[100dvh] w-full flex items-center justify-center text-slate-400">Загрузка карты...</div>
  )
})

export default function HomePage() {
  return <MapView />
}
