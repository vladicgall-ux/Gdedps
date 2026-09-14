import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { rateLimit } from '@/lib/rateLimit'
import { markerConfirmSchema } from '@/lib/validation'

// POST: "still here" confirmation -- pushes expires_at 3 hours into the
// future. For gas markers, the caller may also send updated fuel prices,
// which overwrite the marker's last-known prices (crowdsourced, no
// external price feed).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 })

  const limited = rateLimit(req, { key: `markers:confirm:${session.sub}`, limit: 20, windowMs: 60_000 })
  if (limited) return limited

  const rawBody = await req.json().catch(() => ({}))
  const parsed = markerConfirmSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }
  const { price92, price95, priceDt } = parsed.data

  const db = supabaseAdmin()
  const { data: marker, error: fetchError } = await db
    .from('dps_markers')
    .select('id, source, confirmations_count')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!marker) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const update: Record<string, unknown> = {
    confirmations_count: marker.confirmations_count + 1
  }
  // Permanent stations seeded from OSM never expire -- confirming one is
  // just a "still open" signal, not a lifecycle reset.
  if (marker.source !== 'osm') {
    update.expires_at = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
  }
  if (price92 !== undefined) update.price_92 = price92
  if (price95 !== undefined) update.price_95 = price95
  if (priceDt !== undefined) update.price_dt = priceDt

  const { data, error } = await db.from('dps_markers').update(update).eq('id', params.id).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    marker: {
      expires_at: data.expires_at,
      confirmations_count: data.confirmations_count,
      price92: data.price_92,
      price95: data.price_95,
      priceDt: data.price_dt
    }
  })
}
