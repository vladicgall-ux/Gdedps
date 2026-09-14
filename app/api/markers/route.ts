import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { rateLimit } from '@/lib/rateLimit'
import { markerCreateSchema, markerKindQuerySchema } from '@/lib/validation'

// GET: all currently-active markers of one kind (not yet expired), with
// their comments. ?kind=dps (default) or ?kind=gas.
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { key: 'markers:list', limit: 60, windowMs: 60_000 })
  if (limited) return limited

  const kindParsed = markerKindQuerySchema.safeParse(req.nextUrl.searchParams.get('kind') ?? undefined)
  if (!kindParsed.success) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 })
  }
  const kind = kindParsed.data

  const db = supabaseAdmin()
  const nowIso = new Date().toISOString()

  const { data: markers, error } = await db
    .from('dps_markers')
    .select('*, app_users!dps_markers_author_id_fkey(display_name)')
    .eq('kind', kind)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const markerIds = (markers ?? []).map((m) => m.id)
  let commentsByMarker = new Map<string, unknown[]>()

  if (markerIds.length > 0) {
    const { data: comments } = await db
      .from('dps_marker_comments')
      .select('*, app_users!dps_marker_comments_author_id_fkey(display_name)')
      .in('marker_id', markerIds)
      .order('created_at', { ascending: true })

    commentsByMarker = new Map()
    for (const c of comments ?? []) {
      const list = commentsByMarker.get(c.marker_id) ?? []
      list.push({
        id: c.id,
        marker_id: c.marker_id,
        author_id: c.author_id,
        body: c.body,
        created_at: c.created_at,
        author_name: (c as any).app_users?.display_name ?? null
      })
      commentsByMarker.set(c.marker_id, list)
    }
  }

  const result = (markers ?? []).map((m) => ({
    id: m.id,
    author_id: m.author_id,
    kind: m.kind,
    source: m.source,
    lat: m.lat,
    lng: m.lng,
    note: m.note,
    price92: m.price_92,
    price95: m.price_95,
    priceDt: m.price_dt,
    created_at: m.created_at,
    expires_at: m.expires_at,
    confirmations_count: m.confirmations_count,
    author_name: (m as any).app_users?.display_name ?? null,
    comments: commentsByMarker.get(m.id) ?? []
  }))

  return NextResponse.json({ markers: result })
}

// POST: create a new marker (DPS post or gas station) at the caller's
// location. Requires auth.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 })

  const limited = rateLimit(req, { key: `markers:create:${session.sub}`, limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const parsed = markerCreateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }
  const { lat, lng, kind, note, price92, price95, priceDt } = parsed.data

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('dps_markers')
    .insert({
      author_id: session.sub,
      kind,
      lat,
      lng,
      note: note ?? null,
      price_92: price92 ?? null,
      price_95: price95 ?? null,
      price_dt: priceDt ?? null
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ marker: data }, { status: 201 })
}
