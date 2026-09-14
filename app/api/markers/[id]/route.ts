import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { rateLimit } from '@/lib/rateLimit'

// DELETE: admin-only, instantly removes a marker from the map.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const limited = rateLimit(req, { key: `markers:delete:${session.sub}`, limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const db = supabaseAdmin()
  const { error } = await db.from('dps_markers').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
