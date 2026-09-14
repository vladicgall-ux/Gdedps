import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { rateLimit } from '@/lib/rateLimit'

// POST: "still here" confirmation -- pushes expires_at 2 hours into the future.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 })

  const limited = rateLimit(req, { key: `markers:confirm:${session.sub}`, limit: 20, windowMs: 60_000 })
  if (limited) return limited

  const db = supabaseAdmin()
  const { data: marker, error: fetchError } = await db
    .from('dps_markers')
    .select('id, confirmations_count')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!marker) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const newExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const { data, error } = await db
    .from('dps_markers')
    .update({ expires_at: newExpiry, confirmations_count: marker.confirmations_count + 1 })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ marker: data })
}
