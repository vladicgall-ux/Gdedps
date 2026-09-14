import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

// POST: add a comment to a marker. Requires auth.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 })

  const body = await req.json()
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (!text || text.length > 500) {
    return NextResponse.json({ error: 'invalid_comment' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('dps_marker_comments')
    .insert({ marker_id: params.id, author_id: session.sub, body: text })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: { ...data, author_name: session.name } }, { status: 201 })
}
