import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

// Called by Vercel Cron (see vercel.json) every 15 minutes. Deletes markers
// whose 3-hour window (or latest confirmation) has expired. The map already
// filters expired markers client-side, so this just keeps the table tidy.
//
// Security: CRON_SECRET is mandatory. Without it configured, this endpoint
// refuses every request instead of silently running unauthenticated -- an
// unset secret must never mean "open to anyone".
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const nowIso = new Date().toISOString()

  const [markers, loginCodes] = await Promise.all([
    db.from('dps_markers').delete().lt('expires_at', nowIso).select('id'),
    db.from('telegram_login_codes').delete().lt('expires_at', nowIso).select('code')
  ])

  if (markers.error) return NextResponse.json({ error: markers.error.message }, { status: 500 })
  if (loginCodes.error) return NextResponse.json({ error: loginCodes.error.message }, { status: 500 })

  return NextResponse.json({
    deletedMarkers: markers.data?.length ?? 0,
    deletedLoginCodes: loginCodes.data?.length ?? 0
  })
}
