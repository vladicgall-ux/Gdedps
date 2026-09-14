import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

// Called by Vercel Cron (see vercel.json) every 15 minutes. Deletes markers
// whose 2-hour window (or latest confirmation) has expired. The map already
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
  const { data, error } = await db
    .from('dps_markers')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: data?.length ?? 0 })
}
