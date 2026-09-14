import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { rateLimit } from '@/lib/rateLimit'
import { commentCreateSchema } from '@/lib/validation'

// POST: add a comment to a marker. Requires auth.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 })

  const limited = rateLimit(req, { key: `comments:create:${session.sub}`, limit: 20, windowMs: 60_000 })
  if (limited) return limited

  const parsed = commentCreateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('dps_marker_comments')
    .insert({ marker_id: params.id, author_id: session.sub, body: parsed.data.body })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: { ...data, author_name: session.name } }, { status: 201 })
}
