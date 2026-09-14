import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const db = supabaseAdmin()
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const nowIso = new Date().toISOString()

  const [{ count: totalUsers }, { count: activeUsers }, { data: users }, { count: activeDpsMarkers }, { count: activeGasMarkers }] =
    await Promise.all([
      db.from('app_users').select('*', { count: 'exact', head: true }),
      db.from('app_users').select('*', { count: 'exact', head: true }).gt('last_seen_at', dayAgo),
      db.from('app_users').select('platform'),
      db.from('dps_markers').select('*', { count: 'exact', head: true }).eq('kind', 'dps').gt('expires_at', nowIso),
      db.from('dps_markers').select('*', { count: 'exact', head: true }).eq('kind', 'gas').gt('expires_at', nowIso)
    ])

  const byPlatform: Record<string, number> = { telegram: 0, max: 0 }
  for (const u of users ?? []) {
    byPlatform[u.platform] = (byPlatform[u.platform] ?? 0) + 1
  }

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    activeUsers24h: activeUsers ?? 0,
    activeDpsMarkers: activeDpsMarkers ?? 0,
    activeGasMarkers: activeGasMarkers ?? 0,
    byPlatform
  })
}
