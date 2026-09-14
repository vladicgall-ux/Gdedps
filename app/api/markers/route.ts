import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

// GET: all currently-active markers (not yet expired), with their comments.
export async function GET() {
  const db = supabaseAdmin()
  const nowIso = new Date().toISOString()

  const { data: markers, error } = await db
    .from('dps_markers')
    .select('*, app_users!dps_markers_author_id_fkey(display_name)')
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
    lat: m.lat,
    lng: m.lng,
    note: m.note,
    created_at: m.created_at,
    expires_at: m.expires_at,
    confirmations_count: m.confirmations_count,
    author_name: (m as any).app_users?.display_name ?? null,
    comments: commentsByMarker.get(m.id) ?? []
  }))

  return NextResponse.json({ markers: result })
}

// POST: create a new marker at the caller's location. Requires auth.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 })

  const body = await req.json()
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'invalid_coordinates' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('dps_markers')
    .insert({ author_id: session.sub, lat, lng, note })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ marker: data }, { status: 201 })
}
